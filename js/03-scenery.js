'use strict';
/* ============================ painting API ============================ */
function background(c){
  if(typeof c==='object'&&c){ const from=c.from||'#fff', to=c.to||'#ccc', ang=(c.angle===undefined?90:c.angle)*Math.PI/180;
    const cx=W/2, cy=H/2, L=Math.abs(W*Math.cos(ang))/2+Math.abs(H*Math.sin(ang))/2;
    const x1=cx-Math.cos(ang)*L, y1=cy-Math.sin(ang)*L, x2=cx+Math.cos(ang)*L, y2=cy+Math.sin(ang)*L;
    addOp('background',[0,0,W,H],g=>{ const gr=g.createLinearGradient(x1,y1,x2,y2);
      gr.addColorStop(0,from); gr.addColorStop(1,to); g.fillStyle=gr; g.fillRect(0,0,W,H); },false);
  } else addOp('background',[0,0,W,H],g=>{ g.fillStyle=c||'#f6f1e7'; g.fillRect(0,0,W,H); },false);
}
function sky(o={}){ background({from:o.from||'#8fc7ee', to:o.to||'#e8f4fb', angle:90}); }

function sun(x,y,r=50,o={}){ const col=o.color||'#ffd27d', glow=o.glow===undefined?1.5:o.glow;
  const R=r*(1.4+glow);
  addOp('sun',[x-R,y-R,R*2,R*2],c=>{
    let g=c.createRadialGradient(x,y,r*0.2,x,y,R);
    g.addColorStop(0,colA(col,.55)); g.addColorStop(1,colA(col,0));
    c.fillStyle=g; c.beginPath(); c.arc(x,y,R,0,7); c.fill();
    g=c.createRadialGradient(x-r*.3,y-r*.3,r*.1,x,y,r);
    g.addColorStop(0,mix(col,'#ffffff',.65)); g.addColorStop(1,col);
    c.fillStyle=g; c.beginPath(); c.arc(x,y,r,0,7); c.fill(); });
}
function moon(x,y,r=40,o={}){ const col=o.color||'#e9edf6', glow=o.glow===undefined?1.4:o.glow;
  const R=r*(1.4+glow), craters=[];
  for(let i=0;i<4;i++) craters.push([rand(-.5,.5)*r, rand(-.5,.5)*r, rand(.1,.24)*r]);
  addOp('moon',[x-R,y-R,R*2,R*2],c=>{
    let g=c.createRadialGradient(x,y,r*.3,x,y,R);
    g.addColorStop(0,colA(col,.4)); g.addColorStop(1,colA(col,0));
    c.fillStyle=g; c.beginPath(); c.arc(x,y,R,0,7); c.fill();
    c.fillStyle=col; c.beginPath(); c.arc(x,y,r,0,7); c.fill();
    c.fillStyle=colA(mix(col,'#5a627a',.6),.5);
    for(const cr of craters){ c.beginPath(); c.arc(x+cr[0],y+cr[1],cr[2],0,7); c.fill(); } });
}
function stars(n=120,o={}){ const maxY=(o.max===undefined?.55:o.max)*H, col=o.color||'#ffffff';
  const pts=[]; for(let i=0;i<n;i++)
    pts.push([rand(0,W), Math.pow(rand(),1.3)*maxY, rand(.4,1.7), rand(.25,1)]);
  addOp('stars',[0,0,W,maxY],c=>{ c.fillStyle=col; c.strokeStyle=col;
    for(const p of pts){ c.globalAlpha=p[3];
      c.beginPath(); c.arc(p[0],p[1],p[2],0,7); c.fill();
      if(p[2]>1.35){ c.globalAlpha=p[3]*.4; c.lineWidth=.8; c.beginPath();
        c.moveTo(p[0]-p[2]*3,p[1]); c.lineTo(p[0]+p[2]*3,p[1]);
        c.moveTo(p[0],p[1]-p[2]*3); c.lineTo(p[0],p[1]+p[2]*3); c.stroke(); } }
    c.globalAlpha=1; },false);
}
function clouds(n=5,o={}){ const yy=o.y===undefined?150:o.y, col=o.color||'rgba(255,255,255,0.85)',
    sc=o.scale===undefined?1:o.scale;
  for(let i=0;i<n;i++){ const cx=rand(40,W-40), cy=yy+rand(-45,45), s=sc*rand(.7,1.35);
    const puffs=[], k=5+Math.floor(rand(0,4));
    for(let j=0;j<k;j++) puffs.push([rand(-60,60)*s, rand(-13,13)*s, rand(18,34)*s, rand(10,18)*s]);
    addOp('cloud',[cx-80*s,cy-36*s,160*s,72*s],c=>{ c.fillStyle=col;
      for(const p of puffs){ c.beginPath(); c.ellipse(cx+p[0],cy+p[1],p[2],p[3],0,0,7); c.fill(); } });
  }
}
function mountains(o={}){
  const layers=o.layers===undefined?3:o.layers, base=o.base===undefined?(o.from===undefined?400:o.from):o.base,
        height=o.height===undefined?200:o.height, rough=o.roughness===undefined?1:o.roughness,
        col=o.color||'#26324a', fade=o.fade||'#93a7cc',
        oct=o.octaves===undefined?4:o.octaves;
  for(let i=0;i<layers;i++){ const t=layers===1?1:i/(layers-1);
    const amp=height*(.45+.55*(1-t)), off=rand(0,1000), pts=[];
    for(let x=-12;x<=W+12;x+=6)
      pts.push([x, base - amp*fbm(x*.0035*(.8+.7*t)+off, oct, .5*Math.min(rough,1.6)) - amp*.12 + t*amp*.28]);
    const color=mix(fade,col,.2+.8*t);
    addOp('mountains',[0,base-amp*1.2,W,H-(base-amp*1.2)],c=>{
      c.fillStyle=color; c.beginPath(); c.moveTo(-12,H+12);
      for(const p of pts) c.lineTo(p[0],p[1]);
      c.lineTo(W+12,H+12); c.closePath(); c.fill(); },false);
  }
}
function hills(o={}){ mountains(Object.assign({layers:2,height:120,roughness:.35,octaves:2},o)); }
const _reflCanvas=document.createElement('canvas');
function water(o={}){
  const y=Math.round(o.from===undefined?H*.63:o.from), col=o.color||'#2b6f9e',
        deep=o.deep||mix(col,'#03102a',.55);
  let refl=o.reflect===undefined?0:o.reflect, inplace=false;
  if(Array.isArray(refl)){ inplace=refl[1]==='inplace'; refl=+refl[0]||0; }
  const deferred=refl>0&&!inplace;
  const glints=[], gcol=mix(col,'#ffffff',.55);
  for(let i=0;i<70;i++)
    glints.push([rand(0,W), y+8+Math.pow(rand(),.7)*(H-y-16), rand(14,80), rand(.04,.16)]);
  const drawGlints=c=>{ c.save(); c.lineWidth=1.4; c.strokeStyle=gcol;
    for(const gl of glints){ c.globalAlpha=gl[3]; c.beginPath();
      c.moveTo(gl[0]-gl[2]/2,gl[1]); c.lineTo(gl[0]+gl[2]/2,gl[1]); c.stroke(); }
    c.restore(); };
  const idx=addOp('water',[0,y,W,H-y],c=>{
    const hR=Math.min(y,H-y); let tmp=null;
    if(inplace&&refl>0&&hR>4){ tmp=document.createElement('canvas'); tmp.width=W; tmp.height=hR;
      tmp.getContext('2d').drawImage(paintCanvas,0,y-hR,W,hR,0,0,W,hR); }
    const g=c.createLinearGradient(0,y,0,H); g.addColorStop(0,col); g.addColorStop(1,deep);
    c.fillStyle=g; c.fillRect(0,y,W,H-y);
    if(tmp){ c.save(); c.globalAlpha=refl; c.translate(0,y); c.scale(1,-1);
      c.drawImage(tmp,0,-hR); c.restore(); }
    if(!deferred) drawGlints(c);          // deferred mode re-draws them after the mirror
  },false);
  if(deferred){
    // mirror the FINISHED scene, so trees and birds painted after the water
    // still cast reflections
    ops[idx].post=(c,op)=>{
      let yy=y+op.ty;
      if(op.layer){ const L=op.layer; yy=(yy-H/2)*L.scale+H/2+L.y; }
      yy=Math.round(yy);
      const hR=Math.min(yy,H-yy);
      if(hR<5) return;
      _reflCanvas.width=W; _reflCanvas.height=hR;
      _reflCanvas.getContext('2d').drawImage(paintCanvas,0,yy-hR,W,hR,0,0,W,hR);
      c.save(); c.setTransform(1,0,0,1,0,0);
      c.globalAlpha=refl; c.translate(0,yy); c.scale(1,-1);
      c.drawImage(_reflCanvas,0,-hR);
      c.restore();
      c.save(); applyOpTransform(c,op); drawGlints(c); c.restore();
    };
  }
}
function ground(y,o={}){ const col=o.color||'#3d3a2e';
  addOp('ground',[0,y,W,H-y],c=>{ const g=c.createLinearGradient(0,y,0,H);
    g.addColorStop(0,col); g.addColorStop(1,mix(col,'#000000',.45));
    c.fillStyle=g; c.fillRect(0,y,W,H-y); },false);
}
function tree(x,y,size=50,o={}){ const type=o.type||'pine', col=o.color||'#1c3b2a';
  if(type==='round'){ const th=size*.45, tw=Math.max(2,size*.08), blobs=[];
    blobs.push([0,-th-size*.3,size*.34],[-size*.2,-th-size*.12,size*.25],[size*.2,-th-size*.15,size*.27]);
    addOp('tree',[x-size*.56,y-th-size*.66,size*1.12,th+size*.66],c=>{
      c.fillStyle=mix(col,'#000000',.35); c.fillRect(x-tw/2,y-th,tw,th);
      c.fillStyle=col;
      for(const b of blobs){ c.beginPath(); c.arc(x+b[0],y+b[1],b[2],0,7); c.fill(); } });
  } else { const trunkH=size*.16, tw=Math.max(1.5,size*.06);
    addOp('tree',[x-size*.34,y-size,size*.68,size],c=>{
      c.fillStyle=mix(col,'#000000',.3); c.fillRect(x-tw/2,y-trunkH,tw,trunkH);
      c.fillStyle=col;
      for(let j=0;j<3;j++){ const w=size*(.62-.15*j), yb=y-trunkH-j*size*.22, h=size*.42;
        c.beginPath(); c.moveTo(x-w/2,yb); c.lineTo(x+w/2,yb); c.lineTo(x,yb-h);
        c.closePath(); c.fill(); } });
  }
  // flock trees can be "baked": dragging one turns it into its own literal call
  const _t=ops[ops.length-1];
  if(_t&&_t.name==='tree')
    _t.bake=(ddx,ddy)=>'tree('+Math.round(x+ddx)+', '+Math.round(y+ddy)+', '
      +Math.round(size)+", { color: '"+col+"'"
      +(type!=='pine'?", type: '"+type+"'":'')+' })  // baked from its flock';
}
function trees(n=6,o={}){ const x0=o.from===undefined?0:o.from, x1=o.to===undefined?W:o.to,
    base=o.base===undefined?H*.7:o.base, size=o.size===undefined?50:o.size;
  for(let i=0;i<n;i++) tree(rand(x0,x1), base+rand(-6,6), size*rand(.75,1.3), o);
}
function grass(y,o={}){ const col=o.color||'#3f6b35', h0=o.height===undefined?16:o.height,
    den=o.density===undefined?240:o.density, blades=[];
  for(let i=0;i<den;i++){ const x=rand(-5,W+5);
    blades.push([x, h0*rand(.5,1.4), (noise01(x*.02)-.5)*10, rand(0,.35)]); }
  addOp('grass',[0,y-h0*1.4,W,h0*1.6],c=>{ c.lineWidth=1.4;
    for(const b of blades){ c.strokeStyle=mix(col,'#000000',b[3]); c.beginPath();
      c.moveTo(b[0],y+2); c.quadraticCurveTo(b[0]+b[2]*.3,y-b[1]*.6,b[0]+b[2],y-b[1]);
      c.stroke(); } },false);
}
function birds(n=5,o={}){ const x0=o.x===undefined?W/2:o.x, y0=o.y===undefined?140:o.y,
    spread=o.spread===undefined?120:o.spread, col=o.color||'#2c3540',
    size=o.size===undefined?8:o.size;
  for(let i=0;i<n;i++){ const bx=x0+rand(-spread,spread), by=y0+rand(-spread*.4,spread*.4),
      s=size*rand(.7,1.3);
    addOp('bird',[bx-s-2,by-s,s*2+4,s*1.4],c=>{
      c.strokeStyle=col; c.lineWidth=Math.max(1.1,s*.2); c.lineCap='round';
      c.beginPath(); c.moveTo(bx-s,by);
      c.quadraticCurveTo(bx-s*.5,by-s*.8,bx,by-s*.1);
      c.quadraticCurveTo(bx+s*.5,by-s*.8,bx+s,by); c.stroke(); });
  }
}
function fog(a=.15,o={}){ const y=o.y===undefined?H*.5:o.y, h=o.height===undefined?90:o.height,
    col=o.color||'#ffffff';
  addOp('fog',[0,y-h/2,W,h],c=>{ const g=c.createLinearGradient(0,y-h/2,0,y+h/2);
    g.addColorStop(0,colA(col,0)); g.addColorStop(.5,colA(col,a)); g.addColorStop(1,colA(col,0));
    c.fillStyle=g; c.fillRect(0,y-h/2,W,h); },false);
}

