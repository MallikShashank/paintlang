'use strict';
/* ---- form: a traced painting mass with human-readable placement ----
   x,y = centre, w,h = size. The outline lives in o.pts as packed data
   (normalized 12-bit coordinates, 4 chars per point) so the numbers you
   see and edit are the ones that mean something. */
const B64A='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const B64R={}; for(let i=0;i<64;i++) B64R[B64A[i]]=i;
function packPts(pts,x0,y0,w,h){
  let s='';
  for(const p of pts){
    const nx=Math.max(0,Math.min(4095,Math.round((p[0]-x0)/w*4095)));
    const ny=Math.max(0,Math.min(4095,Math.round((p[1]-y0)/h*4095)));
    s+=B64A[nx>>6]+B64A[nx&63]+B64A[ny>>6]+B64A[ny&63];
  }
  return s;
}
function unpackPts(s){
  if(typeof s!=='string'||s.length<12) return null;
  const pts=[];
  for(let i=0;i+3<s.length;i+=4){
    const nx=(B64R[s[i]]<<6)|B64R[s[i+1]], ny=(B64R[s[i+2]]<<6)|B64R[s[i+3]];
    if(isNaN(nx)||isNaN(ny)) return null;
    pts.push([nx/4095,ny/4095]);
  }
  return pts.length>2?pts:null;
}
/* ---- strokes: a packed bundle of painterly detail strokes ----
   What the trace service emits for its coarse-to-fine paint layers.
   Each stroke in the blob: [1 char point-count][4 chars RGB][n x 4 chars xy].
   Coordinates are canvas-absolute, 12-bit. One bundle = one selectable op. */
function unpackStrokes(s){
  if(typeof s!=='string'||s.length<9) return null;
  const out=[]; let i=0;
  while(i<s.length){
    const n=B64R[s[i]]; if(n===undefined||n<1){ return out.length?out:null; }
    if(i+1+4+n*4>s.length) break;
    const c=(B64R[s[i+1]]<<18)|(B64R[s[i+2]]<<12)|(B64R[s[i+3]]<<6)|B64R[s[i+4]];
    const col='rgb('+((c>>16)&255)+','+((c>>8)&255)+','+(c&255)+')';
    i+=5;
    const pts=[];
    for(let k=0;k<n;k++){
      const nx=(B64R[s[i]]<<6)|B64R[s[i+1]], ny=(B64R[s[i+2]]<<6)|B64R[s[i+3]];
      pts.push([nx/4095*W, ny/4095*H]); i+=4;
    }
    out.push({col, pts});
  }
  return out.length?out:null;
}
function strokes(blob,o={}){
  const list=unpackStrokes(blob);
  if(!list) return;
  const size=o.size===undefined?6:o.size, al=o.opacity===undefined?1:o.opacity;
  let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  for(const s of list) for(const p of s.pts){
    if(p[0]<x0)x0=p[0]; if(p[0]>x1)x1=p[0];
    if(p[1]<y0)y0=p[1]; if(p[1]>y1)y1=p[1]; }
  addOp('strokes',[x0-size,y0-size,x1-x0+size*2,y1-y0+size*2],c=>{
    c.globalAlpha=al; c.lineCap='round'; c.lineJoin='round';
    for(const s of list){
      c.strokeStyle=s.col;
      const p=s.pts, m=p.length;
      if(m===1){
        c.fillStyle=s.col; c.beginPath();
        c.arc(p[0][0],p[0][1],size/2,0,7); c.fill(); continue;
      }
      if(m===2||size<3){
        // tiny strokes: taper is invisible - one path keeps huge bundles fast
        c.lineWidth=size*.9;
        c.beginPath(); c.moveTo(p[0][0],p[0][1]);
        for(let i2=1;i2<m;i2++) c.lineTo(p[i2][0],p[i2][1]);
        c.stroke();
        continue;
      }
      // tapered brush touch: full width mid-stroke, slimmer at the tips
      for(let i2=0;i2<m-1;i2++){
        const t=(i2+.5)/(m-1);
        c.lineWidth=size*(.55+.45*Math.sin(Math.PI*t));
        c.beginPath(); c.moveTo(p[i2][0],p[i2][1]);
        c.lineTo(p[i2+1][0],p[i2+1][1]); c.stroke();
      }
    }
  });
}
function form(x,y,w,h,o={}){
  if(x&&typeof x==='object'){ o=x;
    x=o.x===undefined?W/2:o.x; y=o.y===undefined?H/2:o.y;
    w=o.w===undefined?100:o.w; h=o.h===undefined?100:o.h; }
  const x0=x-w/2, y0=y-h/2;
  const norm=unpackPts(o.pts);
  if(!norm){ rect(x0,y0,w,h,o); const op=ops[ops.length-1]; if(op) op.name='form'; return; }
  const pts=norm.map(p=>[x0+p[0]*w, y0+p[1]*h]);
  addOp('form',[x0,y0,w,h],c=>{
    c.globalAlpha=o.opacity===undefined?1:o.opacity;
    let fill=o.color||'#333';
    if(o.shade&&o.shade.length){
      // soft modelling: colour on the dark side → shade colour on the lit side
      const ang=(o.shade[1]||0)*Math.PI/180;
      const ux=Math.cos(ang), uy=Math.sin(ang);
      const ext=Math.abs(ux)*w/2+Math.abs(uy)*h/2||1;
      const g=c.createLinearGradient(x-ux*ext,y-uy*ext,x+ux*ext,y+uy*ext);
      g.addColorStop(0,o.color||'#333'); g.addColorStop(1,o.shade[0]);
      fill=g;
    }
    c.fillStyle=fill;
    c.beginPath();
    if(o.smooth!==false&&pts.length>3){
      c.moveTo((pts[pts.length-1][0]+pts[0][0])/2,(pts[pts.length-1][1]+pts[0][1])/2);
      for(let i=0;i<pts.length;i++){ const p=pts[i], q=pts[(i+1)%pts.length];
        c.quadraticCurveTo(p[0],p[1],(p[0]+q[0])/2,(p[1]+q[1])/2); }
      c.closePath();
    }else{
      c.moveTo(pts[0][0],pts[0][1]);
      for(let i=1;i<pts.length;i++) c.lineTo(pts[i][0],pts[i][1]);
      c.closePath();
    }
    c.fill();
    if(o.seal!==false||o.stroke){ c.strokeStyle=o.stroke||o.color||'#333';
      c.lineWidth=o.strokeWidth||3; c.lineJoin='round'; c.stroke(); }
  });
}
function text(x,y,str,o={}){ const size=o.size===undefined?28:o.size,
    font=`${o.italic?'italic ':''}${size}px ${o.font||'Georgia, serif'}`;
  _cc.font=font; const w=_cc.measureText(String(str)).width;
  const ax=o.align==='center'?x-w/2:(o.align==='right'?x-w:x);
  addOp('text',[ax,y-size,w,size*1.3],c=>{
    c.globalAlpha=o.opacity===undefined?1:o.opacity;
    c.fillStyle=o.color||'#333'; c.font=font; c.textAlign=o.align||'left';
    c.fillText(String(str),x,y); });
}

