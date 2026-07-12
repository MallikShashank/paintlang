'use strict';
/* ============== menu drawer, floating toolbox, accounts, library ==============
   Accounts are key-based: creating one issues a plk_... key (its hash lives on
   the server; the key itself only in this browser and wherever you copy it).
   Works are saved to the cloud with full version history. The component
   library is shared: official Paintlang components plus user contributions,
   each one a plain code snippet. */

const API_BASE = (typeof TRACE_API==='string') ? TRACE_API
  : 'https://paintlang-trace.paintlang.workers.dev';
const acct = {
  key: localStorage.getItem('paintlang-key') || '',
  uid: localStorage.getItem('paintlang-uid') || '',
  handle: localStorage.getItem('paintlang-handle') || ''
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
  window.openDrawer=function(){
    clearTimeout(closeT);
    wrap.hidden=false;
    requestAnimationFrame(()=>requestAnimationFrame(()=>wrap.classList.add('open')));
    refreshWorks();
  };
  window.closeDrawer=function(){
    wrap.classList.remove('open');
    closeT=setTimeout(()=>{ wrap.hidden=true; }, 240);
  };
  el('menuBtn').addEventListener('click', openDrawer);
  el('drawerClose').addEventListener('click', closeDrawer);
  el('drawerShade').addEventListener('click', closeDrawer);
  document.addEventListener('keydown', e=>{
    if(e.key==='Escape'&&!wrap.hidden) closeDrawer();
  });
  // actions that leave the studio context close the drawer behind themselves
  for(const id of ['importBtn','replayBtn','shareBtn','helpBtn'])
    el(id).addEventListener('click', closeDrawer);
  el('examples').addEventListener('change', closeDrawer);
  el('acctBtn').addEventListener('click', ()=>{
    openDrawer();
    setTimeout(()=>el('acctSec').scrollIntoView({block:'nearest'}), 60);
  });
})();

/* -------------------------- floating toolbox --------------------------
   Drag by the header, resize from the corner, collapse with the caret.
   Position and size persist per browser. Docks statically on mobile. */
