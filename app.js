'use strict';
/* ═══════════════════════════════════════════════
   TRADEJOURNAL PRO v3.1 — app.js
   Auth · State · CRUD · Voice System · Utilities
   NEW: Screenshot upload/paste, enhanced voice,
        improved animations, goals, notes moods
═══════════════════════════════════════════════ */

// ── THEME ────────────────────────────────────────
const _t = localStorage.getItem('tj_theme') || 'dark';
document.documentElement.setAttribute('data-theme', _t);

function toggleTheme() {
  const nt = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', nt);
  localStorage.setItem('tj_theme', nt);
  setTimeout(() => { try { if (typeof updateDashboard === 'function') updateDashboard(); } catch(e){} }, 120);
}

// ── STORAGE ──────────────────────────────────────
function getUsers()  { return JSON.parse(localStorage.getItem('tj_users') || '{}'); }
function saveUsers(u){ localStorage.setItem('tj_users', JSON.stringify(u)); }
function hp(p)       { let h=5381; for(let i=0;i<p.length;i++){h=((h<<5)+h)^p.charCodeAt(i);h=h>>>0;} return h.toString(36); }

let CU = localStorage.getItem('tj_session') || null;

function GD() {
  const u = getUsers();
  return (CU && u[CU]) ? u[CU] : { settings:{}, trades:[], notes:[], watchlist:[], goals:[] };
}
function SD(d) { const u=getUsers(); u[CU]=d; saveUsers(u); }

// ── AUTH ─────────────────────────────────────────
function switchTab(tab) {
  ['login','reg'].forEach(t => document.getElementById('auth-'+t)?.classList.toggle('hidden', t!==tab));
  document.querySelectorAll('.a-tab').forEach((b,i) => b.classList.toggle('active', i===(tab==='login'?0:1)));
  document.getElementById('a-err-l').textContent='';
  document.getElementById('a-err-r').textContent='';
}

function doLogin() {
  const u=V('l-user'), p=V('l-pass'), err=document.getElementById('a-err-l');
  if(!u||!p){err.textContent='Enter username and password';return;}
  const us=getUsers();
  if(!us[u]){err.textContent='Username not found';return;}
  if(us[u].passHash!==hp(p)){err.textContent='Incorrect password';return;}
  CU=u; localStorage.setItem('tj_session',u); err.textContent=''; enterApp();
}

function doRegister() {
  const u=V('r-user'), p=V('r-pass'), p2=V('r-pass2'), err=document.getElementById('a-err-r');
  if(!u||u.length<3){err.textContent='Username must be at least 3 characters';return;}
  if(!/^[a-z0-9_]+$/.test(u)){err.textContent='Letters, numbers, underscore only';return;}
  if(p.length<6){err.textContent='Password must be at least 6 characters';return;}
  if(p!==p2){err.textContent='Passwords do not match';return;}
  const us=getUsers();
  if(us[u]){err.textContent='Username already taken';return;}
  us[u]={passHash:hp(p),settings:{},trades:[],notes:[],watchlist:[],goals:[]};
  saveUsers(us); CU=u; localStorage.setItem('tj_session',u);
  HIDE('auth-screen'); SHOW('setup-overlay'); SHOW('main-app');
}

function doLogout() { CU=null; localStorage.removeItem('tj_session'); location.reload(); }

function enterApp() {
  HIDE('auth-screen'); SHOW('main-app');
  const d=GD(); if(!d.settings.balance) SHOW('setup-overlay');
  refresh(); startTicker(); initParticles();
}

function completeSetup() {
  const bal=parseFloat(V('su-balance'));
  if(!bal||bal<=0){toast('Starting balance is required','e');return;}
  const d=GD();
  d.settings={
    name:V('su-name'), balance:bal, currency:V('su-currency'),
    broker:V('su-broker'), riskPct:parseFloat(V('su-risk'))||1,
    style:V('su-style'), commission:parseFloat(V('su-comm'))||0,
  };
  SD(d); HIDE('setup-overlay'); toast('Welcome to TradeJournal Pro!','s'); refresh();
}

// ── HELPERS ──────────────────────────────────────
const V = id => document.getElementById(id)?.value ?? '';
const SV = (id,v) => { const el=document.getElementById(id); if(el) el.value = v??''; };
const GET = id => document.getElementById(id);
const HIDE = id => GET(id)?.classList.add('hidden');
const SHOW = id => GET(id)?.classList.remove('hidden');
const SETTEXT = (id,v) => { const el=GET(id); if(el) el.textContent=v; };
const SETCLS  = (id,c) => { const el=GET(id); if(el) el.className=c; };

const CSYMS = {USD:'$',PKR:'₨',EUR:'€',GBP:'£',AED:'د.إ',SAR:'﷼',CAD:'C$',AUD:'A$',JPY:'¥',INR:'₹'};
function curSym() { return CSYMS[GD().settings.currency||'USD']||'$'; }
function startBal(){ return parseFloat(GD().settings.balance)||0; }
function fmtC(v,d=2) { if(v===null||v===undefined)return'—'; const s=curSym(); return(v>=0?'+'+s:'−'+s)+Math.abs(v).toFixed(d); }
function fmtP(v)     { if(v===null||v===undefined)return'—'; return(v>=0?'+':'')+v.toFixed(2)+'%'; }
function esc(s)      { const m={'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}; return String(s||'').replace(/[&<>"']/g,c=>m[c]); }

// ── P&L ──────────────────────────────────────────
function autoPnl(t) {
  if(!t.exitPrice||t.exitPrice==='')return null;
  const en=parseFloat(t.entryPrice), ex=parseFloat(t.exitPrice), sz=parseFloat(t.size)||1;
  if(isNaN(en)||isNaN(ex))return null;
  const diff = t.direction==='long' ? ex-en : en-ex;
  const gross = parseFloat((diff*sz).toFixed(4));
  const comm  = parseFloat(t.commission||0)*2;
  return parseFloat((gross-comm).toFixed(4));
}
function finalPnl(t) {
  if(t.manualPnl!==undefined&&t.manualPnl!==null&&t.manualPnl!=='')return parseFloat(t.manualPnl);
  return autoPnl(t);
}
function closed(t){return finalPnl(t)!==null;}

