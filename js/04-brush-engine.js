'use strict';
/* ====================== brush engine ======================
   Every brush is a stamp recipe: marks laid along the path with
   pressure-, speed- and direction-aware size, flow and rotation.
   Deterministic per stroke (seeded), so re-renders are identical. */
const BRUSHES={
  round:      {shape:'round',  spacing:.45, flow:.9,  pSize:.55, pFlow:.35, taper:.5},
  pencil:     {shape:'speck',  spacing:.4,  flow:.5,  pSize:.6,  pFlow:.7,  density:.5, dot:1,   jitter:.08, taper:.3},
  ink:        {shape:'round',  spacing:.3,  flow:1,   pSize:.85, taper:1},
  calligraphy:{shape:'flat',   spacing:.35, flow:.95, pSize:.4,  flatness:.32, angle:-45},
  marker:     {shape:'flat',   spacing:.42, flow:.16, pSize:.15, flatness:.85, blend:'multiply'},
  watercolor: {shape:'wc',     spacing:.5,  flow:.14, pSize:.5,  pFlow:.5,  jitter:.12, scatter:.05},
  oil:        {shape:'bristle',spacing:.32, flow:.85, pSize:.5,  bristle:7, mix:.6},
  charcoal:   {shape:'speck',  spacing:.38, flow:.4,  pSize:.5,  pFlow:.6,  density:.9, dot:1.4, jitter:.1, scatter:.12},
  airbrush:   {shape:'soft',   spacing:.55, flow:.07, pSize:.3,  pFlow:.6,  soft:1.6},
  glow:       {shape:'soft',   spacing:.5,  flow:.2,  pSize:.4,  soft:1.8,  blend:'lighter'},
  smudge:     {shape:'smudge', spacing:.3,  flow:.3,  pSize:.45, strength:.86},
  eraser:     {shape:'round',  spacing:.35, flow:1,   pSize:.4}
};
/* factory presets - strokes without a tune render against these, so tuning a
   brush later never silently changes older strokes */
