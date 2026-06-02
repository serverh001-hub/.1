/* ════════════════════════════════════════
   ⚙️ ตั้งค่าระบบ (โหมด Fix Device ID)
   ════════════════════════════════════════ */
const APP_CONFIG = {
  USERNAME: "Yout45", 
  TOKEN:    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkZXYiOiJoZWxtZXRfMDEiLCJpYXQiOjE3NzkwMDE3MDYsImp0aSI6IjZhMDk2OTY5YTU4ZTM2YjIzZjBjNWVlYiIsInN2ciI6ImFwLXNvdXRoZWFzdC5hd3MudGhpbmdlci5pbyIsInVzciI6IllvdXQ0NSJ9.BvUtgmKuGJ0S1m2TBs5pTIWn_TPbYh8ZIti2-uWI_YQ",
  SERVER:   "backend.thinger.io",
  DEFAULT_DEVICE: "helmet_01" 
};

const BASE = `https://${APP_CONFIG.SERVER}`;
let currentWorkerDevice = ""; 

// ── ระบบเปลี่ยนหน้าจอ ──
function go(id){
  document.querySelectorAll('.page').forEach(p => p.classList.remove('show'));
  document.getElementById(id).classList.add('show');
  window.scrollTo(0,0);
}

// ── ระบบระบุตัวตน (ลูกน้อง) - เปลี่ยนจากการสแกนเป็นการ Fix ID ──
function enterWorkerMode() {
  currentWorkerDevice = APP_CONFIG.DEFAULT_DEVICE;
  document.getElementById('displayHelmetId').textContent = currentWorkerDevice;
  go('pgWorker');
  toast('✅ เตรียมเชื่อมต่อกับหมวก: ' + currentWorkerDevice);
}

// ── ระบบเข้าสู่ระบบ PIN (หัวหน้างาน) ──
const PIN = '1234'; 
let pinBuf = '';

function pp(d){
  if(pinBuf.length >= 4) return; pinBuf += d; renderPin();
  if(pinBuf.length === 4) setTimeout(checkPin, 150);
}

function pd(){ pinBuf = pinBuf.slice(0, -1); renderPin(); document.getElementById('pinErr').classList.remove('show'); }

function renderPin(){
  for(let i=0; i<4; i++){
    const c = document.getElementById('pc'+i);
    c.classList.toggle('on', i < pinBuf.length); c.classList.remove('bad');
  }
}

function checkPin(){
  if(pinBuf === PIN){
    go('pgBoss'); pinBuf = ''; renderPin();
    document.getElementById('pinErr').classList.remove('show');
    bLog('🔓 หัวหน้าเข้าสู่ระบบ', 'info');
    
    // ระบบอัตโนมัติ: ดึงหมวก DEFAULT_DEVICE ลง Dashboard ทันที
    helmets = [{ 
      id: Date.now(), 
      label: "หมวกนิรภัย (Fix)", 
      device: APP_CONFIG.DEFAULT_DEVICE, 
      prev_sos: false, 
      prev_obs: false, 
      online: false, 
      data: null 
    }];
    renderAllCards();
    bossStartAll();
  } else {
    for(let i=0; i<4; i++) document.getElementById('pc'+i).classList.add('bad');
    document.getElementById('pinErr').classList.add('show');
    setTimeout(() => { pinBuf = ''; renderPin(); }, 700);
  }
}

function bossLogout(){ bossStopAll(); go('pgHome'); }

