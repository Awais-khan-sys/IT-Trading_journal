'use strict';
/* ═══════════════════════════════════════════════
   TRADEJOURNAL PRO v3 — charts.js
   Dashboard rendering · Charts · Trade table
═══════════════════════════════════════════════ */

let pnlC, wlC, barC, monthC, symC, emoC;

function themeCC() {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  return {
    grid:    dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)',
    tick:    dark ? '#4e4e62' : '#9898b0',
    tip_bg:  dark ? '#1e1e28' : '#ffffff',
    tip_bd:  dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
    tip_txt: dark ? '#f2f2f7' : '#0f0f14',
    font:    "'IBM Plex Mono', monospace",
  };
}

const BASE = cc => ({
  responsive: true, maintainAspectRatio: false,
  animation: { duration: 480, easing: 'easeOutQuart' },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: cc.tip_bg, borderColor: cc.tip_bd, borderWidth: 1,
      titleColor: cc.tick, bodyColor: cc.tip_txt, padding: 10,
      bodyFont: { family: cc.font, size: 12 }, titleFont: { family: cc.font, size: 10 },
    },
  },
});

// ── DASHBOARD ─────────────────────────────────────
function updateDashboard() {
  const a=analytics(), s=curSym(), sb=startBal();
  const ST=(id,v)=>SETTEXT(id,v), SC=(id,c)=>SETCLS(id,c);

  // KPIs
  ST('kpi-bal',  s + a.balance.toFixed(2));
  ST('kpi-today', fmtC(a.todayPnl));
  GET('kpi-today')?.classList.toggle('c-g', a.todayPnl>=0);
  GET('kpi-today')?.classList.toggle('c-r', a.todayPnl<0);
  ST('kpi-week', fmtC(a.weekPnl));
  GET('kpi-week')?.classList.toggle('c-g', a.weekPnl>=0);
  GET('kpi-week')?.classList.toggle('c-r', a.weekPnl<0);
  ST('kpi-wr',    a.wr.toFixed(1)+'%');
  GET('kpi-wr')?.classList.toggle('c-g', a.wr>=50);
  GET('kpi-wr')?.classList.toggle('c-r', a.wr<50);
  ST('kpi-total', a.allTrades.length);
  ST('kpi-open',  a.openTrades.length);
  ST('kpi-pf',    a.pf.toFixed(2));

  // Balance chip
  const pctChg = sb>0 ? ((a.balance-sb)/sb*100) : 0;
  const chip=GET('bal-chip');
  if(chip){
    chip.textContent=fmtP(pctChg);
    chip.style.background = pctChg>=0?'var(--emerald-bg)':'var(--red-bg)';
    chip.style.color       = pctChg>=0?'var(--emerald-2)':'var(--red)';
  }

  // Streaks
  ST('str-cur',  a.streak.count);
  ST('str-type', a.streak.type==='w'?'Win Streak':a.streak.type==='l'?'Loss Streak':'No streak');
  ST('str-max',  a.streak.max);

  // Stats
  ST('st-avgw',   fmtC(a.aw));
  ST('st-avgl',   '−'+s+a.al.toFixed(2));
  ST('st-pf',     a.pf.toFixed(2));
  ST('st-rr',     a.rr.toFixed(2)+':1');
  ST('st-dd',     '−'+s+a.maxDD.toFixed(2));
  ST('st-exp',    fmtC(a.exp));
  ST('st-sharpe', a.sharpe.toFixed(2));

  // Grade
  const gr=GET('perf-grade');
  if(gr){gr.textContent=a.grade;gr.className=`grade-ring gr-${a.grade}`;}

  // Best/worst
  if(a.best){ST('best-sym',a.best.symbol);ST('best-pnl',fmtC(a.best.fp));}
  if(a.worst){ST('worst-sym',a.worst.symbol);ST('worst-pnl',fmtC(a.worst.fp));}

  // Open trades
  const openEl=GET('open-list');
  if(openEl){
    if(!a.openTrades.length){
      openEl.innerHTML=`<div class="empty" style="padding:18px"><svg class="icon icon-lg e-icon" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg><div class="e-sub">No open positions</div></div>`;
    } else {
      openEl.innerHTML=a.openTrades.map(t=>`
        <div style="display:flex;align-items:center;justify-content:space-between;padding:9px 16px;border-bottom:1px solid var(--border);font-size:12px">
          <span style="font-weight:700">${esc(t.symbol)}</span>
          <span class="badge b-${t.direction}">${t.direction.toUpperCase()}</span>
          <span class="c-d" style="font-family:var(--mono)">@ ${parseFloat(t.entryPrice).toFixed(4)}</span>
          <div style="display:flex;gap:4px">
            <button class="act-view" onclick="viewTrade('${t.id}')">View</button>
            <button class="act-edit" onclick="openModal('${t.id}')">Close</button>
          </div>
        </div>`).join('');
    }
  }

  buildPnlChart(a.cl);
  buildWlChart(a.wins.length, a.losses.length, a.be.length);
  buildHeatmap(a.cl);
}