/* ---- atmosphere ---- */
function grain(amount=.5){ const s=Math.floor(rand(0,1e9));
  addOp('grain',[0,0,W,H],c=>{ const r=mulberry32(s), n=Math.floor(2400*amount);
    for(let i=0;i<n;i++){ const x=r()*W, y=r()*H, a=r()*.07;
      c.fillStyle=r()<.5?`rgba(0,0,0,${a})`:`rgba(255,255,255,${a})`;
      c.fillRect(x,y,1.3,1.3); } },false);
}
function vignette(a=.3){ addOp('vignette',[0,0,W,H],c=>{
    const g=c.createRadialGradient(W/2,H/2,H*.42,W/2,H/2,W*.62);
    g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(1,`rgba(0,0,0,${a})`);
    c.fillStyle=g; c.fillRect(0,0,W,H); },false);
}

/* ---- composition ---- */
function repeat(n,fn){ for(let i=0;i<n;i++) fn(i); }
function nudge(i,dx,dy){ const op=ops[i]; if(op){ op.tx+=dx; op.ty+=dy; } }
function hide(i){ const op=ops[i]; if(op) op.hidden=true; }
function resize(i,f){ const op=ops[i]; if(op&&f>0) op.rs*=f; }
function layer(name,o={}){
  currentLayer={ name:String(name), x:o.x||0, y:o.y||0,
    scale:o.scale===undefined?1:o.scale, hidden:!!o.hidden };
  layersRun.push(currentLayer);
}

function __call(k, name){
  const args = Array.prototype.slice.call(arguments, 2);
  siteStack.push(k);
  try{ return api[name].apply(null, args); }
  finally{ siteStack.pop(); }
}
const api = { seed, rand, noise, hsl, mix,
  background, sky, sun, moon, stars, clouds, mountains, hills, water, ground,
  tree, trees, grass, birds, fog,
  circle, ring, rect, ellipse, line, polygon, triangle, star, ngon, arrow, heart, crescent,
  stroke, spray, form, strokes, text,
  grain, vignette, repeat, nudge, hide, resize, layer, __call,
  W, H, PI: Math.PI };
const apiSet = new Set(Object.keys(api).filter(k=>k!=='__call'));

