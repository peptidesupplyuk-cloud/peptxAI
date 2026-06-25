/* PeptX.AI — living marble/smoke background (vanilla WebGL, no deps, no assets).
   Dark brushed-metal + flowing blue/white ink-smoke matching the brand imagery.
   Degrades to the page's CSS gradient if WebGL is unavailable; honours reduced-motion;
   pauses off-tab; survives context loss. Attach to <canvas id="fxbg">. */
(function(){
  var canvas = document.getElementById('fxbg');
  if(!canvas) return;
  var gl = canvas.getContext('webgl',{antialias:false,alpha:false,depth:false,stencil:false,powerPreference:'low-power'})
        || canvas.getContext('experimental-webgl');
  if(!gl){ canvas.style.display='none'; return; } // CSS fallback shows through

  var VERT = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.0,1.0);}';
  var FRAG = [
  'precision highp float;',
  'uniform float u_time; uniform vec2 u_res;',
  'float hash(vec2 p){p=fract(p*vec2(123.34,345.45));p+=dot(p,p+34.345);return fract(p.x*p.y);}',
  'float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);',
  ' float a=hash(i),b=hash(i+vec2(1.0,0.0)),c=hash(i+vec2(0.0,1.0)),d=hash(i+vec2(1.0,1.0));',
  ' return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);}',
  'float fbm(vec2 p){float v=0.0,a=0.5;mat2 m=mat2(1.6,1.2,-1.2,1.6);',
  ' for(int i=0;i<6;i++){v+=a*vnoise(p);p=m*p+0.02;a*=0.5;}return v;}',
  'void main(){',
  ' vec2 uv=gl_FragCoord.xy/u_res.xy;',
  ' vec2 p=(gl_FragCoord.xy*2.0-u_res.xy)/u_res.y;',
  ' float t=u_time*0.025;',
  // advect the noise field like drifting smoke (two-level domain warp)
  ' vec2 pp=p*1.12;',
  ' vec2 q=vec2(fbm(pp+vec2(0.0,0.28*t)),fbm(pp+vec2(3.1,-0.20*t)+5.0));',
  ' vec2 r=vec2(fbm(pp+1.8*q+vec2(1.7,9.2)+0.16*t),fbm(pp+1.8*q+vec2(8.3,2.8)-0.13*t));',
  ' float f=fbm(pp+2.2*r);',
  // soft body + sharp ink filaments
  // corner weight keeps the vertical centre dark while smoke gathers in the corners
  ' float corner=smoothstep(0.22,1.30,length(p*vec2(0.82,0.62)));',
  ' float haze=smoothstep(0.34,1.0,f);',
  ' float veins=pow(1.0-abs(f*2.0-1.0),3.2);',
  ' veins*=smoothstep(0.28,0.70,length(r));',
  ' float smoke=corner*(0.07+1.02*haze)+veins*corner*1.05;',
  ' smoke=clamp(smoke,0.0,1.5);',
  // ---- dark brushed-metal base ----
  ' vec3 base=vec3(0.011,0.015,0.024);',
  ' float colm=pow(max(0.0,1.0-abs(uv.x-0.5)*1.55),3.0)*pow(uv.y,2.4);',
  ' base+=colm*vec3(0.55,0.60,0.72)*0.72;',
  ' base+=smoothstep(0.6,1.0,uv.y)*0.018*vec3(0.6,0.7,0.92);',
  ' base+=(vnoise(vec2(uv.x*u_res.x*0.5,uv.y*3.0))-0.5)*0.011;',
  // ---- smoke colour ramp: navy -> blue -> cyan-white ----
  ' vec3 cA=vec3(0.03,0.09,0.42);',
  ' vec3 cB=vec3(0.12,0.42,0.92);',
  ' vec3 cC=vec3(0.82,0.90,1.0);',
  ' float tone=clamp(f*0.6+r.x*0.5+0.08,0.0,1.0);',
  ' vec3 smk=mix(cA,cB,smoothstep(0.2,0.72,tone));',
  ' smk=mix(smk,cC,smoothstep(0.48,1.0,haze*0.45+veins));',
  ' vec3 col=base+smk*smoke*0.55;',
  // faint blue light arc lower-right (brand accent streak)
  ' float arc=smoothstep(0.05,0.0,abs(length(p-vec2(0.5,-1.2))-1.3));',
  ' col+=arc*vec3(0.10,0.34,0.9)*0.45;',
  // vignette + gentle lift
  ' col*=1.0-0.40*dot(p*0.5,p*0.5);',
  ' col=clamp(col,0.0,1.0);',
  ' col=pow(col,vec3(0.90));',
  ' gl_FragColor=vec4(col,1.0);',
  '}'].join('\n');

  function sh(type,src){var s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);
    if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){console.warn('fxbg',gl.getShaderInfoLog(s));return null;}return s;}
  var prog, uTime, uRes, buf, running=false, raf=0, t0=Date.now();
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function build(){
    var vs=sh(gl.VERTEX_SHADER,VERT), fs=sh(gl.FRAGMENT_SHADER,FRAG);
    if(!vs||!fs){canvas.style.display='none';return false;}
    prog=gl.createProgram();gl.attachShader(prog,vs);gl.attachShader(prog,fs);gl.linkProgram(prog);
    if(!gl.getProgramParameter(prog,gl.LINK_STATUS)){canvas.style.display='none';return false;}
    gl.useProgram(prog);
    buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
    var loc=gl.getAttribLocation(prog,'a');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
    uTime=gl.getUniformLocation(prog,'u_time');uRes=gl.getUniformLocation(prog,'u_res');
    return true;
  }
  function resize(){
    var dpr=Math.min(window.devicePixelRatio||1,1.5), scale=0.6;
    var w=Math.max(1,Math.round(canvas.clientWidth*dpr*scale)), h=Math.max(1,Math.round(canvas.clientHeight*dpr*scale));
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);}
  }
  function frame(){
    resize();
    gl.uniform1f(uTime,(Date.now()-t0)/1000);
    gl.uniform2f(uRes,canvas.width,canvas.height);
    gl.drawArrays(gl.TRIANGLES,0,3);
    if(running) raf=requestAnimationFrame(frame);
  }
  function start(){ if(running||reduce) return; running=true; raf=requestAnimationFrame(frame); }
  function stop(){ running=false; if(raf)cancelAnimationFrame(raf); raf=0; }

  if(!build()) return;
  resize(); gl.uniform1f(uTime, reduce?14.0:0.0); gl.uniform2f(uRes,canvas.width,canvas.height); gl.drawArrays(gl.TRIANGLES,0,3);
  if(!reduce) start();

  document.addEventListener('visibilitychange',function(){ document.hidden?stop():start(); });
  window.addEventListener('resize',function(){ if(!running) frame(); });
  canvas.addEventListener('webglcontextlost',function(e){e.preventDefault();stop();},false);
  canvas.addEventListener('webglcontextrestored',function(){ if(build()){ resize(); start(); } },false);
})();
