// update.mjs — بازنویسی اشتراک v2ray با ECH تازه و نوشتن در subscription.txt
// توسط GitHub Action هر چند ساعت اجرا می‌شود. ECH از DoH کلادفلر (بدون سانسور) گرفته می‌شود.
import { writeFileSync } from 'node:fs';
import { buildHttpsQuery, extractEchConfigListBase64 } from './src/dns.js';

const SUB_URL = process.env.SUB_URL || 'https://raw.githubusercontent.com/patterniha/Free-Configs/main/configs.txt';
const OUT = process.env.OUT || 'subscription.txt';

// DoH (روی GitHub Actions کار می‌کند)
async function echViaDoh() {
  const resp = await fetch('https://cloudflare-dns.com/dns-query', {
    method: 'POST',
    headers: {
      'content-type': 'application/dns-message',
      accept: 'application/dns-message',
    },
    body: buildHttpsQuery('cloudflare-ech.com'),
  });
  if (!resp.ok) throw new Error(`DoH status ${resp.status}`);
  const wire = new Uint8Array(await resp.arrayBuffer());
  return extractEchConfigListBase64(wire);
}

// fallback: DNS-over-TCP (وقتی DoH از شبکه محلی مسدود است)
function echViaTcp() {
  return new Promise((resolve, reject) => {
    import('node:net').then(({ default: net }) => {
      const query = buildHttpsQuery('cloudflare-ech.com');
      const len = Buffer.alloc(2);
      len.writeUInt16BE(query.length);
      const sock = net.connect(53, '1.1.1.1');
      const chunks = [];
      const timer = setTimeout(() => { sock.destroy(); reject(new Error('DNS-TCP timeout')); }, 6000);
      sock.on('connect', () => sock.write(Buffer.concat([len, Buffer.from(query)])));
      sock.on('data', (d) => {
        chunks.push(d);
        const total = Buffer.concat(chunks);
        if (total.length >= 2 && total.length >= 2 + total.readUInt16BE(0)) {
          clearTimeout(timer);
          sock.end();
          resolve(extractEchConfigListBase64(total.subarray(2, 2 + total.readUInt16BE(0))));
        }
      });
      sock.on('error', (e) => { clearTimeout(timer); reject(e); });
    }).catch(reject);
  });
}

async function fetchEchBase64() {
  let b64 = null;
  try {
    b64 = await echViaDoh();
  } catch (err) {
    console.warn(`DoH failed (${err.message}); falling back to DNS-over-TCP`);
  }
  if (!b64) b64 = await echViaTcp();
  if (!b64) throw new Error('ECH param not found in HTTPS record');
  return b64;
}

export function rewriteSubscription(text, echB64) {
  const enc = encodeURIComponent(echB64);
  return text
    .split(/\r?\n/)
    .map((line) =>
      /^(vless|trojan|ss|vmess):\/\//.test(line)
        ? line.replace(/ech=[^&#]*/g, `ech=${enc}`)
        : line
    )
    .join('\n');
}

const [subResp, echB64] = await Promise.all([
  fetch(SUB_URL, { headers: { accept: 'text/plain,*/*' } }),
  fetchEchBase64(),
]);
if (!subResp.ok) throw new Error(`upstream ${subResp.status}`);
const sub = await subResp.text();
const out = rewriteSubscription(sub, echB64);

const lines = out.split(/\r?\n/);
const configs = lines.filter((l) => /^(vless|trojan|ss|vmess):\/\//.test(l)).length;
const withEch = lines.filter((l) => /^(vless|trojan):\/\//.test(l) && /ech=[A-Za-z0-9%+/=]{40,}/.test(l)).length;
const leftover = lines.filter((l) => l.includes('ech=cloudflare-ech.com')).length;
if (configs === 0) throw new Error('no configs parsed from upstream');
if (withEch === 0) throw new Error('no ech configs rewritten');
if (leftover > 0) throw new Error(`${leftover} leftover old ech params`);

writeFileSync(OUT, out);
console.log(`OK: ${configs} configs, ${withEch} ech rewritten, leftover=${leftover}, ech=${echB64.slice(0, 32)}...`);
