'use strict';
/* ---- export engine: the painting leaves home ----
   Re-runs the op list through a recording context, then serializes the
   recorded command stream into other art-code formats. The code and canvas
   stay the source of truth here; exports are one-way snapshots. */
(function(){
  const TONE_CSS={ink:'saturate(0.12) sepia(0.26) brightness(1.05)',
    charcoal:'saturate(0.16) brightness(1.03)',
    neon:'saturate(1.4) brightness(0.88) contrast(1.05)',
    watercolor:'saturate(1.12) brightness(1.08)'};
  const num=v=>typeof v==='number'?+v.toFixed(2):v;
  const arg=v=>typeof v==='number'?String(+v.toFixed(2)):JSON.stringify(v);

  /* ---- record: run every visible op against a logging context ---- */
  function recordPainting(){
    const cmds=[], images=[], imap=new Map();
    const cv=document.createElement('canvas');
    cv.width=W*DPR; cv.height=H*DPR;
    const g=cv.getContext('2d');
    let gseq=0;
    const rec={canvas:cv};
    const METHODS=['save','restore','beginPath','closePath','moveTo','lineTo',
      'quadraticCurveTo','bezierCurveTo','arc','arcTo','ellipse','rect',
      'roundRect','fill','stroke','clip','fillRect','strokeRect','clearRect',
      'setLineDash','setTransform','transform','translate','scale','rotate',
      'fillText','strokeText'];
    for(const m of METHODS)
      rec[m]=function(...a){ cmds.push({k:'m',m,a}); return g[m](...a); };
    rec.measureText=t=>g.measureText(t);
    rec.getImageData=(...a)=>g.getImageData(...a);
    rec.getLineDash=()=>g.getLineDash();
    const mkGrad=(t,a)=>{
      const gr=t==='linear'?g.createLinearGradient(...a):g.createRadialGradient(...a);
      const meta={k:'grad',t,id:'G'+(gseq++),a,stops:[]};
      cmds.push(meta);
      return {__id:meta.id,__gr:gr,
        addColorStop(o,c){ meta.stops.push([o,c]); gr.addColorStop(o,c); }};
    };
    rec.createLinearGradient=(...a)=>mkGrad('linear',a);
    rec.createRadialGradient=(...a)=>mkGrad('radial',a);
    for(const p of ['strokeStyle','fillStyle','globalAlpha','lineWidth','lineCap',
      'lineJoin','miterLimit','globalCompositeOperation','font','textAlign',
      'textBaseline','filter','shadowColor','shadowBlur','shadowOffsetX',
      'shadowOffsetY','lineDashOffset','imageSmoothingEnabled'])
      Object.defineProperty(rec,p,{
        set(v){ if(v&&v.__id){ cmds.push({k:'sg',p,id:v.__id}); g[p]=v.__gr; }
          else { cmds.push({k:'s',p,v}); g[p]=v; } },
        get(){ return g[p]; }});
    rec.drawImage=function(src,...a){
      let id=imap.get(src);
      if(id===undefined){
        id=images.length;
        try{
          const d=src.toDataURL?src.toDataURL('image/png'):(src.src||'');
          images.push({d,w:src.width,h:src.height});
        }catch(e){ images.push(null); }
        imap.set(src,id);
      }
      cmds.push({k:'img',id,a});
      try{ return g.drawImage(src,...a); }catch(e){}
    };
    // the run, mirroring renderOps
    rec.setTransform(DPR,0,0,DPR,0,0);
    rec.fillStyle='#f6f1e7'; rec.fillRect(0,0,W,H);
    let toneMedia=null;
    for(const op of ops){
      if(op.hidden||(op.layer&&op.layer.hidden)) continue;
      if(op.post&&op._strokes&&TONE_CSS[op._strokes.media])
        toneMedia=op._strokes.media;
      cmds.push({k:'op',n:op.name});
      rec.save();
      applyOpTransform(rec,op);
      try{ op.draw(rec); }catch(e){}
      rec.restore();
    }
    // generic post passes (water reflection); the media tone finish is NOT
    // replayed here - each serializer applies it natively at the end instead
    for(const op of ops){
      if(op.hidden||(op.layer&&op.layer.hidden)||!op.post||op._strokes) continue;
      cmds.push({k:'op',n:op.name+' (post)'});
      try{ op.post(rec,op); }catch(e){}
    }
    return {cmds,images,toneMedia};
  }

  /* ---- serializer: plain canvas javascript ---- */
  function bodyJS(r){
    const L=[], gn={};
    for(const c of r.cmds){
      if(c.k==='m') L.push('ctx.'+c.m+'('+c.a.map(arg).join(',')+');');
      else if(c.k==='s') L.push('ctx.'+c.p+'='+JSON.stringify(c.v)+';');
      else if(c.k==='grad'){
        const n='g'+Object.keys(gn).length; gn[c.id]=n;
        L.push('const '+n+'=ctx.create'+(c.t==='linear'?'Linear':'Radial')
          +'Gradient('+c.a.map(arg).join(',')+');');
        for(const [o,cc] of c.stops)
          L.push(n+'.addColorStop('+arg(o)+','+JSON.stringify(cc)+');');
      }
      else if(c.k==='sg') L.push('ctx.'+c.p+'='+gn[c.id]+';');
      else if(c.k==='img'){
        if(!r.images[c.id]) continue;
        L.push('ctx.drawImage(IMGS['+c.id+']'
          +(c.a.length?','+c.a.map(arg).join(','):'')+');');
      }
      else if(c.k==='op') L.push('// '+c.n);
    }
    if(r.toneMedia){
      L.push("// the medium's drying pass");
      L.push("const tmp=document.createElement('canvas');");
      L.push('tmp.width=cv.width;tmp.height=cv.height;');
      L.push("tmp.getContext('2d').drawImage(cv,0,0);");
      L.push('ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;');
      L.push("ctx.filter='"+TONE_CSS[r.toneMedia]+"';");
      L.push("ctx.drawImage(tmp,0,0);ctx.filter='none';ctx.restore();");
    }
    return L.join('\n');
  }
  function serializeHTML(r,name){
    const imgs=r.images.map(i=>i?JSON.stringify(i.d):'null').join(',\n');
    return '<!doctype html>\n<html>\n<head>\n<meta charset="utf-8">\n<title>'
      +name+' - painted with Paintlang</title>\n'
      +'<style>body{margin:0;background:#222;display:grid;place-items:center;'
      +'min-height:100vh}canvas{width:960px;max-width:96vw;height:auto}</style>\n'
      +'</head>\n<body>\n<canvas id="cv" width="'+W*DPR+'" height="'+H*DPR+'"></canvas>\n'
      +'<script>\n// '+name+' - exported from paintlang.com\n'
      +"const cv=document.getElementById('cv');\n"
      +"const ctx=cv.getContext('2d');\n"
      +'const SRC=['+imgs+'];\n'
      +'const IMGS=SRC.map(d=>{if(!d)return null;const i=new Image();i.src=d;return i;});\n'
      +'Promise.all(IMGS.filter(Boolean).map(i=>i.decode().catch(()=>{}))).then(paint);\n'
      +'function paint(){\n'+bodyJS(r)+'\n}\n'
      +'<\/script>\n</body>\n</html>\n';
  }
  function serializeP5(r,name){
    const imgs=r.images.map(i=>i?JSON.stringify(i.d):'null').join(',\n');
    return '// '+name+' - exported from paintlang.com as a p5.js sketch\n'
      +'// The painting draws once through drawingContext (the raw 2d canvas\n'
      +'// under p5), which keeps every stroke faithful. Paint over it with\n'
      +'// any p5 calls in draw().\n'
      +'const SRC=['+imgs+'];\nlet IMGS=[];\n'
      +'function setup(){\n'
      +'  pixelDensity(1);\n'
      +'  createCanvas('+W*DPR+','+H*DPR+');\n'
      +'  noLoop();\n'
      +'  IMGS=SRC.map(d=>{if(!d)return null;const i=new Image();i.src=d;return i;});\n'
      +'  Promise.all(IMGS.filter(Boolean).map(i=>i.decode().catch(()=>{})))'
      +'.then(()=>{paintAll();});\n'
      +'}\n'
      +'function draw(){}\n'
      +'function paintAll(){\n'
      +'  const cv=drawingContext.canvas;\n'
      +'  const ctx=drawingContext;\n'
      +bodyJS(r)+'\n}\n';
  }

  /* ---- serializer: SVG ---- */
  function colInfo(v,gn){
    if(v&&typeof v==='object'&&v.__id) return {u:'url(#'+v.__id+')'};
    return {u:v};
  }
  function serializeSVG(r,name){
    const els=[], defs=[];
    const I=[1,0,0,1,0,0];
    let st={m:I.slice(),fill:'#000',stroke:'#000',alpha:1,lw:1,cap:'butt',
      join:'miter',dash:null,gco:'source-over',filter:'none',clip:null,
      font:'10px sans-serif',fillG:null,strokeG:null};
    const stack=[];
    const grads={};
    let path=[], d='', clipSeq=0, gradSeq=0;
    const mul=(m,n)=>[m[0]*n[0]+m[2]*n[1], m[1]*n[0]+m[3]*n[1],
      m[0]*n[2]+m[2]*n[3], m[1]*n[2]+m[3]*n[3],
      m[0]*n[4]+m[2]*n[5]+m[4], m[1]*n[4]+m[3]*n[5]+m[5]];
    const tp=(x,y)=>{ const m=st.m;
      return [m[0]*x+m[2]*y+m[4], m[1]*x+m[3]*y+m[5]]; };
    const P=n=>+n.toFixed(2);
    const seg=(x,y,pre)=>{ const [a,b]=tp(x,y); d+=pre+P(a)+' '+P(b); };
    const sc=()=>Math.sqrt(Math.abs(st.m[0]*st.m[3]-st.m[1]*st.m[2]))||1;
    function arcBez(cx,cy,rx,ry,rot,a0,a1,ccw){
      let da=a1-a0;
      if(ccw&&da>0) da-=Math.PI*2;
      if(!ccw&&da<0) da+=Math.PI*2;
      if(Math.abs(da)>Math.PI*2-1e-6) da=Math.sign(da||1)*Math.PI*2;
      const n=Math.max(1,Math.ceil(Math.abs(da)/(Math.PI/2)));
      const cosr=Math.cos(rot), sinr=Math.sin(rot);
      const pt=a=>{ const px=Math.cos(a)*rx, py=Math.sin(a)*ry;
        return [cx+px*cosr-py*sinr, cy+px*sinr+py*cosr]; };
      const dv=a=>{ const px=-Math.sin(a)*rx, py=Math.cos(a)*ry;
        return [px*cosr-py*sinr, px*sinr+py*cosr]; };
      const out=[];
      for(let i=0;i<n;i++){
        const s0=a0+da*i/n, s1=a0+da*(i+1)/n, h=(s1-s0)/2;
        const k=4/3*Math.tan(h/2);
        const p0=pt(s0), p1=pt(s1), d0=dv(s0), d1=dv(s1);
        out.push([p0,[p0[0]+d0[0]*k,p0[1]+d0[1]*k],
          [p1[0]-d1[0]*k,p1[1]-d1[1]*k],p1]);
      }
      return out;
    }
    const emitArc=(cx,cy,rx,ry,rot,a0,a1,ccw)=>{
      const bz=arcBez(cx,cy,rx,ry,rot,a0,a1,ccw);
      if(!bz.length) return;
      const s=tp(bz[0][0][0],bz[0][0][1]);
      d+=(d===''?'M':'L')+P(s[0])+' '+P(s[1]);
      for(const b of bz){
        const c1=tp(b[1][0],b[1][1]), c2=tp(b[2][0],b[2][1]), e=tp(b[3][0],b[3][1]);
        d+='C'+P(c1[0])+' '+P(c1[1])+' '+P(c2[0])+' '+P(c2[1])+' '+P(e[0])+' '+P(e[1]);
      }
    };
    const styleOf=()=>{
      let s='';
      const BM={lighter:'plus-lighter',multiply:'multiply',screen:'screen',
        overlay:'overlay',saturation:'saturation',color:'color',
        'soft-light':'soft-light','destination-over':''};
      if(st.gco!=='source-over'&&BM[st.gco]) s+='mix-blend-mode:'+BM[st.gco]+';';
      if(st.filter&&st.filter!=='none') s+='filter:'+st.filter+';';
      return s?' style="'+s+'"':'';
    };
    const gradRef=(gid)=>{
      const meta=grads[gid]; if(!meta) return '#000';
      const id='sg'+(gradSeq++);
      const m=st.m.map(P).join(' ');
      if(meta.t==='linear')
        defs.push('<linearGradient id="'+id+'" gradientUnits="userSpaceOnUse" '
          +'x1="'+P(meta.a[0])+'" y1="'+P(meta.a[1])+'" x2="'+P(meta.a[2])
          +'" y2="'+P(meta.a[3])+'" gradientTransform="matrix('+m+')">'
          +meta.stops.map(s2=>'<stop offset="'+P(s2[0])+'" stop-color="'
            +s2[1].replace(/"/g,'')+'"/>').join('')+'</linearGradient>');
      else
        defs.push('<radialGradient id="'+id+'" gradientUnits="userSpaceOnUse" '
          +'fx="'+P(meta.a[0])+'" fy="'+P(meta.a[1])+'" r="'+P(meta.a[5])
          +'" cx="'+P(meta.a[3])+'" cy="'+P(meta.a[4])
          +'" gradientTransform="matrix('+m+')">'
          +meta.stops.map(s2=>'<stop offset="'+P(s2[0])+'" stop-color="'
            +s2[1].replace(/"/g,'')+'"/>').join('')+'</radialGradient>');
      return 'url(#'+id+')';
    };
    const clipAttr=()=>st.clip?' clip-path="url(#'+st.clip+')"':'';
    const emitPath=(mode)=>{
      if(!d) return;
      const op=P(st.alpha);
      if(mode==='fill'){
        const f=st.fillG?gradRef(st.fillG):st.fill;
        els.push('<path d="'+d+'" fill="'+f+'"'
          +(op<1?' opacity="'+op+'"':'')+clipAttr()+styleOf()+'/>');
      }else{
        const s=st.strokeG?gradRef(st.strokeG):st.stroke;
        els.push('<path d="'+d+'" fill="none" stroke="'+s+'" stroke-width="'
          +P(st.lw*sc())+'"'
          +(st.cap!=='butt'?' stroke-linecap="'+st.cap+'"':'')
          +(st.join!=='miter'?' stroke-linejoin="'+st.join+'"':'')
          +(st.dash&&st.dash.length?' stroke-dasharray="'
            +st.dash.map(x=>P(x*sc())).join(' ')+'"':'')
          +(op<1?' opacity="'+op+'"':'')+clipAttr()+styleOf()+'/>');
      }
    };
    for(const c of r.cmds){
      if(c.k==='grad') grads[c.id]=c;
      else if(c.k==='sg'){ if(c.p==='fillStyle') st.fillG=c.id;
        else if(c.p==='strokeStyle') st.strokeG=c.id; }
      else if(c.k==='s'){
        const v=c.v;
        if(c.p==='fillStyle'){ st.fill=v; st.fillG=null; }
        else if(c.p==='strokeStyle'){ st.stroke=v; st.strokeG=null; }
        else if(c.p==='globalAlpha') st.alpha=v;
        else if(c.p==='lineWidth') st.lw=v;
        else if(c.p==='lineCap') st.cap=v;
        else if(c.p==='lineJoin') st.join=v;
        else if(c.p==='globalCompositeOperation') st.gco=v;
        else if(c.p==='filter') st.filter=v;
        else if(c.p==='font') st.font=v;
      }
      else if(c.k==='img'){
        const im=r.images[c.id]; if(!im) continue;
        const a=c.a, m=st.m.map(P).join(' ');
        const op=P(st.alpha);
        let inner;
        if(a.length>=8){
          inner='<svg x="'+P(a[4])+'" y="'+P(a[5])+'" width="'+P(a[6])
            +'" height="'+P(a[7])+'" viewBox="'+P(a[0])+' '+P(a[1])+' '
            +P(a[2])+' '+P(a[3])+'" preserveAspectRatio="none">'
            +'<image width="'+im.w+'" height="'+im.h+'" href="'+im.d+'"/></svg>';
        }else{
          const dw=a.length>=4?a[2]:im.w, dh=a.length>=4?a[3]:im.h;
          inner='<image x="'+P(a[0]||0)+'" y="'+P(a[1]||0)+'" width="'+P(dw)
            +'" height="'+P(dh)+'" preserveAspectRatio="none" href="'+im.d+'"/>';
        }
        els.push('<g transform="matrix('+m+')"'
          +(op<1?' opacity="'+op+'"':'')+clipAttr()+styleOf()+'>'+inner+'</g>');
      }
      else if(c.k==='m'){
        const a=c.a;
        switch(c.m){
          case 'save': stack.push({...st,m:st.m.slice(),
            dash:st.dash?st.dash.slice():null}); break;
          case 'restore': if(stack.length) st=stack.pop(); break;
          case 'setTransform': st.m=a.length?a.slice(0,6):I.slice(); break;
          case 'transform': st.m=mul(st.m,a); break;
          case 'translate': st.m=mul(st.m,[1,0,0,1,a[0],a[1]]); break;
          case 'scale': st.m=mul(st.m,[a[0],0,0,a[1],0,0]); break;
          case 'rotate': { const co=Math.cos(a[0]),si=Math.sin(a[0]);
            st.m=mul(st.m,[co,si,-si,co,0,0]); break; }
          case 'beginPath': d=''; break;
          case 'closePath': d+='Z'; break;
          case 'moveTo': seg(a[0],a[1],'M'); break;
          case 'lineTo': seg(a[0],a[1],d===''?'M':'L'); break;
          case 'quadraticCurveTo': { const c1=tp(a[0],a[1]), e=tp(a[2],a[3]);
            d+='Q'+P(c1[0])+' '+P(c1[1])+' '+P(e[0])+' '+P(e[1]); break; }
          case 'bezierCurveTo': { const c1=tp(a[0],a[1]), c2=tp(a[2],a[3]),
            e=tp(a[4],a[5]);
            d+='C'+P(c1[0])+' '+P(c1[1])+' '+P(c2[0])+' '+P(c2[1])+' '
              +P(e[0])+' '+P(e[1]); break; }
          case 'arc': emitArc(a[0],a[1],a[2],a[2],0,a[3],a[4],!!a[5]); break;
          case 'ellipse': emitArc(a[0],a[1],a[2],a[3],a[4],a[5],a[6],!!a[7]); break;
          case 'rect': case 'roundRect':
            seg(a[0],a[1],(d===''?'M':'M'));
            seg(a[0]+a[2],a[1],'L'); seg(a[0]+a[2],a[1]+a[3],'L');
            seg(a[0],a[1]+a[3],'L'); d+='Z'; break;
          case 'fill': emitPath('fill'); break;
          case 'stroke': emitPath('stroke'); break;
          case 'clip': { if(!d) break; const id='c'+(clipSeq++);
            defs.push('<clipPath id="'+id+'"><path d="'+d+'"/></clipPath>');
            st.clip=id; break; }
          case 'fillRect': { const hold=d; d='';
            seg(a[0],a[1],'M'); seg(a[0]+a[2],a[1],'L');
            seg(a[0]+a[2],a[1]+a[3],'L'); seg(a[0],a[1]+a[3],'L'); d+='Z';
            emitPath('fill'); d=hold; break; }
          case 'strokeRect': { const hold=d; d='';
            seg(a[0],a[1],'M'); seg(a[0]+a[2],a[1],'L');
            seg(a[0]+a[2],a[1]+a[3],'L'); seg(a[0],a[1]+a[3],'L'); d+='Z';
            emitPath('stroke'); d=hold; break; }
          case 'clearRect': break;
          case 'setLineDash': st.dash=a[0]&&a[0].length?a[0].slice():null; break;
          case 'fillText': { const [x,y]=tp(a[1],a[2]);
            els.push('<text x="'+P(x)+'" y="'+P(y)+'" fill="'+st.fill
              +'" style="font:'+st.font+'"'+clipAttr()+'>'
              +String(a[0]).replace(/&/g,'&amp;').replace(/</g,'&lt;')
              +'</text>'); break; }
        }
      }
    }
    const tone=r.toneMedia
      ?' style="filter:'+TONE_CSS[r.toneMedia]+'"':'';
    return '<?xml version="1.0" encoding="UTF-8"?>\n'
      +'<!-- '+name+' - exported from paintlang.com -->\n'
      +'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+W*DPR+' '+H*DPR
      +'" width="'+W+'" height="'+H+'">\n'
      +(defs.length?'<defs>'+defs.join('')+'</defs>\n':'')
      +'<g'+tone+'>\n'+els.join('\n')+'\n</g>\n</svg>\n';
  }

  /* ---- serializer: WebGL / GLSL effect shell ---- */
  function serializeGLSL(name){
    const tex=paintCanvas.toDataURL('image/jpeg',.92);
    return '<!doctype html>\n<html>\n<head>\n<meta charset="utf-8">\n<title>'
      +name+' - Paintlang WebGL shell</title>\n'
      +'<style>body{margin:0;background:#111;display:grid;place-items:center;'
      +'min-height:100vh}canvas{width:960px;max-width:96vw}</style>\n</head>\n<body>\n'
      +'<canvas id="gl" width="'+W*DPR+'" height="'+H*DPR+'"></canvas>\n'
      +'<script>\n'
      +'// '+name+' - exported from paintlang.com\n'
      +'// The painting rides in as a texture; the fragment shader below is\n'
      +'// yours to edit. uTime ticks, uRes is the canvas size.\n'
      +'const FRAG=`\nprecision mediump float;\n'
      +'uniform sampler2D uTex;uniform float uTime;uniform vec2 uRes;\n'
      +'varying vec2 vUV;\n'
      +'void main(){\n'
      +'  vec2 uv=vUV;\n'
      +'  // try: uv.x+=sin(uv.y*40.0+uTime)*0.002;  (heat shimmer)\n'
      +'  // try: float g=dot(texture2D(uTex,uv).rgb,vec3(.3,.59,.11));\n'
      +'  //      gl_FragColor=vec4(vec3(g),1.0); return;  (monochrome)\n'
      +'  gl_FragColor=texture2D(uTex,uv);\n'
      +'}`;\n'
      +'const VERT=`attribute vec2 aP;varying vec2 vUV;'
      +'void main(){vUV=vec2(aP.x*.5+.5,.5-aP.y*.5);'
      +'gl_Position=vec4(aP,0.,1.);}`;\n'
      +"const gl=document.getElementById('gl').getContext('webgl');\n"
      +'function sh(t,s){const o=gl.createShader(t);gl.shaderSource(o,s);'
      +'gl.compileShader(o);'
      +'if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))'
      +'console.error(gl.getShaderInfoLog(o));return o;}\n'
      +'const pr=gl.createProgram();\n'
      +'gl.attachShader(pr,sh(gl.VERTEX_SHADER,VERT));\n'
      +'gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,FRAG));\n'
      +'gl.linkProgram(pr);gl.useProgram(pr);\n'
      +'const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);\n'
      +'gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),'
      +'gl.STATIC_DRAW);\n'
      +"const aP=gl.getAttribLocation(pr,'aP');\n"
      +'gl.enableVertexAttribArray(aP);gl.vertexAttribPointer(aP,2,gl.FLOAT,false,0,0);\n'
      +'const img=new Image();img.src='+JSON.stringify(tex)+';\n'
      +'img.onload=()=>{\n'
      +'  const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);\n'
      +'  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);\n'
      +'  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);\n'
      +'  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);\n'
      +'  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);\n'
      +"  const uT=gl.getUniformLocation(pr,'uTime');\n"
      +"  const uR=gl.getUniformLocation(pr,'uRes');\n"
      +'  gl.uniform2f(uR,gl.canvas.width,gl.canvas.height);\n'
      +'  (function tick(ms){gl.uniform1f(uT,ms/1000);\n'
      +'    gl.drawArrays(gl.TRIANGLES,0,3);requestAnimationFrame(tick);})(0);\n'
      +'};\n<\/script>\n</body>\n</html>\n';
  }

  /* ---- serializer: Lottie JSON (replay as an animation) ---- */
  function serializeLottie(r,name){
    const FR=30, OP=FR*10, CAP=6000;
    const groups=[];
    const I=[1,0,0,1,0,0];
    let st={m:I.slice(),fill:'#000',stroke:'#000',alpha:1,lw:1,cap:'round',
      join:'round'};
    const stack=[];
    let subs=[], cur=null, opName='';
    const mul=(m,n)=>[m[0]*n[0]+m[2]*n[1], m[1]*n[0]+m[3]*n[1],
      m[0]*n[2]+m[2]*n[3], m[1]*n[2]+m[3]*n[3],
      m[0]*n[4]+m[2]*n[5]+m[4], m[1]*n[4]+m[3]*n[5]+m[5]];
    const tp=(x,y)=>{ const m=st.m;
      return [+(m[0]*x+m[2]*y+m[4]).toFixed(1), +(m[1]*x+m[3]*y+m[5]).toFixed(1)]; };
    const sc=()=>Math.sqrt(Math.abs(st.m[0]*st.m[3]-st.m[1]*st.m[2]))||1;
    const col=v=>{
      if(typeof v!=='string') return [0,0,0];
      let m=v.match(/^#([0-9a-f]{6})/i);
      if(m) return [parseInt(m[1].slice(0,2),16)/255,
        parseInt(m[1].slice(2,4),16)/255, parseInt(m[1].slice(4,6),16)/255];
      m=v.match(/[\d.]+/g);
      if(m&&m.length>=3) return [m[0]/255,m[1]/255,m[2]/255];
      return [0,0,0];
    };
    const colAlpha=v=>{
      const m=typeof v==='string'&&v.match(/rgba\([^)]*,\s*([\d.]+)\)/);
      return m?+m[1]:1;
    };
    const shOf=pts=>({ty:'sh',ks:{a:0,k:{c:pts.closed,
      i:pts.v.map(()=>[0,0]), o:pts.v.map(()=>[0,0]), v:pts.v}}});
    const flush=(mode)=>{
      if(cur&&cur.v.length>1) subs.push(cur);
      if(!subs.length){ cur=null; return; }
      const items=subs.filter(s2=>s2.v.length>1).map(shOf);
      if(!items.length){ subs=[]; cur=null; return; }
      const a=Math.max(0,Math.min(1,st.alpha
        *(mode==='fill'?colAlpha(st.fill):colAlpha(st.stroke))));
      if(mode==='fill') items.push({ty:'fl',c:{a:0,k:col(st.fill)},
        o:{a:0,k:Math.round(a*100)}});
      else items.push({ty:'st',c:{a:0,k:col(st.stroke)},
        o:{a:0,k:Math.round(a*100)}, w:{a:0,k:+(st.lw*sc()).toFixed(1)},
        lc:st.cap==='round'?2:st.cap==='square'?3:1,
        lj:st.join==='round'?2:st.join==='bevel'?3:1});
      groups.push({op:opName,items});
      subs=[]; cur=null;
    };
    for(const c of r.cmds){
      if(c.k==='op'){ opName=c.n; continue; }
      if(c.k==='s'){
        if(c.p==='fillStyle') st.fill=c.v;
        else if(c.p==='strokeStyle') st.stroke=c.v;
        else if(c.p==='globalAlpha') st.alpha=c.v;
        else if(c.p==='lineWidth') st.lw=c.v;
        else if(c.p==='lineCap') st.cap=c.v;
        else if(c.p==='lineJoin') st.join=c.v;
        continue;
      }
      if(c.k!=='m') continue;
      const a=c.a;
      switch(c.m){
        case 'save': stack.push({...st,m:st.m.slice()}); break;
        case 'restore': if(stack.length) st=stack.pop(); break;
        case 'setTransform': st.m=a.length?a.slice(0,6):I.slice(); break;
        case 'transform': st.m=mul(st.m,a); break;
        case 'translate': st.m=mul(st.m,[1,0,0,1,a[0],a[1]]); break;
        case 'scale': st.m=mul(st.m,[a[0],0,0,a[1],0,0]); break;
        case 'rotate': { const co=Math.cos(a[0]),si=Math.sin(a[0]);
          st.m=mul(st.m,[co,si,-si,co,0,0]); break; }
        case 'beginPath': subs=[]; cur=null; break;
        case 'closePath': if(cur){ cur.closed=true; subs.push(cur); cur=null; } break;
        case 'moveTo': if(cur&&cur.v.length>1) subs.push(cur);
          cur={v:[tp(a[0],a[1])],closed:false}; break;
        case 'lineTo': if(!cur) cur={v:[tp(a[0],a[1])],closed:false};
          else cur.v.push(tp(a[0],a[1])); break;
        case 'quadraticCurveTo': case 'bezierCurveTo': {
          const e=c.m==='quadraticCurveTo'?tp(a[2],a[3]):tp(a[4],a[5]);
          if(!cur) cur={v:[e],closed:false}; else cur.v.push(e); break; }
        case 'arc': case 'ellipse': {
          const rx=a[2], ry=c.m==='arc'?a[2]:a[3];
          const a0=c.m==='arc'?a[3]:a[5], a1=c.m==='arc'?a[4]:a[6];
          const cx=a[0], cy=a[1];
          if(cur&&cur.v.length>1) subs.push(cur);
          cur={v:[],closed:Math.abs(a1-a0)>=Math.PI*2-1e-6};
          const n=10;
          for(let i=0;i<=n;i++){
            const t=a0+(a1-a0)*i/n;
            cur.v.push(tp(cx+Math.cos(t)*rx, cy+Math.sin(t)*ry));
          }
          break; }
        case 'rect': case 'roundRect':
          if(cur&&cur.v.length>1) subs.push(cur);
          subs.push({v:[tp(a[0],a[1]),tp(a[0]+a[2],a[1]),
            tp(a[0]+a[2],a[1]+a[3]),tp(a[0],a[1]+a[3])],closed:true});
          cur=null; break;
        case 'fillRect': { const hold=cur, hs=subs;
          subs=[{v:[tp(a[0],a[1]),tp(a[0]+a[2],a[1]),
            tp(a[0]+a[2],a[1]+a[3]),tp(a[0],a[1]+a[3])],closed:true}];
          cur=null; flush('fill'); cur=hold; subs=hs; break; }
        case 'fill': flush('fill'); break;
        case 'stroke': flush('stroke'); break;
      }
    }
    // size guard: keep the composition, thin the stroke storm
    let out=groups, dropped=0;
    if(groups.length>CAP){
      const nStrokes=groups.reduce((n,g2)=>n+(g2.op==='strokes'?1:0),0);
      const nRest=groups.length-nStrokes;
      const keepEvery=Math.ceil(nStrokes/Math.max(1,CAP-nRest));
      out=[]; let k=0;
      for(const g2 of groups){
        if(g2.op!=='strokes'){ out.push(g2); continue; }
        if(k%keepEvery===0) out.push(g2); else dropped++;
        k++;
      }
    }
    const N=out.length;
    const shapes=out.map((g2,i)=>{
      const t=Math.round((i/Math.max(1,N-1))*(OP-FR));
      return {ty:'gr',nm:g2.op,it:[...g2.items,{ty:'tr',
        p:{a:0,k:[0,0]},a:{a:0,k:[0,0]},s:{a:0,k:[100,100]},r:{a:0,k:0},
        o:{a:1,k:[{t:0,s:[0],h:1},{t,s:[100],h:1}]}}]};
    });
    return JSON.stringify({v:'5.7.4',fr:FR,ip:0,op:OP,w:W*DPR,h:H*DPR,
      nm:name+(dropped?' (simplified: '+dropped+' strokes thinned to fit Lottie)':''),
      ddd:0,assets:[],
      layers:[{ddd:0,ind:1,ty:4,nm:'painting',sr:1,
        ks:{o:{a:0,k:100},r:{a:0,k:0},p:{a:0,k:[0,0,0]},
          a:{a:0,k:[0,0,0]},s:{a:0,k:[100,100,100]}},
        ao:0,shapes,ip:0,op:OP,st:0,bm:0}]});
  }

  /* ---- the dialog ---- */
  const NOTES={
    png:'The canvas as a lossless image at 2x resolution (1920x1200). No '
      +'watermark, ever.',
    jpg:'The canvas as a smaller JPG at 2x resolution - good for sharing '
      +'where file size matters. For lossless, use PNG.',
    paint:'The painting exactly as it is: the code in this tab. Open it back '
      +'at paintlang.com any time - this is the only format that stays editable '
      +'as a painting.',
    svg:'Every stroke and mass as vector paths, with brush transparency and '
      +'blend modes. Large traced paintings make large files (tens of MB at '
      +'ultra). Post effects are approximated with SVG filters.',
    html:'A self-contained web page: a canvas plus the full ctx.beginPath / '
      +'moveTo / stroke command stream, faithful to the pixel. Paste the '
      +'paint() body into any canvas project.',
    p5:'A p5.js sketch. The painting draws once through drawingContext for '
      +'fidelity; layer your own p5 code in draw() on top. Drop it into the '
      +'p5 web editor.',
    glsl:'A WebGL page with your painting as a texture and an editable GLSL '
      +'fragment shader (uTime, uRes ready). Brush strokes do not translate '
      +'to shader math, so this exports the image plus a shader playground, '
      +'not per-stroke GLSL.',
    lottie:'A Lottie animation of the painting revealing itself, for After '
      +'Effects, web players and apps. Gradients become flat fills; very '
      +'dense paintings are thinned to stay playable. For video, use '
      +'Download replay video (WebM); mp4 = ffmpeg -i replay.webm replay.mp4.'};
  const EXT={paint:'.paint',svg:'.svg',html:'.html',p5:'.js',glsl:'.html',
    lottie:'.json'};
  const MIME={paint:'text/plain',svg:'image/svg+xml',html:'text/html',
    p5:'text/javascript',glsl:'text/html',lottie:'application/json'};
  function safeName(name){
    return name.replace(/[^a-z0-9\-_ ]/gi,'').trim().replace(/ +/g,'-')||'painting';
  }
  function download(name,ext,mime,text){
    const a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob([text],{type:mime}));
    a.download=safeName(name)+ext;
    a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),4000);
  }
  function downloadURL(name,ext,url){
    const a=document.createElement('a');
    a.href=url; a.download=safeName(name)+ext; a.click();
  }
  // headless-test and power-user hook: returns the serialized text
  window.__plExport=function(f){
    const name=(docs[activeDoc]&&docs[activeDoc].name)||'painting';
    if(f==='paint') return ta.value;
    if(f==='glsl') return serializeGLSL(name);
    const r=recordPainting();
    return f==='svg'?serializeSVG(r,name)
      :f==='html'?serializeHTML(r,name)
      :f==='p5'?serializeP5(r,name)
      :serializeLottie(r,name);
  };
  const xmodal=document.getElementById('exportModal');
  const xfmt=document.getElementById('exportFmt');
  const xnote=document.getElementById('exportNote');
  const xgo=document.getElementById('exportGo');
  function syncNote(){ xnote.textContent=NOTES[xfmt.value]||''; }
  xfmt.addEventListener('change',syncNote);
  document.getElementById('exportCodeBtn').addEventListener('click',()=>{
    if(typeof closeDrawer==='function') closeDrawer();
    xmodal.hidden=false; syncNote();
  });
  document.getElementById('exportClose').addEventListener('click',()=>{
    xmodal.hidden=true; });
  xmodal.addEventListener('click',e=>{ if(e.target===xmodal) xmodal.hidden=true; });
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&!xmodal.hidden) xmodal.hidden=true; });
  xgo.addEventListener('click',()=>{
    const f=xfmt.value, d=docs[activeDoc];
    const name=(d&&d.name)||'painting';
    xgo.disabled=true; xgo.textContent='Exporting...';
    setTimeout(()=>{
      try{
        if(f==='png') downloadURL(name,'.png',paintCanvas.toDataURL('image/png'));
        else if(f==='jpg') downloadURL(name,'.jpg',paintCanvas.toDataURL('image/jpeg',.95));
        else if(f==='paint') download(name,EXT[f],MIME[f],ta.value);
        else if(f==='glsl') download(name,EXT[f],MIME[f],serializeGLSL(name));
        else{
          const r=recordPainting();
          const text=f==='svg'?serializeSVG(r,name)
            :f==='html'?serializeHTML(r,name)
            :f==='p5'?serializeP5(r,name)
            :serializeLottie(r,name);
          download(name,EXT[f],MIME[f],text);
        }
        statusMsgEl.textContent='exported "'+name+'" as '+xfmt.selectedOptions[0].textContent;
        statusMsgEl.className='ok';
        if(typeof plMetric==='function') plMetric('export-'+f);
        xmodal.hidden=true;
      }catch(e){
        statusMsgEl.textContent='export failed: '+e.message;
        statusMsgEl.className='err';
      }
      xgo.disabled=false; xgo.textContent='Export';
    },30);
  });
})();