// ── ANALYTICS ────────────────────────────────────
function analytics() {
  const d=GD(), sb=startBal();
  const cl=d.trades.filter(t=>closed(t)).map(t=>({...t,fp:finalPnl(t)}));
  const wins=cl.filter(t=>t.fp>0), losses=cl.filter(t=>t.fp<0), be=cl.filter(t=>t.fp===0);
  const tp=wins.reduce((s,t)=>s+t.fp,0);
  const tl=Math.abs(losses.reduce((s,t)=>s+t.fp,0));
  const net=tp-tl, wr=cl.length?wins.length/cl.length*100:0;
  const aw=wins.length?tp/wins.length:0, al=losses.length?tl/losses.length:0;
  const pf=tl>0?tp/tl:(tp>0?999:0), rr=al>0?aw/al:0;
  const exp=cl.length?(wr/100*aw-(1-wr/100)*al):0;
  let peak=sb,maxDD=0,bal=sb;
  [...cl].sort((a,b)=>a.date>b.date?1:-1).forEach(t=>{bal+=t.fp;if(bal>peak)peak=bal;const dd=peak-bal;if(dd>maxDD)maxDD=dd;});
  const pnls=cl.map(t=>t.fp), avg=pnls.length?pnls.reduce((a,b)=>a+b,0)/pnls.length:0;
  const variance=pnls.length?pnls.reduce((a,b)=>a+(b-avg)**2,0)/pnls.length:0;
  const sharpe=variance>0?avg/Math.sqrt(variance):0;
  const today=new Date().toISOString().split('T')[0];
  const todayPnl=cl.filter(t=>t.date===today).reduce((s,t)=>s+t.fp,0);
  const now=new Date(),ws=new Date(now); ws.setDate(now.getDate()-now.getDay()); ws.setHours(0,0,0,0);
  const weekPnl=cl.filter(t=>new Date(t.date)>=ws).reduce((s,t)=>s+t.fp,0);
  const sorted=[...cl].sort((a,b)=>a.date>b.date?1:-1);
  let cs=0,ms=0,cd='';
  sorted.forEach(t=>{const dir=t.fp>0?'w':t.fp<0?'l':'b';if(dir===cd){cs++;ms=Math.max(ms,cs);}else{cs=1;cd=dir;}});
  const streak={count:cs,type:cd,max:ms};
  const monthMap={},symMap={},emoMap={},setupMap={};
  cl.forEach(t=>{
    const m=t.date.slice(0,7); monthMap[m]=(monthMap[m]||0)+t.fp;
    const s=t.symbol; if(!symMap[s])symMap[s]={fp:0,count:0,wins:0}; symMap[s].fp+=t.fp; symMap[s].count++; if(t.fp>0)symMap[s].wins++;
    const e=t.emotion||'neutral'; if(!emoMap[e])emoMap[e]={fp:0,count:0}; emoMap[e].fp+=t.fp; emoMap[e].count++;
    const su=t.setup||'Other'; if(!setupMap[su])setupMap[su]={fp:0,count:0,wins:0}; setupMap[su].fp+=t.fp; setupMap[su].count++; if(t.fp>0)setupMap[su].wins++;
  });
  const best=cl.reduce((b,t)=>(!b||t.fp>b.fp)?t:b,null);
  const worst=cl.reduce((b,t)=>(!b||t.fp<b.fp)?t:b,null);
  let grade='D';
  if(wr>=60&&pf>=2)grade='A'; else if(wr>=50&&pf>=1.5)grade='B'; else if(wr>=40&&pf>=1)grade='C';
  return {
    cl,wins,losses,be,allTrades:d.trades,tp,tl,net,wr,aw,al,pf,rr,exp,sharpe,maxDD,
    balance:sb+net,todayPnl,weekPnl,streak,best,worst,monthMap,symMap,emoMap,setupMap,grade,
    openTrades:d.trades.filter(t=>!closed(t))
  };
}

function weekTrades() {
  const d=GD(), now=new Date(), ws=new Date(now);
  ws.setDate(now.getDate()-now.getDay()); ws.setHours(0,0,0,0);
  return d.trades.filter(t=>new Date(t.date)>=ws&&closed(t));
}

// ── MODAL PNL LIVE ───────────────────────────────
let useManual=false;

function recalcPnl() {
  if(useManual)return;
  const en=parseFloat(V('f-en')), ex=parseFloat(V('f-ex'));
  const sl=parseFloat(V('f-sl')), tp_=parseFloat(V('f-tp'));
  const sz=parseFloat(V('f-sz'))||1, dir=V('f-dir');
  const comm=parseFloat(V('f-comm'))||0;
  const prev=GET('pnl-prev'), src=GET('pnl-src');
  if(!ex||isNaN(ex)||!en||isNaN(en)){
    prev.textContent='—'; prev.className='pnl-big';
    src.textContent='Enter entry & exit to auto-calculate';
    calcRisk(en,sl,tp_,ex,sz,dir); return;
  }
  const diff=dir==='long'?ex-en:en-ex;
  const pnl=parseFloat(((diff*sz)-(comm*2)).toFixed(4));
  prev.textContent=fmtC(pnl);
  prev.className='pnl-big '+(pnl>=0?'c-g':'c-r');
  src.textContent='Auto-calculated (includes commission)';
  calcRisk(en,sl,tp_,ex,sz,dir);
}

function calcRisk(en,sl,tp_,ex,sz,dir) {
  const cfg=GD().settings, bal=parseFloat(cfg.balance)||0, rp=parseFloat(cfg.riskPct)||1;
  let riskAmt='—',rrRatio='—',sugSize='—',rPct='—';
  if(en&&sl&&!isNaN(en)&&!isNaN(sl)) {
    const slD=Math.abs(en-sl);
    if(slD>0) {
      const maxR=bal*rp/100;
      sugSize=(maxR/slD).toFixed(2)+' u';
      riskAmt=fmtC(slD*sz); rPct=((slD*sz/bal)*100).toFixed(2)+'%';
    }
    if((ex||tp_)&&!isNaN(ex||tp_)) {
      const reward=Math.abs((ex||tp_)-en);
      rrRatio=(reward/Math.abs(en-sl)).toFixed(2)+':1';
    }
  }
  SETTEXT('rc-sz',sugSize); SETTEXT('rc-r',riskAmt);
  SETTEXT('rc-rr',rrRatio); SETTEXT('rc-rp',rPct);
}

