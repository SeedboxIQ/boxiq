/* ============================================================
   BoxIQ v1 — shared engine
   ------------------------------------------------------------
   Every client site loads this one file and passes its own
   settings in a JSON block with id="boxiq-config". Nothing in
   here is client specific, so a fix here reaches every site at once.

   Changing behaviour for one client? Add a config option.
   Breaking change? Copy this to boxiq-v2.js and point new
   sites at that, so demos already sent out keep working.
   ============================================================ */
(function(){
'use strict';

const DEFAULTS = {
  client: '',                 // co-brand partner, e.g. "Aurora Cooperative"
  logo: '',                   // path to their logo, relative to the client folder
  preparedFor: '',            // small line under the lockup
  tagline: "Track what's in your box",
  lede: "Every slidegate has its own <strong>Gate ID</strong>. Scan the QR code on the gate label, or key in the digits printed under it, to see the seed brand and batch/lot loaded in this box.",
  dataUrl: 'gates.csv',       // resolved relative to the client folder
  demoData: false,            // true shows a "demo data" flag in the header
  supportNote: 'Ask the person who filled the box, or contact Seedbox Solution.',
  footerNote: 'BoxIQ · powered by Seedbox Solution',
  steps: [
    'Scan the QR code on the box sticker — that opens BoxIQ.',
    'Scan or type the Gate ID from the slidegate label.',
    'BoxIQ shows the brand and batch/lot recorded for that gate.'
  ],
  idPrefix: 'SG',
  idDigits: 8,
  cacheBustMinutes: 5,
  sampleFallback: '',         // optional CSV string used only if dataUrl fails
  inlineData: ''              // CSV/JSON carried inside the page: no fetch, works with no signal
};

let CONFIG = DEFAULTS;
const cfgEl = document.getElementById('boxiq-config');
if(cfgEl){
  try{ CONFIG = Object.assign({}, DEFAULTS, JSON.parse(cfgEl.textContent)); }
  catch(e){ console.error('BoxIQ: config block is not valid JSON', e); }
}

const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const el = id => document.getElementById(id);

/* ---------- markup ---------- */
function render(){
  const clientBlock = CONFIG.client ? `
      <span class="divider" aria-hidden="true"></span>
      <span class="client">
        ${CONFIG.logo
          ? `<img src="${esc(CONFIG.logo)}" alt="${esc(CONFIG.client)}">`
          : `<span class="name">${esc(CONFIG.client)}</span>`}
      </span>` : '';

  const mount = el('boxiq') || document.body;
  mount.innerHTML = `
  <div class="topbar">
    <div class="wrap">
      <div class="lockup">
        <span class="mark">seedb<span class="sprout">o</span>x<span class="dot">·</span>BoxIQ</span>
        ${clientBlock}
      </div>
      <div class="${CONFIG.preparedFor ? 'prepared' : 'eyebrow'}" style="margin-top:9px">
        ${esc(CONFIG.preparedFor || CONFIG.tagline)}${CONFIG.demoData ? '<span class="demo-flag">Demo data</span>' : ''}
      </div>
    </div>
  </div>

  <main class="wrap">
    <p class="lede">${CONFIG.lede}</p>

    <label class="field-label" for="gateDigits">Gate ID</label>
    <div class="plate">
      <div class="plate-inner">
        <span class="rivet l" aria-hidden="true"></span>
        <span class="prefix" aria-hidden="true">${esc(CONFIG.idPrefix)}</span>
        <input id="gateDigits" inputmode="numeric" autocomplete="off" spellcheck="false"
               enterkeyhint="search" placeholder="${'0'.repeat(Math.max(0, CONFIG.idDigits - 7))}1001091"
               aria-describedby="status">
        <span class="rivet r" aria-hidden="true"></span>
      </div>
    </div>

    <div class="actions">
      <button class="btn btn-primary" id="scanBtn" type="button">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3"/>
          <path d="M3 12h18"/>
        </svg>
        Scan gate label
      </button>
      <button class="btn btn-ghost" id="lookupBtn" type="button">Look up</button>
    </div>

    <p class="status" id="status" role="status" aria-live="polite">Loading gate list…</p>

    <div class="tie" id="tie" aria-hidden="true"></div>
    <section class="tag" id="tag" aria-live="polite"></section>

    <section class="how">
      <h3>How it works</h3>
      <ol>${CONFIG.steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol>
    </section>

    <footer id="foot">${esc(CONFIG.footerNote)}</footer>
  </main>

  <div class="scanner" id="scanner" role="dialog" aria-modal="true" aria-label="Scan gate label">
    <video id="video" playsinline muted></video>
    <div class="reticle"></div>
    <p class="scan-hint" id="scanHint">Hold the QR code on the gate label inside the frame.</p>
    <button class="scan-close" id="scanClose" type="button">Close</button>
  </div>`;
}

/* ---------- tiny CSV reader (handles quoted fields) ---------- */
function parseCSV(text){
  const rows=[]; let row=[], field='', inQuotes=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(inQuotes){
      if(c==='"'){ if(text[i+1]==='"'){field+='"';i++;} else inQuotes=false; }
      else field+=c;
    }else{
      if(c==='"') inQuotes=true;
      else if(c===','){ row.push(field); field=''; }
      else if(c==='\n'){ row.push(field); rows.push(row); row=[]; field=''; }
      else if(c!=='\r') field+=c;
    }
  }
  row.push(field); rows.push(row);
  return rows.filter(r=>r.some(v=>String(v).trim()!==''));
}
const key = s => String(s).trim().toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');

function toRecords(text){
  const trimmed = text.trim();
  if(trimmed.startsWith('[')||trimmed.startsWith('{')){
    const json = JSON.parse(trimmed);
    const arr = Array.isArray(json) ? json : (json.gates||json.records||json.data||[]);
    return arr.map(o=>{ const r={}; for(const k in o) r[key(k)] = String(o[k] == null ? '' : o[k]).trim(); return r; });
  }
  const rows = parseCSV(trimmed);
  if(!rows.length) return [];
  const head = rows[0].map(key);
  return rows.slice(1).map(cells=>{
    const r={}; head.forEach((h,i)=> r[h] = String(cells[i] == null ? '' : cells[i]).trim()); return r;
  });
}

/* ---------- Gate ID normalising ----------
   Accepts: SG01001091 · sg 01001091 · 01001091 · 1001091 · a full URL
   with ?gate= · and the glare-prone characters on a printed label. */
function normalizeGateId(raw){
  if(raw==null) return '';
  let s = String(raw).trim();
  const param = s.match(/[?&#](?:gate|g|id)=([^&\s]+)/i);
  if(param) s = decodeURIComponent(param[1]);
  s = s.toUpperCase().replace(/[^A-Z0-9]/g,'');
  const found = s.match(new RegExp(CONFIG.idPrefix + '[A-Z0-9]+'));
  if(found) s = found[0];
  let tail = s.startsWith(CONFIG.idPrefix) ? s.slice(CONFIG.idPrefix.length) : s;
  tail = tail.replace(/O/g,'0').replace(/[IL]/g,'1').replace(/S/g,'5').replace(/B/g,'8');
  if(/^\d+$/.test(tail) && tail.length < CONFIG.idDigits) tail = tail.padStart(CONFIG.idDigits,'0');
  return tail ? CONFIG.idPrefix + tail : '';
}
function isGateId(id){
  return new RegExp('^' + CONFIG.idPrefix + '\\d{4,12}$').test(id);
}

/* ---------- state ---------- */
const index = new Map();   // normalised gate id -> loads, newest first
let usingSample = false;
const cacheKey = 'boxiq.gates.' + location.pathname;

function buildIndex(records){
  index.clear();
  let count = 0;
  for(const r of records){
    const id = normalizeGateId(r.gate_id || r.gateid || r.gate || r.id);
    const brand = r.brand || r.hybrid || r.seed_brand || r.variety;
    if(!id || !brand) continue;
    if(!index.has(id)) index.set(id, []);
    index.get(id).push(r);
    count++;
  }
  for(const loads of index.values()){
    loads.sort((a,b)=> String(b.loaded_on||b.date_loaded||'').localeCompare(String(a.loaded_on||a.date_loaded||'')));
  }
  return count;
}

function setStatus(msg, tone){
  const s = el('status');
  s.textContent = msg;
  if(tone) s.setAttribute('data-tone',tone); else s.removeAttribute('data-tone');
}

async function loadData(){
  if(CONFIG.inlineData){
    const n = buildIndex(toRecords(CONFIG.inlineData));
    setStatus(`${n} gates loaded · offline copy carried in this page`);
    return;
  }
  const bust = Math.floor(Date.now() / (CONFIG.cacheBustMinutes*60000));
  const url = CONFIG.dataUrl + (CONFIG.dataUrl.includes('?') ? '&' : '?') + 'v=' + bust;
  try{
    const res = await fetch(url, {cache:'no-store'});
    if(!res.ok) throw new Error('HTTP ' + res.status);
    const text = await res.text();
    const n = buildIndex(toRecords(text));
    if(!n) throw new Error('no usable rows');
    try{ localStorage.setItem(cacheKey, JSON.stringify({saved:Date.now(), text})); }catch(e){}
    setStatus(`${n} gates loaded · list current as of ${new Date().toLocaleDateString()}`);
  }catch(err){
    let cached = null;
    try{ cached = JSON.parse(localStorage.getItem(cacheKey)||'null'); }catch(e){}
    if(cached && cached.text){
      const n = buildIndex(toRecords(cached.text));
      setStatus(`Offline. Using the copy saved on this device (${new Date(cached.saved).toLocaleDateString()}) · ${n} gates.`,'warn');
    }else if(CONFIG.sampleFallback){
      buildIndex(toRecords(CONFIG.sampleFallback));
      usingSample = true;
      setStatus(`Sample rows only — ${CONFIG.dataUrl} could not be read.`,'warn');
    }else{
      setStatus(`Can't read ${CONFIG.dataUrl}. Check that the file is published, then reload.`,'warn');
    }
  }
}

/* ---------- rendering a result ---------- */
const LABELS = {
  seed_size:'Seed size', treatment:'Treatment', loaded_on:'Loaded', date_loaded:'Loaded',
  box_id:'Box', filled_by:'Filled by', bags:'Bags', units:'Units', field:'Field',
  location:'Location', grower:'Grower', notes:'Notes'
};

function showResult(id){
  const tag = el('tag'), tie = el('tie');
  const loads = index.get(id);
  tag.classList.remove('show','miss'); tie.classList.remove('show');
  void tag.offsetWidth; // restart the drop animation

  if(!loads){
    tag.innerHTML = `
      <span class="punch" aria-hidden="true"></span>
      <p class="gate">${esc(id)}</p>
      <h2>No load recorded for this gate</h2>
      <p>Check the digits printed under the QR code — the label reads ${esc(CONFIG.idPrefix)}
      followed by ${CONFIG.idDigits} digits. If the print is worn, scan the QR code instead.
      ${esc(CONFIG.supportNote)}</p>`;
    tag.classList.add('miss');
  }else{
    const cur = loads[0];
    const brand = cur.brand || cur.hybrid || cur.seed_brand || cur.variety;
    const lot = cur.batch_lot || cur.lot || cur.batch || cur.lot_number || '—';
    const extras = Object.keys(LABELS)
      .filter(k => cur[k])
      .map(k => `<div class="${k==='notes' ? 'wide' : ''}">
                   <div class="k">${LABELS[k]}</div><div class="v">${esc(cur[k])}</div>
                 </div>`).join('');
    const historyHtml = loads.length > 1 ? `
      <details class="history">
        <summary>${loads.length-1} earlier load${loads.length>2?'s':''} on this gate</summary>
        <ul>${loads.slice(1).map(l=>`<li>${esc(l.brand||l.hybrid||'')} · ${esc(l.batch_lot||l.lot||'')}${l.loaded_on?` · ${esc(l.loaded_on)}`:''}</li>`).join('')}</ul>
      </details>` : '';
    tag.innerHTML = `
      <span class="punch" aria-hidden="true"></span>
      <p class="gate">Gate ${esc(id)}${usingSample ? ' · sample data' : ''}</p>
      <h2>${esc(brand)}</h2>
      <div class="lot"><div class="k">Batch / lot</div><div class="v">${esc(lot)}</div></div>
      ${extras ? `<div class="grid">${extras}</div>` : ''}
      ${historyHtml}`;
  }
  tie.classList.add('show'); tag.classList.add('show');
  tag.scrollIntoView({behavior:'smooth', block:'nearest'});
  try{
    const url = new URL(location.href);
    url.searchParams.set('gate', id);
    window.history.replaceState(null,'',url);
  }catch(e){}
}

function runLookup(rawInput){
  const raw = rawInput != null ? rawInput : (CONFIG.idPrefix + el('gateDigits').value);
  const id = normalizeGateId(raw);
  if(!isGateId(id)){
    setStatus('Enter the digits printed under the QR code, or scan the label.','warn');
    el('gateDigits').focus();
    return;
  }
  el('gateDigits').value = id.slice(CONFIG.idPrefix.length);
  showResult(id);
}

/* ---------- QR scanning ---------- */
let stream = null, rafId = null, jsQRReady = false;

function loadJsQR(){
  if(jsQRReady) return Promise.resolve();
  return new Promise((resolve,reject)=>{
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jsQR/1.4.0/jsQR.min.js';
    s.onload = ()=>{ jsQRReady = true; resolve(); };
    s.onerror = ()=> reject(new Error('scanner unavailable offline'));
    document.head.appendChild(s);
  });
}

async function openScanner(){
  const panel = el('scanner'), video = el('video');
  try{ await loadJsQR(); }
  catch(e){
    setStatus('Scanner needs a connection. Type the digits from the label instead.','warn');
    el('gateDigits').focus(); return;
  }
  try{
    stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}}});
  }catch(e){
    setStatus('No camera access. Type the digits from the label instead.','warn');
    el('gateDigits').focus(); return;
  }
  panel.classList.add('open');
  video.srcObject = stream;
  await video.play();
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', {willReadFrequently:true});

  (function tick(){
    if(!stream) return;
    if(video.readyState === video.HAVE_ENOUGH_DATA){
      const w = Math.min(640, video.videoWidth), scale = w / video.videoWidth;
      canvas.width = w; canvas.height = Math.round(video.videoHeight * scale);
      ctx.drawImage(video,0,0,canvas.width,canvas.height);
      const img = ctx.getImageData(0,0,canvas.width,canvas.height);
      const hit = window.jsQR ? window.jsQR(img.data, img.width, img.height, {inversionAttempts:'dontInvert'}) : null;
      if(hit && hit.data){
        const id = normalizeGateId(hit.data);
        if(isGateId(id)){
          if(navigator.vibrate) navigator.vibrate(35);
          closeScanner(); runLookup(id); return;
        }
        el('scanHint').textContent = "That code isn't a Gate ID. Scan the label on the slidegate.";
      }
    }
    rafId = requestAnimationFrame(tick);
  })();
}

