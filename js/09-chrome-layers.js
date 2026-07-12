'use strict';
/* ============================ chrome ============================ */
const divider=document.getElementById('divider'), leftPane=document.getElementById('left');
divider.addEventListener('pointerdown', e=>{
  divider.setPointerCapture(e.pointerId);
  const move = ev=>{ const mainR=document.querySelector('main').getBoundingClientRect();
    const w=Math.min(Math.max(ev.clientX-mainR.left,240), mainR.width-320);
    leftPane.style.width=w+'px'; };
  const up = ()=>{ divider.removeEventListener('pointermove',move);
    divider.removeEventListener('pointerup',up); };
  divider.addEventListener('pointermove',move);
  divider.addEventListener('pointerup',up);
});
document.getElementById('exportBtn').addEventListener('click', ()=>{
  const a=document.createElement('a'); a.download='paintlang.png';
  a.href=paintCanvas.toDataURL('image/png'); a.click();
});

/* ---- share links: the whole painting travels compressed in the URL hash,
   no server needed ---- */
async function codeToHash(src){
  try{
    const cs=new CompressionStream('deflate-raw');
    const buf=await new Response(new Blob([src]).stream().pipeThrough(cs)).arrayBuffer();
    const u=new Uint8Array(buf);
    let s=''; for(let i=0;i<u.length;i+=0x8000)
      s+=String.fromCharCode.apply(null,u.subarray(i,i+0x8000));
    return 'z'+btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }catch(e){
    return 'p'+btoa(unescape(encodeURIComponent(src)))
      .replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }
}
async function hashToCode(h){
  const kind=h[0], b64=h.slice(1).replace(/-/g,'+').replace(/_/g,'/');
  const bin=atob(b64);
  if(kind==='p') return decodeURIComponent(escape(bin));
  const u=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) u[i]=bin.charCodeAt(i);
  const ds=new DecompressionStream('deflate-raw');
  return await new Response(new Blob([u]).stream().pipeThrough(ds)).text();
}
document.getElementById('shareBtn').addEventListener('click', async ()=>{
  const h=await codeToHash(ta.value);
  let url, kind;
  if(h.length>1800){
    // big paintings: clipboards and chat apps mangle huge fragments, so the
    // compressed payload is stored server-side and the link is a 6-char id
    try{
      const r=await fetch(TRACE_API+'/api/share',{method:'POST',
        headers:{'content-type':'application/json'}, body:JSON.stringify({h})});
      const j=await r.json();
      if(!r.ok||!j.id) throw new Error(j.error||'share service unavailable');
      url=location.origin+location.pathname+'?s='+j.id; kind='short link';
    }catch(e){
      statusMsgEl.textContent='could not create the share link: '+e.message;
      statusMsgEl.className='err'; return;
    }
  }else{
    url=location.origin+location.pathname+'#'+h;
    kind=(url.length/1024).toFixed(1)+' kb link';
  }
  let copied=false;
  try{
    await navigator.clipboard.writeText(url);
    // verify: large writes can "succeed" while the clipboard keeps old content
    try{ copied=(await navigator.clipboard.readText())===url; }
    catch(e){ copied=true; }   // no read permission: trust the write
  }catch(e){}
  if(!copied){
    prompt('Copy this share link (Ctrl+C):', url);
    copied=true;
  }
  statusMsgEl.textContent='share '+kind+' copied - anyone who opens it gets this painting, code and all';
  statusMsgEl.className='ok';
});
/* ---- painting replay: reveal the ops in paint order, strokes gradually ----
   startReplay(opts) accepts {speed, media, onEnd}: speed scales the pace
   (0.5 = half speed), media re-renders every stroke bundle in another medium
   for the run, onEnd(finished) fires once - true after a full run, false on
   cancel. The video exporter in 12-account.js records the canvas through it. */