function toggleManual() {
  useManual=!useManual;
  GET('manual-wrap').classList.toggle('hidden',!useManual);
  GET('pnl-auto').style.opacity=useManual?'0.4':'1';
  if(!useManual){SV('f-mpnl','');recalcPnl();}
}
function onManualChange() {
  const v=parseFloat(V('f-mpnl'));
  const prev=GET('pnl-prev'), src=GET('pnl-src');
  if(isNaN(v)){prev.textContent='—';prev.className='pnl-big';return;}
  prev.textContent=fmtC(v); prev.className='pnl-big '+(v>=0?'c-g':'c-r');
  src.textContent='Manual override';
}

// ── SCREENSHOT SYSTEM ─────────────────────────────
let scDataUrl = ''; // holds base64 or URL

function switchScTab(tab) {
  ['url','file','paste'].forEach(t => {
    GET('sc-tab-'+t)?.classList.toggle('active', t===tab);
    GET('sc-panel-'+t)?.classList.toggle('hidden', t!==tab);
  });
}

function previewScUrl() {
  const url = V('f-sc').trim();
  scDataUrl = url;
  if(url) showScPreview(url);
  else hideScPreview();
}

function handleScFile(e) {
  const file = e.target.files[0];
  if(!file) return;
  if(!file.type.startsWith('image/')) { toast('Please select an image file','e'); return; }
  const reader = new FileReader();
  reader.onload = ev => {
    scDataUrl = ev.target.result;
    showScPreview(scDataUrl);
    toast('Screenshot loaded!','s');
  };
  reader.readAsDataURL(file);
}

function handleScDrop(e) {
  e.preventDefault();
  GET('sc-upload-area')?.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if(!file || !file.type.startsWith('image/')) { toast('Drop an image file','e'); return; }
  switchScTab('file');
  const reader = new FileReader();
  reader.onload = ev => { scDataUrl = ev.target.result; showScPreview(scDataUrl); toast('Screenshot loaded!','s'); };
  reader.readAsDataURL(file);
}

function handleScPaste(e) {
  const items = e.clipboardData?.items;
  if(!items) return;
  for(const item of items) {
    if(item.type.startsWith('image/')) {
      const file = item.getAsFile();
      const reader = new FileReader();
      reader.onload = ev => { scDataUrl = ev.target.result; showScPreview(scDataUrl); toast('Screenshot pasted!','s'); };
      reader.readAsDataURL(file);
      return;
    }
  }
  toast('No image found in clipboard','e');
}

// Global paste listener — paste anywhere when modal is open
document.addEventListener('paste', e => {
  const modal = GET('trade-modal');
  if(!modal?.classList.contains('open')) return;
  const items = e.clipboardData?.items;
  if(!items) return;
  for(const item of items) {
    if(item.type.startsWith('image/')) {
      const file = item.getAsFile();
      const reader = new FileReader();
      reader.onload = ev => {
        scDataUrl = ev.target.result;
        showScPreview(scDataUrl);
        switchScTab('paste');
        toast('Screenshot pasted from clipboard!','s');
      };
      reader.readAsDataURL(file);
      return;
    }
  }
});

function showScPreview(src) {
  const wrap = GET('sc-preview-wrap');
  const img  = GET('sc-preview-img');
  if(wrap && img) { img.src = src; wrap.classList.remove('hidden'); }
}

function hideScPreview() {
  GET('sc-preview-wrap')?.classList.add('hidden');
}

function clearScreenshot() {
  scDataUrl = '';
  SV('f-sc','');
  hideScPreview();
  const fi = GET('sc-file-in');
  if(fi) fi.value = '';
}

// ── TRADE CRUD ───────────────────────────────────
let editId=null, sortC='date', sortD=-1, fStatus='all', searchQ='';

function openModal(id) {
  editId=id||null; useManual=false;
  HIDE('manual-wrap'); GET('pnl-auto').style.opacity='1';
  clearScreenshot(); switchScTab('url');
  const d=GD(), t=id?d.trades.find(x=>x.id===id):null;
  SETTEXT('modal-title', id?'Edit Trade':'Log New Trade');
  SV('f-dt',  t?t.date:new Date().toISOString().split('T')[0]);
  SV('f-sym', t?t.symbol:'');
  SV('f-dir', t?t.direction:'long');
  SV('f-sz',  t?t.size:'');
  SV('f-en',  t?t.entryPrice:'');
  SV('f-ex',  t?(t.exitPrice||''):'');
  SV('f-sl',  t?(t.stopLoss||''):'');
  SV('f-tp',  t?(t.takeProfit||''):'');
  SV('f-comm',t?(t.commission||GD().settings.commission||0):'');
  SV('f-setup',t?(t.setup||''):'');
  SV('f-emo',  t?(t.emotion||'neutral'):'neutral');
  SV('f-sess', t?(t.session||''):'');
  SV('f-tf',   t?(t.timeframe||''):'');
  SV('f-tags', t?(t.tags||''):'');
  SV('f-notes',t?(t.notes||''):'');
  SV('f-mpnl','');
  // load screenshot
  if(t && t.screenshot) {
    scDataUrl = t.screenshot;
    if(t.screenshot.startsWith('data:')) {
      switchScTab('file');
    } else {
      SV('f-sc', t.screenshot);
      switchScTab('url');
    }
    showScPreview(t.screenshot);
  }
  if(t&&t.manualPnl!==undefined&&t.manualPnl!==null&&t.manualPnl!=='') {
    useManual=true; SHOW('manual-wrap'); GET('pnl-auto').style.opacity='0.4';
    SV('f-mpnl',t.manualPnl); onManualChange();
  } else recalcPnl();
  GET('trade-modal').classList.add('open');
}
function closeModal(){GET('trade-modal').classList.remove('open');}