function closeScanner(){
  el('scanner').classList.remove('open');
  if(rafId) cancelAnimationFrame(rafId);
  rafId = null;
  if(stream){ stream.getTracks().forEach(t=>t.stop()); stream = null; }
  el('scanHint').textContent = 'Hold the QR code on the gate label inside the frame.';
}

/* ---------- boot ---------- */
render();
const logoImg = document.querySelector('.client img');
if(logoImg){
  // If the logo file is missing, fall back to the client's name rather than a broken image
  logoImg.addEventListener('error', ()=>{
    const span = document.createElement('span');
    span.className = 'name';
    span.textContent = CONFIG.client;
    logoImg.replaceWith(span);
  });
}
el('gateDigits').addEventListener('input', e=>{
  const v = e.target.value;
  if(!/[^0-9]/.test(v)) return;
  const n = v.length >= 4 ? normalizeGateId(v) : '';
  e.target.value = n ? n.slice(CONFIG.idPrefix.length) : v.replace(/[^0-9]/g,'');
});
el('gateDigits').addEventListener('keydown', e=>{ if(e.key==='Enter') runLookup(); });
el('lookupBtn').addEventListener('click', ()=> runLookup());
el('scanBtn').addEventListener('click', openScanner);
el('scanClose').addEventListener('click', closeScanner);
document.addEventListener('keydown', e=>{ if(e.key==='Escape' && stream) closeScanner(); });

loadData().then(()=>{
  const fromUrl = normalizeGateId(location.search + location.hash);
  if(isGateId(fromUrl)) runLookup(fromUrl);
});
})();