// ── P&L LINE CHART ────────────────────────────────
function buildPnlChart(cl) {
  if(pnlC)pnlC.destroy();
  const ctx=GET('pnl-chart');if(!ctx)return;
  const cc=themeCC();
  const sorted=[...cl].sort((a,b)=>a.date>b.date?1:-1);
  let cum=0;
  const labels=['Start',...sorted.map(t=>t.date.slice(5))];
  const data=[0,...sorted.map(t=>{cum+=t.fp;return+cum.toFixed(2);})];
  const last=data[data.length-1]??0;
  const color=last>=0?'#059669':'#dc2626';
  const gradA=last>=0?'rgba(5,150,105,':'rgba(220,38,38,';
  pnlC=new Chart(ctx,{type:'line',data:{labels,datasets:[{data,borderColor:color,borderWidth:2,
    backgroundColor:c=>{const g=c.chart.ctx.createLinearGradient(0,0,0,200);g.addColorStop(0,gradA+'0.15)');g.addColorStop(1,gradA+'0)');return g;},
    fill:true,tension:0.38,pointRadius:data.length>60?0:3,pointBackgroundColor:color,pointHoverRadius:5,}]},
    options:{...BASE(cc),interaction:{intersect:false,mode:'index'},
      plugins:{...BASE(cc).plugins,tooltip:{...BASE(cc).plugins.tooltip,callbacks:{label:c=>'P&L: '+fmtC(c.raw)}}},
      scales:{x:{ticks:{color:cc.tick,font:{size:10,family:cc.font}},grid:{color:cc.grid,drawBorder:false}},
        y:{ticks:{color:cc.tick,font:{size:10,family:cc.font},callback:v=>curSym()+v},grid:{color:cc.grid,drawBorder:false},grace:'10%'}}},
  });
}

// ── WIN/LOSS DOUGHNUT ─────────────────────────────
function buildWlChart(w,l,be) {
  if(wlC)wlC.destroy();
  const ctx=GET('wl-chart');if(!ctx)return;
  const cc=themeCC();
  wlC=new Chart(ctx,{type:'doughnut',
    data:{labels:['Wins','Losses','Break Even'],datasets:[{data:[w,l,be],backgroundColor:['#059669','#dc2626','#d97706'],borderWidth:0,hoverOffset:5}]},
    options:{...BASE(cc),cutout:'68%',plugins:{
      legend:{display:true,position:'bottom',labels:{color:cc.tick,font:{size:11,family:cc.font},boxWidth:10,padding:10}},
      tooltip:{...BASE(cc).plugins.tooltip}}},
  });
}