function saveTrade() {
  const d=GD(), sym=V('f-sym').toUpperCase().trim();
  if(!sym){toast('Symbol is required','e');return;}
  const mv=V('f-mpnl');
  // determine screenshot: use scDataUrl if set (file/paste/url), else f-sc field value
  const screenshot = scDataUrl || V('f-sc') || '';
  const t={
    id:editId||Date.now().toString(),
    date:V('f-dt'), symbol:sym, direction:V('f-dir'),
    size:parseFloat(V('f-sz'))||1,
    entryPrice:parseFloat(V('f-en'))||0,
    exitPrice:V('f-ex'), stopLoss:V('f-sl'), takeProfit:V('f-tp'),
    commission:parseFloat(V('f-comm'))||0,
    setup:V('f-setup'), emotion:V('f-emo'),
    session:V('f-sess'), timeframe:V('f-tf'),
    tags:V('f-tags'), screenshot, notes:V('f-notes'),
    manualPnl:(useManual&&mv!=='')?parseFloat(mv):undefined,
    createdAt:editId?(d.trades.find(x=>x.id===editId)?.createdAt||Date.now()):Date.now(),
  };
  if(editId){const i=d.trades.findIndex(x=>x.id===editId);d.trades[i]=t;toast('Trade updated','s');}
  else{d.trades.push(t);toast('Trade logged!','s');}
  SD(d); closeModal(); refresh();
}

function deleteTrade(id) {
  if(!confirm('Delete this trade permanently?'))return;
  const d=GD(); d.trades=d.trades.filter(t=>t.id!==id);
  SD(d); refresh(); toast('Trade deleted','i');
}

// View trade in drawer
function viewTrade(id) {
  const d=GD(), t=d.trades.find(x=>x.id===id);
  if(!t)return;
  const p=finalPnl(t), pPct=startBal()>0&&p!==null?((p/startBal())*100).toFixed(2)+'%':'—';
  SETTEXT('dr-sym',t.symbol);
  GET('dr-dir').innerHTML=`<span class="badge b-${t.direction}">${t.direction.toUpperCase()}</span>`;
  SETTEXT('dr-meta',`${t.date} · ${t.session||'—'} · ${t.timeframe||'—'}`);
  SETTEXT('dr-pnl', p!==null?fmtC(p):'Open');
  SETCLS('dr-pnl', 'kpi-value '+(p===null?'c-s':p>=0?'c-g':'c-r'));
  SETTEXT('dr-pct', pPct);
  const rows=[
    ['Entry', parseFloat(t.entryPrice||0).toFixed(4)],
    ['Exit',  t.exitPrice?parseFloat(t.exitPrice).toFixed(4):'Open'],
    ['Stop Loss', t.stopLoss?parseFloat(t.stopLoss).toFixed(4):'—'],
    ['Take Profit',t.takeProfit?parseFloat(t.takeProfit).toFixed(4):'—'],
    ['Size', t.size],
    ['Commission', t.commission?fmtC(t.commission,2):curSym()+'0.00'],
    ['Setup', t.setup||'—'],
    ['Emotion',t.emotion||'—'],
    ['Tags', t.tags||'—'],
    ['P&L Source', (t.manualPnl!==undefined&&t.manualPnl!=='')?'Manual':'Auto-calc'],
  ];
  GET('dr-details').innerHTML=rows.map(([k,v])=>
    `<div class="d-row"><span class="d-k">${esc(k)}</span><span class="d-v">${esc(String(v))}</span></div>`
  ).join('');
  SETTEXT('dr-notes', t.notes||'No notes for this trade.');
  const scEl=GET('dr-sc');
  scEl.innerHTML=t.screenshot
    ?`<img src="${esc(t.screenshot)}" class="sc-img" onclick="window.open('${esc(t.screenshot)}','_blank')" alt="chart">`
    :`<p class="c-d" style="font-size:12px;font-family:var(--mono)">No screenshot attached.</p>`;
  GET('drawer-overlay').classList.add('open');
}
function closeDrawer(){GET('drawer-overlay').classList.remove('open');}

// ── JOURNAL ──────────────────────────────────────
function renderNotes() {
  const d=GD(), el=GET('notes-list'); if(!el)return;
  if(!d.notes||!d.notes.length){
    el.innerHTML=`<div class="empty"><div class="e-title">No journal entries yet</div><div class="e-sub">Start reflecting on your trading journey above.</div></div>`;
    return;
  }
  const moodEmoji = {great:'🟢',good:'🔵',okay:'🟡',bad:'🔴',terrible:'⚫'};
  el.innerHTML=[...d.notes].reverse().map(n=>`
    <div class="note-card">
      <div class="note-meta">
        <span>${esc(n.date||'')} ${moodEmoji[n.mood||'good']||''}</span>
        <div style="display:flex;gap:6px">
          <span style="font-size:10px;color:var(--text-3)">${esc(n.title||'')}</span>
          <button class="act-del" onclick="deleteNote('${n.id}')">Del</button>
        </div>
      </div>
      <div class="note-body">${esc(n.body)}</div>
    </div>`).join('');
}

function addNote() {
  const title=V('note-title').trim(), body=V('note-body').trim(), mood=V('note-mood');
  if(!body){toast('Write something first','e');return;}
  const d=GD(); if(!d.notes)d.notes=[];
  d.notes.push({id:Date.now().toString(), date:new Date().toISOString().split('T')[0], title, body, mood});
  SD(d); SV('note-title',''); SV('note-body','');
  renderNotes(); toast('Journal entry saved','s');
}

function deleteNote(id) {
  if(!confirm('Delete this entry?'))return;
  const d=GD(); d.notes=(d.notes||[]).filter(n=>n.id!==id);
  SD(d); renderNotes(); toast('Entry deleted','i');
}

// ── GOALS ────────────────────────────────────────
function renderGoals() {
  const d=GD(), el=GET('goals-list'); if(!el)return;
  if(!d.goals||!d.goals.length){
    el.innerHTML=`<div class="empty"><div class="e-title">No goals set yet</div><div class="e-sub">Set targets above to track your progress.</div></div>`;
    return;
  }
  const a=analytics();
  el.innerHTML=d.goals.map(g=>{
    let current=0, pct=0;
    if(g.type==='profit') current=a.net;
    else if(g.type==='trades') current=a.allTrades.length;
    else if(g.type==='wr') current=a.wr;
    pct=Math.min((current/g.target)*100, 100);
    const done=pct>=100;
    return`<div class="card" style="padding:18px;margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
        <div>
          <div style="font-weight:700;font-size:14px">${esc(g.name)}</div>
          <div style="font-size:11px;color:var(--text-3);font-family:var(--mono);margin-top:2px">${g.type==='profit'?'Profit Goal':g.type==='trades'?'Trades Goal':'Win Rate Goal'}</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          ${done?'<span class="badge b-win">✓ ACHIEVED</span>':''}
          <button class="act-del" onclick="deleteGoal('${g.id}')">Del</button>
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-2);font-family:var(--mono);margin-bottom:6px">
        <span>Progress: ${g.type==='profit'?fmtC(current):g.type==='wr'?current.toFixed(1)+'%':current} / ${g.type==='profit'?fmtC(g.target):g.type==='wr'?g.target+'%':g.target}</span>
        <span>${pct.toFixed(1)}%</span>
      </div>
      <div class="goal-bar"><div class="goal-fill" style="width:${pct}%;background:${done?'var(--emerald-2)':pct>50?'var(--sky)':'var(--amber)'}"></div></div>
    </div>`;
  }).join('');
}