(function(){
  const box=el('toolbox'), head=el('tbHead'), right=el('right')||document.getElementById('right');
  const host=document.getElementById('right');
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
    if(e.target.id==='tbMin'||mobile()) return;
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

/* ------------------------------ account ------------------------------ */
function setAcct(key, uid, handle){
  acct.key=key||''; acct.uid=uid||''; acct.handle=handle||'';
  try{
    for(const [k,v] of [['paintlang-key',acct.key],['paintlang-uid',acct.uid],
                        ['paintlang-handle',acct.handle]])
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
  const b=document.createElement('button'); b.textContent=txt;
  if(primary) b.className='primary';
  b.addEventListener('click', fn); return b;
}
function mkInput(ph, type){
  const i=document.createElement('input'); i.placeholder=ph; i.type=type||'text';
  return i;
}
let worksBox=null, keyShown=false;
function renderAcct(){
  const body=el('acctBody'); body.innerHTML=''; keyShown=false;
  if(!acct.key){
    const note=document.createElement('div'); note.className='acct-note';
    note.textContent='An account saves your paintings to the cloud with full version history, and lets you contribute to the component library. No email needed: your account is a secret key this browser remembers.';
    body.appendChild(note);
    const name=mkInput('display name (optional)');
    body.appendChild(acctRow(name));
    body.appendChild(acctRow(acctBtnEl('Create account', async ()=>{
      try{
        const r=await acctApi('/api/account/new',{method:'POST',body:{handle:name.value.trim()}});
        setAcct(r.key, r.uid, r.handle);
        apiStatus('account created - copy your account key from the menu and keep it safe', true);
        showKey(true);
      }catch(e){ apiStatus('account: '+e.message, false); }
    }, true)));
    const keyIn=mkInput('paste your account key (plk_...)');
    body.appendChild(acctRow(keyIn));
    body.appendChild(acctRow(acctBtnEl('Sign in with key', async ()=>{
      const k=keyIn.value.trim();
      if(!/^plk_[0-9a-f]{48}$/i.test(k)){ apiStatus('that does not look like an account key', false); return; }
      try{
        acct.key=k;
        const me=await acctApi('/api/me');
        setAcct(k, me.uid, me.handle);
        apiStatus('signed in', true); refreshWorks();
      }catch(e){ acct.key=''; apiStatus('sign in: '+e.message, false); }
    })));
    return;
  }
  const who=document.createElement('div'); who.className='acct-note';
  who.innerHTML='Signed in as <b style="color:var(--text)">'+
    (acct.handle||'artist').replace(/[<>&]/g,'')+'</b>';
  body.appendChild(who);
  const keyBox=document.createElement('div'); keyBox.className='acct-key'; keyBox.hidden=true;
  window.showKey=function(show){
    keyShown=show===undefined?!keyShown:show;
    keyBox.hidden=!keyShown; keyBox.textContent=keyShown?acct.key:'';
  };
  body.appendChild(acctRow(
    acctBtnEl('Show key', ()=>showKey()),
    acctBtnEl('Copy key', async ()=>{
      try{ await navigator.clipboard.writeText(acct.key); apiStatus('account key copied - it is the only way back into this account', true); }
      catch(e){ showKey(true); apiStatus('copy failed - key shown below, copy it by hand', false); }
    }),
    acctBtnEl('Sign out', ()=>{
      if(!confirm('Sign out? Make sure your account key is copied somewhere - it is the only way back in.')) return;
      setAcct('','','');
    })
  ));
  body.appendChild(keyBox);
  const label=mkInput('version label (optional)');
  body.appendChild(acctRow(label));
  body.appendChild(acctRow(acctBtnEl('☁ Save this painting to cloud', async ()=>{
    const d=docs[activeDoc]; if(!d) return;
    d.code=ta.value;
    try{
      const bodyq={name:d.name, code:d.code, label:label.value.trim()};
      if(d.cloudId) bodyq.id=d.cloudId;
      const r=await acctApi('/api/work/save',{method:'POST',body:bodyq});
      d.cloudId=r.id; label.value='';
      if(typeof persistDocs==='function') persistDocs();
      apiStatus('saved to cloud - "'+d.name+'" version '+r.ver, true);
      refreshWorks();
    }catch(e){ apiStatus('save: '+e.message, false); }
  }, true)));
  worksBox=document.createElement('div');
  worksBox.style.cssText='display:flex;flex-direction:column;gap:6px';
  body.appendChild(worksBox);
}
async function refreshWorks(){
  if(!acct.key||!worksBox) return;
  try{
    const me=await acctApi('/api/me');
    if(me.handle!==acct.handle){ acct.handle=me.handle;
      try{ localStorage.setItem('paintlang-handle',me.handle||''); }catch(e){}
      el('acctBtnLabel').textContent=me.handle||'Account';
    }
    worksBox.innerHTML='';
    if(!me.works.length){
      const n=document.createElement('div'); n.className='acct-note';
      n.textContent='No cloud paintings yet - save one above.';
      worksBox.appendChild(n); return;
    }
    for(const w of me.works) worksBox.appendChild(workRow(w));
  }catch(e){ /* offline or bad key: leave the list as is */ }
}
function workRow(w){
  const row=document.createElement('div'); row.className='wk-row';
  const nm=document.createElement('div'); nm.className='wk-name'; nm.textContent=w.name;
  const meta=document.createElement('div'); meta.className='wk-meta';
  meta.textContent='v'+w.ver+' · '+timeAgo(w.updated);
  const acts=document.createElement('div'); acts.className='wk-acts';
  const vlist=document.createElement('div'); vlist.className='vlist'; vlist.hidden=true;
  acts.appendChild(acctBtnEl('Open', ()=>openWork(w.id)));
  acts.appendChild(acctBtnEl('⏱ Versions', async ()=>{
    if(!vlist.hidden){ vlist.hidden=true; return; }
    vlist.hidden=false; vlist.textContent='loading...';
    try{
      const r=await acctApi('/api/work/get?id='+w.id+'&meta=1');
      vlist.textContent='';
      for(const v of r.versions){
        const vr=document.createElement('div'); vr.className='vrow';
        const t=document.createElement('span');
        t.textContent='v'+v.v+(v.label?' · '+v.label:'')+' · '+timeAgo(v.created)+
          ' · '+(v.bytes>2048?Math.round(v.bytes/1024)+'KB':v.bytes+'B');
        vr.appendChild(t);
        vr.appendChild(acctBtnEl('Open', ()=>openWork(w.id, v.v)));
        vlist.appendChild(vr);
      }
    }catch(e){ vlist.textContent='could not load versions: '+e.message; }
  }));
  acts.appendChild(acctBtnEl('🗑', async ()=>{
    if(!confirm('Delete "'+w.name+'" and all its versions from the cloud? Open tabs are not affected.')) return;
    try{ await acctApi('/api/work/delete',{method:'POST',body:{id:w.id}});
      apiStatus('deleted from cloud', true); refreshWorks();
    }catch(e){ apiStatus('delete: '+e.message, false); }
  }));
  row.appendChild(nm); row.appendChild(meta); row.appendChild(acts); row.appendChild(vlist);
  return row;
}
async function openWork(id, v){
  try{
    const r=await acctApi('/api/work/get?id='+id+(v?'&v='+v:''));
    newDoc(r.name+(v&&v!==r.latest?' (v'+v+')':''), r.code);
    if(!v||v===r.latest){ docs[activeDoc].cloudId=id;
      if(typeof persistDocs==='function') persistDocs(); }
    closeDrawer();
    apiStatus('"'+r.name+'"'+(v&&v!==r.latest?' version '+v:'')+' opened from the cloud', true);
  }catch(e){ apiStatus('open: '+e.message, false); }
}
setAcct(acct.key, acct.uid, acct.handle);

/* -------------------------- component library -------------------------- */
(function(){
  const modal=el('libModal'), list=el('libList'), contrib=el('libContrib');
  let loaded=false;
  function renderContrib(){
    contrib.innerHTML='';
    if(!acct.key){
      contrib.textContent='Sign in (menu → Account) to contribute a component of your own.';
      return;
    }
    const name=mkInput('component name'), descr=mkInput('what is it / how to use it');
    contrib.appendChild(name); contrib.appendChild(descr);
    contrib.appendChild(acctBtnEl('Contribute current tab', async ()=>{
      const code=ta.value;
      if(code.length>80*1024){
        apiStatus('components are capped at 80KB - copy one layer into a fresh tab (Layers pane 📋) and contribute that', false);
        return;
      }
      if(!name.value.trim()){ apiStatus('give the component a name first', false); return; }
      try{
        await acctApi('/api/library/contribute',{method:'POST',
          body:{name:name.value.trim(), descr:descr.value.trim(), code}});
        apiStatus('contributed - thank you! It is live in the library for everyone', true);
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
        m.textContent='by '+(it.author||'anonymous')+' · '+
          (it.size>2048?Math.round(it.size/1024)+'KB':it.size+'B')+
          (it.uses?' · used '+it.uses+'×':'');
        card.appendChild(b); card.appendChild(d); card.appendChild(m);
        card.appendChild(acctBtnEl('+ Insert', async ()=>{
          try{
            const full=await acctApi('/api/library/get?id='+encodeURIComponent(it.id));
            appendCode('\n'+full.code.trim());
            modal.hidden=true;
            apiStatus('"'+it.name+'" added to your painting - scroll the code to the bottom to edit it', true);
          }catch(e){ apiStatus('insert: '+e.message, false); }
        }));
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
    if(e.key==='Escape'&&!modal.hidden) modal.hidden=true;
  });
})();
