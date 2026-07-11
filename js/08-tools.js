'use strict';
/* =========================== canvas tools ============================ */
let tool = 'paint', sel = -1;
let drawing = false, pts = [], startPt = null, dragStart = null, opStart = null, moved = false;
let resizing = false, resizeStart = null;
const pbrushSel = document.getElementById('pbrush');
const pshapeSel = document.getElementById('pshape');
/* pressure: real for pen/touch; synthesized from stroke speed for a mouse */
let _pT=0, _pPt=null, _pVal=.7;
function pressureOf(e,pt){
  if((e.pointerType==='pen'||e.pointerType==='touch')&&e.pressure>0)
    return Math.max(.12,Math.min(1,e.pressure));
  const now=performance.now();
  let sp=0;
  if(_pPt){ const dt=Math.max(1,now-_pT); sp=Math.hypot(pt.x-_pPt.x,pt.y-_pPt.y)/dt; }
  _pT=now; _pPt=pt;
  const target=Math.max(.3,Math.min(1,1.05-sp*.5));
  _pVal=_pVal*.6+target*.4;
  return _pVal;
}
const pcolor = document.getElementById('pcolor');
const psize = document.getElementById('psize');
const popacity = document.getElementById('popacity');
document.getElementById('psizeo').textContent = psize.value;
psize.addEventListener('input',()=>document.getElementById('psizeo').textContent=psize.value);
popacity.addEventListener('input',()=>document.getElementById('popacityo').textContent=(popacity.value/100).toFixed(2).replace(/0+$/,'').replace(/\.$/,''));

document.querySelectorAll('.tool').forEach(b=>{
  b.addEventListener('click', ()=>{
    document.querySelectorAll('.tool').forEach(x=>x.classList.remove('active'));
    b.classList.add('active'); tool = b.dataset.tool;
    overlay.className = tool==='select' ? 'pick' : 'draw';
    sel = -1; octx.clearRect(0,0,W,H);
    statusMsgEl.textContent = tool==='select'
      ? 'select: click an object, drag to move - the code updates'
      : tool+': draw on the canvas - it becomes code';
    statusMsgEl.className='ok';
  });
});
window.addEventListener('keydown', e=>{
  if(document.activeElement===ta) return;
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){
    e.preventDefault(); if(e.shiftKey) doRedo(); else doUndo(); return; }
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){ e.preventDefault(); doRedo(); return; }
  const map = {b:'paint', u:'shape', v:'select', i:'eyedrop', g:'recolor'};
  if(map[e.key]) { const btn=document.querySelector(`.tool[data-tool=${map[e.key]}]`); if(btn) btn.click(); }
  const shapeKeys={l:'line', a:'arrow', r:'rect', o:'ellipse', c:'circle',
    s:'star', t:'triangle', h:'heart'};
  if(shapeKeys[e.key]){
    pshapeSel.value=shapeKeys[e.key];
    if(tool!=='shape'){ const sb=document.querySelector('.tool[data-tool=shape]'); if(sb) sb.click(); }
    statusMsgEl.textContent='shape: '+shapeKeys[e.key]; statusMsgEl.className='ok';
  }
  if(/^[0-9]$/.test(e.key)){
    const idx=e.key==='0'?9:(+e.key-1);
    const opt=pbrushSel.options[idx];
    if(opt){ pbrushSel.value=opt.value;
      if(tool!=='paint'){ const pb=document.querySelector('.tool[data-tool=paint]'); if(pb) pb.click(); }
      statusMsgEl.textContent='brush: '+opt.textContent.trim(); statusMsgEl.className='ok'; }
  }
  if((e.key==='Delete'||e.key==='Backspace') && sel>=0 && sel<ops.length){
    appendCode(`hide(${sel})  // hide ${ops[sel].name} #${sel}`);
    sel=-1;
  }
});

function toCanvas(e){ const r = overlay.getBoundingClientRect();
  return { x:(e.clientX-r.left)/r.width*W, y:(e.clientY-r.top)/r.height*H }; }
