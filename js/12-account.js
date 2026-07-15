'use strict';
/* ============== menu drawer, floating toolbox, accounts, galleries ==============
   Sign in with GitHub or Google (when configured on the server), or with a
   key account: a plk_... secret this browser remembers. Works save to a
   private cloud gallery with full version history; the global library holds
   shared components - each one a plain code snippet. */

const API_BASE = (typeof TRACE_API==='string') ? TRACE_API
  : 'https://paintlang-trace.paintlang.workers.dev';
const acct = {
  key: localStorage.getItem('paintlang-key') || '',
  uid: localStorage.getItem('paintlang-uid') || '',
  handle: localStorage.getItem('paintlang-handle') || '',
  provider: localStorage.getItem('paintlang-provider') || ''
};

function apiStatus(msg, ok){
  if(typeof statusMsgEl!=='undefined'){
    statusMsgEl.textContent=msg; statusMsgEl.className=ok?'ok':'err';
  }
}
async function acctApi(path, opts={}){
  const h={'content-type':'application/json'};
  if(acct.key) h.authorization='Bearer '+acct.key;
  const r=await fetch(API_BASE+path, {method:opts.method||'GET', headers:h,
    body:opts.body!==undefined?JSON.stringify(opts.body):undefined});
  const j=await r.json().catch(()=>({error:'bad response'}));
  if(!r.ok) throw new Error(j.error||('http '+r.status));
  return j;
}
function timeAgo(t){
  const s=(Date.now()-t)/1000;
  if(s<90) return 'just now';
  if(s<5400) return Math.round(s/60)+' min ago';
  if(s<129600) return Math.round(s/3600)+' h ago';
  return Math.round(s/86400)+' d ago';
}
const el=id=>document.getElementById(id);

/* ------------------------------ drawer ------------------------------ */
(function(){
  const wrap=el('drawerWrap');
  let closeT=null;
  const RAIL=[...document.querySelectorAll('#actbar [data-sec]')];
  window.openDrawer=function(){
    clearTimeout(closeT);
    wrap.hidden=false;
    requestAnimationFrame(()=>requestAnimationFrame(()=>wrap.classList.add('open')));
  };
  window.closeDrawer=function(){
    wrap.classList.remove('open');
    for(const b of RAIL) b.classList.remove('on');
    closeT=setTimeout(()=>{ wrap.hidden=true; wrap.classList.remove('solo'); }, 240);
  };
  // section mode: an activity-bar icon opens the drawer beside the rail
  // showing only that section (VS Code sidebar behavior)
  window.openDrawerSec=function(id){
    for(const s of document.querySelectorAll('#drawer .dsec'))
      s.classList.toggle('on', s.id===id);
    for(const b of RAIL) b.classList.toggle('on', b.dataset.sec===id);
    wrap.classList.add('solo');
    openDrawer();
  };
  for(const b of RAIL)
    b.addEventListener('click', ()=>{
      if(b.classList.contains('on')&&wrap.classList.contains('open')){
        closeDrawer(); return;
      }
      openDrawerSec(b.dataset.sec);
    });
  el('menuBtn').addEventListener('click', ()=>{
    wrap.classList.remove('solo');
    for(const b of RAIL) b.classList.remove('on');
    openDrawer();
  });
  el('drawerClose').addEventListener('click', closeDrawer);
  el('drawerShade').addEventListener('click', closeDrawer);
  document.addEventListener('keydown', e=>{
    if(e.key==='Escape'&&!wrap.hidden) closeDrawer();
  });
  // actions that leave the studio context close the drawer behind themselves
  for(const id of ['importBtn','replayBtn','shareBtn','helpBtn'])
    el(id).addEventListener('click', closeDrawer);
  el('examples').addEventListener('change', closeDrawer);
  el('acctBtn').addEventListener('click', ()=>{ openDrawerSec('acctSec'); });
})();

/* -------------------------- floating toolbox --------------------------
   Drag by the header, resize from the corner, collapse with the caret.
   Position and size persist per browser. Docks statically on mobile. */
