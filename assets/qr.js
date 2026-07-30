/* ============================================================
   BoxIQ QR encoder — no dependencies, no CDN, works offline.
   Byte mode, error correction level M, versions 1-10 (up to 213
   bytes), which covers every BoxIQ URL with room to spare.

   BoxIQQR.svgPath("https://…") -> { size, path }
     size  modules across, including the 4-module quiet zone
     path  an SVG path string, one square per dark module
   ============================================================ */
(function(global){
'use strict';

/* ---------- GF(256) arithmetic ---------- */
function mul(a, b){
  let z = 0;
  for(let i = 7; i >= 0; i--){
    z = ((z << 1) ^ ((z >>> 7) * 0x11D)) & 0xFF;
    z ^= ((b >>> i) & 1) * a;
  }
  return z;
}

/* ---------- Reed-Solomon ---------- */
function rsDivisor(degree){
  const result = new Uint8Array(degree);
  result[degree - 1] = 1;
  let root = 1;
  for(let i = 0; i < degree; i++){
    for(let j = 0; j < degree; j++){
      result[j] = mul(result[j], root);
      if(j + 1 < degree) result[j] ^= result[j + 1];
    }
    root = mul(root, 0x02);
  }
  return result;
}
function rsRemainder(data, divisor){
  const result = new Uint8Array(divisor.length);
  for(const b of data){
    const factor = b ^ result[0];
    result.copyWithin(0, 1);
    result[result.length - 1] = 0;
    for(let i = 0; i < result.length; i++) result[i] ^= mul(divisor[i], factor);
  }
  return result;
}

/* ---------- capacity tables, error correction level M ---------- */
const ECC_PER_BLOCK = [null,10,16,26,18,24,16,18,22,22,26];
const NUM_BLOCKS    = [null, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
const MAX_VERSION   = 10;

function rawDataModules(ver){
  let result = (16 * ver + 128) * ver + 64;
  if(ver >= 2){
    const numAlign = Math.floor(ver / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if(ver >= 7) result -= 36;
  }
  return result;
}
const dataCodewords = ver =>
  Math.floor(rawDataModules(ver) / 8) - ECC_PER_BLOCK[ver] * NUM_BLOCKS[ver];

function alignPositions(ver){
  if(ver === 1) return [];
  const numAlign = Math.floor(ver / 7) + 2;
  const step = Math.ceil((ver * 4 + 4) / (numAlign * 2 - 2)) * 2;
  const size = ver * 4 + 17;
  const result = [6];
  for(let pos = size - 7; result.length < numAlign; pos -= step) result.splice(1, 0, pos);
  return result;
}

/* ---------- bit assembly ---------- */
function encode(text){
  const bytes = new TextEncoder().encode(text);
  let ver = 0;
  for(let v = 1; v <= MAX_VERSION; v++){
    const cci = v < 10 ? 8 : 16;
    if(4 + cci + bytes.length * 8 <= dataCodewords(v) * 8){ ver = v; break; }
  }
  if(!ver) throw new Error('too much data for a version 10 QR code');

  const bits = [];
  const push = (val, len) => { for(let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  push(0b0100, 4);                          // byte mode
  push(bytes.length, ver < 10 ? 8 : 16);    // character count
  for(const b of bytes) push(b, 8);

  const capacity = dataCodewords(ver) * 8;
  push(0, Math.min(4, capacity - bits.length));           // terminator
  push(0, (8 - bits.length % 8) % 8);                     // pad to a byte
  for(let pad = 0xEC; bits.length < capacity; pad ^= 0xEC ^ 0x11) push(pad, 8);

  const data = new Uint8Array(bits.length / 8);
  bits.forEach((bit, i) => { if(bit) data[i >>> 3] |= 0x80 >>> (i & 7); });
  return { ver, data };
}

/* ---------- interleave data and error correction blocks ---------- */
function addEcc(data, ver){
  const numBlocks = NUM_BLOCKS[ver], eccLen = ECC_PER_BLOCK[ver];
  const rawCodewords = Math.floor(rawDataModules(ver) / 8);
  const numShort = numBlocks - rawCodewords % numBlocks;
  const shortLen = Math.floor(rawCodewords / numBlocks);
  const divisor = rsDivisor(eccLen);

  const blocks = [];
  for(let i = 0, k = 0; i < numBlocks; i++){
    const len = shortLen - eccLen + (i < numShort ? 0 : 1);
    const dat = data.slice(k, k + len); k += len;
    blocks.push({ dat, ecc: rsRemainder(dat, divisor) });
  }
  const out = [];
  for(let i = 0; i < shortLen - eccLen + 1; i++)
    blocks.forEach((b, j) => { if(i < b.dat.length) out.push(b.dat[i]); });
  for(let i = 0; i < eccLen; i++) blocks.forEach(b => out.push(b.ecc[i]));
  return new Uint8Array(out);
}

/* ---------- module placement ---------- */
function buildMatrix(ver, codewords){
  const size = ver * 4 + 17;
  const m = Array.from({length: size}, () => new Int8Array(size).fill(-1)); // -1 = free
  const set = (x, y, dark) => { if(x >= 0 && x < size && y >= 0 && y < size) m[y][x] = dark ? 1 : 0; };

  const finder = (cx, cy) => {
    for(let dy = -4; dy <= 4; dy++) for(let dx = -4; dx <= 4; dx++){
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      set(cx + dx, cy + dy, d !== 2 && d !== 4);
    }
  };
  finder(3, 3); finder(size - 4, 3); finder(3, size - 4);

  for(let i = 8; i < size - 8; i++){ set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }

  const aligns = alignPositions(ver);
  aligns.forEach((cx, i) => aligns.forEach((cy, j) => {
    if((i === 0 && j === 0) || (i === 0 && j === aligns.length - 1) ||
       (i === aligns.length - 1 && j === 0)) return;
    for(let dy = -2; dy <= 2; dy++) for(let dx = -2; dx <= 2; dx++)
      set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }));

  // reserve the format areas (filled in after masking). Index 6 is skipped:
  // the format info steps over the timing patterns rather than overwriting them.
  for(let i = 0; i <= 8; i++){ if(i !== 6){ set(i, 8, false); set(8, i, false); } }
  for(let i = 0; i < 8; i++){ set(size - 1 - i, 8, false); set(8, size - 1 - i, false); }
  set(8, size - 8, true); // dark module

  if(ver >= 7){
    let rem = ver;
    for(let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
    const bitsVal = ver << 12 | rem;
    for(let i = 0; i < 18; i++){
      const bit = ((bitsVal >>> i) & 1) === 1, a = size - 11 + i % 3, b = Math.floor(i / 3);
      set(a, b, bit); set(b, a, bit);
    }
  }

  // zigzag data placement
  let i = 0;
  for(let right = size - 1; right >= 1; right -= 2){
    if(right === 6) right = 5;
    for(let vert = 0; vert < size; vert++){
      for(let j = 0; j < 2; j++){
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if(m[y][x] === -1 && i < codewords.length * 8){
          m[y][x] = ((codewords[i >>> 3] >>> (7 - (i & 7))) & 1) ? 1 : 0;
          i++;
        }
      }
    }
  }
  // the few remainder modules a version leaves over are light
  for(let y = 0; y < size; y++) for(let x = 0; x < size; x++) if(m[y][x] === -1) m[y][x] = 0;
  return m;
}

function isFunctionModule(ver, size, x, y){
  const aligns = alignPositions(ver);
  if(x <= 8 && y <= 8) return true;
  if(x >= size - 8 && y <= 8) return true;
  if(x <= 8 && y >= size - 8) return true;
  if(x === 6 || y === 6) return true;
  if(ver >= 7 && ((x >= size - 11 && y <= 5) || (y >= size - 11 && x <= 5))) return true;
  for(const cx of aligns) for(const cy of aligns){
    if((cx === 6 && cy === 6) || (cx === 6 && cy === aligns[aligns.length-1]) ||
       (cx === aligns[aligns.length-1] && cy === 6)) continue;
    if(Math.abs(x - cx) <= 2 && Math.abs(y - cy) <= 2) return true;
  }
  return false;
}

function applyMask(m, ver, mask){
  const size = m.length;
  for(let y = 0; y < size; y++) for(let x = 0; x < size; x++){
    if(isFunctionModule(ver, size, x, y)) continue;
    let invert;
    switch(mask){
      case 0: invert = (x + y) % 2 === 0; break;
      case 1: invert = y % 2 === 0; break;
      case 2: invert = x % 3 === 0; break;
      case 3: invert = (x + y) % 3 === 0; break;
      case 4: invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
      case 5: invert = x * y % 2 + x * y % 3 === 0; break;
      case 6: invert = (x * y % 2 + x * y % 3) % 2 === 0; break;
      case 7: invert = ((x + y) % 2 + x * y % 3) % 2 === 0; break;
    }
    if(invert) m[y][x] ^= 1;
  }
}

function drawFormat(m, mask){
  const size = m.length;
  const data = 0b00 << 3 | mask;            // 00 = error correction level M
  let rem = data;
  for(let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const bits = ((data << 10) | rem) ^ 0x5412;
  const get = i => ((bits >>> i) & 1) === 1 ? 1 : 0;

  for(let i = 0; i <= 5; i++) m[i][8] = get(i);
  m[7][8] = get(6); m[8][8] = get(7); m[8][7] = get(8);
  for(let i = 9; i < 15; i++) m[8][14 - i] = get(i);

  for(let i = 0; i < 8; i++) m[8][size - 1 - i] = get(i);
  for(let i = 8; i < 15; i++) m[size - 15 + i][8] = get(i);
  m[size - 8][8] = 1;
}

/* ---------- mask scoring ---------- */
function penalty(m){
  const size = m.length;
  let score = 0;
  const runScore = run => run >= 5 ? 3 + (run - 5) : 0;

  for(let y = 0; y < size; y++){
    let run = 1;
    for(let x = 1; x < size; x++){
      if(m[y][x] === m[y][x-1]) run++;
      else { score += runScore(run); run = 1; }
    }
    score += runScore(run);
  }
  for(let x = 0; x < size; x++){
    let run = 1;
    for(let y = 1; y < size; y++){
      if(m[y][x] === m[y-1][x]) run++;
      else { score += runScore(run); run = 1; }
    }
    score += runScore(run);
  }
  for(let y = 0; y < size - 1; y++) for(let x = 0; x < size - 1; x++){
    const v = m[y][x];
    if(v === m[y][x+1] && v === m[y+1][x] && v === m[y+1][x+1]) score += 3;
  }
  const finderish = [1,0,1,1,1,0,1,0,0,0,0];
  const matches = (get, i, len) => {
    if(i + 11 > len) return false;
    for(let k = 0; k < 11; k++) if(get(i + k) !== finderish[k]) return false;
    return true;
  };
  for(let y = 0; y < size; y++){
    const row = i => m[y][i], rev = i => m[y][size - 1 - i];
    for(let x = 0; x < size; x++){ if(matches(row, x, size)) score += 40; if(matches(rev, x, size)) score += 40; }
  }
  for(let x = 0; x < size; x++){
    const col = i => m[i][x], rev = i => m[size - 1 - i][x];
    for(let y = 0; y < size; y++){ if(matches(col, y, size)) score += 40; if(matches(rev, y, size)) score += 40; }
  }
  let dark = 0;
  for(let y = 0; y < size; y++) for(let x = 0; x < size; x++) dark += m[y][x];
  const total = size * size;
  score += Math.floor(Math.abs(dark * 20 - total * 10) / total) * 10;
  return score;
}

/* ---------- public API ---------- */
function modules(text, forceMask){
  const { ver, data } = encode(text);
  const codewords = addEcc(data, ver);
  let best = null;
  const masks = forceMask == null ? [0,1,2,3,4,5,6,7] : [forceMask];
  for(const mask of masks){
    const m = buildMatrix(ver, codewords);
    applyMask(m, ver, mask);
    drawFormat(m, mask);
    const p = penalty(m);
    if(!best || p < best.p) best = { m, p, mask };
  }
  return { modules: best.m, version: ver, mask: best.mask };
}

function svgPath(text, opts){
  const border = (opts && opts.border != null) ? opts.border : 4;
  const { modules: m } = modules(text, opts && opts.mask);
  const size = m.length + border * 2;
  let path = '';
  for(let y = 0; y < m.length; y++) for(let x = 0; x < m.length; x++){
    if(m[y][x]) path += `M${x + border},${y + border}h1v1h-1z`;
  }
  return { size, path };
}

global.BoxIQQR = { svgPath, modules };
})(typeof window !== 'undefined' ? window : globalThis);
