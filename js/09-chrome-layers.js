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
function renderLayerChips(){
  const bar=document.getElementById('layersbar');
  const box=document.getElementById('layerchips');
  box.innerHTML='';
  if(!layersRun.length){ bar.hidden=true; return; }
  bar.hidden=false;
  const mkBtn=(txt,title,fn)=>{ const b=document.createElement('button');
    b.textContent=txt; b.title=title; b.addEventListener('click',fn); return b; };
  layersRun.forEach(L=>{
    const chip=document.createElement('span');
    chip.className='lchip'+(L.hidden?' off':'');
    chip.appendChild(mkBtn(L.hidden?'🙈':'👁','show / hide this layer',()=>toggleLayer(L.name)));
    const nm=document.createElement('b'); nm.textContent=L.name; nm.title=L.name;
    chip.appendChild(nm);
    chip.appendChild(mkBtn('◀','paint earlier (send further back)',()=>moveLayer(L.name,-1)));
    chip.appendChild(mkBtn('▶','paint later (bring further front)',()=>moveLayer(L.name,1)));
    const sc=document.createElement('input');
    sc.type='number'; sc.step='0.1'; sc.min='0.1'; sc.max='6'; sc.value=L.scale;
    sc.title='layer scale (also editable in code: layer(name, { scale, x, y }))';
    sc.addEventListener('change',()=>setLayerOpt(L.name,'scale',parseFloat(sc.value)||1));
    chip.appendChild(sc);
    box.appendChild(chip);
  });
}