(function(){
  const box=el('toolbox'), head=el('tbHead'), host=el('right');
  const KEY='paintlang-tbox';
  const mobile=()=>matchMedia('(max-width: 820px)').matches;
  let st={};
  try{ st=JSON.parse(localStorage.getItem(KEY)||'{}')||{}; }catch(e){}
  const save=()=>{ try{ localStorage.setItem(KEY, JSON.stringify(st)); }catch(e){} };
  function clamp(){
    if(mobile()) return;
    const hb=host.getBoundingClientRect(), bb=box.getBoundingClientRect();
    let x=parseFloat(box.style.left)||14, y=parseFloat(box.style.top)||42;
    x=Math.max(2, Math.min(x, hb.width-Math.min(bb.width,120)));
    y=Math.max(30, Math.min(y, hb.height-28));
    box.style.left=x+'px'; box.style.top=y+'px';
    st.x=x; st.y=y;
  }
  if(!mobile()){
    if(st.x!==undefined){ box.style.left=st.x+'px'; box.style.top=st.y+'px'; }
    if(st.w){ box.style.width=st.w+'px'; }
    if(st.h){ box.style.height=st.h+'px'; }
    if(st.min) box.classList.add('min');
    requestAnimationFrame(clamp);
  }
  el('tbMin').addEventListener('click', e=>{
    e.stopPropagation();
    st.min=box.classList.toggle('min'); save();
  });
  let drag=null;
  head.addEventListener('pointerdown', e=>{
    // the collapse button holds an svg icon - a raw id check misses clicks
    // that land on the icon's paths and turns them into drags
    if((e.target.closest&&e.target.closest('#tbMin'))||mobile()) return;
    const hb=host.getBoundingClientRect(), bb=box.getBoundingClientRect();
    drag={dx:e.clientX-bb.left, dy:e.clientY-bb.top, hb};
    head.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  head.addEventListener('pointermove', e=>{
    if(!drag) return;
    box.style.left=(e.clientX-drag.hb.left-drag.dx)+'px';
    box.style.top=(e.clientY-drag.hb.top-drag.dy)+'px';
  });
  head.addEventListener('pointerup', ()=>{ if(drag){ drag=null; clamp(); save(); } });
  let rot=null;
  new ResizeObserver(()=>{
    if(mobile()||box.classList.contains('min')) return;
    clearTimeout(rot);
    rot=setTimeout(()=>{
      const bb=box.getBoundingClientRect();
      if(bb.width>50){ st.w=Math.round(bb.width); st.h=Math.round(bb.height); save(); }
    }, 300);
  }).observe(box);
  window.addEventListener('resize', clamp);
})();

/* ------------------ workspace: whose studio is this? ------------------
   The open tabs ARE the workspace. Signed out, they belong to this
   browser's guest. Signing in swaps to the account's own workspace, synced
   through the server so it follows you across devices; signing out saves
   it up, removes it from this device, and restores the guest's studio.
   Parallel devices: pushes carry the last-seen timestamp; if another
   device wrote meanwhile, whichever side holds the most recent real edit
   wins, and the other side is reloaded with a message. */
const WS={t:0, lastEdit:0, timer:null, syncing:false};
function docsSnapshot(){
  if(docs[activeDoc]) docs[activeDoc].code=ta.value;
  return JSON.stringify({a:activeDoc,
    d:docs.map(d=>({n:d.name, c:d.code, w:d.cloudId||undefined,
      r:d.remixOf||undefined, p:d.pubId||undefined}))});
}
function loadDocsState(stateStr, msg){
  try{
    const s=JSON.parse(stateStr);
    if(!s||!Array.isArray(s.d)||!s.d.length) return false;
    docs=s.d.map(x=>({name:String(x.n||'painting').slice(0,40),
      code:String(x.c||''), cloudId:x.w||undefined,
      remixOf:x.r||undefined, pubId:x.p||undefined, undo:[], redo:[]}));
    activeDoc=Math.min(Math.max(0,s.a|0), docs.length-1);
    activateDoc(activeDoc);
    if(msg) apiStatus(msg, true);
    return true;
  }catch(e){ return false; }
}
function freshStudio(msg){
  docs=[{name:'painting', code:BLANK_DOC, undo:[], redo:[]}];
  activeDoc=0; activateDoc(0);
  if(msg) apiStatus(msg, true);
}
function wsQueue(){
  WS.lastEdit=Date.now();
  if(!acct.key) return;
  clearTimeout(WS.timer);
  WS.timer=setTimeout(wsPush, 5000);
}
async function wsPush(){
  if(!acct.key||WS.syncing) return;
  WS.syncing=true;
  try{
    const r=await fetch(API_BASE+'/api/workspace',{method:'POST',
      headers:{'content-type':'application/json', authorization:'Bearer '+acct.key},
      body:JSON.stringify({state:docsSnapshot(), baseT:WS.t})});
    const j=await r.json();
    if(r.ok){ WS.t=j.t; }
    else if(r.status===409){
      // another device wrote since this one last looked
      if(Date.now()-WS.lastEdit<60000){
        WS.t=j.t;                        // this edit is fresher: take over
        WS.syncing=false; return wsPush();
      }
      WS.t=j.t;
      loadDocsState(j.state,'your studio was updated from another device');
    }
  }catch(e){}
  WS.syncing=false;
}
async function wsPull(adoptIfEmpty){
  if(!acct.key) return;
  try{
    const r=await acctApi('/api/workspace');
    if(r.t&&r.t>WS.t){
      if(r.state===docsSnapshot()){ WS.t=r.t; return; }   // already identical
      if(Date.now()-WS.lastEdit>60000||WS.t===0){
        WS.t=r.t;
        loadDocsState(r.state,'your studio is back where you left it');
      }
    }else if(!r.t&&adoptIfEmpty){
      // first sign-in anywhere: this session becomes the account's studio
      WS.t=0; wsPush();
    }
  }catch(e){}
}
/* untouched starter tabs (a blank canvas or an unedited example) are not
   work worth carrying anywhere */
function isTrivialDoc(d){
  const c=(d.code||'').trim();
  if(!c) return true;
  if(c===BLANK_DOC.trim()) return true;
  if(typeof EXAMPLES==='object')
    for(const k in EXAMPLES) if(c===EXAMPLES[k].trim()) return true;
  return false;
}
async function onSignIn(){
  // real work painted before signing in belongs to the person signing in:
  // it is carried INTO the account. Nothing is ever left waiting on the
  // device for whoever sits down next.
  if(docs[activeDoc]) docs[activeDoc].code=ta.value;
  const carried=docs.filter(d=>!isTrivialDoc(d))
    .map(d=>({name:d.name, code:d.code, cloudId:d.cloudId}));
  WS.t=0; WS.lastEdit=0;
  try{
    const r=await acctApi('/api/workspace');
    if(r.t){
      WS.t=r.t;
      loadDocsState(r.state,'your studio is back where you left it');
      if(carried.length){
        for(const c of carried)
          docs.push({name:uniqueDocName(c.name), code:c.code,
            cloudId:c.cloudId, undo:[], redo:[]});
        activateDoc(docs.length-1);
        apiStatus('your studio is back, and '+carried.length
          +(carried.length>1?' paintings':' painting')
          +' from this session came along', true);
        wsPush();
      }
    }else{
      // first sign-in anywhere: this session becomes the account's studio
      wsPush();
    }
  }catch(e){}
}
async function onSignOut(){
  // save the account's studio up, then leave a clean desk: on a shared
  // machine, nothing of a signed-out person may remain
  clearTimeout(WS.timer);
  try{ await wsPush(); }catch(e){}
  WS.t=0; WS.lastEdit=0;
  try{ localStorage.removeItem('paintlang-docs-guest'); }catch(e){}
  freshStudio('signed out - the studio is clean. Sign in to load your work.');
  if(typeof persistDocs==='function') persistDocs();
}
// keep devices honest: re-check on focus, and every 45 seconds while visible
addEventListener('focus',()=>{ if(acct.key) wsPull(false); });
setInterval(()=>{
  if(!acct.key||document.hidden) return;
  fetch(API_BASE+'/api/workspace?meta=1',
    {headers:{authorization:'Bearer '+acct.key}})
    .then(r=>r.json()).then(j=>{ if(j.t&&j.t>WS.t) wsPull(false); })
    .catch(()=>{});
}, 45000);

/* ------------------------------ account ------------------------------ */
function setAcct(key, uid, handle, provider){
  acct.key=key||''; acct.uid=uid||''; acct.handle=handle||''; acct.provider=provider||'';
  try{
    for(const [k,v] of [['paintlang-key',acct.key],['paintlang-uid',acct.uid],
        ['paintlang-handle',acct.handle],['paintlang-provider',acct.provider]])
      v?localStorage.setItem(k,v):localStorage.removeItem(k);
  }catch(e){}
  el('acctBtnLabel').textContent=acct.key?(acct.handle||'Account'):'Sign in';
  renderAcct();
}
function acctRow(...kids){
  const d=document.createElement('div'); d.className='drow';
  for(const k of kids) d.appendChild(k);
  return d;
}
function acctBtnEl(txt, fn, primary){
  const b=document.createElement('button');
  if(txt.startsWith('<svg')) b.innerHTML=txt; else b.textContent=txt;
  if(primary) b.className='primary';
  b.addEventListener('click', fn); return b;
}
function mkInput(ph, type){
  const i=document.createElement('input'); i.placeholder=ph; i.type=type||'text';
  return i;
}
function noteEl(txt){
  const d=document.createElement('div'); d.className='acct-note'; d.textContent=txt;
  return d;
}
let providers=null;
async function getProviders(){
  if(providers) return providers;
  try{ providers=await acctApi('/api/auth/providers'); }
  catch(e){ providers={github:false, google:false}; }
  return providers;
}
const PROVIDER_NAME={github:'GitHub', google:'Google'};

/* ---- the plans dialog: both tiers side by side, one subscribe each ----
   Fed by /api/billing/info; each tier's button follows the visitor's
   region (UPI via Razorpay in India, card MoR elsewhere). A tier whose
   rail is not configured yet shows as coming soon instead of vanishing. */
function renderPlanModal(b, currentPlan, startPoll){
  const modal=el('planModal'), grid=el('planGrid');
  grid.innerHTML='';
  const price=t=>b.prices&&b.prices[t]
    ?(b.region==='in'?b.prices[t].inr:b.prices[t].usd):'';
  const mkCard=(t,name,blurb,best)=>{
    const cfg=(b.tiers||{})[t]||{}, cp=(b.caps||{})[t]||{};
    const card=document.createElement('div');
    card.className='plan-card'+(best?' best':'');
    const h=document.createElement('h3'); h.textContent=name;
    const pr=document.createElement('div'); pr.className='plan-price';
    pr.innerHTML=price(t).replace(/\/mo/,' <span>per month</span>');
    const ul=document.createElement('ul');
    for(const li of [
      cp.works+' cloud paintings',
      cp.versions+' versions of each',
      cp.ultraDay+' ultra traces a day',
      cp.fineDay+' fine traces a day',
      cp.pubs+' community publishes',
      'replay video export',
      blurb
    ]){ const e3=document.createElement('li'); e3.textContent=li; ul.appendChild(e3); }
    const useIndia=b.region==='in'&&cfg.inAvailable;
    let btn;
    if(currentPlan===t){
      btn=acctBtnEl('Your current plan', ()=>{});
      btn.disabled=true;
    }else if(useIndia||cfg.intlLink){
      btn=acctBtnEl('Subscribe', async ev=>{
        const el2=ev.currentTarget; el2.disabled=true;
        plMetric('upgrade-click-'+t);
        try{
          if(useIndia){
            const r=await acctApi('/api/billing/rzp/subscribe',
              {method:'POST',body:{tier:t}});
            window.open(r.url,'_blank','noopener');
          }else{
            window.open(cfg.intlLink,'_blank','noopener');
          }
          apiStatus('complete the payment in the new tab - your plan activates here by itself', true);
          if(startPoll) startPoll();
          modal.hidden=true;
        }catch(e){ apiStatus('subscribe: '+e.message, false); }
        el2.disabled=false;
      }, true);
      btn.className='primary';
      btn.title=name+' - '+price(t)+' via '
        +(useIndia?'UPI (Razorpay)':'card (Dodo Payments)')+'. Cancel anytime.';
    }else{
      btn=acctBtnEl('Coming soon', ()=>{});
      btn.disabled=true;
    }
    card.append(h,pr,ul,btn);
    return card;
  };
  grid.appendChild(mkCard('hobby','Hobby',
    'for painting most weekends', false));
  grid.appendChild(mkCard('artist','Artist',
    'for artists who live in the studio', true));
  modal.hidden=false;
}
(function(){
  const modal=el('planModal');
  el('planClose').addEventListener('click',()=>{ modal.hidden=true; });
  modal.addEventListener('click',e=>{ if(e.target===modal) modal.hidden=true; });
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&!modal.hidden) modal.hidden=true;
  });
})();

