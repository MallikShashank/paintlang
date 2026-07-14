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
/* fast numeric tint for 'rgb(r,g,b)' strings: f>0 toward white, f<0 toward black */
function shadeRGB(col,f){
  const m=col.match(/\d+/g); if(!m) return col;
  const t=f>0?255:0, a=Math.abs(f);
  return 'rgb('+Math.round(+m[0]+(t-+m[0])*a)+','+Math.round(+m[1]+(t-+m[1])*a)
    +','+Math.round(+m[2]+(t-+m[2])*a)+')';
}
function _slPolyline(c,p,w){ c.lineWidth=w;
  c.beginPath(); c.moveTo(p[0][0],p[0][1]);
  for(let i2=1;i2<p.length;i2++) c.lineTo(p[i2][0],p[i2][1]);
  c.stroke(); }
function _slTaper(c,p,w){ const m=p.length;
  for(let i2=0;i2<m-1;i2++){
    const t=(i2+.5)/(m-1);
    c.lineWidth=w*(.55+.45*Math.sin(Math.PI*t));
    c.beginPath(); c.moveTo(p[i2][0],p[i2][1]);
    c.lineTo(p[i2+1][0],p[i2+1][1]); c.stroke();
  } }
/* one fixed studio light for every painted ridge - real impasto catches one
   sun, not a different sun per stroke (the old per-stroke rails read as
   crawling embossed worms) */
