'use strict';
/* ---- retained scene ---- */
let ops = [];
const siteStack = [];
let currentLayer = null, layersRun = [];
function addOp(name, bbox, draw, selectable=true){
  ops.push({name, bbox, draw, selectable, tx:0, ty:0, rs:1, psc:1, hidden:false,
    layer: currentLayer,
    site: siteStack.length ? siteStack[siteStack.length-1] : -1});
  return ops.length-1;
}
function applyOpTransform(c,op){
  if(op.layer&&(op.layer.scale!==1||op.layer.x||op.layer.y)){
    c.translate(op.layer.x+W/2, op.layer.y+H/2);
    c.scale(op.layer.scale, op.layer.scale);
    c.translate(-W/2, -H/2);
  }
  c.translate(op.tx,op.ty);
  const f=op.rs*op.psc;
  if(f!==1){ const cx=op.bbox[0]+op.bbox[2]/2, cy=op.bbox[1]+op.bbox[3]/2;
    c.translate(cx,cy); c.scale(f,f); c.translate(-cx,-cy); }
}
/* ---- render caches: appending a stroke composites onto a snapshot instead
   of re-painting the whole document; dragging pre-renders everything
   beneath the selection once ---- */
const opCache={canvas:document.createElement('canvas'), src:null, count:0, t:[], endMax:-1};
opCache.canvas.width=W; opCache.canvas.height=H;
function layerKey(op){ const L=op.layer;
  return L?L.name+','+L.x+','+L.y+','+L.scale+','+(L.hidden?1:0):''; }
function opT(op){ return [op.tx,op.ty,op.rs,op.psc,!!op.hidden,layerKey(op)]; }
function sameT(op,t){ return t&&op.tx===t[0]&&op.ty===t[1]&&op.rs===t[2]
  &&op.psc===t[3]&&(!!op.hidden)===t[4]&&layerKey(op)===t[5]; }
function cacheUsable(){
  if(opCache.src===null||opCache.count>ops.length) return false;
  if(opCache.src!==lastRunSrc){
    const a=opCache.src, b=lastRunSrc, n=Math.min(a.length,b.length);
    let d=0; while(d<n&&a.charCodeAt(d)===b.charCodeAt(d)) d++;
    if(opCache.endMax<0||opCache.endMax>=d) return false;   // a cached call was touched
  }
  for(let k=0;k<opCache.count;k++)
    if(!sameT(ops[k],opCache.t[k])) return false;            // nudged / resized / hidden
  return true;
}
function bakeCache(){
  const g=opCache.canvas.getContext('2d');
  g.setTransform(1,0,0,1,0,0);
  g.clearRect(0,0,W,H); g.drawImage(paintCanvas,0,0);
  opCache.src=lastRunSrc; opCache.count=ops.length;
  opCache.t=ops.map(opT);
  let em=-1;
  for(const op of ops){
    if(op.site<0){ em=Infinity; break; }
    const s=runSites[op.site];
    if(s._end===undefined){ const sc=scanArgs(lastRunSrc,s.open); s._end=sc?sc.close:null; }
    if(s._end===null){ em=Infinity; break; }
    if(s._end>em) em=s._end;
  }
  opCache.endMax=em;
}
let dragCacheCanvas=null, dragCacheUpto=-1;
function buildDragCache(upto){
  if(!dragCacheCanvas){ dragCacheCanvas=document.createElement('canvas');
    dragCacheCanvas.width=W; dragCacheCanvas.height=H; }
  const g=dragCacheCanvas.getContext('2d');
  g.setTransform(1,0,0,1,0,0);
  g.fillStyle='#f6f1e7'; g.fillRect(0,0,W,H);
  for(let i=0;i<upto;i++){ const op=ops[i];
    if(op.hidden||(op.layer&&op.layer.hidden)) continue;
    g.save(); applyOpTransform(g,op);
    try{ op.draw(g); }catch(e){}
    g.restore(); }
  dragCacheUpto=upto;
}
function runPostPasses(){
  for(const op of ops){
    if(op.hidden||(op.layer&&op.layer.hidden)||!op.post) continue;
    try{ op.post(ctx,op); }catch(e){}
  }
}
function renderOps(rebake){
  ctx.setTransform(1,0,0,1,0,0);
  let start=0;
  if(cacheUsable()){ ctx.drawImage(opCache.canvas,0,0); start=opCache.count; }
  else { ctx.fillStyle='#f6f1e7'; ctx.fillRect(0,0,W,H); }
  for(let i=start;i<ops.length;i++){ const op=ops[i];
    if(op.hidden||(op.layer&&op.layer.hidden)) continue;
    ctx.save();
    applyOpTransform(ctx,op);
    try{ op.draw(ctx); }catch(e){}
    ctx.restore(); }
  if(rebake) bakeCache();
  runPostPasses();
}
function previewRender(){
  if(dragCacheUpto>=0&&dragCacheCanvas){
    ctx.setTransform(1,0,0,1,0,0);
    ctx.drawImage(dragCacheCanvas,0,0);
    for(let i=dragCacheUpto;i<ops.length;i++){ const op=ops[i];
      if(op.hidden||(op.layer&&op.layer.hidden)) continue;
      ctx.save(); applyOpTransform(ctx,op);
      try{ op.draw(ctx); }catch(e){}
      ctx.restore(); }
    runPostPasses();
  } else renderOps();
}
/* effective on-screen bounding box of an op (move, resize, layer transform) */
function opBox(op){
  const f=op.rs*op.psc, b=op.bbox;
  let cx=b[0]+b[2]/2+op.tx, cy=b[1]+b[3]/2+op.ty;
  let hw=Math.abs(b[2])/2*f, hh=Math.abs(b[3])/2*f;
  if(op.layer){ const L=op.layer, s=L.scale;
    cx=(cx-W/2)*s+W/2+L.x; cy=(cy-H/2)*s+H/2+L.y; hw*=s; hh*=s; }
  return [cx-hw, cy-hh, hw*2, hh*2];
}