function renderAcct(){
  const body=el('acctBody'); body.innerHTML='';
  if(!acct.key){ renderSignedOut(body); return; }

  // signed in
  const who=document.createElement('div'); who.className='acct-note';
  const nameB=document.createElement('b');
  nameB.style.color='var(--text)';
  nameB.textContent=acct.handle||'artist';
  who.append('Signed in as ', nameB,
    acct.provider?' via '+(PROVIDER_NAME[acct.provider]||acct.provider):'');
  const rename=acctBtnEl(plIco('pencil'), async ()=>{
    const n=prompt('Your artist name - unique across the community, shown on everything you publish (3-24 letters, digits, - or _):', acct.handle||'');
    if(n===null) return;
    try{
      const r=await acctApi('/api/account/handle',{method:'POST',body:{handle:n.trim()}});
      setAcct(acct.key, acct.uid, r.handle, acct.provider);
      apiStatus('name updated to '+r.handle, true);
    }catch(e){ apiStatus('rename: '+e.message, false); }
  });
  rename.title='Change your artist name';
  rename.style.cssText='padding:1px 7px;margin-left:6px';
  who.appendChild(rename);
  body.appendChild(who);

  if(!acct.provider){
    // key accounts: the key is the only way back in - keep it reachable
    const keyBox=document.createElement('div'); keyBox.className='acct-key'; keyBox.hidden=true;
    let shown=false;
    body.appendChild(acctRow(
      acctBtnEl('Show key', ()=>{ shown=!shown; keyBox.hidden=!shown;
        keyBox.textContent=shown?acct.key:''; }),
      acctBtnEl('Copy key', async ()=>{
        try{ await navigator.clipboard.writeText(acct.key);
          apiStatus('account key copied - it is the only way back into this account', true); }
        catch(e){ shown=true; keyBox.hidden=false; keyBox.textContent=acct.key;
          apiStatus('copy failed - key shown in the menu, copy it by hand', false); }
      }),
      acctBtnEl('Sign out', async ()=>{
        if(!confirm('Sign out? Make sure your account key is copied somewhere - it is the only way back in.')) return;
        await onSignOut();
        setAcct('','','','');
      })
    ));
    body.appendChild(keyBox);
  }else{
    body.appendChild(acctRow(acctBtnEl('Sign out', async ()=>{
      if(!confirm('Sign out?')) return;
      await onSignOut();
      setAcct('','','','');
    })));
  }

  // plan + upgrade (rails appear only when configured server-side; the
  // primary button follows the visitor's region - UPI for India, card MoR
  // internationally - with the other rail one click away)
  const planBox=document.createElement('div'); planBox.className='acct-note';
  body.appendChild(planBox);
  acctApi('/api/billing/info').then(b=>{
    // the panel re-renders on sign-in refresh; a response for a torn-down
    // render must not append duplicate upgrade rows to the live panel
    if(!planBox.isConnected) return;
    const stale=body.querySelector('.upgrade-row'); if(stale) stale.remove();
    const e2=b.ent||{};
    planBox.textContent=(e2.label||'Free')+' plan: '+e2.works+' cloud paintings, '
      +e2.versions+' versions each, '+e2.ultraDay+' ultra and '
      +(e2.fineDay||50)+' fine traces a day.';
    if(e2.plan==='artist'||e2.plan==='pro') return;
    // checkout opens in a new tab; the studio stays put and watches for the
    // payment webhook, flipping the plan the moment it lands
    let pollT=null;
    const startPoll=()=>{
      clearInterval(pollT);
      let tries=0;
      pollT=setInterval(async ()=>{
        if(++tries>120){ clearInterval(pollT); return; }
        try{
          const me=await acctApi('/api/me');
          if(me.ent&&me.ent.plan!=='free'&&me.ent.plan!==e2.plan){
            clearInterval(pollT);
            renderAcct();
            apiStatus(me.ent.label+' is active - welcome! '+me.ent.works
              +' cloud paintings, '+me.ent.ultraDay+' ultra traces a day are yours', true);
          }
        }catch(e){}
      }, 6000);
    };
    // one button; the plans dialog holds both tiers side by side
    const tiers=b.tiers||{};
    const avail=t=>{
      const cfg=tiers[t]||{};
      return (b.region==='in'&&cfg.inAvailable)||!!cfg.intlLink;
    };
    if(!avail('hobby')&&!avail('artist')) return;
    const row=document.createElement('div'); row.className='drow upgrade-row';
    row.style.marginTop='7px';
    const openBtn=acctBtnEl('Subscribe for more usage', ()=>{
      plMetric('plans-open');
      renderPlanModal(b, e2.plan, startPoll);
    });
    openBtn.className='pro-btn';
    openBtn.title='The studio is free forever - plans raise the ceilings. See both plans.';
    row.appendChild(openBtn);
    body.appendChild(row);
  }).catch(()=>{ planBox.remove(); });

  const label=mkInput('version label (optional, e.g. "before sky rework")');
  body.appendChild(acctRow(label));
  body.appendChild(acctRow(acctBtnEl(plIco('cloud')+' Save this painting', async ev=>{
    const d=docs[activeDoc]; if(!d) return;
    const sb=ev.currentTarget;
    d.code=ta.value;
    try{
      const bodyq={name:d.name, code:d.code, label:label.value.trim()};
      if(d.cloudId) bodyq.id=d.cloudId;
      const r=await acctApi('/api/work/save',{method:'POST',body:bodyq});
      d.cloudId=r.id; label.value='';
      if(typeof persistDocs==='function') persistDocs();
      plMetric('save');
      apiStatus('saved - "'+d.name+'" is now version '+r.ver+' in your gallery', true);
      const old=sb.innerHTML;
      sb.innerHTML=plIco('check')+' Saved'; sb.classList.add('saved-ok');
      setTimeout(()=>{ sb.innerHTML=old; sb.classList.remove('saved-ok'); }, 2000);
    }catch(e){ apiStatus('save: '+e.message, false); }
  }, true)));
  body.appendChild(acctRow(acctBtnEl(plIco('folder')+' Open my gallery', ()=>{
    closeDrawer(); openMyGallery();
  })));
}