function addGoal() {
  const name=V('gl-name').trim(), target=parseFloat(V('gl-target')), type=V('gl-type');
  if(!name){toast('Goal description required','e');return;}
  if(!target||isNaN(target)){toast('Valid target required','e');return;}
  const d=GD(); if(!d.goals)d.goals=[];
  d.goals.push({id:Date.now().toString(), name, target, type, createdAt:Date.now()});
  SD(d); SV('gl-name',''); SV('gl-target','');
  renderGoals(); toast('Goal added!','s');
}

function deleteGoal(id) {
  const d=GD(); d.goals=(d.goals||[]).filter(g=>g.id!==id);
  SD(d); renderGoals(); toast('Goal removed','i');
}

// ── WATCHLIST ─────────────────────────────────────
function renderWatchlist() {
  const d=GD(), wl=d.watchlist||[], el=GET('wl-items'); if(!el)return;
  if(!wl.length){
    el.innerHTML=`<div class="empty" style="padding:24px"><div class="e-sub">No assets in watchlist</div></div>`;
    return;
  }
  el.innerHTML=wl.map(w=>`
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 16px;border-bottom:1px solid var(--border);font-family:var(--mono);font-size:12px">
      <span style="font-weight:700;font-family:var(--font)">${esc(w.symbol)}</span>
      <span class="c-d">${esc(w.note||'')}</span>
      <span class="badge b-${w.bias==='bullish'?'win':w.bias==='bearish'?'loss':'neutral'}">${esc(w.bias||'Neutral')}</span>
      <button class="act-del" onclick="removeWl('${w.id}')">Remove</button>
    </div>`).join('');
}
function addWl() {
  const sym=V('wl-sym').toUpperCase().trim(), note=V('wl-note'), bias=V('wl-bias');
  if(!sym)return;
  const d=GD();if(!d.watchlist)d.watchlist=[];
  d.watchlist.push({id:Date.now().toString(),symbol:sym,note,bias});
  SD(d); renderWatchlist(); SV('wl-sym',''); SV('wl-note',''); toast(`${sym} added to watchlist`,'i');
}
function removeWl(id){const d=GD();d.watchlist=(d.watchlist||[]).filter(w=>w.id!==id);SD(d);renderWatchlist();}

// ── REPORT ───────────────────────────────────────
function updateReport() {
  const wt=weekTrades().map(t=>({...t,fp:finalPnl(t)})).filter(t=>t.fp!==null);
  const wins=wt.filter(t=>t.fp>0),losses=wt.filter(t=>t.fp<0);
  const tp=wins.reduce((s,t)=>s+t.fp,0),tl=Math.abs(losses.reduce((s,t)=>s+t.fp,0));
  const wr=wt.length?wins.length/wt.length*100:0,aw=wins.length?tp/wins.length:0,al=losses.length?tl/losses.length:0;
  const pf=tl>0?tp/tl:(tp>0?999:0),rr=al>0?aw/al:0,net=tp-tl,s=curSym();
  const S=(id,v,c)=>{const el=GET(id);if(!el)return;el.textContent=v;if(c)el.className=c;};
  S('r-wr',wr.toFixed(1)+'%','rpt-v '+(wr>=50?'c-g':'c-r'));
  S('r-rr',rr.toFixed(2)+':1','rpt-v c-s');
  S('r-pf',pf.toFixed(2),'rpt-v c-a');
  S('r-profit','+'+s+tp.toFixed(2),'rpt-v c-g');
  S('r-loss','−'+s+tl.toFixed(2),'rpt-v c-r');
  S('r-tc',wt.length,'rpt-v');
  const ne=GET('r-net');if(ne){ne.textContent=fmtC(net);ne.className='rpt-v '+(net>=0?'c-g':'c-r');}
}

function copyReport() {
  const wt=weekTrades().map(t=>({...t,fp:finalPnl(t)})).filter(t=>t.fp!==null);
  const wins=wt.filter(t=>t.fp>0),losses=wt.filter(t=>t.fp<=0);
  const tp=wins.reduce((s,t)=>s+t.fp,0),tl=Math.abs(losses.reduce((s,t)=>s+t.fp,0));
  const wr=wt.length?(wins.length/wt.length*100).toFixed(1):'0.0';
  const aw=wins.length?tp/wins.length:0,al=losses.length?tl/losses.length:0;
  const rr=al>0?(aw/al).toFixed(2):'0.00',pf=tl>0?(tp/tl).toFixed(2):'0.00',net=tp-tl,s=curSym();
  const email=V('email-in'), d=GD();
  const txt=`To: ${email||'you@email.com'}\nSubject: Weekly Trading Report — ${new Date().toDateString()}\n\n${'═'.repeat(44)}\n  TRADEJOURNAL PRO · WEEKLY REPORT\n${'═'.repeat(44)}\n\nTrader:        ${CU}${d.settings.name?' ('+d.settings.name+')':''}\nBroker:        ${d.settings.broker||'—'}\nGenerated:     ${new Date().toLocaleString()}\n\n── PERFORMANCE ─────────────────────\nWin Rate:      ${wr}%\nRisk:Reward:   ${rr}:1\nProfit Factor: ${pf}\nTotal Profit:  ${s}${tp.toFixed(2)}\nTotal Loss:    ${s}${tl.toFixed(2)}\nNet P&L:       ${net>=0?'+':''}${s}${Math.abs(net).toFixed(2)}\nTrades:        ${wt.length} (${wins.length}W/${losses.length}L)\n\n── TRADE LOG ───────────────────────\n${wt.map(t=>`${t.date}  ${t.symbol.padEnd(10)} ${t.direction.toUpperCase().padEnd(6)} ${fmtC(t.fp)}`).join('\n')}\n${'═'.repeat(44)}\nGenerated by TradeJournal Pro v3.1\n`;
  navigator.clipboard.writeText(txt).catch(()=>{});
  toast('Report copied to clipboard!','s');
}