const DEFAULT_BRUSHES=JSON.parse(JSON.stringify(BRUSHES));
function brushTune(name){
  const cur=BRUSHES[name], def=DEFAULT_BRUSHES[name];
  if(!cur||!def) return null;
  const out={};
  const keys=new Set(Object.keys(cur).concat(Object.keys(def)));
  for(const k of keys){
    if(k==='blend'){ if((cur.blend||'')!==(def.blend||'')) out.blend=cur.blend||''; continue; }
    if(k==='shape'||k==='angle') continue;
    const cv=cur[k];
    if(typeof cv==='number'&&cv!==def[k]) out[k]=+(+cv).toFixed(2);
  }
  return Object.keys(out).length?out:null;
}
function resamplePath(pts, step){
  const out=[];
  if(!pts.length) return out;
  if(pts.length<2){ const a=pts[0];
    out.push([a[0],a[1],a[2]===undefined?.6:a[2],0]); return out; }
  let carry=0;
  for(let i=0;i<pts.length-1;i++){
    const a=pts[i], b=pts[i+1];
    const dx=b[0]-a[0], dy=b[1]-a[1], L=Math.hypot(dx,dy);
    if(L<1e-6) continue;
    const ang=Math.atan2(dy,dx);
    const pa=a[2]===undefined?.6:a[2], pb=b[2]===undefined?.6:b[2];
    let d=carry;
    while(d<L){ const t=d/L;
      out.push([a[0]+dx*t, a[1]+dy*t, pa+(pb-pa)*t, ang]); d+=step; }
    carry=d-L;
  }
  return out;
}
let _mixCanvas=null, _smCanvas=null;
function makeCanvasSampler(mw,mh,which){
  let cv=which?_smCanvas:_mixCanvas;
  if(!cv){ cv=document.createElement('canvas');
    if(which) _smCanvas=cv; else _mixCanvas=cv; }
  cv.width=mw; cv.height=mh;
  const g=cv.getContext('2d',{willReadFrequently:true});
  g.drawImage(paintCanvas,0,0,mw,mh);
  const data=g.getImageData(0,0,mw,mh).data;
  return (x,y)=>{
    const ix=Math.max(0,Math.min(mw-1,Math.round(x/W*mw)));
    const iy=Math.max(0,Math.min(mh-1,Math.round(y/H*mh)));
    const i=(iy*mw+ix)*4; return [data[i],data[i+1],data[i+2]]; };
}
function makeMixSampler(){ return makeCanvasSampler(192,120,0); }
function makeSmudgeSampler(){ return makeCanvasSampler(320,200,1); }
function drawStamp(c,B,x,y,sz,al,col,ang,rng,bristles,step){
  c.globalAlpha=al;
  if(B.shape==='soft'){
    const R=sz*(B.soft||1.2);
    const g=c.createRadialGradient(x,y,0,x,y,R);
    g.addColorStop(0,colA(col,1)); g.addColorStop(1,colA(col,0));
    c.fillStyle=g; c.beginPath(); c.arc(x,y,R,0,7); c.fill();
  } else if(B.shape==='wc'){
    const g=c.createRadialGradient(x,y,0,x,y,sz);
    g.addColorStop(0,colA(col,.72)); g.addColorStop(.7,colA(col,.95));
    g.addColorStop(.94,colA(mix(col,'#141432',.3),1)); g.addColorStop(1,colA(col,0));
    c.fillStyle=g; c.beginPath(); c.arc(x,y,sz,0,7); c.fill();
  } else if(B.shape==='flat'){
    c.save(); c.translate(x,y); c.rotate(ang);
    c.fillStyle=col;
    c.fillRect(-sz*.9, -sz*B.flatness, sz*1.8, sz*B.flatness*2);
    c.restore();
  } else if(B.shape==='bristle'){
    c.strokeStyle=col;
    const len=step*1.7, ca=Math.cos(ang), sa=Math.sin(ang);
    for(const b of bristles){
      const off=b[0]*sz, bx=x-sa*off, by=y+ca*off;
      c.globalAlpha=al*b[1];
      c.lineWidth=Math.max(.5,sz*1.7/bristles.length);
      c.beginPath(); c.moveTo(bx-ca*len/2,by-sa*len/2);
      c.lineTo(bx+ca*len/2,by+sa*len/2); c.stroke();
    }
  } else if(B.shape==='speck'){
    c.fillStyle=col;
    const k=Math.min(60,Math.max(3,Math.round(sz*sz*.28*(B.density||.6))));
    for(let j=0;j<k;j++){ const a2=rng()*6.283, d=Math.sqrt(rng())*sz;
      c.globalAlpha=al*(.4+rng()*.6);
      c.fillRect(x+Math.cos(a2)*d, y+Math.sin(a2)*d, B.dot||1.1, B.dot||1.1); }
  } else {
    c.fillStyle=col; c.beginPath(); c.arc(x,y,sz,0,7); c.fill();
  }
}
function renderBrushStroke(c, rawPts, o, seedVal){
  const name=o.brush||'round';
  const base=DEFAULT_BRUSHES[name]||BRUSHES[name]||BRUSHES.round;
  const B=o.tune?Object.assign({},base,o.tune):base;
  const size=o.size===undefined?10:o.size, baseA=o.opacity===undefined?1:o.opacity;
  const col=name==='eraser'?'#f6f1e7':(o.color||'#222');
  const colRGB=parseColor(col);
  const rng=mulberry32((seedVal>>>0)||1);
  const step=Math.max(.8,size*B.spacing);
  const st=resamplePath(rawPts,step);
  if(!st.length) return;
  const n=st.length;
  let bristles=null;
  if(B.bristle){ bristles=[];
    for(let j=0;j<Math.max(2,Math.round(B.bristle));j++)
      bristles.push([(j/(Math.max(2,Math.round(B.bristle))-1)-.5)*2+(rng()-.5)*.15, .35+rng()*.65]); }
  let sampler=null, carried=null;
  if(B.mix){ sampler=makeMixSampler(); carried=colRGB.slice(0,3); }
  let smSampler=null, smCarried=null;
  if(B.shape==='smudge') smSampler=makeSmudgeSampler();
  c.save();
  if(B.blend) c.globalCompositeOperation=B.blend;
  for(let i=0;i<n;i++){
    const s0=st[i], pr=Math.max(.05,Math.min(1,s0[2]));
    let env=1;
    if(B.taper){ const edge=Math.min(i,n-1-i)/Math.max(1,n*.15);
      if(edge<1) env=1-B.taper*(1-(.25+.75*edge)); }
    const sz=Math.max(.4,size*(B.pSize?(1-B.pSize+B.pSize*pr):1)*env
      *(1+(rng()-.5)*2*(B.jitter||0))*.6);
    const al=Math.max(.01,Math.min(1,baseA*B.flow*(B.pFlow?(1-B.pFlow+B.pFlow*pr):1)));
    if(smSampler){
      // smudge: drag the paint already under the path
      const cur=smSampler(s0[0],s0[1]);
      if(!smCarried) smCarried=cur.slice();
      else{ const k=1-(B.strength===undefined?.86:B.strength);
        smCarried[0]+=(cur[0]-smCarried[0])*k;
        smCarried[1]+=(cur[1]-smCarried[1])*k;
        smCarried[2]+=(cur[2]-smCarried[2])*k; }
      const col2='rgb('+Math.round(smCarried[0])+','+Math.round(smCarried[1])+','
        +Math.round(smCarried[2])+')';
      const R=sz*1.15;
      const g=c.createRadialGradient(s0[0],s0[1],0,s0[0],s0[1],R);
      g.addColorStop(0,colA(col2,1)); g.addColorStop(1,colA(col2,0));
      c.globalAlpha=al*pr; c.fillStyle=g;
      c.beginPath(); c.arc(s0[0],s0[1],R,0,7); c.fill();
      continue;
    }
    let scol=col;
    if(sampler){ const tc=sampler(s0[0],s0[1]);
      if(tc){ carried[0]+=(tc[0]-carried[0])*.12;
        carried[1]+=(tc[1]-carried[1])*.12; carried[2]+=(tc[2]-carried[2])*.12;
        const m=Math.min(.85,B.mix*(.25+.75*i/n));
        scol='rgb('+Math.round(colRGB[0]+(carried[0]-colRGB[0])*m)+','
          +Math.round(colRGB[1]+(carried[1]-colRGB[1])*m)+','
          +Math.round(colRGB[2]+(carried[2]-colRGB[2])*m)+')'; } }
    const x=s0[0]+(B.scatter?(rng()-.5)*size*B.scatter*2:0);
    const y=s0[1]+(B.scatter?(rng()-.5)*size*B.scatter*2:0);
    const ang=B.angle!==undefined?B.angle*Math.PI/180:s0[3];
    drawStamp(c,B,x,y,sz,al,scol,ang,rng,bristles,step);
  }
  c.restore();
}
function drawPath(c,pts){ c.beginPath(); c.moveTo(pts[0][0],pts[0][1]);
  if(pts.length===2) c.lineTo(pts[1][0],pts[1][1]);
  else{ for(let i=1;i<pts.length-1;i++){
      const mx=(pts[i][0]+pts[i+1][0])/2, my=(pts[i][1]+pts[i+1][1])/2;
      c.quadraticCurveTo(pts[i][0],pts[i][1],mx,my); }
    c.lineTo(pts[pts.length-1][0],pts[pts.length-1][1]); }
  c.stroke(); }