const _LX=-0.573, _LY=-0.819;   // light from the upper left
function _offsetPath(c,p,nx,ny,w){
  c.lineWidth=w;
  c.beginPath(); c.moveTo(p[0][0]+nx,p[0][1]+ny);
  for(let i2=1;i2<p.length;i2++) c.lineTo(p[i2][0]+nx,p[i2][1]+ny);
  c.stroke();
}
function _mixWhite(col,f){ return shadeRGB(col,f); }
/* push a colour's channels away from its own luminance: chroma turned up */
function _vivid(col,f){
  const m=col.match(/\d+/g); if(!m) return col;
  const L=.3*m[0]+.59*m[1]+.11*m[2];
  const v=ch=>Math.max(0,Math.min(255,Math.round(L+(ch-L)*(1+f))));
  return 'rgb('+v(+m[0])+','+v(+m[1])+','+v(+m[2])+')';
}
function drawOneStroke(c,s,size,al,media,rng){
  const p=s.pts, m=p.length;
  if(m===1){
    c.globalAlpha=al; c.fillStyle=s.col; c.beginPath();
    c.arc(p[0][0],p[0][1],size/2,0,7); c.fill(); return;
  }
  const dx=p[m-1][0]-p[0][0], dy=p[m-1][1]-p[0][1];
  const L=Math.hypot(dx,dy)||1;
  let nx=-dy/L, ny=dx/L;
  // the stroke's lit side is whichever normal faces the studio light
  if(nx*_LX+ny*_LY<0){ nx=-nx; ny=-ny; }

  if(media==='watercolor'){
    // a masterpiece wash is SATURATED: chroma turned up, the lightest
    // passages reserved as paper, broken dried edges, a glow through the
    // middle and pigment pooling at the tail
    const mm=s.col.match(/\d+/g)||[128,128,128];
    const lum=.3*mm[0]+.59*mm[1]+.11*mm[2];
    const pig=_vivid(s.col,.4);
    if(lum>228&&rng()<.55){
      // the whites belong to the paper - barely breathe on them
      c.strokeStyle=_mixWhite(pig,.3); c.globalAlpha=al*.1;
      _slPolyline(c,p,size*1.6);
      return;
    }
    c.strokeStyle=_mixWhite(pig,.22); c.globalAlpha=al*.13;
    _slPolyline(c,p,size*2.1);
    c.strokeStyle=shadeRGB(pig,-.22); c.globalAlpha=al*.12;
    c.setLineDash([size*1.8, size*1.3]);
    _slPolyline(c,p,size*1.3); c.setLineDash([]);
    c.strokeStyle=pig; c.globalAlpha=al*.5; _slPolyline(c,p,size*1.05);
    c.globalAlpha=al*.32;
    _offsetPath(c,p,nx*size*.2,ny*size*.2,size*.8);
    c.strokeStyle=_mixWhite(pig,.34); c.globalAlpha=al*.14;
    _slPolyline(c,p,size*.4);
    c.globalAlpha=al*.3; c.fillStyle=shadeRGB(pig,-.28);
    c.beginPath(); c.arc(p[m-1][0],p[m-1][1],Math.max(.6,size*.45),0,7); c.fill();
    if(rng()<.3){
      c.globalAlpha=al*.15; c.fillStyle=shadeRGB(pig,-.22);
      const gp=p[Math.floor(rng()*m)];
      c.beginPath(); c.arc(gp[0]+(rng()-.5)*size,gp[1]+(rng()-.5)*size,size*.16,0,7);
      c.fill();
    }
  } else if(media==='oil'){
    // paint with a body: a soft dark underlay, the loaded pass, bristle
    // striations pulled through the wet paint, and one studio light
    const bodyCol=shadeRGB(s.col,(rng()-.5)*.08);
    c.strokeStyle=shadeRGB(bodyCol,-.1); c.globalAlpha=al*.45;
    if(m===2||size<3) _slPolyline(c,p,size*1.15); else _slTaper(c,p,size*1.15);
    c.strokeStyle=bodyCol; c.globalAlpha=al*.92;
    if(m===2||size<3) _slPolyline(c,p,size*.9); else _slTaper(c,p,size*.95);
    if(size>=2){
      c.strokeStyle=shadeRGB(bodyCol,.24); c.globalAlpha=al*.22;
      _offsetPath(c,p,nx*size*.26,ny*size*.26,Math.max(.5,size*.22));
      c.strokeStyle=shadeRGB(bodyCol,-.24); c.globalAlpha=al*.16;
      _offsetPath(c,p,-nx*size*.3,-ny*size*.3,Math.max(.5,size*.2));
      for(const b of [-.22,.16]){
        c.strokeStyle=shadeRGB(bodyCol,b<0?-.12:.1); c.globalAlpha=al*.14;
        _offsetPath(c,p,nx*size*b,ny*size*b,Math.max(.4,size*.11));
      }
    }
  } else if(media==='impasto'){
    // oil with the paint laid on thick: wider body, brighter catch of
    // light, and a deposit of paint where the stroke lifts off
    c.strokeStyle=s.col; c.globalAlpha=al;
    if(m===2||size<3) _slPolyline(c,p,size*1.2); else _slTaper(c,p,size*1.25);
    if(size>=1.6){
      c.strokeStyle=shadeRGB(s.col,.3); c.globalAlpha=al*.3;
      _offsetPath(c,p,nx*size*.3,ny*size*.3,Math.max(.5,size*.3));
      c.strokeStyle=shadeRGB(s.col,-.3); c.globalAlpha=al*.2;
      _offsetPath(c,p,-nx*size*.33,-ny*size*.33,Math.max(.5,size*.26));
      c.globalAlpha=al*.24; c.fillStyle=shadeRGB(s.col,.34);
      c.beginPath();
      c.arc(p[m-1][0]+nx*size*.15,p[m-1][1]+ny*size*.15,Math.max(.5,size*.3),0,7);
      c.fill();
    }
  } else if(media==='gouache'){
    // opaque and matte: a soft same-hue edge under a flat body, no shine
    c.strokeStyle=shadeRGB(s.col,-.1); c.globalAlpha=al*.25;
    _slPolyline(c,p,size*1.18);
    c.strokeStyle=s.col; c.globalAlpha=al*.97;
    if(m===2||size<3) _slPolyline(c,p,size*.95); else _slTaper(c,p,size);
  } else if(media==='acrylic'){
    // crisp plastic body with a thin satin catch of light
    c.strokeStyle=s.col; c.globalAlpha=al;
    if(m===2||size<3) _slPolyline(c,p,size*.95); else _slTaper(c,p,size);
    if(size>=2.4){
      c.strokeStyle=shadeRGB(s.col,.24); c.globalAlpha=al*.12;
      _offsetPath(c,p,nx*size*.2,ny*size*.2,Math.max(.4,size*.16));
    }
  } else if(media==='pastel'){
    // soft dust: a broad tender body with grain drifting off both edges
    c.strokeStyle=s.col; c.globalAlpha=al*.5; _slPolyline(c,p,size*1.3);
    c.globalAlpha=al*.3;
    for(let k=0;k<2;k++){
      const b=(rng()-.5)*size*.9;
      c.lineWidth=Math.max(.5,size*.3);
      c.setLineDash([size*(1+rng()*2), size*(.6+rng())]);
      _offsetPath(c,p,nx*b,ny*b,Math.max(.5,size*.3));
      c.setLineDash([]);
    }
  } else if(media==='chalk'){
    c.strokeStyle=s.col;
    for(let i2=0;i2<m-1;i2++){
      const jx=(rng()-.5)*size*.4, jy=(rng()-.5)*size*.4;
      c.globalAlpha=al*(.3+rng()*.45);
      c.lineWidth=Math.max(.5,size*(.5+rng()*.5));
      c.beginPath(); c.moveTo(p[i2][0]+jx,p[i2][1]+jy);
      c.lineTo(p[i2+1][0]+jx,p[i2+1][1]+jy); c.stroke();
    }
  } else if(media==='pencil'){
    // coloured pencil: two fine jittered passes that never quite align
    c.strokeStyle=s.col; c.globalAlpha=al*.55;
    _offsetPath(c,p,(rng()-.5)*size*.2,(rng()-.5)*size*.2,Math.max(.5,size*.3));
    c.strokeStyle=shadeRGB(s.col,-.12); c.globalAlpha=al*.35;
    c.setLineDash([size*2.5, size*.7]);
    _offsetPath(c,p,(rng()-.5)*size*.35,(rng()-.5)*size*.35,Math.max(.4,size*.22));
    c.setLineDash([]);
  } else if(media==='ink'){
    // sumi lives on reserved paper: light and mid tones are mostly LEFT
    // OUT, and what remains is a thin wash - only true darks carry the
    // drawing. Painting every stroke dark is how you get a black slab.
    const mm=s.col.match(/\d+/g)||[0,0,0];
    let den=1-(.3*mm[0]+.59*mm[1]+.11*mm[2])/255;
    den=Math.pow(den,2.2);
    if(den<.22&&rng()>den*3.2) return;      // the paper keeps the lights
    if(den<.5&&rng()>.72) return;           // and breathes in the midtones
    c.strokeStyle='rgb(34,29,24)';
    c.globalAlpha=al*(.04+den*.09); _slPolyline(c,p,size*1.8);
    c.globalAlpha=al*(.07+den*.4);
    if(m===2||size<3) _slPolyline(c,p,size*.78); else _slTaper(c,p,size*.82);
  } else if(media==='pointillism'){
    // Seurat's arithmetic: the stroke dissolves into touched dots of
    // slightly wandering hue
    const step=Math.max(1.6,size*1.05);
    for(let i2=0;i2<m-1;i2++){
      const ax=p[i2][0],ay=p[i2][1],bx=p[i2+1][0],by=p[i2+1][1];
      const seg=Math.hypot(bx-ax,by-ay), n2=Math.max(1,Math.round(seg/step));
      for(let k=0;k<n2;k++){
        const t=k/n2;
        c.fillStyle=shadeRGB(s.col,(rng()-.5)*.3);
        c.globalAlpha=al*(.75+rng()*.25);
        c.beginPath();
        c.arc(ax+(bx-ax)*t+(rng()-.5)*size*.3,
              ay+(by-ay)*t+(rng()-.5)*size*.3,
              Math.max(.7,size*(.34+rng()*.22)),0,7);
        c.fill();
      }
    }
  } else if(media==='marker'){
    // alcohol marker: flat translucent bands that darken where they overlap
    const cap=c.lineCap; c.lineCap='butt';
    c.strokeStyle=s.col; c.globalAlpha=al*.38; _slPolyline(c,p,size*1.35);
    c.globalAlpha=al*.34; _slPolyline(c,p,size*.8);
    c.strokeStyle=shadeRGB(s.col,-.1); c.globalAlpha=al*.18;
    _offsetPath(c,p,nx*size*.5,ny*size*.5,Math.max(.5,size*.22));
    c.lineCap=cap;
  } else if(media==='spray'){
    // airbrush: a drifting cloud of fine droplets around the path
    for(let i2=0;i2<m-1;i2++){
      const ax=p[i2][0],ay=p[i2][1],bx=p[i2+1][0],by=p[i2+1][1];
      const seg=Math.hypot(bx-ax,by-ay), n2=Math.max(2,Math.round(seg/1.4));
      for(let k=0;k<n2;k++){
        const t=k/n2, sc=(rng()-.5)*size*1.7;
        c.fillStyle=s.col; c.globalAlpha=al*(.1+rng()*.2);
        c.beginPath();
        c.arc(ax+(bx-ax)*t+nx*sc, ay+(by-ay)*t+ny*sc,
              Math.max(.4,size*(.08+rng()*.16)),0,7);
        c.fill();
      }
    }
  } else if(media==='charcoal'){
    // burnt willow: colour surrenders to warm grey, pressure varies,
    // and the side of the stick smudges alongside
    const mm=s.col.match(/\d+/g)||[0,0,0];
    const g=Math.round((.3*mm[0]+.59*mm[1]+.11*mm[2])*.55);
    const cc='rgb('+(g+14)+','+(g+9)+','+(g+5)+')';
    c.strokeStyle=cc; c.globalAlpha=al*.12;
    _offsetPath(c,p,nx*size*.45,ny*size*.45,size*1.5);
    for(let i2=0;i2<m-1;i2++){
      const jx=(rng()-.5)*size*.3, jy=(rng()-.5)*size*.3;
      c.globalAlpha=al*(.35+rng()*.4);
      c.lineWidth=Math.max(.5,size*(.45+rng()*.4));
      c.beginPath(); c.moveTo(p[i2][0]+jx,p[i2][1]+jy);
      c.lineTo(p[i2+1][0]+jx,p[i2+1][1]+jy); c.stroke();
    }
  } else if(media==='neon'){
    // light itself: additive glow around a white-hot core
    const comp=c.globalCompositeOperation;
    c.globalCompositeOperation='lighter';
    c.strokeStyle=s.col; c.globalAlpha=al*.09; _slPolyline(c,p,size*2.6);
    c.globalAlpha=al*.2; _slPolyline(c,p,size*1.3);
    c.strokeStyle=_mixWhite(s.col,.55); c.globalAlpha=al*.5;
    _slPolyline(c,p,Math.max(.6,size*.4));
    c.globalCompositeOperation=comp;
  } else {
    c.strokeStyle=s.col; c.globalAlpha=al;
    if(m===2||size<3) _slPolyline(c,p,size*.9); else _slTaper(c,p,size);
  }
}
/* draw a slice of a bundle - the replay engine reveals bundles gradually */
function drawStrokesRange(c,st,from,to){
  const rng=mulberry32((((st.seed||9)+from)>>>0)||9);
  c.lineCap='round'; c.lineJoin='round';
  const end=Math.min(to,st.list.length);
  for(let i=from;i<end;i++) drawOneStroke(c,st.list[i],st.size,st.al,st.media,rng);
  c.globalAlpha=1;
}
function strokes(blob,o={}){
  const list=unpackStrokes(blob);
  if(!list) return;
  const size=o.size===undefined?6:o.size, al=o.opacity===undefined?1:o.opacity;
  const media=o.media||'flat';
  let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  for(const s of list) for(const p of s.pts){
    if(p[0]<x0)x0=p[0]; if(p[0]>x1)x1=p[0];
    if(p[1]<y0)y0=p[1]; if(p[1]>y1)y1=p[1]; }
  const st={list, size, al, media, seed:Math.floor(rand(0,1e9))};
  // not click-selectable: bundles belong to their layer (hide/move/scale in
  // the Layers pane) and their code line - clicks always reach the forms
  const idx=addOp('strokes',[x0-size*2,y0-size*2,x1-x0+size*4,y1-y0+size*4],
    c=>drawStrokesRange(c,st,0,st.list.length), false);
  ops[idx]._strokes=st;
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

