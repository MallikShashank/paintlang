'use strict';
/* ========================= image → code ========================= */
/* Image tracing runs as a hosted service: the browser decodes and downscales
   the picture, sends raw pixels to the trace API, and receives a ready
   Paintlang layer back. Point TRACE_API at your deployment, or override per
   browser with localStorage 'paintlang-trace-api'. */
const TRACE_API = localStorage.getItem('paintlang-trace-api')
  || 'https://paintlang-trace.paintlang.workers.dev';
const TRACE_GRID = { sketch:320, balanced:460, fine:960, ultra:1280 };
const TRACE_MAX_CELLS = 1600000;

const importBtn=document.getElementById('importBtn');
const importFile=document.getElementById('importFile');
importBtn.addEventListener('click',()=>importFile.click());
importFile.addEventListener('change',()=>{
  if(importFile.files[0]) handleImageFile(importFile.files[0]);
  importFile.value=''; });
const stageEl=document.getElementById('stage');
stageEl.addEventListener('dragover',e=>e.preventDefault());
stageEl.addEventListener('drop',e=>{ e.preventDefault();
  const f=e.dataTransfer.files&&e.dataTransfer.files[0];
  if(f) handleImageFile(f); });

function traceStatus(msg){ statusMsgEl.textContent=msg; statusMsgEl.className='ok'; }
function layerSlug(fname){
  let base=fname.replace(/\.[^.]*$/,'').toLowerCase()
    .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,24)||'image';
  let slug=base, n=2;
  while(new RegExp("layer\\(\\s*['\"]"+slug+"['\"]").test(ta.value)) slug=base+'-'+(n++);
  return slug;
}

let importBusy=false;
function handleImageFile(file){
  if(importBusy){ traceStatus('already tracing an image - one moment'); return; }
  traceStatus('reading '+file.name+'...');
  const url=URL.createObjectURL(file);
  const img=new Image();
  img.onload=()=>{ URL.revokeObjectURL(url);
    importBusy=true; importBtn.disabled=true;
    traceToCode(img,file.name)
      .catch(err=>{ statusMsgEl.textContent='✕ '+String(err.message||err);
        statusMsgEl.className='err'; })
      .finally(()=>{ importBusy=false; importBtn.disabled=false; });
  };
  img.onerror=()=>{ URL.revokeObjectURL(url);
    statusMsgEl.textContent='✕ could not read '+file.name+' as an image';
    statusMsgEl.className='err'; };
  img.src=url;
}

async function traceToCode(img,fname){
  const detail=document.getElementById('importDetail').value||'fine';
  const GRID=TRACE_GRID[detail]||560;
  const iw=img.naturalWidth||800, ih=img.naturalHeight||500;
  const fit=Math.min(W/iw,H/ih), dw=iw*fit, dh=ih*fit, ox=(W-dw)/2, oy=(H-dh)/2;
  const gk=GRID/Math.max(dw,dh);
  let gw=Math.max(16,Math.round(dw*gk)), gh=Math.max(16,Math.round(dh*gk));
  if(gw*gh>TRACE_MAX_CELLS){                 // square-ish images: keep the cell budget
    const k=Math.sqrt(TRACE_MAX_CELLS/(gw*gh));
    gw=Math.max(16,Math.floor(gw*k)); gh=Math.max(16,Math.floor(gh*k));
  }
  traceStatus('preparing '+fname+' ('+gw+'×'+gh+')...');
  const oc=document.createElement('canvas'); oc.width=gw; oc.height=gh;
  const g2=oc.getContext('2d',{willReadFrequently:true});
  g2.fillStyle='#f6f1e7'; g2.fillRect(0,0,gw,gh);
  g2.drawImage(img,0,0,gw,gh);
  const data=g2.getImageData(0,0,gw,gh).data;
  let bin=''; const CH=0x8000;
  for(let i=0;i<data.length;i+=CH)
    bin+=String.fromCharCode.apply(null,data.subarray(i,Math.min(i+CH,data.length)));
  const payload=JSON.stringify({
    gw, gh, ox:Math.round(ox), oy:Math.round(oy),
    dw:Math.round(dw), dh:Math.round(dh),
    detail, slug:layerSlug(fname), fname,
    rgba:btoa(bin)
  });
  traceStatus('tracing '+fname+' ('+detail+' detail)...');
  let resp;
  try{
    resp=await fetch(TRACE_API,{method:'POST',
      headers:{'content-type':'application/json'}, body:payload});
  }catch(e){
    throw new Error('trace service unreachable at '+TRACE_API
      +' - deploy it (see server/README.md) or set localStorage paintlang-trace-api');
  }
  const out=await resp.json();
  if(!resp.ok||out.error) throw new Error(out.error||('trace service error '+resp.status));
  sel=-1;
  appendCode(out.code);
  statusMsgEl.textContent='✓ traced '+fname+' → '+out.shapes+' shapes in '+out.pigments
    +' pigments'+(out.strokes?' + '+out.strokes+' painted detail strokes':'')
    +' - reorder or hide the layer in the Layers strip';
  statusMsgEl.className='ok';
}