// ── API เชื่อมต่อ Thinger.io ──
async function tGet(user, device, token, resource){
  const r = await fetch(`${BASE}/v3/users/${user}/devices/${device}/resources/${resource}`, {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  if(!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

async function tPost(user, device, token, resource, body){
  const r = await fetch(`${BASE}/v3/users/${user}/devices/${device}/resources/${resource}`, {
    method: 'POST', 
    headers: { 
      'Authorization': 'Bearer ' + token, 
      'Content-Type': 'application/json' 
    }, 
    body: JSON.stringify(body)
  });
  if(!r.ok) throw new Error('HTTP ' + r.status);
  return r.ok;
}

// ── ฝั่งลูกน้อง (ส่งข้อมูลเข้าหมวก) ──
let wPoll = null;

async function workerSend(){
  if(!currentWorkerDevice) currentWorkerDevice = APP_CONFIG.DEFAULT_DEVICE;
  
  const name = document.getElementById('wName').value.trim();
  const eid = document.getElementById('wEID').value.trim() || "ไม่มีรหัส";
  
  if(!name){ toast('⚠️ กรุณากรอกชื่อของคุณ', 'warn'); return; }

  const btn = document.getElementById('wSendBtn');
  btn.disabled = true; btn.textContent = 'กำลังส่งข้อมูล…';
  wSetStatus('', 'กำลังเชื่อมต่อหมวก…');
  
  try {
    await tPost(APP_CONFIG.USERNAME, currentWorkerDevice, APP_CONFIG.TOKEN, 'set_worker', { in: { name: name, id: eid } });
    wSetStatus('ok', 'บันทึกสำเร็จ: ' + name);
    toast('✅ บันทึกชื่อเข้าหมวกเรียบร้อย');
    setDot('wDot', 'wDotLbl', 'live');
    
    // เริ่มอ่านสถานะหมวกแบบเรียลไทม์
    if(wPoll) clearInterval(wPoll);
    wPoll = setInterval(() => wFetchStatus(APP_CONFIG.USERNAME, currentWorkerDevice, APP_CONFIG.TOKEN), 3000);
    
  } catch(e){
    wSetStatus('fail', 'เชื่อมต่อล้มเหลว (เช็คให้แน่ใจว่าเปิดบอร์ด ESP32 แล้ว)'); 
    setDot('wDot', 'wDotLbl', 'err'); 
    toast('❌ เกิดข้อผิดพลาดในการส่งข้อมูล', 'err');
  }
  
  btn.disabled = false; btn.textContent = '✅ บันทึกชื่อเข้าหมวก';
}

async function wFetchStatus(u, d, t){
  try{
    const data = await tGet(u, d, t, 'status'); setDot('wDot', 'wDotLbl', 'live');
    const obs = data.obstacle === true;
    wSetStatus(obs ? 'fail' : 'ok', obs ? '⚠️ ตรวจพบสิ่งกีดขวาง!' : '🟢 ระบบหมวกทำงานปกติ');
  }catch(e) { setDot('wDot', 'wDotLbl', 'err'); }
}

function wSetStatus(state, txt){
  const dot = document.getElementById('wStatusDot');
  dot.className = 'w-status-dot' + (state === 'ok' ? ' ok' : state === 'fail' ? ' fail' : '');
  document.getElementById('wStatusTxt').textContent = txt;
}

// ── ฝั่งหัวหน้างาน (Auto-Sync) ──
let helmets = []; 
let globalPoll = null;

function bossStartAll(){
  document.getElementById('bStatusPill').style.display = 'flex'; 
  setDot('bDot', 'bDotLbl', 'loading');
  bLog('เริ่มติดตามหมวกในระบบอัตโนมัติ', 'info'); 
  stopAll();
  globalPoll = setInterval(pollAll, 2000); 
  pollAll();
}

function bossStopAll(){ stopAll(); setDot('bDot', 'bDotLbl', 'off'); bLog('หยุดติดตาม', 'info'); }
function stopAll(){ if(globalPoll){ clearInterval(globalPoll); globalPoll = null; } }

async function pollAll(){
  let onlineCnt = 0, sosCnt = 0, obsCnt = 0;
  for(const h of helmets){
    try{
      const data = await tGet(APP_CONFIG.USERNAME, h.device, APP_CONFIG.TOKEN, 'status');
      h.data = data; h.online = true; onlineCnt++;
      if(data.sos === true) sosCnt++; if(data.obstacle === true) obsCnt++;
      if(data.sos && !h.prev_sos){ bLog('🚨 SOS จาก ' + (data.worker_name || h.label), 'sos'); playAlert(); }
      if(data.obstacle && !h.prev_obs){ bLog('⚠️ สิ่งกีดขวาง: ' + (data.worker_name || h.label), 'obs'); }
      h.prev_sos = data.sos; h.prev_obs = data.obstacle;
    } catch(e){ h.online = false; h.data = null; }
    renderCard(h);
  }
  document.getElementById('sumTotal').textContent = helmets.length; 
  document.getElementById('sumOnline').textContent = onlineCnt;
  document.getElementById('sumSOS').textContent = sosCnt; 
  document.getElementById('sumObs').textContent = obsCnt;
  
  const banner = document.getElementById('sosBanner');
  if(sosCnt > 0){
    banner.classList.add('show');
    const names = helmets.filter(h => h.data?.sos).map(h => h.data?.worker_name || h.label).join(', ');
    document.getElementById('bannerTxt').textContent = '🚨 SOS จาก: ' + names;
  } else { banner.classList.remove('show'); }
  setDot('bDot', 'bDotLbl', onlineCnt > 0 ? 'live' : (helmets.length > 0 ? 'err' : 'off'));
}

function renderAllCards(){
  const grid = document.getElementById('helmetsGrid'); 
  const empty = document.getElementById('emptyState');
  if(helmets.length === 0){ grid.innerHTML = ''; grid.appendChild(empty); return; }
  if(grid.contains(empty)) grid.removeChild(empty);
  helmets.forEach(h => {
    if(!document.getElementById('hcard-' + h.id)) { 
      const el = document.createElement('div'); el.id = 'hcard-' + h.id; grid.appendChild(el); 
    }
    renderCard(h);
  });
}

function renderCard(h){
  const el = document.getElementById('hcard-' + h.id); if(!el) return;
  const d = h.data; const online = h.online; const sos = d?.sos === true; const obs = d?.obstacle === true;
  
  const name = d?.worker_name && d?.worker_name !== "ไม่ระบุ" ? d.worker_name : h.label;
  const eid = d?.worker_id && d?.worker_id !== "000" ? d.worker_id : "—";
  const d1 = d?.distance1_cm; const d2 = d?.distance2_cm; const now = new Date().toLocaleTimeString('th-TH');

  el.className = 'h-card' + (sos ? ' sos-active' : obs ? ' obs-active' : !online ? ' offline' : '');
  
  el.innerHTML = `
    <div class="h-card-head">
      <div class="h-card-id"><div class="h-avatar">👷</div><div><div class="h-name">${name}</div><div class="h-eid">${eid !== '—' ? eid + ' · ' : ''}<span style="color:var(--txt2)">${h.device}</span></div></div></div>
      <div class="h-card-badges">${sos ? '<span class="badge sos">🚨 SOS</span>' : ''}${obs ? '<span class="badge obs">⚠️ กีดขวาง</span>' : ''}<span class="badge ${online ? 'online' : 'offline'}">${online ? 'LIVE' : 'OFFLINE'}</span></div>
    </div>
    <div class="h-card-body">
      <div class="m-row"><div class="m-box"><div class="m-lbl">สถานะ</div><div class="m-val ${sos ? 'r' : obs ? 'o' : 'g'}">${sos ? 'SOS!' : obs ? 'ระวัง' : 'ปกติ'}</div></div>
      <div class="m-box"><div class="m-lbl">ด้านหน้า</div><div class="m-val ${d1 && d1 < 50 ? 'o' : ''}">${fmtDist(d1)}</div></div>
      <div class="m-box"><div class="m-lbl">ด้านข้าง</div><div class="m-val ${d2 && d2 < 50 ? 'o' : ''}">${fmtDist(d2)}</div></div></div>
      <div class="dist-mini"><div class="dist-mini-row"><span class="dist-mini-label">ด้านหน้า</span><div class="dist-mini-bar"><div class="dist-mini-fill ${d1 && d1 < 50 ? 'warn' : ''}" style="width:${distPct(d1)}%"></div></div><span class="dist-mini-val">${fmtDist(d1)}</span></div>
      <div class="dist-mini-row"><span class="dist-mini-label">ด้านข้าง</span><div class="dist-mini-bar"><div class="dist-mini-fill ${d2 && d2 < 50 ? 'warn' : ''}" style="width:${distPct(d2)}%"></div></div><span class="dist-mini-val">${fmtDist(d2)}</span></div></div>
    </div>
    <div class="h-card-foot"><span class="foot-time">อัพเดท ${online ? now : '—'}</span><button class="btn-ack-small" ${!sos ? 'disabled' : ''} onclick="ackSOS('${h.device}','${name}')">${sos ? '✅ ตอบรับ SOS' : 'ไม่มีเหตุ'}</button></div>
  `;
}

async function ackSOS(device, label){
  try{ 
    await tPost(APP_CONFIG.USERNAME, device, APP_CONFIG.TOKEN, 'ack_sos', { in: {ack:true} }); 
    bLog('✅ ตอบรับ SOS: ' + label, 'ok'); 
    toast('✅ ส่งการตอบรับไปยังพนักงานแล้ว');
    const h = helmets.find(h => h.device === device); if(h){ h.prev_sos = false; if(h.data) h.data.sos = false; renderCard(h); }
  }catch(e){ toast('❌ ส่งไม่สำเร็จ: ' + e.message, 'err'); }
}

// ── ฟังก์ชันสนับสนุน ──
function v(id){ return document.getElementById(id).value.trim(); }
function fmtDist(cm){ return (!cm || cm >= 999) ? '—' : (cm.toFixed(1) + ' ซม.'); }
function distPct(cm){ return (!cm || cm >= 999) ? 0 : Math.min(100, Math.max(0, ((200 - cm) / 200) * 100)); }

function setDot(dotId, lblId, state){ 
  const d = document.getElementById(dotId), l = document.getElementById(lblId); 
  if(state === 'live'){ d.className = 'sdot live'; l.textContent = 'ออนไลน์'; } 
  else if(state === 'err'){ d.className = 'sdot err'; l.textContent = 'การเชื่อมต่อผิดพลาด'; } 
  else if(state === 'loading'){ d.className = 'sdot live'; l.textContent = 'กำลังโหลด…'; }
  else { d.className = 'sdot'; l.textContent = 'ออฟไลน์'; } 
}

function bLog(msg, type = 'info'){ 
  const list = document.getElementById('bLog'); const t = new Date().toLocaleTimeString('th-TH'); const el = document.createElement('div'); 
  el.className = 'log-item'; el.innerHTML = `<span class="log-t">${t}</span><span class="log-m ${type}">${msg}</span>`; 
  list.prepend(el); while(list.children.length > 60) list.removeChild(list.lastChild); 
}

let _toastTimer; 
function toast(msg, type = 'ok'){ 
  const el = document.getElementById('toast'); el.textContent = msg; 
  const c = type === 'err' ? 'var(--red)' : type === 'warn' ? 'var(--yellow)' : 'var(--cyan)'; 
  el.style.borderColor = c; el.style.color = c; el.classList.add('show'); 
  clearTimeout(_toastTimer); _toastTimer = setTimeout(() => el.classList.remove('show'), 3200); 
}

function playAlert(){ 
  try{ 
    const ctx = new(window.AudioContext || window.webkitAudioContext)(); 
    [523,659,784,659,523].forEach((f, i) => { 
      const o = ctx.createOscillator(), g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.frequency.value = f; 
      const t = ctx.currentTime + i * 0.17; g.gain.setValueAtTime(0.22, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.15); o.start(t); o.stop(t + 0.15); 
    }); 
  }catch(e){} 
}