// ── SETTINGS ─────────────────────────────────────
function loadSettings() {
  const d=GD(),c=d.settings||{};
  SV('s-name',c.name); SV('s-balance',c.balance); SV('s-currency',c.currency||'USD');
  SV('s-broker',c.broker); SV('s-risk',c.riskPct); SV('s-style',c.style||'swing');
  SV('s-comm',c.commission); SV('s-op',''); SV('s-np','');
}
function saveSettings() {
  HIDE('s-saved'); HIDE('s-err');
  const d=GD(), op=V('s-op'), np=V('s-np');
  if(op||np) {
    if(!op){GET('s-err').textContent='Enter current password';SHOW('s-err');return;}
    if(d.passHash!==hp(op)){GET('s-err').textContent='Current password incorrect';SHOW('s-err');return;}
    if(np.length<6){GET('s-err').textContent='New password must be at least 6 chars';SHOW('s-err');return;}
    d.passHash=hp(np);toast('Password changed','s');
  }
  d.settings={...d.settings,name:V('s-name').trim(),balance:parseFloat(V('s-balance'))||d.settings.balance,currency:V('s-currency'),broker:V('s-broker').trim(),riskPct:parseFloat(V('s-risk'))||0,style:V('s-style'),commission:parseFloat(V('s-comm'))||0};
  SD(d); refresh(); SHOW('s-saved'); setTimeout(()=>HIDE('s-saved'),2500); toast('Settings saved','s');
}
function resetData() {
  if(!confirm('Permanently delete ALL your data?'))return;
  const all=getUsers();
  if(all[CU]){all[CU].trades=[];all[CU].notes=[];all[CU].settings={};all[CU].watchlist=[];all[CU].goals=[];}
  saveUsers(all); refresh(); SHOW('setup-overlay'); toast('All data cleared','i');
}

