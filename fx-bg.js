/* PeptX.AI — living marble/smoke background (vanilla WebGL, no deps, no assets).
   Renders dark brushed-metal + flowing blue/white smoke matching the brand imagery.
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
  'float fbm(vec2 p){float v=0.0,a=0.55;mat2 m=mat2(1.6,1.2,-1.2,1.6);',
  ' for(int i=0;i<5;i++){v+=a*vnoise(p);p=m*p;a*=0.5;}return v;}',
  'void main(){',
  ' vec2 uv=gl_FragCoord.xy/u_res.xy;',
  ' vec2 p=(gl_FragCoord.xy*2.0-u_res.xy)/u_res.y;',
  ' float t=u_time*0.035;',
  ' vec2 q=vec2(fbm(p*1.1+vec2(0.0,t)),fbm(p*1.1+vec2(4.3,-t)));',
  ' vec2 r=vec2(fbm(p*1.25+1.7*q+vec2(1.7,9.2)+0.6*t),fbm(p*1.25+1.7*q+vec2(8.3,2.8)-0.5*t));',
  ' float f=fbm(p*1.2+2.0*r);',
  ' float edge=smoothstep(0.12,1.25,length(p*vec2(0.92,0.80)));',
  ' float smoke=smoothstep(0.40,1.0,f)*edge;',
  ' vec3 base=vec3(0.016,0.022,0.034);',
  ' float spot=pow(max(0.0,1.0-abs(uv.x-0.5)*1.7),3.0)*pow(uv.y,2.2);',
  ' base+=spot*vec3(0.55,0.60,0.70)*0.60;',
  ' base+=(vnoise(vec2(uv.x*2.0,uv.y*u_res.y*0.30))-0.5)*0.010;',
  ' vec3 c1=vec3(0.05,0.16,0.66);',
  ' vec3 c2=vec3(0.16,0.60,0.96);',
  ' vec3 c3=vec3(0.86,0.94,1.0);',
  ' vec3 smk=mix(c1,c2,smoothstep(0.30,0.82,r.x+0.5));',
  ' smk=mix(smk,c3,smoothstep(0.74,1.0,f));',
  ' vec3 col=base+smk*smoke*0.46;',
  ' col*=1.0-0.40*dot(p*0.52,p*0.52);',
  ' col=clamp(col,0.0,1.0);',
  ' col=pow(col,vec3(0.92));',
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
    var dpr=Math.min(window.devicePixelRatio||1,1.5), scale=0.60; // render below CSS res; smoke is soft
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
  // initial paint (also the static frame for reduced-motion)
  resize(); gl.uniform1f(uTime, reduce?12.0:0.0); gl.uniform2f(uRes,canvas.width,canvas.height); gl.drawArrays(gl.TRIANGLES,0,3);
  if(!reduce) start();

  document.addEventListener('visibilitychange',function(){ document.hidden?stop():start(); });
  window.addEventListener('resize',function(){ if(!running) frame(); });
  canvas.addEventListener('webglcontextlost',function(e){e.preventDefault();stop();},false);
  canvas.addEventListener('webglcontextrestored',function(){ if(build()){ resize(); start(); } },false);
})();
