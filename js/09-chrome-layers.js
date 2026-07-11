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
  const url=location.origin+location.pathname+'#'+h;
  let copied=false;
  try{ await navigator.clipboard.writeText(url); copied=true; }catch(e){}
  if(!copied){
    const t=document.createElement('textarea');
    t.value=url; document.body.appendChild(t); t.select();
    try{ copied=document.execCommand('copy'); }catch(e){}
    t.remove();
  }
  const kb=(url.length/1024).toFixed(1);
  statusMsgEl.textContent=copied
    ? '✓ share link copied ('+kb+' kb) - anyone who opens it gets this painting, code and all'
    : 'could not reach the clipboard - link is in the browser address bar';
  statusMsgEl.className='ok';
  if(!copied) location.hash=h;
});
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
    b.textContent=txt; b.title=title; b.addEventListener('click',fn); return b; };
  [...layersRun].reverse().forEach(L=>{
    const row=document.createElement('div');
    row.className='lrow'+(L.hidden?' off':'');
    row.appendChild(mkBtn(L.hidden?'🙈':'👁','show / hide this layer',()=>toggleLayer(L.name)));
    const nm=document.createElement('b');
    nm.textContent=L.name; nm.title=L.name+' - double-click to rename';
    nm.addEventListener('dblclick',()=>{
      const n=prompt('Rename layer', L.name);
      if(n&&n.trim()) renameLayer(L.name, n.trim());
    });
    row.appendChild(nm);
    row.appendChild(mkBtn('▲','bring forward',()=>moveLayer(L.name,1)));
    row.appendChild(mkBtn('▼','send back',()=>moveLayer(L.name,-1)));
    const sc=document.createElement('input');
    sc.type='number'; sc.step='0.1'; sc.min='0.1'; sc.max='6'; sc.value=L.scale;
    sc.className='lscale';
    sc.title='layer scale (also editable in code: layer(name, { scale, x, y }))';
    sc.addEventListener('change',()=>setLayerOpt(L.name,'scale',parseFloat(sc.value)||1));
    row.appendChild(sc);
    row.appendChild(mkBtn('🗑','delete this layer',()=>deleteLayer(L.name)));
    list.appendChild(row);
  });
}

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
        JSON.stringify({a:activeDoc, d:docs.map(d=>({n:d.name, c:d.code}))}));
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
    docs.forEach((d,i)=>{
      const t=document.createElement('span');
      t.className='tab'+(i===activeDoc?' active':'');
      const nm=document.createElement('span'); nm.textContent=d.name;
      t.appendChild(nm);
      if(docs.length>1){
        const x=document.createElement('span'); x.className='x'; x.textContent='×';
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
    const add=document.createElement('span');
    add.className='tab tab-add'; add.textContent='+';
    add.title='new blank painting';
    add.addEventListener('click',()=>newDoc('painting'));
    holder.appendChild(add);
  }
}