// ── EXPORT / IMPORT ──────────────────────────────
function exportCSV() {
  const d=GD();if(!d.trades.length){toast('No trades to export','e');return;}
  const h=['Date','Symbol','Direction','Size','Entry','Exit','SL','TP','Commission','P&L','Status','Setup','Emotion','Session','Timeframe','Tags','Notes'];
  const rows=d.trades.map(t=>{const p=finalPnl(t);return[t.date,t.symbol,t.direction,t.size,t.entryPrice,t.exitPrice||'',t.stopLoss||'',t.takeProfit||'',t.commission||0,p!==null?p.toFixed(2):'',p===null?'open':p>0?'win':'loss',t.setup||'',t.emotion||'',t.session||'',t.timeframe||'',t.tags||'',(t.notes||'').replace(/,/g,';')].map(v=>`"${v}"`).join(',');});
  const blob=new Blob([[h.join(','),...rows].join('\n')],{type:'text/csv'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download=`tj_${CU}_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();URL.revokeObjectURL(a.href);toast('CSV exported!','s');
}
function exportJSON() {
  const d=GD(),blob=new Blob([JSON.stringify({user:CU,exported:new Date().toISOString(),...d},null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download=`tj_backup_${CU}.json`;a.click();URL.revokeObjectURL(a.href);toast('Backup exported!','s');
}
function triggerImport(){GET('csv-in').click();}
function handleImport(e) {
  const file=e.target.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=ev=>{
    const lines=ev.target.result.split('\n').filter(l=>l.trim());
    if(lines.length<2){toast('CSV appears empty','e');return;}
    const headers=lines[0].split(',').map(h=>h.replace(/"/g,'').trim().toLowerCase());
    const d=GD();let added=0;
    lines.slice(1).forEach(line=>{
      const vals=line.split(',').map(v=>v.replace(/"/g,'').trim());
      const get=k=>{const i=headers.indexOf(k);return i>=0?vals[i]:'';};
      const sym=get('symbol');if(!sym)return;
      const pv=get('p&l');
      d.trades.push({id:Date.now().toString()+Math.random(),date:get('date')||new Date().toISOString().split('T')[0],symbol:sym.toUpperCase(),direction:get('direction')||'long',size:parseFloat(get('size'))||1,entryPrice:parseFloat(get('entry'))||0,exitPrice:get('exit'),stopLoss:get('sl'),takeProfit:get('tp'),commission:parseFloat(get('commission'))||0,setup:get('setup'),emotion:get('emotion'),tags:get('tags'),notes:get('notes'),manualPnl:pv?parseFloat(pv):undefined});
      added++;
    });
    SD(d);refresh();toast(`${added} trades imported!`,'s');
  };
  reader.readAsText(file);e.target.value='';
}

// ── ACHIEVEMENTS ─────────────────────────────────
const ACHS=[
  {id:'first',name:'First Trade',desc:'Logged your first trade',icon:'🚀',check:a=>a.allTrades.length>=1},
  {id:'ten',name:'Active Trader',desc:'Logged 10 trades',icon:'📊',check:a=>a.allTrades.length>=10},
  {id:'fifty',name:'Veteran',desc:'Logged 50 trades',icon:'🏆',check:a=>a.allTrades.length>=50},
  {id:'hundred',name:'Century Trader',desc:'Logged 100 trades',icon:'💯',check:a=>a.allTrades.length>=100},
  {id:'fwin',name:'First Win',desc:'Your first profitable trade',icon:'✅',check:a=>a.wins.length>=1},
  {id:'streak5',name:'Hot Streak',desc:'5+ consecutive wins',icon:'🔥',check:a=>a.streak.max>=5},
  {id:'streak10',name:'Unstoppable',desc:'10+ consecutive wins',icon:'⚡',check:a=>a.streak.max>=10},
  {id:'wr60',name:'Sharp Shooter',desc:'Win rate above 60%',icon:'🎯',check:a=>a.wr>=60},
  {id:'wr70',name:'Elite Trader',desc:'Win rate above 70%',icon:'👑',check:a=>a.wr>=70},
  {id:'pf2',name:'Profit Machine',desc:'Profit factor above 2.0',icon:'💰',check:a=>a.pf>=2},
  {id:'green',name:'Green Month',desc:'Profitable monthly P&L',icon:'🌿',check:a=>Object.values(a.monthMap).some(v=>v>0)},
  {id:'disc',name:'Disciplined',desc:'Every trade has setup notes',icon:'📝',check:a=>a.cl.length>0&&a.cl.every(t=>t.setup)},
];

function renderAchs() {
  const el=GET('ach-grid');if(!el)return;
  const a=analytics();
  el.innerHTML=ACHS.map(ach=>{
    const ok=ach.check(a);
    return`<div class="ach ${ok?'ach-done':'locked'}">
      <div class="ach-icon-wrap"><span style="font-size:22px">${ok?ach.icon:'🔒'}</span></div>
      <div class="ach-info">
        <div class="ach-name">${ach.name}</div>
        <div class="ach-desc">${ach.desc}</div>
      </div>
    </div>`;
  }).join('');
}

// ── TICKER ───────────────────────────────────────
const ASSETS=[{s:'BTC',b:67000},{s:'ETH',b:3500},{s:'EUR/USD',b:1.089},{s:'GOLD',b:2320},{s:'SPX',b:5280}];
let ticks=ASSETS.map(a=>({...a,price:a.b,ch:0}));
function startTicker(){updateTicker();setInterval(updateTicker,4000);}
function updateTicker(){
  ticks=ticks.map(a=>{const d=(Math.random()-0.5)*a.b*0.001;const p=a.price+d;return{...a,price:p,ch:(p-a.b)/a.b*100};});
  const el=GET('ticker-body');if(!el)return;
  el.innerHTML=ticks.map(a=>`
    <div class="ticker-row">
      <span class="tick-sym">${a.s}</span>
      <span class="${a.ch>=0?'tick-up':'tick-dn'}">${a.price>100?a.price.toFixed(2):a.price.toFixed(4)}</span>
    </div>`).join('');
}

// ── TOAST ────────────────────────────────────────
function toast(msg,type='i',dur=3500) {
  const icons = {
    s:`<svg class="icon icon-green" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>`,
    e:`<svg class="icon icon-red" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    i:`<svg class="icon icon-sky" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  };
  const el=document.createElement('div');
  el.className=`toast t-${type}`;
  el.innerHTML=`${icons[type]||icons.i}<span>${msg}</span>`;
  GET('toast-stack').appendChild(el);
  setTimeout(()=>{el.style.opacity='0';el.style.transform='translateX(20px)';el.style.transition='0.3s';setTimeout(()=>el.remove(),300);},dur);
}

// ── VOICE SYSTEM ─────────────────────────────────
let SRecog=null, isListening=false;

function initVoice() {
  // Try to init voice — works in Chrome/Edge
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){
    const btn = GET('voice-btn');
    if(btn) {
      btn.setAttribute('title','Voice requires Chrome or Edge browser');
      btn.style.opacity='0.4';
      btn.style.cursor='not-allowed';
    }
    return;
  }
  try {
    SRecog=new SR();
    SRecog.continuous=false;
    SRecog.interimResults=true;
    SRecog.lang='en-US';

    SRecog.onstart=()=>{
      isListening=true;
      GET('voice-btn')?.classList.add('listening');
      const ov=GET('voice-overlay');
      if(ov) { ov.classList.add('active'); }
      SETTEXT('voice-text','Listening...');
      animateVoiceOrb(true);
    };

    SRecog.onresult=(e)=>{
      const transcript=Array.from(e.results).map(r=>r[0].transcript).join('').toLowerCase().trim();
      SETTEXT('voice-text',transcript);
      if(e.results[e.results.length-1].isFinal) processVoice(transcript);
    };

    SRecog.onend=()=>{
      isListening=false;
      GET('voice-btn')?.classList.remove('listening');
      animateVoiceOrb(false);
      setTimeout(()=>GET('voice-overlay')?.classList.remove('active'),1400);
    };

    SRecog.onerror=(e)=>{
      isListening=false;
      GET('voice-btn')?.classList.remove('listening');
      GET('voice-overlay')?.classList.remove('active');
      animateVoiceOrb(false);
      if(e.error==='not-allowed') toast('Mic access denied — allow microphone in browser settings','e',5000);
      else if(e.error!=='aborted') toast('Voice error: '+e.error,'e');
    };
  } catch(err) {
    console.warn('Voice init failed:', err);
  }
}

function animateVoiceOrb(active) {
  const orb = GET('voice-orb');
  if(!orb) return;
  orb.classList.toggle('orb-active', active);
}

function toggleVoice() {
  if(!SRecog){
    toast('Voice recognition requires Chrome or Edge browser','e',4000);
    return;
  }
  if(isListening){
    try{SRecog.stop();}catch(e){}
  } else {
    try{
      SRecog.start();
    }catch(e){
      // If already started, stop and restart
      try{SRecog.stop();}catch(e2){}
      setTimeout(()=>{try{SRecog.start();}catch(e3){toast('Could not start voice','e');}},300);
    }
  }
}

function processVoice(cmd) {
  // Navigation
  if(/dashboard|home|overview/.test(cmd))             { showSection('dashboard');  speak('Opening dashboard'); return; }
  if(/trade[s]?|trade log|my trades/.test(cmd))       { showSection('trades');     speak('Opening trades'); return; }
  if(/analytic[s]?|performance|stats/.test(cmd))      { showSection('analytics'); speak('Opening analytics'); return; }
  if(/journal|note[s]?/.test(cmd))                    { showSection('journal');   speak('Opening journal'); return; }
  if(/goal[s]?|target[s]?/.test(cmd))                 { showSection('goals');     speak('Opening goals'); return; }
  if(/watch\s?list|watching/.test(cmd))               { showSection('watchlist'); speak('Opening watchlist'); return; }
  if(/report|weekly/.test(cmd))                       { showSection('report');    speak('Opening weekly report'); return; }
  if(/achievement[s]?|badge[s]?/.test(cmd))           { showSection('achievements');speak('Opening achievements'); return; }
  if(/setting[s]?|config/.test(cmd))                  { showSection('settings');  speak('Opening settings'); return; }

  // Actions
  if(/add trade|new trade|log trade|open modal/.test(cmd)) { openModal(); speak('Opening trade form'); return; }
  if(/close|cancel|dismiss/.test(cmd))                { closeModal(); closeDrawer(); speak('Closed'); return; }
  if(/export|download|csv/.test(cmd))                 { exportCSV(); speak('Exporting CSV'); return; }
  if(/backup|json/.test(cmd))                         { exportJSON(); speak('Exporting backup'); return; }
  if(/dark.*(mode|theme)|switch.*dark/.test(cmd))     { if(document.documentElement.getAttribute('data-theme')!=='dark'){toggleTheme();speak('Dark mode activated');} return; }
  if(/light.*(mode|theme)|switch.*light/.test(cmd))   { if(document.documentElement.getAttribute('data-theme')!=='light'){toggleTheme();speak('Light mode activated');} return; }
  if(/toggle.*theme|switch.*theme|change.*theme/.test(cmd)) { toggleTheme(); speak('Theme toggled'); return; }
  if(/log.?out|sign.?out/.test(cmd))                  { speak('Logging out'); setTimeout(doLogout,1200); return; }

  // Stats readout
  if(/balance|account/.test(cmd)) {
    const a=analytics();
    speak(`Your account balance is ${curSym()}${a.balance.toFixed(2)}`); return;
  }
  if(/win rate/.test(cmd)) {
    const a=analytics();
    speak(`Your win rate is ${a.wr.toFixed(1)} percent`); return;
  }
  if(/today/.test(cmd)) {
    const a=analytics();
    speak(`Today's P and L is ${fmtC(a.todayPnl)}`); return;
  }
  if(/how many trade[s]?/.test(cmd)) {
    const a=analytics();
    speak(`You have logged ${a.allTrades.length} trades total`); return;
  }
  if(/profit factor/.test(cmd)) {
    const a=analytics();
    speak(`Your profit factor is ${a.pf.toFixed(2)}`); return;
  }
  if(/grade|score/.test(cmd)) {
    const a=analytics();
    speak(`Your performance grade is ${a.grade}`); return;
  }

  // Not recognized
  SETTEXT('voice-text',`"${cmd}" — not recognized`);
  toast(`Command not recognized: "${cmd}"`,'e');
}

function speak(text) {
  if(!window.speechSynthesis)return;
  window.speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance(text);
  u.rate=1.05; u.pitch=1; u.volume=0.85;
  window.speechSynthesis.speak(u);
}

// ── NAV ──────────────────────────────────────────
const SECS=['dashboard','trades','analytics','journal','report','goals','watchlist','achievements','settings'];
const TITLES={
  dashboard:['Dashboard','// performance overview'],
  trades:['Trade Log','// full history & management'],
  analytics:['Analytics','// deep performance intelligence'],
  journal:['Journal','// trading psychology & notes'],
  report:['Weekly Report','// performance summary'],
  goals:['Goals','// track your targets'],
  watchlist:['Watchlist','// assets under observation'],
  achievements:['Achievements','// milestones & progress'],
  settings:['Settings','// account configuration'],
};

function showSection(name) {
  SECS.forEach(s=>{
    const el=GET('sec-'+s);
    if(!el)return;
    if(s===name) {
      el.classList.remove('hidden');
      el.classList.add('section-enter');
      setTimeout(()=>el.classList.remove('section-enter'),400);
    } else {
      el.classList.add('hidden');
    }
  });
  document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active', b.dataset.s===name));
  const [title, sub]=TITLES[name]||['—',''];
  SETTEXT('tb-title',title); SETTEXT('tb-sub',sub);
  const dispatch={analytics:updateAnalytics,report:updateReport,journal:renderNotes,settings:loadSettings,watchlist:renderWatchlist,goals:renderGoals,achievements:renderAchs};
  if(dispatch[name])dispatch[name]();
}

function updateHeader() {
  const d=GD(),c=d.settings||{};
  const parts=[CU]; if(c.name)parts.push(c.name); if(c.broker)parts.push(c.broker); if(c.currency)parts.push(c.currency);
  SETTEXT('hdr-user', parts.join(' · '));
  const av=GET('u-avatar'); if(av)av.textContent=(CU||'?')[0].toUpperCase();
  SETTEXT('u-name', c.name||CU); SETTEXT('u-role', (c.style||'swing')+' trader');
}

function refresh(){ updateDashboard(); renderTable(); updateHeader(); }

// ── PARTICLES (background ambience) ──────────────
function initParticles() {
  const canvas = GET('particle-canvas');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H, particles=[];

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  for(let i=0;i<60;i++) {
    particles.push({
      x: Math.random()*W, y: Math.random()*H,
      vx: (Math.random()-0.5)*0.3, vy: (Math.random()-0.5)*0.3,
      r: Math.random()*1.5+0.5,
      a: Math.random()*0.3+0.05
    });
  }

  function draw() {
    ctx.clearRect(0,0,W,H);
    const dark = document.documentElement.getAttribute('data-theme')==='dark';
    const dotColor = dark ? '255,255,255' : '0,0,0';
    particles.forEach(p=>{
      p.x += p.vx; p.y += p.vy;
      if(p.x<0)p.x=W; if(p.x>W)p.x=0;
      if(p.y<0)p.y=H; if(p.y>H)p.y=0;
      ctx.beginPath();
      ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
      ctx.fillStyle = `rgba(${dotColor},${p.a})`;
      ctx.fill();
    });
    requestAnimationFrame(draw);
  }
  draw();
}

// ── KEYBOARD SHORTCUTS ───────────────────────────
document.addEventListener('keydown', e=>{
  if(e.altKey){const m={d:'dashboard',t:'trades',a:'analytics',j:'journal',r:'report',g:'goals',w:'watchlist',s:'settings'};if(m[e.key]){e.preventDefault();showSection(m[e.key]);}}
  if(e.ctrlKey&&e.key==='n'){e.preventDefault();openModal();}
  if(e.key==='Escape'){closeModal();closeDrawer();}
  // Space to toggle voice when not in an input
  if(e.key===' '&&e.target===document.body&&GET('main-app')&&!GET('main-app').classList.contains('hidden')){
    e.preventDefault();toggleVoice();
  }
});

// ── INIT ─────────────────────────────────────────
if(CU){
  const us=getUsers();
  if(us[CU])enterApp(); else{localStorage.removeItem('tj_session');CU=null;}
}
initVoice();