function fmtOpts(extra){
  const op = popacity.value/100;
  let s = `color: '${pcolor.value}'`+(extra||'');
  if(op<1) s += `, opacity: ${op}`;
  return '{ '+s+' }';
}
function hitTest(x,y){
  for(let i=ops.length-1;i>=0;i--){ const o=ops[i];
    if(!o.selectable||o.hidden||(o.layer&&o.layer.hidden)) continue;
    const b=opBox(o);
    if(x>=b[0] && x<=b[0]+b[2] && y>=b[1] && y<=b[1]+b[3]) return i; }
  return -1;
}
function selHandles(b){
  return [[b[0]-3,b[1]-3],[b[0]+b[2]+3,b[1]-3],
          [b[0]-3,b[1]+b[3]+3],[b[0]+b[2]+3,b[1]+b[3]+3]];
}
function drawSel(){
  octx.clearRect(0,0,W,H);
  if(sel<0||sel>=ops.length) return;
  const op=ops[sel], b=opBox(op);
  octx.save(); octx.strokeStyle='#3794ff'; octx.lineWidth=1.6;
  octx.setLineDash([6,4]);
  octx.strokeRect(b[0]-3, b[1]-3, b[2]+6, b[3]+6);
  octx.setLineDash([]);
  octx.fillStyle='#3794ff';
  for(const h of selHandles(b)) octx.fillRect(h[0]-5,h[1]-5,10,10);
  const site=op.site>=0?runSites[op.site]:null;
  let tip='#'+sel+' '+op.name;
  if(op.layer) tip+=' · '+op.layer.name;
  if(site) tip+=' → line '+srcLine(site.start);
  octx.font='12px ui-monospace,Consolas,monospace';
  const tw=octx.measureText(tip).width;
  let tx0=b[0]-3, ty0=b[1]-28; if(ty0<4) ty0=b[1]+b[3]+12;
  if(tx0+tw+14>W) tx0=W-tw-14; if(tx0<2) tx0=2;
  octx.fillStyle='rgba(30,30,30,.94)';
  octx.fillRect(tx0,ty0,tw+12,19);
  octx.fillStyle='#cccccc'; octx.fillText(tip,tx0+6,ty0+14);
  octx.restore();
}
/* ---- moving objects rewrites their coordinates in the source ---- */
const MOVE_SPEC = {
  circle:{pairs:[[0,1]]}, ring:{pairs:[[0,1]]}, ellipse:{pairs:[[0,1]]},
  rect:{pairs:[[0,1]]}, sun:{pairs:[[0,1]]}, moon:{pairs:[[0,1]]},
  tree:{pairs:[[0,1]]}, text:{pairs:[[0,1]]}, star:{pairs:[[0,1]]},
  ngon:{pairs:[[0,1]]}, heart:{pairs:[[0,1]]}, crescent:{pairs:[[0,1]]},
  line:{pairs:[[0,1],[2,3]]}, arrow:{pairs:[[0,1],[2,3]]},
  triangle:{pairs:[[0,1],[2,3],[4,5]]},
  stroke:{points:0}, polygon:{points:0}, spray:{points:0},
  form:{props:['x','y'], posPairs:[[0,1]]}
};
/* rewrite `key: <number>` inside an object-literal argument span */
function propEdit(src, a0, key, newVal){
  const body=src.slice(a0.start,a0.end);
  const re=new RegExp('(^|[{,\\s])'+key+'(\\s*:\\s*)(-?\\d+(?:\\.\\d+)?)');
  const m=body.match(re); if(!m) return null;
  const numStart=a0.start+m.index+m[1].length+key.length+m[2].length;
  return {start:numStart, end:numStart+m[3].length, text:String(newVal), old:+m[3]};
}
function scanArgs(src, open){
  let depth=0, argStart=open+1, inStr=null; const args=[];
  for(let i=open;i<src.length;i++){
    const ch=src[i];
    if(inStr){ if(ch==='\\'){i++;continue} if(ch===inStr) inStr=null; continue; }
    if(ch==="'"||ch==='"'||ch==='`'){ inStr=ch; continue; }
    if(ch==='('||ch==='['||ch==='{'){ depth++; continue; }
    if(ch===')'||ch===']'||ch==='}'){ depth--;
      if(depth===0&&ch===')'){
        if(i>argStart||args.length) args.push({start:argStart,end:i});
        return {close:i,args}; }
      continue; }
    if(ch===','&&depth===1){ args.push({start:argStart,end:i}); argStart=i+1; }
  }
  return null;
}
function numEdit(src, span, delta){
  const orig=src.slice(span.start,span.end);
  const m=orig.match(/^(\s*)(-?\d+(?:\.\d+)?)(\s*)$/);
  if(!m) return null;
  return {start:span.start,end:span.end,text:m[1]+Math.round(+m[2]+delta)+m[3]};
}
function tryLiteralMove(opIndex, dx, dy){
  const op=ops[opIndex];
  if(!op||op.site===undefined||op.site<0) return false;
  if(siteOpsCount[op.site]!==1) return false;      // loop/flock: one site, many objects
  const site=runSites[op.site]; if(!site) return false;
  const spec=MOVE_SPEC[site.name]; if(!spec) return false;
  const src=lastRunSrc; if(ta.value!==src) return false;
  const sc=scanArgs(src, site.open); if(!sc) return false;
  const edits=[];
  let pairs=spec.pairs;
  if(spec.props){
    const a0=sc.args[0];
    if(a0&&/^\s*\{/.test(src.slice(a0.start,a0.end))){
      const deltas=[dx,dy];
      for(let pi=0;pi<spec.props.length;pi++){
        const m=propEdit(src,a0,spec.props[pi],0);
        if(!m) return false;
        m.text=String(Math.round(m.old+deltas[pi]));
        edits.push(m);
      }
    } else pairs=spec.posPairs;      // older positional form(x, y, w, h, ...)
  }
  if(!edits.length&&pairs){
    for(const pr of pairs){
      const ax=sc.args[pr[0]], ay=sc.args[pr[1]]; if(!ax||!ay) return false;
      const ex=numEdit(src,ax,dx), ey=numEdit(src,ay,dy);
      if(!ex||!ey) return false;                   // expression, not a literal
      edits.push(ex,ey);
    }
  } else if(!edits.length&&spec.points!==undefined){
    const a=sc.args[spec.points]; if(!a) return false;
    const orig=src.slice(a.start,a.end);
    let arr; try{ arr=JSON.parse(orig); }catch(e){ return false; }
    if(!Array.isArray(arr)||!arr.length||!Array.isArray(arr[0])) return false;
    const moved=arr.map(p=>{ const q=[Math.round(p[0]+dx),Math.round(p[1]+dy)];
      if(p.length>2) q.push(p[2]); return q; });
    const lead=orig.match(/^\s*/)[0], trail=orig.match(/\s*$/)[0];
    edits.push({start:a.start,end:a.end,text:lead+JSON.stringify(moved)+trail});
  }
  if(!edits.length) return false;
  edits.sort((a,b)=>b.start-a.start);
  snapshotUndo();
  ta.focus();
  for(const e of edits) ta.setRangeText(e.text, e.start, e.end, 'preserve');
  renderHL(); clearTimeout(debounceT); runCode();
  return true;
}
/* ---- resizing rewrites radii / sizes / point arrays around the shape centre ---- */
const RESIZE_SPEC = {
  circle:{scal:[2]}, ring:{scal:[2]}, sun:{scal:[2]}, moon:{scal:[2]}, tree:{scal:[2]},
  ellipse:{scal:[2,3]}, star:{scal:[3,4]}, ngon:{scal:[3]},
  heart:{scal:[2]}, crescent:{scal:[2]},
  rect:{rect:true}, form:{propsScale:['w','h'], posScal:[2,3]},
  line:{pairsC:[[0,1],[2,3]]}, arrow:{pairsC:[[0,1],[2,3]]},
  triangle:{pairsC:[[0,1],[2,3],[4,5]]},
  stroke:{points:0}, polygon:{points:0}, spray:{points:0}
};
function tryLiteralResize(opIndex, f){
  const op=ops[opIndex];
  if(!op||op.site===undefined||op.site<0) return false;
  if(siteOpsCount[op.site]!==1) return false;
  const site=runSites[op.site]; if(!site) return false;
  const spec=RESIZE_SPEC[site.name]; if(!spec) return false;
  const src=lastRunSrc; if(ta.value!==src) return false;
  const sc=scanArgs(src, site.open); if(!sc) return false;
  const C=[op.bbox[0]+op.bbox[2]/2, op.bbox[1]+op.bbox[3]/2];
  const numRe=/^(\s*)(-?\d+(?:\.\d+)?)(\s*)$/;
  const getNum=span=>{ const m=src.slice(span.start,span.end).match(numRe);
    return m?{lead:m[1],v:+m[2],trail:m[3]}:null; };
  const rnd1=v=>Math.round(v*10)/10;
  const edits=[];
  let scal=spec.scal;
  if(spec.propsScale){
    const a0=sc.args[0];
    if(a0&&/^\s*\{/.test(src.slice(a0.start,a0.end))){
      for(const key of spec.propsScale){
        const m=propEdit(src,a0,key,0);
        if(!m) return false;
        m.text=String(Math.max(2,Math.round(m.old*f)));
        edits.push(m);
      }
    } else scal=spec.posScal;        // older positional form(x, y, w, h, ...)
  }
  if(edits.length){
    // labelled properties handled above
  } else if(scal){
    for(const ai of scal){ const a=sc.args[ai]; if(!a) return false;
      const n=getNum(a); if(!n) return false;
      edits.push({start:a.start,end:a.end,text:n.lead+Math.max(1,rnd1(n.v*f))+n.trail}); }
  } else if(spec.rect){
    const ns=[0,1,2,3].map(i=>sc.args[i]&&getNum(sc.args[i]));
    if(ns.some(n=>!n)) return false;
    const cx=ns[0].v+ns[2].v/2, cy=ns[1].v+ns[3].v/2;
    const nw=Math.max(2,rnd1(ns[2].v*f)), nh=Math.max(2,rnd1(ns[3].v*f));
    const vals=[rnd1(cx-nw/2), rnd1(cy-nh/2), nw, nh];
    for(let i=0;i<4;i++) edits.push({start:sc.args[i].start,end:sc.args[i].end,
      text:ns[i].lead+vals[i]+ns[i].trail});
  } else if(spec.pairsC){
    for(const pr of spec.pairsC){
      const ax=sc.args[pr[0]], ay=sc.args[pr[1]]; if(!ax||!ay) return false;
      const nx=getNum(ax), ny=getNum(ay); if(!nx||!ny) return false;
      edits.push({start:ax.start,end:ax.end,text:nx.lead+Math.round(C[0]+(nx.v-C[0])*f)+nx.trail});
      edits.push({start:ay.start,end:ay.end,text:ny.lead+Math.round(C[1]+(ny.v-C[1])*f)+ny.trail});
    }
  } else if(spec.points!==undefined){
    const a=sc.args[spec.points]; if(!a) return false;
    const orig=src.slice(a.start,a.end);
    let arr; try{ arr=JSON.parse(orig); }catch(e){ return false; }
    if(!Array.isArray(arr)||!arr.length||!Array.isArray(arr[0])) return false;
    const moved=arr.map(p=>{ const q=[Math.round(C[0]+(p[0]-C[0])*f),Math.round(C[1]+(p[1]-C[1])*f)];
      if(p.length>2) q.push(p[2]); return q; });
    const lead=orig.match(/^\s*/)[0], trail=orig.match(/\s*$/)[0];
    edits.push({start:a.start,end:a.end,text:lead+JSON.stringify(moved)+trail});
  } else return false;
  edits.sort((a,b)=>b.start-a.start);
  snapshotUndo();
  ta.focus();
  for(const e of edits) ta.setRangeText(e.text, e.start, e.end, 'preserve');
  renderHL(); clearTimeout(debounceT); runCode();
  return true;
}
/* ---- recolouring rewrites the color: literal inside the call ---- */
function tryRecolor(opIndex, color){
  const op=ops[opIndex];
  if(!op||op.site===undefined||op.site<0) return false;
  if(siteOpsCount[op.site]!==1) return false;
  const site=runSites[op.site]; if(!site) return false;
  const src=lastRunSrc; if(ta.value!==src) return false;
  const sc=scanArgs(src, site.open); if(!sc) return false;
  for(let ai=sc.args.length-1;ai>=0;ai--){
    const span=sc.args[ai], s=src.slice(span.start,span.end);
    if(!/^\s*\{/.test(s)) continue;
    const m=s.match(/(color\s*:\s*)(['"])((?:[^'"\\]|\\.)*?)\2/);
    snapshotUndo(); ta.focus();
    if(m){
      const st=span.start+m.index+m[1].length;
      ta.setRangeText("'"+color+"'", st, st+(m[0].length-m[1].length), 'preserve');
    }else{
      const bi=span.start+s.indexOf('{')+1;
      ta.setRangeText(" color: '"+color+"',", bi, bi, 'preserve');
    }
    renderHL(); clearTimeout(debounceT); runCode();
    return true;
  }
  snapshotUndo(); ta.focus();
  ta.setRangeText(", { color: '"+color+"' }", sc.close, sc.close, 'preserve');
  renderHL(); clearTimeout(debounceT); runCode();
  return true;
}
function addNudge(i,dx,dy){
  dx=Math.round(dx); dy=Math.round(dy);
  if(!dx&&!dy) return;
  const re = new RegExp('nudge\\(\\s*'+i+'\\s*,\\s*(-?\\d+(?:\\.\\d+)?)\\s*,\\s*(-?\\d+(?:\\.\\d+)?)\\s*\\)');
  const src = ta.value, m = src.match(re);
  if(m){ setCode(src.replace(re, `nudge(${i}, ${Math.round(+m[1]+dx)}, ${Math.round(+m[2]+dy)})`)); }
  else appendCode(`nudge(${i}, ${dx}, ${dy})  // move ${ops[i]?ops[i].name:'object'} #${i}`);
  if(i<ops.length){ sel=i; drawSel(); }
}
function simplify(points, maxN){
  if(points.length<=maxN) return points;
  const out=[], step=(points.length-1)/(maxN-1);
  for(let i=0;i<maxN;i++) out.push(points[Math.round(i*step)]);
  return out;
}

overlay.addEventListener('pointerdown', e=>{
  overlay.setPointerCapture(e.pointerId);
  const p = toCanvas(e);
  if(tool==='select'){
    if(ta.value!==lastRunSrc){ clearTimeout(debounceT); runCode(); }
    // corner handle first: resize the current selection
    if(sel>=0&&sel<ops.length){
      const b=opBox(ops[sel]);
      for(const h of selHandles(b)){
        if(Math.abs(p.x-h[0])<9&&Math.abs(p.y-h[1])<9){
          resizing=true; moved=false; dragStart=null;
          const cx=b[0]+b[2]/2, cy=b[1]+b[3]/2;
          resizeStart={cx,cy,d0:Math.max(8,Math.hypot(p.x-cx,p.y-cy))};
          if(ops.length>60) buildDragCache(sel); else dragCacheUpto=-1;
          return;
        }
      }
    }
    sel = hitTest(p.x,p.y); moved=false; resizing=false;
    drawSel();
    if(sel>=0){ dragStart=p; opStart=[ops[sel].tx,ops[sel].ty];
      if(ops.length>60) buildDragCache(sel); else dragCacheUpto=-1;
      const op=ops[sel], site=op.site>=0?runSites[op.site]:null;
      if(site) revealLine(srcLine(site.start));
      statusMsgEl.textContent=`selected ${op.name} #${sel}`
        +(site?` → line ${srcLine(site.start)}`:'')
        +' - drag to move · corner handles resize · Delete hides';
      statusMsgEl.className='ok';
    } else { dragStart=null; linebarLine=-1; positionLinebar();
      statusMsgEl.textContent='nothing selectable there (skies, water and texture layers are fixed)';
      statusMsgEl.className='ok'; }
    return;
  }
  if(tool==='eyedrop'){
    const d=ctx.getImageData(Math.max(0,Math.min(W*DPR-1,Math.round(p.x*DPR))),
      Math.max(0,Math.min(H*DPR-1,Math.round(p.y*DPR))),1,1).data;
    pcolor.value='#'+[d[0],d[1],d[2]].map(v=>v.toString(16).padStart(2,'0')).join('');
    statusMsgEl.textContent='picked colour '+pcolor.value; statusMsgEl.className='ok';
    return;
  }
  if(tool==='recolor'){
    if(ta.value!==lastRunSrc){ clearTimeout(debounceT); runCode(); }
    const i=hitTest(p.x,p.y);
    if(i<0){ statusMsgEl.textContent='nothing to recolour there'; statusMsgEl.className='ok'; return; }
    const nm=ops[i].name;
    if(tryRecolor(i,pcolor.value)){
      sel=i; if(sel<ops.length) drawSel();
      statusMsgEl.textContent=`recoloured ${nm} #${i} to ${pcolor.value} - its code was rewritten`;
      statusMsgEl.className='ok';
    } else { statusMsgEl.textContent=`can't recolour a loop-made ${nm} - edit its code instead`;
      statusMsgEl.className='ok'; }
    return;
  }
  drawing = true; startPt = p;
  if(tool==='paint'){
    _pPt=null; _pVal=.7;
    pts = [[Math.round(p.x),Math.round(p.y),Math.round(pressureOf(e,p)*100)/100]];
  } else pts = [[Math.round(p.x),Math.round(p.y)]];
});
overlay.addEventListener('pointermove', e=>{
  const p = toCanvas(e);
  statusPosEl.textContent = `x ${Math.round(p.x)}  y ${Math.round(p.y)}`;
  if(tool==='select'){
    if(resizing && sel>=0 && sel<ops.length){
      const f=Math.max(.08,Math.min(12,
        Math.hypot(p.x-resizeStart.cx,p.y-resizeStart.cy)/resizeStart.d0));
      if(Math.abs(f-1)>.02) moved=true;
      ops[sel].psc=f;
      previewRender(); drawSel();
      return;
    }
    if(dragStart && sel>=0){
      const s=ops[sel].layer?ops[sel].layer.scale:1;
      const dx=(p.x-dragStart.x)/s, dy=(p.y-dragStart.y)/s;
      if(Math.abs(dx)+Math.abs(dy)>2) moved=true;
      ops[sel].tx=opStart[0]+dx; ops[sel].ty=opStart[1]+dy;
      previewRender(); drawSel();
    }
    return;
  }
  if(!drawing) return;
  const op = popacity.value/100, size=+psize.value, col=pcolor.value;
  octx.clearRect(0,0,W,H);
  octx.lineCap='round'; octx.lineJoin='round';
  if(tool==='paint'){
    const evs=e.getCoalescedEvents?e.getCoalescedEvents():[e];
    for(const ce of evs){
      const cp=toCanvas(ce);
      const last=pts[pts.length-1];
      if(Math.hypot(cp.x-last[0],cp.y-last[1])<2.2) continue;
      pts.push([Math.round(cp.x),Math.round(cp.y),
        Math.round(pressureOf(ce,cp)*100)/100]);
    }
    renderBrushStroke(octx, pts,
      {brush:pbrushSel.value, color:col, size, opacity:op,
       tune:brushTune(pbrushSel.value)||undefined}, 12345);
  } else if(tool==='shape'){
    octx.globalAlpha=op;
    drawShapePreview(octx, pshapeSel.value, startPt.x, startPt.y, p.x, p.y, size, col);
  }
  octx.globalAlpha=1;
});
function drawShapePreview(c, kind, sx, sy, px, py, size, col){
  c.strokeStyle=col; c.fillStyle=col; c.lineWidth=size; c.lineCap='round';
  const r=Math.hypot(px-sx,py-sy)||1;
  const poly=pts=>{ c.beginPath();
    pts.forEach((q,i)=>i?c.lineTo(q[0],q[1]):c.moveTo(q[0],q[1]));
    c.closePath(); c.fill(); };
  const gonPts=n=>{ const out=[];
    for(let i=0;i<n;i++){ const a=i*2*Math.PI/n-Math.PI/2;
      out.push([sx+Math.cos(a)*r, sy+Math.sin(a)*r]); } return out; };
  if(kind==='line'){
    c.beginPath(); c.moveTo(sx,sy); c.lineTo(px,py); c.stroke();
  } else if(kind==='arrow'){
    const head=Math.max(9,size*3.2), ang=Math.atan2(py-sy,px-sx);
    c.beginPath(); c.moveTo(sx,sy);
    c.lineTo(px-Math.cos(ang)*head*.7, py-Math.sin(ang)*head*.7); c.stroke();
    c.beginPath(); c.moveTo(px,py);
    c.lineTo(px-Math.cos(ang-.42)*head, py-Math.sin(ang-.42)*head);
    c.lineTo(px-Math.cos(ang+.42)*head, py-Math.sin(ang+.42)*head);
    c.closePath(); c.fill();
  } else if(kind==='rect'){
    c.fillRect(Math.min(sx,px),Math.min(sy,py),Math.abs(px-sx),Math.abs(py-sy));
  } else if(kind==='ellipse'){
    c.beginPath();
    c.ellipse(sx,sy,Math.abs(px-sx)||1,Math.abs(py-sy)||1,0,0,7); c.fill();
  } else if(kind==='circle'){
    c.beginPath(); c.arc(sx,sy,r,0,7); c.fill();
  } else if(kind==='ring'){
    c.lineWidth=Math.max(2,size); c.beginPath(); c.arc(sx,sy,r,0,7); c.stroke();
  } else if(kind==='triangle'){
    poly([[sx,sy-r],[sx+r*.87,sy+r*.5],[sx-r*.87,sy+r*.5]]);
  } else if(kind==='diamond'){ poly(gonPts(4));
  } else if(kind==='pentagon'){ poly(gonPts(5));
  } else if(kind==='hexagon'){ poly(gonPts(6));
  } else if(kind==='star'){
    const pts=[];
    for(let i=0;i<10;i++){ const rr=i%2?r*.45:r, a=i*Math.PI/5-Math.PI/2;
      pts.push([sx+Math.cos(a)*rr, sy+Math.sin(a)*rr]); }
    poly(pts);
  } else if(kind==='heart'){
    const s=r;
    c.beginPath();
    c.moveTo(sx,sy+s*.95);
    c.bezierCurveTo(sx-s*1.15,sy+s*.2, sx-s*.95,sy-s*.8, sx,sy-s*.2);
    c.bezierCurveTo(sx+s*.95,sy-s*.8, sx+s*1.15,sy+s*.2, sx,sy+s*.95);
    c.closePath(); c.fill();
  } else if(kind==='crescent'){
    const cxi=sx-r*.35, rr=Math.hypot(r*.35,r), a=Math.atan2(r,r*.35);
    c.beginPath();
    c.arc(sx,sy,r,-Math.PI/2,Math.PI/2,false);
    c.arc(cxi,sy,rr,a,-a,true);
    c.closePath(); c.fill();
  }
}
overlay.addEventListener('pointerup', e=>{
  const p = toCanvas(e);
  if(tool==='select'){
    if(resizing && sel>=0 && sel<ops.length){
      const f=ops[sel].psc; ops[sel].psc=1;
      resizing=false; resizeStart=null;
      if(moved&&Math.abs(f-1)>.02){
        const keep=sel, nm=ops[sel].name;
        if(tryLiteralResize(sel,f)){
          sel=keep; if(sel<ops.length) drawSel();
          statusMsgEl.textContent=`resized ${nm} #${keep} ×${f.toFixed(2)} - its code was rewritten`;
          statusMsgEl.className='ok';
        } else {
          appendCode(`resize(${sel}, ${+f.toFixed(2)})  // resize ${nm} #${sel}`);
          if(keep<ops.length){ sel=keep; drawSel(); }
        }
      } else { previewRender(); drawSel(); }
      dragCacheUpto=-1;
      return;
    }
    if(dragStart && sel>=0 && moved){
      const s=ops[sel].layer?ops[sel].layer.scale:1;
      const dx=(p.x-dragStart.x)/s, dy=(p.y-dragStart.y)/s;
      const keep=sel, nm=ops[sel]?ops[sel].name:'object';
      if(tryLiteralMove(sel, dx, dy)){
        sel=keep; if(sel<ops.length) drawSel();
        statusMsgEl.textContent=`moved ${nm} #${keep} - its coordinates were rewritten in the code`;
        statusMsgEl.className='ok';
      } else if(ops[sel]&&ops[sel].bake){
        appendCode('hide('+sel+')  // baked into its own call below\n'+ops[sel].bake(dx,dy));
        sel=-1; octx.clearRect(0,0,W,H);
        statusMsgEl.textContent=`that ${nm} came from a flock - it now has its own editable tree(...) call at the new position`;
        statusMsgEl.className='ok';
      } else {
        const siteNm=ops[sel]&&ops[sel].site>=0&&runSites[ops[sel].site]
          ?runSites[ops[sel].site].name:'loop';
        addNudge(sel, dx, dy);
        statusMsgEl.textContent=`moved via nudge() - one ${siteNm}(...) call paints many objects, so there's no single coordinate to rewrite for this ${nm}`;
        statusMsgEl.className='ok';
      }
    }
    dragStart=null; dragCacheUpto=-1;
    return;
  }
  if(!drawing) return;
  drawing=false; octx.clearRect(0,0,W,H);
  const size=+psize.value, opv=popacity.value/100, col=pcolor.value;
  const rx=Math.round(p.x), ry=Math.round(p.y), sx=Math.round(startPt.x), sy=Math.round(startPt.y);
  const opStr=opv<1?`, opacity: ${opv}`:'';
  if(tool==='paint'){
    const brush=pbrushSel.value;
    const sp=simplify(pts, 140);
    const colStr=(brush==='eraser'||brush==='smudge')?'':`, color: '${col}'`;
    const tune=brushTune(brush);
    let tuneStr='';
    if(tune){ const parts=Object.keys(tune).map(k=>
        k+': '+(typeof tune[k]==='string'?"'"+tune[k]+"'":tune[k]));
      tuneStr=', tune: { '+parts.join(', ')+' }'; }
    appendCode(`stroke(${JSON.stringify(sp)}, { brush: '${brush}'${colStr}, size: ${size}${opStr}${tuneStr} })`
      +(brush==='eraser'?'  // eraser':(brush==='smudge'?'  // smudge':'')));
  } else if(tool==='shape'){
    const kind=pshapeSel.value;
    const r=Math.round(Math.hypot(rx-sx,ry-sy));
    if(kind==='line'){
      if(r>3) appendCode(`line(${sx}, ${sy}, ${rx}, ${ry}, ${fmtOpts(`, size: ${size}`)})`);
    } else if(kind==='arrow'){
      if(r>5) appendCode(`arrow(${sx}, ${sy}, ${rx}, ${ry}, ${fmtOpts(`, size: ${size}`)})`);
    } else if(kind==='rect'){
      const w=Math.abs(rx-sx), h=Math.abs(ry-sy);
      if(w>3&&h>3) appendCode(`rect(${Math.min(sx,rx)}, ${Math.min(sy,ry)}, ${w}, ${h}, ${fmtOpts()})`);
    } else if(kind==='ellipse'){
      const rxx=Math.abs(rx-sx), ryy=Math.abs(ry-sy);
      if(rxx>2&&ryy>2) appendCode(`ellipse(${sx}, ${sy}, ${rxx}, ${ryy}, ${fmtOpts()})`);
    } else if(kind==='circle'){
      if(r>2) appendCode(`circle(${sx}, ${sy}, ${r}, ${fmtOpts()})`);
    } else if(kind==='ring'){
      if(r>2) appendCode(`ring(${sx}, ${sy}, ${r}, ${fmtOpts(`, size: ${Math.max(2,size)}`)})`);
    } else if(kind==='triangle'){
      if(r>3) appendCode(`triangle(${sx}, ${sy-r}, ${sx+Math.round(r*.87)}, ${sy+Math.round(r*.5)}, ${sx-Math.round(r*.87)}, ${sy+Math.round(r*.5)}, ${fmtOpts()})`);
    } else if(kind==='diamond'){
      if(r>3) appendCode(`ngon(${sx}, ${sy}, 4, ${r}, ${fmtOpts()})`);
    } else if(kind==='pentagon'){
      if(r>3) appendCode(`ngon(${sx}, ${sy}, 5, ${r}, ${fmtOpts()})`);
    } else if(kind==='hexagon'){
      if(r>3) appendCode(`ngon(${sx}, ${sy}, 6, ${r}, ${fmtOpts()})`);
    } else if(kind==='star'){
      if(r>3) appendCode(`star(${sx}, ${sy}, 5, ${r}, ${Math.round(r*.45)}, ${fmtOpts()})`);
    } else if(kind==='heart'){
      if(r>3) appendCode(`heart(${sx}, ${sy}, ${r*2}, ${fmtOpts()})`);
    } else if(kind==='crescent'){
      if(r>3) appendCode(`crescent(${sx}, ${sy}, ${r}, ${fmtOpts()})`);
    }
  }
});
overlay.addEventListener('pointerleave', ()=>{ statusPosEl.textContent=''; });

