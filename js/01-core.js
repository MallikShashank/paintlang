
'use strict';
/* ================================ core ================================ */
const W = 960, H = 600;
/* the canvas is backed by 2x real pixels for crisp detail and 2x exports;
   all coordinates in the app stay in the 960x600 logical space */
const DPR = 2;
const paintCanvas = document.getElementById('paint');
const overlay = document.getElementById('overlay');
paintCanvas.width=W*DPR; paintCanvas.height=H*DPR;
overlay.width=W*DPR; overlay.height=H*DPR;
const ctx = paintCanvas.getContext('2d');
const octx = overlay.getContext('2d');
octx.setTransform(DPR,0,0,DPR,0,0);
const ta = document.getElementById('code');
const hl = document.getElementById('hl');
const gutterInner = document.getElementById('gutterInner');
const statusMsgEl = document.getElementById('statusMsg');
const statusPosEl = document.getElementById('statusPos');

/* ---- seeded randomness ---- */
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);
  t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
let _rng = mulberry32(7), _perm = [];
function buildNoise(){ _perm = []; for(let i=0;i<512;i++) _perm.push(_rng()); }
function seed(n){ _rng = mulberry32((n>>>0)||1); buildNoise(); }
function rand(a, b){ if(a===undefined){a=0;b=1} else if(b===undefined){b=a;a=0}
  return a + (b-a)*_rng(); }
function noise01(x){ const xi=Math.floor(x), f=x-xi, u=f*f*(3-2*f);
  const a=_perm[xi&511], b=_perm[(xi+1)&511]; return a+(b-a)*u; }
function noise(x){ return noise01(x); }
function fbm(x, oct, gain){ let a=1,f=1,s=0,n=0;
  for(let i=0;i<oct;i++){ s+=a*noise01(x*f); n+=a; a*=gain; f*=2.13; } return s/n; }

/* ---- colour helpers ---- */
const _cc = document.createElement('canvas').getContext('2d');
function parseColor(c){ _cc.fillStyle='#000'; _cc.fillStyle=c; const s=_cc.fillStyle;
  if(s[0]==='#') return [parseInt(s.slice(1,3),16),parseInt(s.slice(3,5),16),parseInt(s.slice(5,7),16),1];
  const m=s.match(/[\d.]+/g)||[0,0,0,1]; return [+m[0],+m[1],+m[2],m[3]===undefined?1:+m[3]]; }
function mix(c1,c2,t){ const A=parseColor(c1),B=parseColor(c2);
  const r=Math.round(A[0]+(B[0]-A[0])*t), g=Math.round(A[1]+(B[1]-A[1])*t),
        b=Math.round(A[2]+(B[2]-A[2])*t), a=+(A[3]+(B[3]-A[3])*t).toFixed(3);
  return a>=1?`rgb(${r},${g},${b})`:`rgba(${r},${g},${b},${a})`; }
function colA(c,a){ const p=parseColor(c); return `rgba(${p[0]},${p[1]},${p[2]},${a})`; }
function hsl(h,s,l,a){ h=((h%360)+360)%360;
  return a===undefined?`hsl(${h},${s}%,${l}%)`:`hsla(${h},${s}%,${l}%,${a})`; }