function renderSignedOut(body){
  body.appendChild(noteEl('Sign in to keep a private cloud gallery of your paintings (with version history, from any device) and to contribute to the global library.'));
  const row=document.createElement('div'); row.className='brand-row';
  body.appendChild(row);
  const keyForm=document.createElement('div'); keyForm.hidden=true;
  keyForm.style.cssText='display:flex;flex-direction:column;gap:7px;margin-top:7px';
  const brand=(svg,label,fn)=>{
    const b=document.createElement('button'); b.className='brand-btn';
    b.innerHTML=svg+'<span>'+label+'</span>';
    b.addEventListener('click',fn); return b;
  };
  const keyBtn=brand(plIco('key'),'Key', ()=>{ keyForm.hidden=!keyForm.hidden; });
  keyBtn.title='A key account: no email at all - you pick a name, we issue a secret key';
  row.appendChild(keyBtn);
  getProviders().then(p=>{
    if(acct.key) return;
    if(p.google) row.prepend(brand(plIco('google'),'Google', ()=>{
      location.href=API_BASE+'/api/auth/google/start'; }));
    if(p.github) row.prepend(brand(plIco('github'),'GitHub', ()=>{
      location.href=API_BASE+'/api/auth/github/start'; }));
  });
  keyForm.appendChild(noteEl('You pick a name, we issue a secret key. Whoever holds the key holds the account - copy it somewhere safe.'));
  const name=mkInput('your artist name (unique, 3-24 letters, digits, - or _)');
  keyForm.appendChild(acctRow(name));
  // live availability: artist names are unique across the community
  const avail=noteEl(''); avail.style.minHeight='15px';
  keyForm.appendChild(avail);
  let avT=0;
  name.addEventListener('input',()=>{
    clearTimeout(avT);
    const h=name.value.trim();
    if(h.length<3){ avail.textContent=''; return; }
    avT=setTimeout(async ()=>{
      try{
        const r=await fetch(API_BASE+'/api/account/check?h='+encodeURIComponent(h))
          .then(x=>x.json());
        if(h!==name.value.trim()) return;
        avail.textContent=r.ok?'"'+h+'" is free'
          :r.why?'"'+h+'" - '+r.why:'"'+h+'" is taken - pick another';
        avail.style.color=r.ok?'var(--tk-c)':'#f48771';
      }catch(e){}
    },350);
  });
  keyForm.appendChild(acctRow(acctBtnEl('Create key account', async ()=>{
    const handle=name.value.trim();
    if(!handle){
      apiStatus('pick an artist name first - it is shown on your library contributions', false);
      name.focus(); return;
    }
    try{
      const r=await acctApi('/api/account/new',{method:'POST',body:{handle}});
      setAcct(r.key, r.uid, r.handle, '');
      onSignIn();
      apiStatus('welcome, '+r.handle+' - now copy your account key (menu, "Copy key") and keep it safe', true);
    }catch(e){ apiStatus('account: '+e.message, false); }
  }, true)));
  const keyIn=mkInput('or paste an existing key (plk_...)');
  keyForm.appendChild(acctRow(keyIn));
  keyForm.appendChild(acctRow(acctBtnEl('Sign in with key', async ()=>{
    const k=keyIn.value.trim();
    if(!/^plk_[0-9a-f]{48}$/i.test(k)){ apiStatus('that does not look like an account key', false); return; }
    try{
      acct.key=k;
      const me=await acctApi('/api/me');
      setAcct(k, me.uid, me.handle, me.provider||'');
      onSignIn();
      apiStatus('signed in as '+(me.handle||'artist'), true);
    }catch(e){ acct.key=''; apiStatus('sign in: '+e.message, false); }
  })));
  body.appendChild(keyForm);
}

/* returning from an OAuth redirect: the worker hands the session key back
   in the URL fragment (plkey), which never reaches any server log */
(function(){
  const m=location.hash.match(/plkey=(plk_[0-9a-f]{48})/i);
  const err=location.hash.match(/plerr=([^&]+)/);
  if(m){
    const nm=(location.hash.match(/plname=([^&]+)/)||[])[1];
    history.replaceState(null,'',location.pathname+location.search);
    acct.key=m[1];
    setAcct(m[1], '', nm?decodeURIComponent(nm):'', '');
    acctApi('/api/me').then(me=>{
      setAcct(m[1], me.uid, me.handle, me.provider||'');
      onSignIn();
      apiStatus('signed in as '+(me.handle||'artist'), true);
    }).catch(()=>{});
  }else if(err){
    history.replaceState(null,'',location.pathname+location.search);
    apiStatus('sign in failed: '+decodeURIComponent(err[1]), false);
  }
})();
setAcct(acct.key, acct.uid, acct.handle, acct.provider);