let replayActive=false, replayOpts=null;
function cancelReplay(){
  if(!replayActive) return;
  replayActive=false;
  const cb=replayOpts&&replayOpts.onEnd; replayOpts=null;
  const b=document.getElementById('replayBtn');
  if(b) b.innerHTML=plIco('play')+' Replay';
  if(statusMsgEl.textContent.indexOf('replaying')===0){
    statusMsgEl.textContent='ready'; statusMsgEl.className='ok';
  }
  if(cb) cb(false);
}
function startReplay(opts){
  if(replayActive) return;
  if(!ops.length){ statusMsgEl.textContent='nothing to replay yet'; return; }
  replayActive=true; replayOpts=opts||null;
  const speed=(opts&&opts.speed)||1;
  const media=(opts&&opts.media)||null;
  document.getElementById('replayBtn').innerHTML=plIco('stop')+' Stop';
  statusMsgEl.textContent='replaying the painting...'; statusMsgEl.className='ok';
  // build the reveal plan: forms appear whole, stroke bundles in slices
  const plan=[];
  for(const op of ops){
    if(op.hidden||(op.layer&&op.layer.hidden)) continue;
    if(op._strokes){
      const n=op._strokes.list.length;
      const per=Math.max(3,Math.ceil(n/64));
      for(let i=0;i<n;i+=per) plan.push({op, s0:i, s1:Math.min(n,i+per)});
    } else plan.push({op});
  }
  const totalFrames=Math.max(120,
    Math.round(Math.max(480,Math.min(1600,plan.length*2.2))/speed));
  const perFrame=plan.length/totalFrames;
  let idx=0, acc=0;
  ctx.setTransform(DPR,0,0,DPR,0,0);
  ctx.fillStyle='#f6f1e7'; ctx.fillRect(0,0,W,H);
  octx.clearRect(0,0,W,H);
  if(typeof hideSelAction==='function') hideSelAction();
  function frame(){
    if(!replayActive){ renderOps(); return; }
    acc+=perFrame;
    while(acc>=1&&idx<plan.length){
      acc-=1;
      const it=plan[idx++];
      ctx.save(); applyOpTransform(ctx,it.op);
      try{
        if(it.op._strokes&&it.s0!==undefined)
          drawStrokesRange(ctx, media?Object.assign({},it.op._strokes,{media}):it.op._strokes,
            it.s0, it.s1);
        else it.op.draw(ctx);
      }catch(e){}
      ctx.restore();
    }
    if(idx>=plan.length){
      const cb=replayOpts&&replayOpts.onEnd; replayOpts=null;
      cancelReplay();
      if(cb) cb(true);           // recorder stops on the finished artwork
      renderOps();               // final proper render (reflections and all)
      statusMsgEl.textContent='replay finished'; statusMsgEl.className='ok';
      return;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
document.getElementById('replayBtn').addEventListener('click',()=>{
  if(replayActive){ cancelReplay(); renderOps(); }
  else startReplay();
});

/* ---- first-visit welcome card ---- */
const welcomeEl=document.getElementById('welcome');
try{ if(!localStorage.getItem('paintlang-welcomed')) welcomeEl.hidden=false; }catch(e){}
function dismissWelcome(){
  welcomeEl.hidden=true;
  try{ localStorage.setItem('paintlang-welcomed','1'); }catch(e){}
}
document.getElementById('welcomeGo').addEventListener('click',dismissWelcome);
document.getElementById('welcomeRef').addEventListener('click',()=>{
  dismissWelcome();
  document.getElementById('helpModal').hidden=false;
});
welcomeEl.addEventListener('click',e=>{ if(e.target===welcomeEl) dismissWelcome(); });

const helpModal=document.getElementById('helpModal');
document.getElementById('helpBtn').addEventListener('click',()=>helpModal.hidden=false);
document.getElementById('helpClose').addEventListener('click',()=>helpModal.hidden=true);
helpModal.addEventListener('click',e=>{ if(e.target===helpModal) helpModal.hidden=true; });
window.addEventListener('keydown',e=>{ if(e.key==='Escape') helpModal.hidden=true; });

/* ============================ layers strip ============================ */
function layerBlocks(){
  const src=lastRunSrc||'';
  const Ls=runSites.filter(s=>s.name==='layer');
  // block start = the layer() line, extended up over its comment header
  const starts=Ls.map(s=>{
    let st=src.lastIndexOf('\n',s.start)+1;
    while(st>0){
      const prevStart=src.lastIndexOf('\n',st-2)+1;
      const prevLine=src.slice(prevStart,st-1).trim();
      if(prevLine.startsWith('//')||prevLine==='') st=prevStart; else break;
      if(prevStart===0) break;
    }
    return st;
  });
  const blocks=[];
  for(let i=0;i<Ls.length;i++){
    const en=i+1<Ls.length? starts[i+1] : src.length;
    let nm='';
    const sc=scanArgs(src,Ls[i].open);
    if(sc&&sc.args[0]){
      const m=src.slice(sc.args[0].start,sc.args[0].end).match(/['"]([^'"]*)['"]/);
      if(m) nm=m[1];
    }
    blocks.push({name:nm, start:starts[i], end:en, site:Ls[i]});
  }
  return blocks;
}
function moveLayer(name,dir){
  if(ta.value!==lastRunSrc){ clearTimeout(debounceT); runCode(); }
  const bs=layerBlocks();
  const i=bs.findIndex(b=>b.name===name), j=i+dir;
  if(i<0||j<0||j>=bs.length) return;
  const src=ta.value;
  const a=bs[Math.min(i,j)], b=bs[Math.max(i,j)];
  setCode(src.slice(0,a.start)+src.slice(b.start,b.end)
    +src.slice(a.start,b.start)+src.slice(b.end));
}
function setLayerOpt(name,key,val){
  if(ta.value!==lastRunSrc){ clearTimeout(debounceT); runCode(); }
  const bs=layerBlocks(); const b=bs.find(x=>x.name===name);
  const L=layersRun.find(x=>x.name===name);
  if(!b||!L) return;
  const nv={x:L.x,y:L.y,scale:L.scale,hidden:L.hidden}; nv[key]=val;
  const parts=[];
  if(nv.x) parts.push('x: '+Math.round(nv.x));
  if(nv.y) parts.push('y: '+Math.round(nv.y));
  if(nv.scale!==1) parts.push('scale: '+(+(+nv.scale).toFixed(2)));
  if(nv.hidden) parts.push('hidden: true');
  const argstr="'"+name+"'"+(parts.length?', { '+parts.join(', ')+' }':'');
  const sc=scanArgs(ta.value,b.site.open); if(!sc) return;
  snapshotUndo(); ta.focus();
  ta.setRangeText(argstr, b.site.open+1, sc.close, 'preserve');
  renderHL(); clearTimeout(debounceT); runCode();
}
function toggleLayer(name){
  const L=layersRun.find(x=>x.name===name);
  if(L) setLayerOpt(name,'hidden',!L.hidden);
}
function renameLayer(oldName,newName){
  newName=newName.replace(/['\\\n]/g,'').slice(0,32);
  if(!newName) return;
  if(layersRun.some(l=>l.name===newName)){
    statusMsgEl.textContent='a layer named "'+newName+'" already exists';
    statusMsgEl.className='ok'; return;
  }
  const bs=layerBlocks(); const b=bs.find(x=>x.name===oldName); if(!b) return;
  const sc=scanArgs(ta.value,b.site.open); if(!sc||!sc.args[0]) return;
  const span=sc.args[0], orig=ta.value.slice(span.start,span.end);
  const m=orig.match(/(['"]).*?\1/); if(!m) return;
  snapshotUndo(); ta.focus();
  ta.setRangeText("'"+newName+"'", span.start+m.index, span.start+m.index+m[0].length,'preserve');
  renderHL(); clearTimeout(debounceT); runCode();
}
function deleteLayer(name){
  const bs=layerBlocks(); const i=bs.findIndex(b=>b.name===name); if(i<0) return;
  if(!confirm('Delete layer "'+name+'" and everything painted on it?')) return;
  const src=ta.value, b=bs[i];
  setCode(src.slice(0,b.start)+src.slice(b.end));
}
/* per-document layers pane, front-most layer listed first */
function renderLayerChips(){
  const pane=document.getElementById('layersPane');
  const list=document.getElementById('layerList');
  list.innerHTML='';
  if(!layersRun.length){ pane.hidden=true; return; }
  pane.hidden=false;
  const mkBtn=(txt,title,fn)=>{ const b=document.createElement('button');
    if(txt.startsWith('<svg')) b.innerHTML=txt; else b.textContent=txt;
    b.title=title; b.addEventListener('click',fn); return b; };
  [...layersRun].reverse().forEach(L=>{
    const row=document.createElement('div');
    row.className='lrow'+(L.hidden?' off':'');
    const nm=document.createElement('div');
    nm.className='lname';
    nm.textContent=L.name; nm.title=L.name+' - double-click to rename';
    nm.addEventListener('dblclick',()=>{
      const n=prompt('Rename layer', L.name);
      if(n&&n.trim()) renameLayer(L.name, n.trim());
    });
    row.appendChild(nm);
    const ctl=document.createElement('div');
    ctl.className='lctl';
    ctl.appendChild(mkBtn(plIco(L.hidden?'eyeoff':'eye'),'show / hide this layer',()=>toggleLayer(L.name)));
    ctl.appendChild(mkBtn(plIco('up'),'bring forward',()=>moveLayer(L.name,1)));
    ctl.appendChild(mkBtn(plIco('down'),'send back',()=>moveLayer(L.name,-1)));
    ctl.appendChild(mkBtn(plIco('copy'),'copy this layer as a reusable component (paste into any tab)',()=>{
      const bs=layerBlocks(); const b=bs.find(x=>x.name===L.name);
      if(!b) return;
      const snippet=ta.value.slice(b.start,b.end);
      navigator.clipboard.writeText(snippet).then(()=>{
        statusMsgEl.textContent='layer '+JSON.stringify(L.name)+' copied as a component - paste it into any painting tab';
        statusMsgEl.className='ok';
      }).catch(()=>{ statusMsgEl.textContent='could not reach the clipboard'; statusMsgEl.className='ok'; });
    }));
    ctl.appendChild(mkBtn(plIco('trash'),'delete this layer',()=>deleteLayer(L.name)));
    const sc=document.createElement('input');
    sc.type='number'; sc.step='0.1'; sc.min='0.1'; sc.max='6'; sc.value=L.scale;
    sc.className='lscale';
    sc.title='layer scale (also editable in code: layer(name, { scale, x, y }))';
    sc.addEventListener('change',()=>setLayerOpt(L.name,'scale',parseFloat(sc.value)||1));
    ctl.appendChild(sc);
    row.appendChild(ctl);
    list.appendChild(row);
  });
}
/* resizable layers pane */
(function(){
  const pane=document.getElementById('layersPane');
  const grip=document.getElementById('lpResize');
  if(!pane||!grip) return;
  try{ const w=localStorage.getItem('paintlang-lpw');
    if(w) pane.style.width=Math.min(420,Math.max(150,+w))+'px'; }catch(e){}
  grip.addEventListener('pointerdown', e=>{
    grip.setPointerCapture(e.pointerId);
    const startX=e.clientX, startW=pane.getBoundingClientRect().width;
    const move=ev=>{
      const w=Math.min(420,Math.max(150,startW+(startX-ev.clientX)));
      pane.style.width=w+'px';
    };
    const up=ev=>{
      grip.removeEventListener('pointermove',move);
      grip.removeEventListener('pointerup',up);
      try{ localStorage.setItem('paintlang-lpw',
        String(Math.round(pane.getBoundingClientRect().width))); }catch(e2){}
    };
    grip.addEventListener('pointermove',move);
    grip.addEventListener('pointerup',up);
  });
})();

/* ============================ document tabs ============================
   One painting per tab, mirrored above the code and the canvas; the layers
   pane always shows the active tab's layers. Tabs persist in localStorage. */
let docs=[], activeDoc=0, _persistT=null;
const BLANK_DOC="// - blank canvas -\nseed(1)\nbackground('#f6f1e7')\n\n// pick a tool and paint - or Import image to trace a new painting\n";
function persistDocs(){
  clearTimeout(_persistT);
  _persistT=setTimeout(()=>{
    try{
      if(docs[activeDoc]) docs[activeDoc].code=ta.value;
      localStorage.setItem('paintlang-docs-v1',
        JSON.stringify({a:activeDoc,
          d:docs.map(d=>({n:d.name, c:d.code, w:d.cloudId||undefined}))}));
    }catch(e){ /* storage quota: keep working without persistence */ }
  },800);
}
function uniqueDocName(base){
  base=(base||'painting').slice(0,40);
  let n=base, k=2;
  while(docs.some(d=>d.name===n)) n=base+'-'+(k++);
  return n;
}
function activateDoc(i){
  const d=docs[i]; if(!d) return;
  activeDoc=i;
  undoStack=d.undo; redoStack=d.redo;
  sel=-1; dragCacheUpto=-1; opCache.src=null;
  hideScrub();
  ta.value=d.code; ta.scrollTop=0;
  renderHL(); runCode(); renderTabs(); persistDocs();
}
function switchDoc(i){
  if(i===activeDoc||!docs[i]) return;
  if(docs[activeDoc]) docs[activeDoc].code=ta.value;
  activateDoc(i);
}
function newDoc(name,code){
  if(docs[activeDoc]) docs[activeDoc].code=ta.value;
  docs.push({name:uniqueDocName(name), code:code!==undefined?code:BLANK_DOC, undo:[], redo:[]});
  activateDoc(docs.length-1);
}
function closeDoc(i){
  if(docs.length<2||!docs[i]) return;
  if(!confirm('Close "'+docs[i].name+'"? This painting is removed (share or export it first if you want to keep it).')) return;
  docs.splice(i,1);
  if(i<activeDoc) activeDoc--;
  activateDoc(Math.min(activeDoc,docs.length-1));
}
function renderTabs(){
  for(const holder of [document.getElementById('codeTabs'),document.getElementById('canvasTabs')]){
    if(!holder) continue;
    holder.innerHTML='';
    holder.setAttribute('role','tablist');
    docs.forEach((d,i)=>{
      const t=document.createElement('button');
      t.type='button';
      t.className='tab'+(i===activeDoc?' active':'');
      t.setAttribute('role','tab');
      t.setAttribute('aria-selected', i===activeDoc?'true':'false');
      const nm=document.createElement('span'); nm.textContent=d.name;
      t.appendChild(nm);
      if(docs.length>1){
        const x=document.createElement('span'); x.className='x'; x.textContent='×';
        x.setAttribute('role','button');
        x.setAttribute('aria-label','close '+d.name);
        x.title='close this painting';
        x.addEventListener('click',ev=>{ ev.stopPropagation(); closeDoc(i); });
        t.appendChild(x);
      }
      t.title=d.name+' - double-click to rename';
      t.addEventListener('click',()=>switchDoc(i));
      t.addEventListener('dblclick',()=>{
        const n=prompt('Rename painting', d.name);
        if(n&&n.trim()){ d.name=uniqueDocName(n.trim()); renderTabs(); persistDocs(); }
      });
      holder.appendChild(t);
    });
    const add=document.createElement('button');
    add.type='button';
    add.className='tab tab-add'; add.textContent='+';
    add.title='new blank painting'; add.setAttribute('aria-label','new blank painting');
    add.addEventListener('click',()=>newDoc('painting'));
    holder.appendChild(add);
  }
}

