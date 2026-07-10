// Build: inline css/ + js/ into single self-contained files under dist/
//   node build.mjs
// dist/paintlang-standalone.html - full page, open anywhere, share as one file
// dist/paintlang-artifact.html   - content-only variant for claude.ai artifact publishing
import fs from 'node:fs';
import path from 'node:path';

const ROOT=path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'));
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');

let html=read('index.html');

html=html.replace(/<link rel="stylesheet" href="([^"]+)">/g,
  (_,href)=>'<style>\n'+read(href).trim()+'\n</style>');
html=html.replace(/<script src="([^"]+)"><\/script>/g,
  (_,src)=>'<script>\n'+read(src)+'\n</script>');

fs.mkdirSync(path.join(ROOT,'dist'),{recursive:true});
fs.writeFileSync(path.join(ROOT,'dist','paintlang-standalone.html'),html);

// artifact variant: the artifact host wraps content in its own document skeleton,
// so strip doctype/html/head/body and keep <title> in the content
const title=(html.match(/<title>(.*?)<\/title>/)||[,'Paintlang Studio'])[1];
const bodyStart=html.indexOf('<body>')+6, bodyEnd=html.lastIndexOf('</body>');
const style=html.match(/<style>[\s\S]*?<\/style>/)[0];
const artifact='<title>'+title+'</title>\n'+style+'\n'+html.slice(bodyStart,bodyEnd).trim()+'\n';
fs.writeFileSync(path.join(ROOT,'dist','paintlang-artifact.html'),artifact);

console.log('built dist/paintlang-standalone.html ('
  +(html.length/1024).toFixed(1)+'kb) and dist/paintlang-artifact.html ('
  +(artifact.length/1024).toFixed(1)+'kb)');