/* ---- shapes ---- */
function circle(x,y,r,o={}){ addOp('circle',[x-r,y-r,r*2,r*2],c=>{
    c.globalAlpha=o.opacity===undefined?1:o.opacity;
    c.fillStyle=o.color||'#333'; c.beginPath(); c.arc(x,y,r,0,7); c.fill();
    if(o.stroke){ c.strokeStyle=o.stroke; c.lineWidth=o.strokeWidth||2; c.stroke(); } });
}
function ring(x,y,r,o={}){ const sz=o.size===undefined?4:o.size;
  addOp('ring',[x-r-sz,y-r-sz,(r+sz)*2,(r+sz)*2],c=>{
    c.globalAlpha=o.opacity===undefined?1:o.opacity;
    c.strokeStyle=o.color||'#333'; c.lineWidth=sz;
    c.beginPath(); c.arc(x,y,r,0,7); c.stroke(); });
}
function rect(x,y,w,h,o={}){ addOp('rect',[x,y,w,h],c=>{
    c.globalAlpha=o.opacity===undefined?1:o.opacity; c.fillStyle=o.color||'#333';
    if(o.round&&c.roundRect){ c.beginPath(); c.roundRect(x,y,w,h,o.round); c.fill(); }
    else c.fillRect(x,y,w,h); });
}
function ellipse(x,y,rx,ry,o={}){ const m=Math.max(rx,ry);
  addOp('ellipse',[x-m,y-m,m*2,m*2],c=>{
    c.globalAlpha=o.opacity===undefined?1:o.opacity; c.fillStyle=o.color||'#333';
    c.beginPath(); c.ellipse(x,y,rx,ry,o.rotate||0,0,7); c.fill(); });
}
function line(x1,y1,x2,y2,o={}){ const sz=o.size===undefined?4:o.size;
  addOp('line',[Math.min(x1,x2)-sz,Math.min(y1,y2)-sz,Math.abs(x2-x1)+sz*2,Math.abs(y2-y1)+sz*2],c=>{
    c.globalAlpha=o.opacity===undefined?1:o.opacity;
    c.strokeStyle=o.color||'#333'; c.lineWidth=sz; c.lineCap='round';
    c.beginPath(); c.moveTo(x1,y1); c.lineTo(x2,y2); c.stroke(); });
}
function polygon(pts,o={}){ if(!pts||pts.length<3) return;
  let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  for(const p of pts){ x0=Math.min(x0,p[0]); y0=Math.min(y0,p[1]);
    x1=Math.max(x1,p[0]); y1=Math.max(y1,p[1]); }
  addOp('polygon',[x0,y0,x1-x0,y1-y0],c=>{
    c.globalAlpha=o.opacity===undefined?1:o.opacity; c.fillStyle=o.color||'#333';
    c.beginPath();
    if(o.smooth&&pts.length>3){
      // closed curve through segment midpoints - organic, hand-drawn outlines
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
    if(o.seal||o.stroke){ c.strokeStyle=o.stroke||o.color||'#333';
      c.lineWidth=o.strokeWidth||(typeof o.seal==='number'?o.seal:3);
      c.lineJoin='round'; c.stroke(); } });
}
function triangle(x1,y1,x2,y2,x3,y3,o={}){ polygon([[x1,y1],[x2,y2],[x3,y3]],o); }
function star(x,y,spikes,outer,inner,o={}){ const pts=[];
  for(let i=0;i<spikes*2;i++){ const r=i%2===0?outer:inner, a=i*Math.PI/spikes-Math.PI/2;
    pts.push([x+Math.cos(a)*r, y+Math.sin(a)*r]); }
  polygon(pts,o); const op=ops[ops.length-1]; if(op) op.name='star';
}
function ngon(x,y,sides,r,o={}){
  const n=Math.max(3,Math.round(sides)), pts=[];
  const rot=(o.rotate||0)*Math.PI/180-Math.PI/2;
  for(let i=0;i<n;i++){ const a=rot+i*2*Math.PI/n;
    pts.push([x+Math.cos(a)*r, y+Math.sin(a)*r]); }
  polygon(pts,o); const op=ops[ops.length-1]; if(op) op.name='ngon';
}
function arrow(x1,y1,x2,y2,o={}){
  const sz=o.size===undefined?4:o.size, head=o.head===undefined?Math.max(9,sz*3.2):o.head;
  const col=o.color||'#333', m=head+sz;
  addOp('arrow',[Math.min(x1,x2)-m,Math.min(y1,y2)-m,
      Math.abs(x2-x1)+m*2,Math.abs(y2-y1)+m*2],c=>{
    c.globalAlpha=o.opacity===undefined?1:o.opacity;
    const ang=Math.atan2(y2-y1,x2-x1);
    c.strokeStyle=col; c.fillStyle=col; c.lineWidth=sz; c.lineCap='round';
    c.beginPath(); c.moveTo(x1,y1);
    c.lineTo(x2-Math.cos(ang)*head*.7, y2-Math.sin(ang)*head*.7); c.stroke();
    c.beginPath(); c.moveTo(x2,y2);
    c.lineTo(x2-Math.cos(ang-.42)*head, y2-Math.sin(ang-.42)*head);
    c.lineTo(x2-Math.cos(ang+.42)*head, y2-Math.sin(ang+.42)*head);
    c.closePath(); c.fill(); });
}
function heart(x,y,size,o={}){
  const s=size/2;
  addOp('heart',[x-s*1.1,y-s*.85,s*2.2,s*1.85],c=>{
    c.globalAlpha=o.opacity===undefined?1:o.opacity;
    c.fillStyle=o.color||'#c0392b';
    c.beginPath();
    c.moveTo(x,y+s*.95);
    c.bezierCurveTo(x-s*1.15,y+s*.2, x-s*.95,y-s*.8, x,y-s*.2);
    c.bezierCurveTo(x+s*.95,y-s*.8, x+s*1.15,y+s*.2, x,y+s*.95);
    c.closePath(); c.fill();
    if(o.stroke){ c.strokeStyle=o.stroke; c.lineWidth=o.strokeWidth||2; c.stroke(); } });
}
function crescent(x,y,r,o={}){
  addOp('crescent',[x-r,y-r,r*2,r*2],c=>{
    c.globalAlpha=o.opacity===undefined?1:o.opacity;
    c.fillStyle=o.color||'#e9edf6';
    const cxi=x-r*.35, rr=Math.hypot(r*.35,r), a=Math.atan2(r,r*.35);
    c.beginPath();
    c.arc(x,y,r,-Math.PI/2,Math.PI/2,false);
    c.arc(cxi,y,rr,a,-a,true);
    c.closePath(); c.fill(); });
}
