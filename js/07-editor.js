'use strict';
/* ============================== editor =============================== */
const tokenRe = /(\/\/[^\n]*)|('(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`)|(\b\d+(?:\.\d+)?\b)|\b(const|let|var|function|return|if|else|for|while|of|in|new|true|false|null|undefined|Math)\b|([A-Za-z_$][\w$]*)/g;
function esc(s){ return s.replace(/&/g,'&amp;').replace(/</g,'&lt;'); }
function buildHL(src){
  let html='', last=0, m;
  tokenRe.lastIndex = 0;
  while((m = tokenRe.exec(src))){
    html += esc(src.slice(last, m.index));
    if(m[1]) html += '<span class="tk-c">'+esc(m[1])+'</span>';
    else if(m[2]) html += '<span class="tk-s">'+esc(m[2])+'</span>';
    else if(m[3]) html += '<span class="tk-n">'+m[3]+'</span>';
    else if(m[4]) html += '<span class="tk-k">'+m[4]+'</span>';
    else html += apiSet.has(m[5]) ? '<span class="tk-a">'+m[5]+'</span>' : esc(m[5]);
    last = tokenRe.lastIndex;
  }
  return html + esc(src.slice(last));
}
let hlIdleT=null;
function renderHL(){
  const src = ta.value;
  const lines = src.split('\n').length;
  let g=''; for(let i=1;i<=lines;i++) g += i + '\n';
  gutterInner.textContent = g;
  // very large documents (big imports): plain text keeps every keystroke
  // instant - the colours return quietly once the typing pauses
  if(src.length>120000){
    hl.textContent = src + '\n';
    clearTimeout(hlIdleT);
    if(src.length<=2500000)
      hlIdleT=setTimeout(()=>{
        if(ta.value!==src) return;          // the document moved on
        hl.innerHTML = buildHL(src) + '\n';
        hl.scrollTop = ta.scrollTop; hl.scrollLeft = ta.scrollLeft;
      }, 500);
    return;
  }
  clearTimeout(hlIdleT);
  hl.innerHTML = buildHL(src) + '\n';
}
ta.addEventListener('scroll', ()=>{
  hl.scrollTop = ta.scrollTop; hl.scrollLeft = ta.scrollLeft;
  gutterInner.style.transform = 'translateY(' + (-ta.scrollTop) + 'px)';
  positionLinebar();
});
let debounceT = null;
ta.addEventListener('input', ()=>{
  renderHL(); sel = -1; linebarLine=-1; positionLinebar(); if(typeof hideSelAction==="function") hideSelAction();
  plMetric('first-code-edit', true);
  clearTimeout(debounceT); debounceT = setTimeout(runCode, 380);
});

/* ---- undo / redo: snapshots of the whole document ---- */
let undoStack=[], redoStack=[];   // reassigned per document tab
let lastSnapT=0;
function snapshotUndo(){
  const v=ta.value;
  if(undoStack.length&&undoStack[undoStack.length-1]===v) return;
  undoStack.push(v); if(undoStack.length>60) undoStack.shift();
  redoStack.length=0; lastSnapT=Date.now();
}
function doUndo(){
  if(!undoStack.length){ statusMsgEl.textContent='nothing to undo'; statusMsgEl.className='ok'; return; }
  redoStack.push(ta.value);
  ta.value=undoStack.pop(); sel=-1; renderHL(); runCode();
  statusMsgEl.textContent='undone'; statusMsgEl.className='ok';
}
function doRedo(){
  if(!redoStack.length) return;
  undoStack.push(ta.value);
  ta.value=redoStack.pop(); sel=-1; renderHL(); runCode();
}
ta.addEventListener('beforeinput', ()=>{
  if(Date.now()-lastSnapT>900) snapshotUndo();
});
document.getElementById('undoBtn').addEventListener('click', doUndo);
document.getElementById('redoBtn').addEventListener('click', doRedo);

/* ---- selected-object → code-line link ---- */
const linebar=document.getElementById('linebar');
let linebarLine=-1;
function srcLine(idx){ let n=1;
  for(let i=0;i<idx&&i<lastRunSrc.length;i++) if(lastRunSrc[i]==='\n') n++;
  return n; }
function positionLinebar(){
  if(linebarLine<0){ linebar.style.display='none'; return; }
  const LH=parseFloat(getComputedStyle(ta).lineHeight)||20;
  linebar.style.display='block';
  linebar.style.top=(12+(linebarLine-1)*LH-ta.scrollTop)+'px';
  linebar.style.height=LH+'px';
}
function revealLine(line){
  linebarLine=line;
  const LH=parseFloat(getComputedStyle(ta).lineHeight)||20;
  ta.scrollTop=Math.max(0,(line-1)*LH-ta.clientHeight/2+LH);
  positionLinebar();
}

/* ---- number scrubber: click any number in the code → slider to scrub it ---- */
const scrubEl=document.createElement('div'); scrubEl.id='scrub'; scrubEl.hidden=true;
scrubEl.innerHTML='<input type="range"><output></output>';
document.getElementById('edstack').appendChild(scrubEl);
const scrubR=scrubEl.querySelector('input'), scrubO=scrubEl.querySelector('output');
let scrubSpan=null, scrubSnapped=false;
function hideScrub(){ scrubEl.hidden=true; scrubSpan=null; }
function tryShowScrub(){
  if(ta.selectionStart!==ta.selectionEnd){ hideScrub(); return; }
  const src=ta.value; let s=ta.selectionStart, e=s;
  while(s>0&&/[\d.]/.test(src[s-1])) s--;
  while(e<src.length&&/[\d.]/.test(src[e])) e++;
  if(s>0&&src[s-1]==='-') s--;
  const tok=src.slice(s,e);
  if(s===e||!/^-?\d+(?:\.\d+)?$/.test(tok)){ hideScrub(); return; }
  scrubSpan={start:s,end:e}; scrubSnapped=false;
  const v=parseFloat(tok), mag=Math.max(24,Math.abs(v));
  scrubR.min=Math.round(v-mag); scrubR.max=Math.round(v+mag);
  scrubR.step=tok.indexOf('.')>=0?'0.1':'1'; scrubR.value=v;
  scrubO.textContent=tok;
  const LH=parseFloat(getComputedStyle(ta).lineHeight)||20;
  const upto=src.slice(0,s);
  const line=upto.split('\n').length-1, col=s-(upto.lastIndexOf('\n')+1);
  const cs=getComputedStyle(ta);
  _cc.font=cs.fontSize+' '+cs.fontFamily;
  const chW=_cc.measureText('0').width||7.8;
  let left=14+col*chW-ta.scrollLeft, top=12+(line+1)*LH-ta.scrollTop+3;
  left=Math.max(2,Math.min(left,ta.clientWidth-190));
  top=Math.max(2,Math.min(top,ta.clientHeight-34));
  scrubEl.style.left=left+'px'; scrubEl.style.top=top+'px';
  scrubEl.hidden=false;
}
ta.addEventListener('click', tryShowScrub);
ta.addEventListener('keydown', ()=>hideScrub());
ta.addEventListener('scroll', ()=>hideScrub());
scrubR.addEventListener('input', ()=>{
  if(!scrubSpan) return;
  if(!scrubSnapped){ snapshotUndo(); scrubSnapped=true; }
  const nv=String(scrubR.value);
  ta.setRangeText(nv, scrubSpan.start, scrubSpan.end, 'preserve');
  scrubSpan.end=scrubSpan.start+nv.length;
  scrubO.textContent=nv;
  renderHL();
  clearTimeout(debounceT); debounceT=setTimeout(runCode,120);
});

/* ---- brush settings panel ---- */
const TUNE_SCHEMA={
  spacing:['Stamp spacing',.08,1.2,.01],
  flow:['Flow per stamp',.02,1,.01],
  pSize:['Pressure → size',0,1,.05],
  pFlow:['Pressure → flow',0,1,.05],
  taper:['End taper',0,1,.05],
  jitter:['Size jitter',0,.5,.01],
  scatter:['Scatter',0,.6,.01],
  soft:['Softness radius',.6,2.6,.05],
  flatness:['Nib flatness',.1,1,.02],
  bristle:['Bristle count',2,14,1],
  mix:['Pick up canvas colour',0,.9,.02],
  strength:['Smudge pull',.5,.98,.01],
  density:['Grain density',.2,1.5,.02]
};
const brushPanel=document.createElement('div');
brushPanel.id='brushPanel'; brushPanel.hidden=true;
document.getElementById('right').appendChild(brushPanel);
function drawBrushSample(){
  const cv=brushPanel.querySelector('#bpPrev'); if(!cv) return;
  const g=cv.getContext('2d');
  g.fillStyle='#f6f1e7'; g.fillRect(0,0,cv.width,cv.height);
  const spts=[];
  for(let i=0;i<=24;i++){ const t=i/24;
    spts.push([12+t*226, 27+Math.sin(t*5)*11,
      Math.round((.25+.75*Math.sin(t*Math.PI))*100)/100]); }
  renderBrushStroke(g, spts, {brush:pbrushSel.value, color:pcolor.value, size:12,
    tune:brushTune(pbrushSel.value)||undefined}, 424242);
}
function buildBrushPanel(){
  const name=pbrushSel.value, B=BRUSHES[name];
  let html='<div class="bp-head"><b>'+name+'</b>'
    +'<button id="bpReset" title="Back to factory settings">Reset</button>'
    +'<button id="bpClose">×</button></div>'
    +'<canvas id="bpPrev" width="250" height="54"></canvas>';
  for(const k of Object.keys(B)){
    const s=TUNE_SCHEMA[k]; if(!s) continue;
    html+='<label class="bp-row"><span>'+s[0]+'</span>'
      +'<input type="range" data-k="'+k+'" min="'+s[1]+'" max="'+s[2]
      +'" step="'+s[3]+'" value="'+B[k]+'"><output>'+B[k]+'</output></label>';
  }
  html+='<label class="bp-row"><span>Blend</span><select id="bpBlend">'
    +'<option value="">normal</option><option value="multiply">multiply</option>'
    +'<option value="lighter">lighter (add)</option><option value="screen">screen</option>'
    +'</select><output></output></label>';
  brushPanel.innerHTML=html;
  brushPanel.querySelector('#bpBlend').value=B.blend||'';
  brushPanel.querySelectorAll('input[type=range]').forEach(inp=>{
    inp.addEventListener('input',()=>{
      BRUSHES[name][inp.dataset.k]=+inp.value;
      inp.nextElementSibling.textContent=inp.value;
      drawBrushSample();
    });
  });
  brushPanel.querySelector('#bpBlend').addEventListener('change',e=>{
    if(e.target.value) BRUSHES[name].blend=e.target.value;
    else delete BRUSHES[name].blend;
    drawBrushSample();
  });
  brushPanel.querySelector('#bpReset').addEventListener('click',()=>{
    BRUSHES[name]=JSON.parse(JSON.stringify(DEFAULT_BRUSHES[name]));
    buildBrushPanel();
    statusMsgEl.textContent=name+' brush reset to its factory settings';
    statusMsgEl.className='ok';
  });
  brushPanel.querySelector('#bpClose').addEventListener('click',()=>{ brushPanel.hidden=true; });
  drawBrushSample();
}
document.getElementById('brushCfg').addEventListener('click',()=>{
  brushPanel.hidden=!brushPanel.hidden;
  if(!brushPanel.hidden) buildBrushPanel();
});
document.getElementById('pbrush').addEventListener('change',()=>{
  if(!brushPanel.hidden) buildBrushPanel();
});
ta.addEventListener('keydown', e=>{
  if(e.key==='Tab'){ e.preventDefault();
    ta.setRangeText('  ', ta.selectionStart, ta.selectionEnd, 'end');
    renderHL(); clearTimeout(debounceT); debounceT=setTimeout(runCode,380); }
  if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){ e.preventDefault();
    clearTimeout(debounceT); runCode(); }
});
function setCode(src, run=true){
  if(ta.value&&ta.value!==src) snapshotUndo();
  ta.value = src; renderHL(); if(run) runCode(); }
function appendCode(snippet){
  snapshotUndo();
  const src = ta.value;
  const insert = (src.length && !src.endsWith('\n') ? '\n' : '') + snippet + '\n';
  if(insert.length>20000){
    // execCommand is far too slow for big blocks (imports) - assign directly;
    // our own undo stack still covers it
    ta.value = src + insert;
  } else {
    ta.focus();
    ta.setSelectionRange(src.length, src.length);
    let ok = false;
    try{ ok = document.execCommand('insertText', false, insert); }catch(e){}
    if(!ok) ta.value = src + insert;
  }
  ta.scrollTop = ta.scrollHeight;
  renderHL(); clearTimeout(debounceT); runCode();
}