/* --------------------------- my gallery (private) --------------------------- */
function openMyGallery(){
  const modal=el('myModal'), list=el('myList');
  modal.hidden=false;
  if(!acct.key){
    list.innerHTML='<p class="libintro">You are not signed in. Open the menu and sign in - then every painting you save lands here, with its version history.</p>';
    return;
  }
  list.innerHTML='<p class="libintro">loading...</p>';
  acctApi('/api/me').then(me=>{
    list.innerHTML='';
    if(!me.works.length){
      list.innerHTML='<p class="libintro">Nothing here yet. Open the menu and press "Save this painting" - it will appear here with a version trail.</p>';
      return;
    }
    for(const w of me.works) list.appendChild(workCard(w));
  }).catch(e=>{
    list.innerHTML='<p class="libintro">could not load your gallery: '+
      String(e.message).replace(/[<>&]/g,'')+'</p>';
  });
}
function workCard(w){
  const card=document.createElement('div'); card.className='lib-item';
  const b=document.createElement('b'); b.textContent=w.name;
  const m=document.createElement('div'); m.className='lm';
  m.textContent=w.ver+(w.ver>1?' versions':' version')+' · updated '+timeAgo(w.updated);
  const acts=document.createElement('div'); acts.className='wk-acts';
  const vlist=document.createElement('div'); vlist.className='vlist'; vlist.hidden=true;
  acts.appendChild(acctBtnEl('Open', ()=>{ el('myModal').hidden=true; openWork(w.id); }, true));
  acts.appendChild(acctBtnEl(plIco('history')+' History', async ()=>{
    if(!vlist.hidden){ vlist.hidden=true; return; }
    vlist.hidden=false; vlist.textContent='loading...';
    try{
      const r=await acctApi('/api/work/get?id='+w.id+'&meta=1');
      vlist.textContent='';
      for(const v of r.versions){
        const vr=document.createElement('div'); vr.className='vrow';
        const t=document.createElement('span');
        t.textContent='v'+v.v+(v.label?' · '+v.label:'')+' · '+timeAgo(v.created);
        vr.appendChild(t);
        vr.appendChild(acctBtnEl('Open', ()=>{ el('myModal').hidden=true; openWork(w.id, v.v); }));
        vlist.appendChild(vr);
      }
    }catch(e){ vlist.textContent='could not load history: '+e.message; }
  }));
  acts.appendChild(acctBtnEl(plIco('trash'), async ()=>{
    if(!confirm('Delete "'+w.name+'" and all its versions from your cloud gallery? Open tabs are not affected.')) return;
    try{ await acctApi('/api/work/delete',{method:'POST',body:{id:w.id}});
      apiStatus('deleted from your gallery', true); openMyGallery();
    }catch(e){ apiStatus('delete: '+e.message, false); }
  }));
  card.appendChild(b); card.appendChild(m); card.appendChild(acts); card.appendChild(vlist);
  return card;
}
async function openWork(id, v){
  try{
    const r=await acctApi('/api/work/get?id='+id+(v?'&v='+v:''));
    newDoc(r.name+(v&&v!==r.latest?' (v'+v+')':''), r.code);
    if(!v||v===r.latest){ docs[activeDoc].cloudId=id;
      if(typeof persistDocs==='function') persistDocs(); }
    closeDrawer();
    apiStatus('"'+r.name+'"'+(v&&v!==r.latest?' version '+v:'')+' opened from your gallery', true);
  }catch(e){ apiStatus('open: '+e.message, false); }
}
el('myGalleryBtn').addEventListener('click', ()=>{ closeDrawer(); openMyGallery(); });
el('myClose').addEventListener('click', ()=>{ el('myModal').hidden=true; });
el('myModal').addEventListener('click', e=>{ if(e.target===el('myModal')) el('myModal').hidden=true; });

/* --------------------------- global library --------------------------- */
function layerBlocksOf(src){
  // every layer('name') ... block in the current code, for the contribute picker
  const lines=src.split('\n'), out=[];
  let cur=null;
  for(let i=0;i<lines.length;i++){
    const m=lines[i].match(/^layer\(\s*'([^']*)'/);
    if(m){
      if(cur) out.push(cur);
      cur={name:m[1], from:i, lines:[lines[i]]};
    }else if(cur) cur.lines.push(lines[i]);
  }
  if(cur) out.push(cur);
  return out.map(b=>({name:b.name, code:b.lines.join('\n').trim()+'\n'}));
}
(function(){
  const modal=el('libModal'), list=el('libList'), contrib=el('libContrib');
  let loaded=false;
  function renderContrib(){
    contrib.innerHTML='';
    if(!acct.key){
      contrib.textContent='Sign in (menu → Account) to contribute a component of your own.';
      return;
    }
    const blocks=layerBlocksOf(ta.value);
    const pick=document.createElement('select');
    if(blocks.length)
      for(const b of blocks){
        const o=document.createElement('option');
        o.value=b.name;
        o.textContent='layer: '+(b.name||'(unnamed)')+' ('+
          (b.code.length>2048?Math.round(b.code.length/1024)+'KB':b.code.length+'B')+')';
        pick.appendChild(o);
      }
    else{
      const o=document.createElement('option');
      o.value='__all__'; o.textContent='whole painting ('+
        (ta.value.length>2048?Math.round(ta.value.length/1024)+'KB':ta.value.length+'B')+')';
      pick.appendChild(o);
    }
    const name=mkInput('component name'), descr=mkInput('what is it / how to use it');
    if(blocks.length) name.value=blocks[0].name;
    pick.addEventListener('change', ()=>{
      const b=blocks.find(x=>x.name===pick.value);
      if(b) name.value=b.name;
    });
    contrib.append('Share a piece of this painting: ', pick, name, descr,
      acctBtnEl('Contribute', async ()=>{
        const b=blocks.find(x=>x.name===pick.value);
        const code=b?b.code:ta.value;
        if(code.length>80*1024){
          apiStatus('components are capped at 80KB - pick a smaller layer (brushwork layers are usually the huge ones)', false);
          return;
        }
        if(!name.value.trim()){ apiStatus('give the component a name first', false); return; }
        try{
          await acctApi('/api/library/contribute',{method:'POST',
            body:{name:name.value.trim(), descr:descr.value.trim(), code}});
          apiStatus('contributed - "'+name.value.trim()+'" is live in the global library, credited to '+(acct.handle||'you'), true);
          loaded=false; loadList();
        }catch(e){ apiStatus('contribute: '+e.message, false); }
      }, true));
  }
  async function loadList(){
    if(loaded) return; loaded=true;
    list.innerHTML='<p class="libintro">loading...</p>';
    try{
      const r=await acctApi('/api/library/list');
      list.innerHTML='';
      for(const it of r.items){
        const card=document.createElement('div'); card.className='lib-item';
        const b=document.createElement('b'); b.textContent=it.name;
        const d=document.createElement('div'); d.className='ld'; d.textContent=it.descr||'';
        const m=document.createElement('div'); m.className='lm';
        m.textContent='by '+(it.author||'anonymous')+
          (it.uses?' · used '+it.uses+'×':'');
        card.appendChild(b); card.appendChild(d); card.appendChild(m);
        const row=document.createElement('div');
        row.style.cssText='display:flex;gap:6px;align-items:center';
        row.appendChild(acctBtnEl('+ Insert', async ()=>{
          try{
            const full=await acctApi('/api/library/get?id='+encodeURIComponent(it.id));
            // a component is a program from a stranger: it arrives HELD,
            // exactly like shared links and community paintings. Look at
            // what it appends, then Ctrl+Enter runs it.
            window.__plHoldRun=true;
            appendCode('\n'+full.code.trim());
            modal.hidden=true;
            apiStatus('"'+it.name+'" appended to your code, held unrendered - look it over, then press Ctrl+Enter to paint it', true);
          }catch(e){ apiStatus('insert: '+e.message, false); }
        }));
        if(it.mine){
          const rm=acctBtnEl(plIco('trash')+' Remove', async ()=>{
            if(!confirm('Remove your component "'+it.name+'" from the global library? People who already inserted it keep their copy.')) return;
            try{
              await acctApi('/api/library/remove',{method:'POST',body:{id:it.id}});
              apiStatus('"'+it.name+'" removed from the global library', true);
              loaded=false; loadList();
            }catch(e){ apiStatus('remove: '+e.message, false); }
          });
          rm.style.cssText='background:none;border-color:var(--line2);color:var(--muted)';
          row.appendChild(rm);
        }
        card.appendChild(row);
        list.appendChild(card);
      }
      if(!r.items.length) list.innerHTML='<p class="libintro">nothing here yet</p>';
    }catch(e){
      loaded=false;
      list.innerHTML='<p class="libintro">could not reach the library: '+
        String(e.message).replace(/[<>&]/g,'')+'</p>';
    }
  }
  el('libraryBtn').addEventListener('click', ()=>{
    closeDrawer(); modal.hidden=false; renderContrib(); loadList();
  });
  el('libClose').addEventListener('click', ()=>{ modal.hidden=true; });
  modal.addEventListener('click', e=>{ if(e.target===modal) modal.hidden=true; });
  document.addEventListener('keydown', e=>{
    if(e.key==='Escape'){
      if(!modal.hidden) modal.hidden=true;
      if(!el('myModal').hidden) el('myModal').hidden=true;
    }
  });
})();