// ── HEATMAP ───────────────────────────────────────
function buildHeatmap(cl) {
  const el=GET('heatmap');if(!el)return;
  const dayMap={};cl.forEach(t=>{dayMap[t.date]=(dayMap[t.date]||0)+t.fp;});
  const maxAbs=Math.max(...Object.values(dayMap).map(Math.abs),1);
  const cells=[];const now=new Date();
  for(let i=90;i>=0;i--){const d=new Date(now);d.setDate(now.getDate()-i);const key=d.toISOString().split('T')[0];cells.push({key,pnl:dayMap[key]});}
  el.innerHTML=cells.map(c=>{
    if(c.pnl===undefined)return`<div class="hm-cell" title="${c.key}"></div>`;
    const inten=Math.min(Math.abs(c.pnl)/maxAbs,1), alpha=0.2+inten*0.8;
    const bg=c.pnl>=0?`rgba(5,150,105,${alpha})`:`rgba(220,38,38,${alpha})`;
    return`<div class="hm-cell" style="background:${bg}" title="${c.key}: ${fmtC(c.pnl)}"></div>`;
  }).join('');
}

// ── ANALYTICS ─────────────────────────────────────
function updateAnalytics() {
  const a=analytics(),s=curSym();
  SETTEXT('a-profit','+'+s+a.tp.toFixed(2));
  SETTEXT('a-loss','−'+s+a.tl.toFixed(2));
  const ne=GET('a-net');if(ne){ne.textContent=fmtC(a.net);ne.className='s-val '+(a.net>=0?'c-g':'c-r');}
  SETTEXT('a-exp',fmtC(a.exp));
  SETTEXT('a-sharpe',a.sharpe.toFixed(2));
  SETTEXT('a-trades',a.cl.length);
  buildBarChart(a.cl);
  buildMonthChart(a.monthMap);
  buildSymChart(a.symMap);
  buildEmoChart(a.emoMap);
  renderSetupTable(a.setupMap);
}

function buildBarChart(cl) {
  if(barC)barC.destroy();
  const ctx=GET('bar-chart');if(!ctx)return;
  const cc=themeCC();
  const wrap=GET('bar-wrap');if(wrap)wrap.style.height=Math.max(220,cl.length*30+80)+'px';
  barC=new Chart(ctx,{type:'bar',data:{labels:cl.map(t=>t.symbol+' '+t.date.slice(5)),
    datasets:[{data:cl.map(t=>t.fp),backgroundColor:cl.map(t=>t.fp>=0?'rgba(5,150,105,0.65)':'rgba(220,38,38,0.65)'),borderColor:cl.map(t=>t.fp>=0?'#059669':'#dc2626'),borderWidth:1,borderRadius:3}]},
    options:{...BASE(cc),indexAxis:'y',
      plugins:{...BASE(cc).plugins,tooltip:{...BASE(cc).plugins.tooltip,callbacks:{label:c=>fmtC(c.raw)}}},
      scales:{x:{ticks:{color:cc.tick,font:{size:10,family:cc.font},callback:v=>curSym()+v},grid:{color:cc.grid}},y:{ticks:{color:cc.tick,font:{size:10,family:cc.font}},grid:{display:false}}}},
  });
}

function buildMonthChart(monthMap) {
  if(monthC)monthC.destroy();
  const ctx=GET('month-chart');if(!ctx)return;
  const cc=themeCC();
  const months=Object.keys(monthMap).sort(),vals=months.map(m=>monthMap[m]);
  monthC=new Chart(ctx,{type:'bar',data:{labels:months,datasets:[{data:vals,backgroundColor:vals.map(v=>v>=0?'rgba(2,132,199,0.6)':'rgba(220,38,38,0.6)'),borderColor:vals.map(v=>v>=0?'#0284c7':'#dc2626'),borderWidth:1,borderRadius:5}]},
    options:{...BASE(cc),scales:{x:{ticks:{color:cc.tick,font:{size:10,family:cc.font}},grid:{color:cc.grid}},y:{ticks:{color:cc.tick,font:{size:10,family:cc.font},callback:v=>curSym()+v},grid:{color:cc.grid}}},
      plugins:{...BASE(cc).plugins,tooltip:{...BASE(cc).plugins.tooltip,callbacks:{label:c=>'P&L: '+fmtC(c.raw)}}}},
  });
}

