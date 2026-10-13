// dns.js — ساخت کوئری DNS و پارس رکورد HTTPS (SVCB type 65) برای استخراج ECHConfigList (param key 5)

export function buildHttpsQuery(domain, id = 0x1234) {
  const parts = [];
  parts.push((id >> 8) & 0xff, id & 0xff); // ID
  parts.push(0x01, 0x00);                   // flags: RD
  parts.push(0x00, 0x01);                   // QDCOUNT
  parts.push(0x00, 0x00, 0x00, 0x00, 0x00, 0x00);
  for (const label of domain.split('.')) {
    const b = new TextEncoder().encode(label);
    parts.push(b.length, ...b);
  }
  parts.push(0);
  parts.push(0x00, 0x41); // type 65 = HTTPS
  parts.push(0x00, 0x01); // class IN
  return new Uint8Array(parts);
}

function readName(b, i) {
  const labels = [];
  let jumped = false;
  let end = i;
  for (let hops = 0; hops < 64; hops++) {
    const len = b[i];
    if (len === 0) { if (!jumped) end = i + 1; break; }
    if ((len & 0xc0) === 0xc0) {
      if (!jumped) end = i + 2;
      i = ((len & 0x3f) << 8) | b[i + 1];
      jumped = true;
      continue;
    }
    labels.push(new TextDecoder().decode(b.subarray(i + 1, i + 1 + len)));
    i += 1 + len;
    if (!jumped) end = i;
  }
  return { name: labels.join('.'), next: end };
}

// پاسخ DNS خام را پارس می‌کند و ECHConfigList به‌صورت base64 برمی‌گرداند؛ در غیر این صورت null
export function extractEchConfigListBase64(buf) {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  if (b.length < 12) return null;
  const ancount = (b[6] << 8) | b[7];
  let i = 12;
  const qdcount = (b[4] << 8) | b[5];
  for (let q = 0; q < qdcount; q++) {
    i = readName(b, i).next + 4;
  }
  for (let a = 0; a < ancount; a++) {
    i = readName(b, i).next;
    const type = (b[i] << 8) | b[i + 1];
    const rdlen = (b[i + 8] << 8) | b[i + 9];
    const rdStart = i + 10;
    const rdEnd = rdStart + rdlen;
    if (type === 65 && rdlen > 3) {
      let j = rdStart + 2; // SvcPriority
      j = readName(b, j).next; // TargetName
      while (j + 4 <= rdEnd) {
        const key = (b[j] << 8) | b[j + 1];
        const plen = (b[j + 2] << 8) | b[j + 3];
        j += 4;
        if (key === 5 && j + plen <= b.length) {
          return bytesToBase64(b.subarray(j, j + plen));
        }
        j += plen;
      }
    }
    i = rdEnd;
  }
  return null;
}

export function bytesToBase64(bytes) {
  let bin = '';
  for (const x of bytes) bin += String.fromCharCode(x);
  return btoa(bin);
}