/* -------------------- replay video export (Pro) --------------------
   Records the canvas through a replay run with MediaRecorder - fully
   client-side, downloads a WebM. Speed and medium are per-recording. */
(function(){
  const modal=el('repModal');
  let recording=false;
  el('replayVidBtn').addEventListener('click', async ()=>{
    if(!acct.key){
      apiStatus('replay videos come with Hobby and Artist plans - sign in from the Account section first', false);
      return;
    }
    try{
      const me=await acctApi('/api/me');
      if(!me.ent||me.ent.plan==='free'){
        apiStatus('downloading replay videos comes with the Hobby and Artist plans - upgrade from the Account section', false);
        return;
      }
    }catch(e){ apiStatus('could not check your plan: '+e.message, false); return; }
    closeDrawer(); modal.hidden=false;
  });
  el('repClose').addEventListener('click', ()=>{ modal.hidden=true; });
  modal.addEventListener('click', e=>{ if(e.target===modal) modal.hidden=true; });
  el('repGo').addEventListener('click', async ()=>{
    if(recording) return;
    if(typeof ops==='undefined'||!ops.length){
      apiStatus('nothing to record yet - paint something first', false); return;
    }
    if(typeof MediaRecorder==='undefined'){
      apiStatus('this browser cannot record video (MediaRecorder missing)', false); return;
    }
    const speed=+el('repSpeed').value||1;
    const medium=el('repMedium').value;
    modal.hidden=true;
    recording=true;
    apiStatus('recording the replay... keep this tab visible', true);
    try{
      const stream=paintCanvas.captureStream(30);
      const mime=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm']
        .find(t=>MediaRecorder.isTypeSupported(t))||'';
      const rec=new MediaRecorder(stream, mime
        ?{mimeType:mime, videoBitsPerSecond:8_000_000}
        :{videoBitsPerSecond:8_000_000});
      const chunks=[];
      rec.ondataavailable=e=>{ if(e.data&&e.data.size) chunks.push(e.data); };
      const stopped=new Promise(res=>{ rec.onstop=res; });
      rec.start(250);
      const finished=await new Promise(res=>{
        startReplay({speed, media:medium==='original'?null:medium, onEnd:res});
      });
      rec.stop(); await stopped;
      if(!finished){ apiStatus('recording cancelled', false); return; }
      const blob=new Blob(chunks,{type:rec.mimeType||'video/webm'});
      const name=((typeof docs!=='undefined'&&docs[activeDoc])?docs[activeDoc].name:'painting')
        .replace(/[^a-z0-9\-_]+/gi,'-');
      const a=document.createElement('a');
      a.download=name+'-replay.webm';
      a.href=URL.createObjectURL(blob);
      a.click();
      setTimeout(()=>URL.revokeObjectURL(a.href), 30000);
      apiStatus('replay video downloaded ('+(blob.size/1048576).toFixed(1)+' MB, WebM)', true);
    }catch(e){ apiStatus('recording failed: '+e.message, false); }
    finally{ recording=false; }
  });
})();

/* ------------------------- the community -------------------------
   Publish a painting: public, remixable, credited. Browse everyone's:
   real thumbnails, hearts, remix lineage - and every opened piece arrives
   HELD, because a painting is a program and strangers' programs do not
   run themselves. */
