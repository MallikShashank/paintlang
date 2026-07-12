'use strict';
/* ============================ examples ============================ */
const EXAMPLES = {
'Sunset Lake': `// - sunset lake -
// every line is a paint layer; edit any number and watch it re-render
seed(7)
sky({ from: '#241a4e', to: '#ff9e63' })
stars(80, { max: 0.4 })
sun(490, 320, 44, { color: '#ffd98a', glow: 2.4 })
clouds(5, { y: 170, color: 'rgba(255,175,150,0.30)', scale: 1.4 })
mountains({ layers: 4, base: 392, height: 200, color: '#160f2e', fade: '#c76a86' })
water({ from: 392, color: '#3a2557', deep: '#0b0722', reflect: 0.35 })
trees(8, { from: 15, to: 280, base: 402, size: 46, color: '#0e081f' })
trees(6, { from: 685, to: 945, base: 402, size: 40, color: '#0e081f' })
birds(5, { x: 615, y: 140, spread: 110, color: '#2a1a3f' })
fog(0.10, { y: 375, height: 70, color: '#ff9e63' })
grain(0.5)
vignette(0.3)
`,
'Moonlit Pines': `// - moonlit pines -
seed(21)
sky({ from: '#04060f', to: '#16224a' })
stars(260, { max: 0.85 })
moon(700, 120, 40, { glow: 2 })
mountains({ layers: 3, base: 430, height: 180, color: '#0b1130', fade: '#2c3a66', roughness: 0.9 })
ground(430, { color: '#0a0f28' })
trees(12, { from: 30, to: 930, base: 560, size: 90, color: '#04081a' })
fog(0.14, { y: 430, height: 120, color: '#8fa8ff' })
grain(0.6)
vignette(0.4)
`,
'Ocean Morning': `// - ocean morning -
seed(11)
sky({ from: '#8fd0ff', to: '#f3fbff' })
sun(160, 120, 50, { color: '#fff6cf', glow: 1.6 })
clouds(7, { y: 140, color: 'rgba(255,255,255,0.85)', scale: 1.5 })
water({ from: 305, color: '#3aa5d8', deep: '#0f5c8c', reflect: 0.18 })
birds(6, { x: 620, y: 130, spread: 170, size: 9, color: '#41586c' })
grain(0.3)
vignette(0.18)
`,
'Abstract Orbit': `// - abstract orbit -
// painting with pure math: one loop, seventy circles
seed(3)
background('#0e0e13')
repeat(70, i => {
  const a = i / 70 * PI * 2
  const r = 30 + i * 3.2
  circle(480 + Math.cos(a * 3) * r, 300 + Math.sin(a * 2) * r * 0.58,
         5 + noise(i * 0.18) * 16,
         { color: hsl(190 + i * 2.4, 85, 62), opacity: 0.8 })
})
grain(0.4)
vignette(0.35)
`,
'Blank Canvas': `// - blank canvas -
seed(1)
background('#f6f1e7')

// pick a tool above the canvas and start painting:
// every gesture you make comes back here as code.
`};
const exSel=document.getElementById('examples');
for(const k of Object.keys(EXAMPLES)){
  const o=document.createElement('option'); o.value=k; o.textContent=k; exSel.appendChild(o);
}
exSel.addEventListener('change',()=>{ sel=-1; setCode(EXAMPLES[exSel.value]); });

/* boot - restore tabs from localStorage; a share link opens as a new tab */
(async ()=>{
  try{
    const raw=localStorage.getItem('paintlang-docs-v1');
    if(raw){
      const s=JSON.parse(raw);
      if(s&&Array.isArray(s.d)&&s.d.length){
        docs=s.d.map(x=>({name:String(x.n||'painting').slice(0,40),
          code:String(x.c||''), cloudId:x.w||undefined, undo:[], redo:[]}));
        activeDoc=Math.min(Math.max(0,s.a|0), docs.length-1);
      }
    }
  }catch(e){}
  if(!docs.length){
    docs=[{name:'sunset-lake', code:EXAMPLES['Sunset Lake'], undo:[], redo:[]}];
    activeDoc=0;
  }
  if(location.hash.length>2){
    try{
      const src=await hashToCode(location.hash.slice(1));
      docs.push({name:uniqueDocName('shared'), code:src, undo:[], redo:[]});
      activeDoc=docs.length-1;
      statusMsgEl.textContent='✓ painting loaded from the share link';
      statusMsgEl.className='ok';
    }catch(e){}
  }
  const openQ=new URLSearchParams(location.search).get('open');
  if(openQ&&/^gallery\/[a-z0-9\-]+\.paint$/.test(openQ)){
    try{
      const r=await fetch('/'+openQ);
      if(r.ok){
        const src=await r.text();
        docs.push({name:uniqueDocName(openQ.split('/')[1].replace('.paint','').slice(0,24)),
          code:src, undo:[], redo:[]});
        activeDoc=docs.length-1;
        statusMsgEl.textContent='✓ gallery piece opened - replay it, remix it, or copy its layers';
        statusMsgEl.className='ok';
      }
    }catch(e){}
  }
  activateDoc(activeDoc);
  if(new URLSearchParams(location.search).get('replay')==='1')
    setTimeout(()=>{ if(typeof startReplay==='function') startReplay(); }, 800);
})();