function stroke(pts,o={}){ if(!pts||!pts.length) return;
  if(!o.brush&&pts.length<2) return;
  const size=o.size===undefined?6:o.size, col=o.color||'#222',
        op=o.opacity===undefined?1:o.opacity;
  let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  for(const p of pts){ x0=Math.min(x0,p[0]); y0=Math.min(y0,p[1]);
    x1=Math.max(x1,p[0]); y1=Math.max(y1,p[1]); }
  const seedVal=Math.floor(rand(0,1e9));
  addOp('stroke',[x0-size*1.4,y0-size*1.4,x1-x0+size*2.8,y1-y0+size*2.8],c=>{
    if(o.brush){ renderBrushStroke(c,pts,o,seedVal); return; }
    if(o.nib==='chisel'){
      const nx=size*.38, ny=-size*.38;
      c.globalAlpha=op; c.fillStyle=col;
      for(let i=0;i<pts.length-1;i++){ const p=pts[i], q=pts[i+1];
        c.beginPath();
        c.moveTo(p[0]+nx,p[1]+ny); c.lineTo(q[0]+nx,q[1]+ny);
        c.lineTo(q[0]-nx,q[1]-ny); c.lineTo(p[0]-nx,p[1]-ny);
        c.closePath(); c.fill(); }
      return;
    }
    c.strokeStyle=col; c.lineCap='round'; c.lineJoin='round';
    c.globalAlpha=op; c.lineWidth=size; drawPath(c,pts); });
}
function spray(pts,o={}){ if(!pts||!pts.length) return;
  const size=o.size===undefined?14:o.size, den=o.density===undefined?2:o.density,
        col=o.color||'#222', op=o.opacity===undefined?1:o.opacity,
        s=Math.floor(rand(0,1e9));
  let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  for(const p of pts){ x0=Math.min(x0,p[0]); y0=Math.min(y0,p[1]);
    x1=Math.max(x1,p[0]); y1=Math.max(y1,p[1]); }
  addOp('spray',[x0-size,y0-size,x1-x0+size*2,y1-y0+size*2],c=>{
    const r=mulberry32(s); c.fillStyle=col;
    for(const p of pts){ const n=Math.round(size*den);
      for(let i=0;i<n;i++){ const a=r()*6.283, d=Math.sqrt(r())*size;
        c.globalAlpha=op*(.12+r()*.3);
        c.beginPath(); c.arc(p[0]+Math.cos(a)*d,p[1]+Math.sin(a)*d,.6+r()*1.1,0,7); c.fill(); } }
    c.globalAlpha=1; });
}
