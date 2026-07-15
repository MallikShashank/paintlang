// Paintlang test pipeline - zero dependencies, run with: node test/run-tests.mjs
// Checks the things that have actually bitten this codebase: syntax in every
// module, global name collisions across the shared-scope scripts, icon
// references, script load order, the pure encoding/color core, and the build.
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const ROOT=path.join(path.dirname(fileURLToPath(import.meta.url)),'..');
let pass=0, fail=0;
function t(name,fn){
  try{ fn(); pass++; console.log('  ok  '+name); }
  catch(e){ fail++; console.error('  FAIL '+name+': '+e.message); }
}
function eq(a,b,msg){ if(a!==b) throw new Error((msg||'')+' expected '+b+' got '+a); }
function ok(v,msg){ if(!v) throw new Error(msg||'expected truthy'); }

const jsFiles=fs.readdirSync(path.join(ROOT,'js')).filter(f=>f.endsWith('.js')).sort();

console.log('\n-- syntax --');
for(const f of [...jsFiles.map(f=>'js/'+f),'build.mjs','server/og-gen.mjs',
    'server/dev-profile.mjs'].filter(f=>fs.existsSync(path.join(ROOT,f))))
  t('node --check '+f, ()=>{
    execFileSync(process.execPath,['--check',path.join(ROOT,f)],{stdio:'pipe'});
  });

console.log('\n-- shared global scope --');
t('no top-level name collisions across js modules', ()=>{
  const seen={};
  for(const f of jsFiles){
    const src=fs.readFileSync(path.join(ROOT,'js',f),'utf8');
    for(const m of src.matchAll(/^(?:const|let|var|function|async function)\s+([A-Za-z_$][\w$]*)/gm)){
      const n=m[1];
      if(seen[n]&&seen[n]!==f)
        throw new Error('"'+n+'" declared in both '+seen[n]+' and '+f);
      seen[n]=f;
    }
  }
});

console.log('\n-- markup wiring --');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
t('every js module is loaded by index.html, in number order', ()=>{
  const tags=[...html.matchAll(/<script src="js\/([^"]+)"><\/script>/g)].map(m=>m[1]);
  for(const f of jsFiles) ok(tags.includes(f), f+' missing from index.html');
  eq(JSON.stringify(tags), JSON.stringify([...tags].sort()), 'load order');
});
t('every data-ico in markup exists in the icon library', ()=>{
  const icons=new Set([...fs.readFileSync(path.join(ROOT,'js/00-icons.js'),'utf8')
    .matchAll(/I\.([a-z]+)=/g)].map(m=>m[1]));
  for(const m of html.matchAll(/data-ico="([a-z]+)"/g))
    ok(icons.has(m[1]), 'unknown icon "'+m[1]+'"');
});
t('foreign-code hold gate exists in the runtime', ()=>{
  const run=fs.readFileSync(path.join(ROOT,'js/06-run.js'),'utf8');
  ok(run.includes('__plHoldRun'), 'runCode hold check missing');
});

console.log('\n-- pure core (extracted into a vm) --');
function extract(file,names){
  const src=fs.readFileSync(path.join(ROOT,file),'utf8');
  let out='';
  for(const n of names){
    if(/^const /.test(n)){ // a one-statement const, taken to end of line
      const name=n.replace('const ','');
      const m=src.match(new RegExp('^const '+name+'\\s*=.*$','m'));
      if(!m) throw new Error(n+' not found in '+file);
      out+=m[0]+'\n'; continue;
    }
    const i=src.indexOf('function '+n+'(');
    if(i<0) throw new Error(n+' not found in '+file);
    let d=0,j=src.indexOf('{',i);
    for(let k=j;k<src.length;k++){
      if(src[k]==='{')d++; else if(src[k]==='}'){d--; if(!d){ j=k+1; break; }}
    }
    out+=src.slice(i,j)+'\n';
  }
  return out;
}
const ctx={W:960,H:600,console};
vm.createContext(ctx);
vm.runInContext(extract('js/05-forms-api.js',
  ['const B64A','packPts','unpackPts','unpackStrokes','shadeRGB','_vivid','_mixWhite'])
  .replace("const B64A='","const B64A='")+
  'const B64R={}; for(let i=0;i<64;i++) B64R[B64A[i]]=i;', ctx);
vm.runInContext(extract('js/07-editor.js',['const tokenRe']), ctx);
vm.runInContext("const apiSet=new Set(['sky','circle']);"
  +extract('js/06-run.js',['instrument']), ctx);

t('packPts/unpackPts roundtrip', ()=>{
  const pts=[[10,20],[500,300],[950,590]];
  const r=vm.runInContext(
    'unpackPts(packPts('+JSON.stringify(pts)+',0,0,960,600))',ctx);
  ok(r&&r.length===3,'length');
  for(let i=0;i<3;i++){
    ok(Math.abs(r[i][0]*960-pts[i][0])<0.5,'x'+i);
    ok(Math.abs(r[i][1]*600-pts[i][1])<0.5,'y'+i);
  }
});
t('unpackStrokes decodes a hand-built blob', ()=>{
  const r=vm.runInContext(`(()=>{
    const enc12=v=>B64A[v>>6]+B64A[v&63];
    const c=(200<<16)|(100<<8)|50;
    const blob=B64A[2]
      +B64A[(c>>18)&63]+B64A[(c>>12)&63]+B64A[(c>>6)&63]+B64A[c&63]
      +enc12(0)+enc12(0)+enc12(4095)+enc12(4095);
    return unpackStrokes(blob);
  })()`,ctx);
  ok(r&&r.length===1,'one stroke');
  eq(r[0].col,'rgb(200,100,50)','color');
  eq(r[0].pts.length,2,'points');
});
t('shadeRGB clamps to white and black', ()=>{
  eq(vm.runInContext("shadeRGB('rgb(100,100,100)',1)",ctx),'rgb(255,255,255)');
  eq(vm.runInContext("shadeRGB('rgb(100,100,100)',-1)",ctx),'rgb(0,0,0)');
});
t('_vivid preserves luminance direction', ()=>{
  const r=vm.runInContext("_vivid('rgb(200,100,50)',.4)",ctx);
  const m=r.match(/\d+/g).map(Number);
  ok(m[0]>=200,'red channel pushed out');
  ok(m[2]<=50,'blue channel pushed in');
});
t('instrument rewrites calls with site ids', ()=>{
  const r=vm.runInContext('instrument("sky({a:1})\\ncircle(1,2,3)")',ctx);
  ok(r.code.includes('__call(0,"sky"'),'sky call');
  ok(r.code.includes('__call(1,"circle"'),'circle call');
  eq(r.sites.length,2,'two sites');
});

console.log('\n-- build --');
t('build.mjs produces both bundles with the app inside', ()=>{
  execFileSync(process.execPath,[path.join(ROOT,'build.mjs')],{cwd:ROOT,stdio:'pipe'});
  for(const f of ['dist/paintlang-standalone.html','dist/paintlang-artifact.html']){
    const s=fs.readFileSync(path.join(ROOT,f),'utf8');
    ok(s.length>150000, f+' suspiciously small');
    ok(s.includes('drawOneStroke'), f+' missing the media engine');
    ok(s.includes('PLICON')||s.includes('plIco'), f+' missing icons');
  }
});

console.log('\n'+pass+' passed, '+fail+' failed');
if(fail) process.exit(1);