function buildSymChart(symMap) {
  if(symC)symC.destroy();
  const ctx=GET('sym-chart');if(!ctx)return;
  const cc=themeCC();
  const sorted=Object.entries(symMap).sort((a,b)=>b[1].fp-a[1].fp);
  const labels=sorted.map(([s])=>s),vals=sorted.map(([,d])=>d.fp);
  symC=new Chart(ctx,{type:'bar',data:{labels,datasets:[{data:vals,backgroundColor:vals.map(v=>v>=0?'rgba(124,58,237,0.6)':'rgba(220,38,38,0.6)'),borderColor:vals.map(v=>v>=0?'#7c3aed':'#dc2626'),borderWidth:1,borderRadius:5}]},
    options:{...BASE(cc),scales:{x:{ticks:{color:cc.tick,font:{size:10,family:cc.font}},grid:{color:cc.grid}},y:{ticks:{color:cc.tick,font:{size:10,family:cc.font},callback:v=>curSym()+v},grid:{color:cc.grid}}},
      plugins:{...BASE(cc).plugins,tooltip:{...BASE(cc).plugins.tooltip,callbacks:{label:c=>'Total: '+fmtC(c.raw)}}}},
  });
}

function buildEmoChart(emoMap) {
  if(emoC)emoC.destroy();
  const ctx=GET('emo-chart');if(!ctx)return;
  if(!Object.keys(emoMap).length)return;
  const cc=themeCC();
  const PAL=['#059669','#0284c7','#d97706','#dc2626','#7c3aed','#06b6d4','#e11d48'];
  const labels=Object.keys(emoMap),vals=labels.map(k=>emoMap[k].count);
  emoC=new Chart(ctx,{type:'doughnut',data:{labels:labels.map(l=>l.charAt(0).toUpperCase()+l.slice(1)),datasets:[{data:vals,backgroundColor:PAL.slice(0,labels.length),borderWidth:0}]},
    options:{...BASE(cc),cutout:'58%',plugins:{legend:{display:true,position:'right',labels:{color:cc.tick,font:{size:11,family:cc.font},boxWidth:10,padding:8}},tooltip:{...BASE(cc).plugins.tooltip}}},
  });
}

function renderSetupTable(setupMap) {
  const el=GET('setup-table');if(!el)return;
  const rows=Object.entries(setupMap).sort((a,b)=>b[1].fp-a[1].fp);
  if(!rows.length){el.innerHTML=`<tr><td colspan="5"><div class="empty" style="padding:16px"><div class="e-sub">No setup data yet.</div></div></td></tr>`;return;}
  el.innerHTML=rows.map(([s,d])=>{
    const wr_=d.count>0?(d.wins/d.count*100).toFixed(1):0;
    return`<tr>
      <td style="font-weight:700">${esc(s)}</td>
      <td>${d.count}</td>
      <td class="${parseFloat(wr_)>=50?'c-g':'c-r'}">${wr_}%</td>
      <td class="${d.fp>=0?'c-g':'c-r'}">${fmtC(d.fp)}</td>
      <td class="${d.count>0?d.fp/d.count>=0?'c-g':'c-r':''}">${fmtC(d.count>0?d.fp/d.count:0)}</td>
    </tr>`;
  }).join('');
}

