'use strict';
/* ============================ run pipeline ============================ */
/* Before each run the source is instrumented: every call to a paint function
   is tagged with its call-site index, so each painted object knows exactly
   which line of code created it - the bridge that lets canvas gestures
   rewrite the code they came from. */
let lastErr = null, lastRunSrc = null, runSites = [], siteOpsCount = [];
function instrument(src){
  const sites = []; let out = '', last = 0, m;
  tokenRe.lastIndex = 0;
  while((m = tokenRe.exec(src))){
    if(!m[5] || !apiSet.has(m[5])) continue;
    const start = m.index, end = start + m[5].length;
    let i = start-1; while(i>=0 && /\s/.test(src[i])) i--;
    if(i>=0 && src[i]==='.') continue;           // property access, not our call
    let j = end; while(j<src.length && /\s/.test(src[j])) j++;
    if(src[j] !== '(') continue;                  // not a call
    out += src.slice(last, start) + '__call(' + sites.length + ',"' + m[5] + '",';
    last = j + 1;
    sites.push({ name: m[5], open: j, start });
  }
  out += src.slice(last);
  return { code: out, sites };
}
function runCode(){
  const src = ta.value;
  const inst = instrument(src);
  lastRunSrc = src; runSites = inst.sites;
  ops = []; siteStack.length = 0; currentLayer = null; layersRun = [];
  seed(7); lastErr = null;
  const t0 = performance.now();
  try{
    const fn = new Function('__A__', 'with(__A__){\n'+inst.code+'\n}');
    fn(api);
  }catch(e){ lastErr = e; }
  siteOpsCount = [];
  for(const op of ops) if(op.site>=0) siteOpsCount[op.site]=(siteOpsCount[op.site]||0)+1;
  renderLayerChips();
  if(typeof persistDocs==="function") persistDocs();
  renderOps(true);
  octx.clearRect(0,0,W,H);
  if(sel>=0 && sel<ops.length) drawSel();
  else{ sel=-1; linebarLine=-1; positionLinebar(); }
  const ms = (performance.now()-t0).toFixed(0);
  if(lastErr){ statusMsgEl.textContent = '✕ ' + lastErr.message;
    statusMsgEl.className='err'; }
  else{ statusMsgEl.textContent = `✓ ${ops.length} objects painted · ${ms} ms`;
    statusMsgEl.className='ok'; }
}