(function(){
  const modal=el('pubModal'), list=el('pubList');
  const share=el('pubShare');
  let sort='new', feedT=0;

  function thumbDataURL(){
    try{
      const c2=document.createElement('canvas');
      c2.width=480; c2.height=300;
      c2.getContext('2d').drawImage(paintCanvas,0,0,480,300);
      return c2.toDataURL('image/jpeg',.72);
    }catch(e){ return ''; }
  }
  el('publishBtn').addEventListener('click', async ()=>{
    if(!acct.key){
      apiStatus('sign in (menu, Account) to publish to the community', false);
      return;
    }
    closeDrawer();
    const d=docs[activeDoc]; if(!d) return;
    el('pubTitle').value=d.name||'';
    el('pubDescr').value='';
    const note=el('pubRemixNote');
    if(d.remixOf){
      note.hidden=false;
      note.textContent='This will be published as a remix, crediting the original.';
    }else note.hidden=true;
    share.hidden=false;
  });
  el('pubShareClose').addEventListener('click',()=>{ share.hidden=true; });
  share.addEventListener('click',e=>{ if(e.target===share) share.hidden=true; });
  el('pubGo').addEventListener('click', async ev=>{
    const btn=ev.currentTarget; btn.disabled=true;
    try{
      const d=docs[activeDoc]; d.code=ta.value;
      const body={title:el('pubTitle').value.trim()||d.name,
        descr:el('pubDescr').value.trim(), code:d.code, thumb:thumbDataURL()};
      if(d.remixOf) body.remixOf=d.remixOf;
      if(d.pubId) body.id=d.pubId;
      const r=await acctApi('/api/pub/publish',{method:'POST',body});
      d.pubId=r.id;
      if(typeof persistDocs==='function') persistDocs();
      share.hidden=true;
      plMetric('pub-publish');
      apiStatus('published - "'+body.title+'" is now on the community wall, credited to '
        +(acct.handle||'you'), true);
    }catch(e){ apiStatus('publish: '+e.message, false); }
    btn.disabled=false;
  });

  function pubCard(it){
    const card=document.createElement('div'); card.className='pub-item';
    const img=document.createElement('img');
    img.loading='lazy';
    img.src=API_BASE+'/api/pub/thumb?id='+it.id;
    img.alt=it.title+' by '+it.author;
    img.addEventListener('error',()=>{ img.style.display='none'; });
    card.appendChild(img);
    const pb=document.createElement('div'); pb.className='pb';
    const b=document.createElement('b'); b.textContent=it.title;
    const pm=document.createElement('div'); pm.className='pm';
    const al=document.createElement('button'); al.className='authorlink';
    al.textContent=it.author; al.title='View '+it.author+"'s profile and follow them";
    if(it.uid) al.addEventListener('click',()=>openProfile({u:it.uid}));
    pm.append('by ',al);
    if(it.dev){ const dv=document.createElement('span'); dv.className='devbadge';
      dv.textContent='paintlang'; pm.appendChild(dv); }
    pm.append(' · '+timeAgo(it.created)+(it.opens?' · opened '+it.opens+'×':''));
    pb.append(b,pm);
    if(it.remixOf&&it.remixTitle){
      const pr=document.createElement('div'); pr.className='pr';
      pr.textContent='remix of "'+it.remixTitle+'" by '+(it.remixAuthor||'?');
      pb.appendChild(pr);
    }
    const pa=document.createElement('div'); pa.className='pa';
    const love=acctBtnEl(plIco('heart')+' '+it.loves, async ()=>{
      if(!acct.key){ apiStatus('sign in to love paintings', false); return; }
      try{
        const r=await acctApi('/api/pub/love',{method:'POST',body:{id:it.id}});
        love.innerHTML=plIco('heart')+' '+r.loves;
        love.classList.toggle('loved', r.loved);
        plMetric('pub-love');
      }catch(e){}
    });
    love.classList.add('lovebtn');
    if(it.loved) love.classList.add('loved');
    const open=acctBtnEl('Open', async ()=>{
      try{
        const r=await fetch(API_BASE+'/api/pub/get?id='+it.id).then(x=>x.json());
        if(!r.code){ apiStatus('could not open it', false); return; }
        modal.hidden=true;
        window.__plHoldRun=true;
        newDoc(r.title, r.code);
        docs[activeDoc].remixOf=it.id;
        if(typeof persistDocs==='function') persistDocs();
        plMetric('pub-open');
      }catch(e){ apiStatus('open: '+e.message, false); }
    }, true);
    pa.append(open,love);
    if(it.mine){
      pa.appendChild(acctBtnEl(plIco('trash'), async ()=>{
        if(!confirm('Remove "'+it.title+'" from the community? Existing remixes keep their copies.')) return;
        try{ await acctApi('/api/pub/remove',{method:'POST',body:{id:it.id}});
          card.remove(); apiStatus('removed from the community', true);
        }catch(e){ apiStatus('remove: '+e.message, false); }
      }));
    }
    const rep=document.createElement('button'); rep.className='repbtn';
    rep.textContent='report'; rep.title='Report this painting';
    rep.addEventListener('click', async ()=>{
      if(!confirm('Report this painting as inappropriate?')) return;
      try{ await fetch(API_BASE+'/api/pub/report',{method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({id:it.id})});
        rep.textContent='reported';
      }catch(e){}
    });
    pa.appendChild(rep);
    pb.appendChild(pa);
    card.appendChild(pb);
    return card;
  }
  let feedCursor=0;
  async function loadFeed(more){
    const my=more?feedT:++feedT;
    if(!more){ feedCursor=0; list.innerHTML='<p class="libintro">loading...</p>'; }
    try{
      const h={};
      if(acct.key) h.authorization='Bearer '+acct.key;
      const r=await fetch(API_BASE+'/api/pub/feed?sort='+sort
        +(more&&feedCursor?'&before='+feedCursor:''),
        {headers:h}).then(x=>x.json());
      if(my!==feedT) return;
      const old=list.querySelector('.pubmore'); if(old) old.remove();
      if(!more) list.innerHTML='';
      for(const it of (r.items||[])) list.appendChild(pubCard(it));
      if(!list.children.length)
        list.innerHTML='<p class="libintro">'+(r.needAuth
          ?'Sign in (menu, Account) to see paintings from artists you follow.'
          :sort==='following'
            ?'No paintings yet from artists you follow - find artists on the Newest wall and follow them from their profile.'
            :'The wall is empty - publish the first painting from the menu.')+'</p>';
      if(r.more){
        feedCursor=r.more;
        const mb=acctBtnEl('Show more', ()=>loadFeed(true));
        mb.className='pubmore';
        list.appendChild(mb);
      }
    }catch(e){
      if(my===feedT&&!more)
        list.innerHTML='<p class="libintro">could not reach the community</p>';
    }
  }
  el('communityBtn').addEventListener('click',()=>{
    closeDrawer(); modal.hidden=false; loadFeed();
  });
  el('pubClose').addEventListener('click',()=>{ modal.hidden=true; });
  modal.addEventListener('click',e=>{ if(e.target===modal) modal.hidden=true; });
  const SORTS=[['pubSortNew','new'],['pubSortLoved','loved'],
    ['pubSortFollowing','following']];
  for(const [id,s] of SORTS)
    el(id).addEventListener('click',()=>{
      sort=s;
      for(const [id2,s2] of SORTS) el(id2).classList.toggle('on',s2===s);
      loadFeed();
    });

  /* ---- artist profiles: only what is already public (handle, joined,
     published paintings, follower counts) - follow from anywhere an
     author's name appears */
  const prof=el('profileModal');
  async function openProfile(q){
    closeDrawer(); modal.hidden=true;
    prof.hidden=false;
    el('profHandle').textContent='...';
    el('profMeta').textContent='loading...';
    el('profPubs').innerHTML=''; el('profFollow').hidden=true;
    try{
      const h={};
      if(acct.key) h.authorization='Bearer '+acct.key;
      const qs=q.dev?'dev=1':'u='+encodeURIComponent(q.u);
      const r=await fetch(API_BASE+'/api/profile?'+qs,{headers:h})
        .then(x=>x.json());
      if(r.error){
        el('profMeta').textContent=q.dev
          ?'the Paintlang studio profile is not set up yet - check back soon'
          :'could not find this artist';
        return;
      }
      el('profHandle').textContent=r.handle;
      if(r.dev){ const dv=document.createElement('span'); dv.className='devbadge';
        dv.textContent='paintlang'; el('profHandle').appendChild(dv); }
      let fers=r.followers;
      const meta=()=>{ el('profMeta').textContent='joined '+timeAgo(r.joined)
        +' · '+fers+(fers===1?' follower':' followers')
        +' · '+r.pubs.length+(r.pubs.length===1?' published painting':' published paintings'); };
      meta();
      const fb=el('profFollow');
      if(!r.mine){
        fb.hidden=false;
        let fol=r.isFollowing;
        const setL=()=>{ fb.textContent=fol?'Following':'Follow';
          fb.classList.toggle('primary',!fol); };
        setL();
        fb.onclick=async()=>{
          if(!acct.key){
            apiStatus('sign in (menu, Account) to follow artists', false);
            return;
          }
          try{
            const x=await acctApi('/api/follow',{method:'POST',body:{uid:r.uid}});
            fol=x.following; fers=x.followers; setL(); meta();
            plMetric('follow');
          }catch(e){ apiStatus('follow: '+e.message, false); }
        };
      }
      for(const it of r.pubs) el('profPubs').appendChild(pubCard(it));
      if(!r.pubs.length)
        el('profPubs').innerHTML='<p class="libintro">nothing published yet</p>';
    }catch(e){ el('profMeta').textContent='could not load the profile'; }
  }
  el('profClose').addEventListener('click',()=>{ prof.hidden=true; });
  prof.addEventListener('click',e=>{ if(e.target===prof) prof.hidden=true; });
  el('devProfileBtn').addEventListener('click',()=>openProfile({dev:1}));
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){
      if(!modal.hidden) modal.hidden=true;
      if(!share.hidden) share.hidden=true;
      if(!prof.hidden) prof.hidden=true;
    }
  });
})();