// ── TRADE TABLE ───────────────────────────────────
function renderTable() {
  const d=GD();
  let trades=[...d.trades];
  if(fStatus==='open')trades=trades.filter(t=>!closed(t));
  else if(fStatus==='closed')trades=trades.filter(t=>closed(t));
  else if(fStatus==='win')trades=trades.filter(t=>{const p=finalPnl(t);return p!==null&&p>0;});
  else if(fStatus==='loss')trades=trades.filter(t=>{const p=finalPnl(t);return p!==null&&p<0;});
  if(searchQ){const q=searchQ.toLowerCase();trades=trades.filter(t=>(t.symbol+''+t.tags+''+t.setup+''+t.notes+''+t.emotion).toLowerCase().includes(q));}
  trades.sort((a,b)=>{
    let av=a[sortC]??'', bv=b[sortC]??'';
    if(sortC==='fp'){av=finalPnl(a)??-9999;bv=finalPnl(b)??-9999;}
    return av>bv?sortD:av<bv?-sortD:0;
  });
  const body=GET('trade-tbody');if(!body)return;
  if(!trades.length){
    body.innerHTML=`<tr><td colspan="13"><div class="empty"><svg class="icon icon-lg e-icon" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg><div class="e-title">No trades found</div><div class="e-sub">Log a trade using the button above.</div></div></td></tr>`;
    return;
  }
  const sb=startBal();
  body.innerHTML=trades.map(t=>{
    const p=finalPnl(t), cl_=p!==null;
    const isM=t.manualPnl!==undefined&&t.manualPnl!==null&&t.manualPnl!=='';
    const status=cl_?(p>0?'win':p<0?'loss':'be'):'open';
    const pPct=sb>0&&p!==null?` (${(p/sb*100).toFixed(2)}%)` :'';
    const tags=(t.tags||'').split(',').filter(Boolean).map(g=>`<span class="tag">${esc(g.trim())}</span>`).join('');
    const srcBadge=cl_?(isM?`<span style="font-size:9px;color:var(--amber);font-family:var(--mono)">MANUAL</span>`:`<span style="font-size:9px;color:var(--text-3);font-family:var(--mono)">AUTO</span>`):'—';
    const emoLabel={confident:'C',anxious:'A',neutral:'N',fomo:'F',patient:'P',greedy:'G',disciplined:'D',frustrated:'Fr'}[t.emotion||'neutral']||'N';
    return`<tr>
      <td class="c-d">${t.date}</td>
      <td class="td-sym" onclick="viewTrade('${t.id}')">${esc(t.symbol)}</td>
      <td><span class="badge b-${t.direction}">${t.direction.toUpperCase()}</span></td>
      <td>${parseFloat(t.entryPrice||0).toFixed(4)}</td>
      <td>${t.exitPrice?parseFloat(t.exitPrice).toFixed(4):'—'}</td>
      <td>${t.stopLoss?parseFloat(t.stopLoss).toFixed(4):'—'}</td>
      <td>${t.size}</td>
      <td class="${cl_?(p>0?'c-g':p<0?'c-r':'c-a'):''}" style="font-weight:${cl_?700:400}">${cl_?fmtC(p)+pPct:'—'}</td>
      <td>${srcBadge}</td>
      <td><span class="badge b-${status}">${status.toUpperCase()}</span></td>
      <td class="c-d" title="${t.emotion||'neutral'}">${emoLabel}</td>
      <td>${tags}</td>
      <td>
        <button class="act-view" onclick="viewTrade('${t.id}')">View</button>
        <button class="act-edit" onclick="openModal('${t.id}')" style="margin-left:3px">Edit</button>
        <button class="act-del" onclick="deleteTrade('${t.id}')" style="margin-left:3px">Del</button>
      </td>
    </tr>`;
  }).join('');
}

function sortBy(col) {
  if(sortC===col)sortD*=-1; else{sortC=col;sortD=1;}
  document.querySelectorAll('th').forEach(th=>th.classList.toggle('sorted',th.dataset.s===col));
  renderTable();
}
function setFilter(f) {
  fStatus=f;
  document.querySelectorAll('.ftab').forEach(b=>b.classList.toggle('active',b.dataset.f===f));
  renderTable();
}
function onSearch(q){searchQ=q;renderTable();}