/* hydrate static markup icons: <span data-ico="name"> -> inline svg */
document.querySelectorAll('[data-ico]').forEach(n=>{ n.innerHTML=plIco(n.dataset.ico); });

/* icon-only controls get real accessible names from their tooltips */
document.querySelectorAll('button[title]:not([aria-label]), a[title]:not([aria-label])')
  .forEach(b=>{ if(!b.textContent.trim()) b.setAttribute('aria-label', b.title.split(' - ')[0]); });

/* one focus trap for every dialog: Tab cycles inside the open modal */
document.addEventListener('keydown', e=>{
  if(e.key!=='Tab') return;
  const dlg=[...document.querySelectorAll('[role="dialog"]')]
    .find(d=>d.offsetParent!==null);
  if(!dlg) return;
  const f=[...dlg.querySelectorAll('button,select,input,textarea,a[href],[tabindex]:not([tabindex="-1"])')]
    .filter(x=>!x.disabled&&x.offsetParent!==null);
  if(!f.length) return;
  if(!dlg.contains(document.activeElement)){ e.preventDefault(); f[0].focus(); return; }
  const i=f.indexOf(document.activeElement);
  if(e.shiftKey&&i<=0){ e.preventDefault(); f[f.length-1].focus(); }
  else if(!e.shiftKey&&i===f.length-1){ e.preventDefault(); f[0].focus(); }
});

/* ------------------------------ theme ------------------------------
   Dark is the studio at night; light is the same studio in daylight.
   The head script applies the choice before first paint. */
(function(){
  const btn=el('themeBtn');
  const paint=()=>{
    const t=document.documentElement.dataset.theme||'dark';
    btn.innerHTML=plIco(t==='dark'?'sun':'moon');
    btn.title=t==='dark'?'Switch to the light studio':'Switch to the dark studio';
  };
  paint();
  btn.addEventListener('click',()=>{
    const next=(document.documentElement.dataset.theme||'dark')==='dark'?'light':'dark';
    document.documentElement.dataset.theme=next;
    try{ localStorage.setItem('paintlang-theme',next); }catch(e){}
    paint();
  });
})();

/* already signed in on this device: fetch the account's studio if another
   device has moved it forward since we were last here */
if(acct.key) setTimeout(()=>wsPull(false), 1500);

/* -------------------- the thirty second first run --------------------
   Text tells; interaction teaches. Two live actions and the visitor has
   understood the whole product: gestures become code, code repaints. */
(function(){
  let coached=false, welcomed=false;
  try{
    coached=!!localStorage.getItem('paintlang-coached');
    welcomed=!!localStorage.getItem('paintlang-welcomed');
  }catch(e){}
  if(coached) return;
  // arrivals into shared or gallery paintings get a different first moment
  if(location.search.indexOf('open=')>=0||location.search.indexOf('s=')>=0
    ||location.hash.length>2) return;
  const box=document.createElement('div'); box.id='coach';
  box.innerHTML='<span class="cdot"></span><span id="coachTxt"></span>'
    +'<button id="coachSkip" title="dismiss the guide" aria-label="dismiss">×</button>';
  document.body.appendChild(box);
  const txt=box.querySelector('#coachTxt');
  const STEPS=[
    'paint one stroke anywhere on the canvas',
    'now press Select and drag the sun somewhere else',
    'that is Paintlang: your gestures became code, and the code repaints. Click any number in the code for a slider.'
  ];
  let step=-1;
  function show(i){
    step=i; txt.textContent=STEPS[i]; box.classList.add('show');
    if(i===2) setTimeout(done, 9000);
  }
  function done(){
    if(!box.isConnected) return;
    box.classList.add('bye'); setTimeout(()=>box.remove(), 500);
    try{ localStorage.setItem('paintlang-coached','1'); }catch(e){}
    if(step===2) plMetric('coach-done');
  }
  box.querySelector('#coachSkip').addEventListener('click', done);
  addEventListener('pl-edit',e=>{
    plMetric('first-canvas-edit', true);
    if(step===0&&e.detail.kind==='stroke') show(1);
    else if(step===1&&e.detail.kind==='move') show(2);
  });
  if(welcomed) setTimeout(()=>show(0), 1500);
  else{
    // begin once the welcome card is answered, either way
    for(const id of ['welcomeGo','welcomeRef']){
      const b=document.getElementById(id);
      if(b) b.addEventListener('click', ()=>setTimeout(()=>show(0), 600));
    }
    setTimeout(()=>{ if(step<0) show(0); }, 12000);   // card ignored: begin anyway
  }
})();
