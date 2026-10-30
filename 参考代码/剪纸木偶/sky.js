'use strict';
/* ===== sky: a sunless sky, light from below the horizon, aurora as layered tissue =====
   Drawn in WebGL into its own canvas, then copied into the picture as the backmost layer.
   Each set's sky(t,cam,shot) returns the uniforms (see sky() in shared.js). Falls back to a plain gradient without WebGL2. */
const SKY={cv:null,gl:null,u:{},ok:false};
const SKY_FS=`#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTA;      // aurora clock (integrated, so speeding up never jumps)
uniform float uT;       // song time
uniform float uStorm;   // 0..1: the sky stirs: curtains drop toward the horizon, brighten and pale
uniform float uHit;     // 0..1: a storm front: the low sky goes pale and the stars go out
uniform float uFlare;   // 0..1: a brief flare (put them on beats)
uniform float uPanY;    // camera tilt, in sky units
uniform float uPoster;  // 0 smooth .. 1 fully stepped tissue layers
uniform float uMotes;   // 0 white pinhole stars .. 1 tinted, drifting motes
uniform sampler2D uPaper;
out vec4 outColor;
float h21(vec2 p){p=fract(p*vec2(233.34,851.73));p+=dot(p,p+23.45);return fract(p.x*p.y);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float s=0.0,a=0.5;for(int i=0;i<5;i++){s+=a*vn(p);p=p*2.03+vec2(17.1,9.3);a*=0.5;}return s/0.96875;}
// one curtain. returns (intensity, height above its lower edge in units of its own height)
vec2 curtain(vec2 uv,float y0,float amp,float fq,float spd,float sd,float hgt,float rays,float t){
  float x=uv.x;
  float wob=(fbm(vec2(x*fq+sd,t*spd*0.30+sd*1.7))-0.5)*2.0;
  float base=y0+amp*wob+0.018*sin(x*2.3+t*spd*0.7+sd);
  float d=uv.y-base;
  float edge=smoothstep(-0.005,0.0015,d);
  float up=exp(-max(d,0.0)/hgt);
  float fold=fbm(vec2(x*2.2+sd*3.1,t*spd*0.45))*0.35;
  float ry=fbm(vec2((x+fold)*rays,d*1.1-t*spd*0.22+sd));
  float r=smoothstep(0.32,0.86,ry);
  float pch=smoothstep(0.22,0.78,fbm(vec2(x*0.9-t*spd*0.10+sd*5.0,sd)));
  return vec2(edge*up*(0.22+0.78*r)*(0.25+0.95*pch),clamp(d/hgt,0.0,3.0));
}
void main(){
  vec2 px=gl_FragCoord.xy;
  vec2 uv=vec2(px.x/uRes.y,px.y/uRes.y+uPanY);
  float S=uStorm,Hh=uHit,t=uTA;
  // ground colour of the sheet: deep blue overhead, teal grey toward the horizon
  vec3 top=vec3(0.010,0.024,0.048),mid=vec3(0.028,0.085,0.120),hor=vec3(0.16,0.33,0.35);
  float v=clamp((uv.y-0.44)/0.56,0.0,1.0);
  vec3 sky=mix(hor,mid,smoothstep(0.0,0.42,v));
  sky=mix(sky,top,smoothstep(0.32,1.0,v));
  // light from below the horizon, stronger and whiter as the curtains stir
  float gb=exp(-max(uv.y-0.47,0.0)/(0.06+0.03*S));
  sky+=vec3(0.22,0.46,0.42)*gb*(0.6+0.9*S+0.8*Hh)+vec3(0.45,0.62,0.58)*gb*gb*(0.35*S+0.9*Hh);
  // aurora: three curtains; uStorm drops them toward the horizon and brightens them
  vec2 c1=curtain(uv,mix(0.80,0.66,S),0.065,0.55,0.8,1.3,mix(0.09,0.12,S),7.0,t);
  vec2 c2=curtain(uv,mix(0.70,0.585,S),0.05,0.82,1.0,7.9,mix(0.065,0.095,S),11.0,t);
  vec2 c3=curtain(uv,mix(0.91,0.77,S),0.06,0.40,0.6,3.7,0.12,5.0,t);
  float A=c1.x+c2.x*0.85+c3.x*0.55;
  A*=(0.80+0.95*S+1.1*uFlare)*(1.0-0.62*Hh*smoothstep(0.55,0.85,uv.y));
  // stepped into a few layers of tissue, with a faint darker line where each layer's cut edge sits
  float lv=4.0,a=A*lv,fa=fract(a);
  float q=(floor(a)+smoothstep(0.5-0.10,0.5+0.10,fa))/lv;
  float Ap=mix(A,q,uPoster);
  float edgeLine=(1.0-smoothstep(0.0,0.045,abs(fa-0.5)))*step(0.5,a)*uPoster;
  float hf=(c1.y*c1.x+c2.y*c2.x*0.85+c3.y*c3.x*0.55)/(A+1e-4);
  vec3 green=vec3(0.33,0.98,0.64),teal=vec3(0.20,0.76,0.80),vio=vec3(0.52,0.40,0.92);
  vec3 ac=mix(green,teal,smoothstep(0.15,1.2,hf));
  ac=mix(ac,vio,smoothstep(1.2,2.6,hf)*0.32*(1.0-uFlare));
  ac=mix(ac,vec3(0.80,1.0,0.90),0.30*S+0.45*uFlare);
  vec3 col=sky+ac*Ap*0.82;
  col*=1.0-0.10*edgeLine;
  // pinholes: a few stars pricked through the sheet, gone once a storm covers them
  vec2 sc=uv*vec2(260.0,260.0);vec2 ci=floor(sc);float hs=h21(ci);
  if(hs>0.985&&uMotes<1.0){vec2 sp=ci+vec2(h21(ci+3.1),h21(ci+7.7))*0.8+0.1;float dd=length(sc-sp);float tw=0.6+0.4*sin(uT*2.0+hs*60.0);
    col+=vec3(0.75,0.88,0.9)*smoothstep(0.22,0.0,dd)*tw*smoothstep(0.62,0.9,uv.y)*(1.0-0.8*S)*(1.0-Hh)*(1.0-clamp(A*2.0,0.0,1.0))*(1.0-uMotes);}
  // or motes: points of light tinted in the aurora's colours (teal, green, violet, a little pale gold) in place of white
  // stars, drifting slowly, a few strung in short lines of four; as faint as the stars, and gone under a storm the same way
  if(uMotes>0.0){float vis=smoothstep(0.6,0.9,uv.y)*(1.0-0.8*S)*(1.0-Hh)*(1.0-clamp(A*2.0,0.0,1.0))*uMotes;
    vec2 ms=(uv+vec2(uT*0.0016,uT*0.0004))*240.0;vec2 mi=floor(ms);float mh=h21(mi);
    if(mh>0.982){vec2 mp=mi+vec2(h21(mi+3.1),h21(mi+7.7))*0.8+0.1;float md=length(ms-mp);float mt=0.75+0.25*sin(uT*1.3+mh*60.0);float hc=h21(mi+11.3);
      vec3 mc=hc<0.35?vec3(0.42,0.9,0.8):hc<0.62?vec3(0.5,0.95,0.58):hc<0.84?vec3(0.72,0.6,0.98):vec3(0.98,0.84,0.52);
      col+=mc*0.85*smoothstep(0.26,0.0,md)*mt*vis;}
    vec2 mg=(uv+vec2(uT*0.0012,uT*0.0003))*52.0;vec2 mcell=floor(mg);
    if(h21(mcell+5.5)>0.968){float an=h21(mcell+9.1)*6.2832;vec2 dv=vec2(cos(an),sin(an))*0.17;vec2 cc=mcell+0.5;float m=0.0;
      for(int k=0;k<4;k++){vec2 pk=cc+dv*(float(k)-1.5)+vec2(0.04*sin(float(k)*2.9+an),0.05*sin(float(k)*1.7));m=max(m,smoothstep(0.06,0.0,length(mg-pk))*(0.6+0.4*h21(mcell+float(k))));}
      float hl=h21(mcell+2.2);vec3 ml=hl<0.5?vec3(0.42,0.9,0.8):hl<0.8?vec3(0.72,0.6,0.98):vec3(0.98,0.84,0.52);col+=ml*0.7*m*vis;}}
  // the paper itself: mottling everywhere, fibres showing where the light is strongest
  float p=texture(uPaper,px/1024.0).r;
  col*=0.93+0.14*(p-0.5);
  col+=(ac*Ap*0.9+sky*0.25)*(p-0.5)*0.30;
  outColor=vec4(col,1.0);
}`;
function initSky(){
  const cv=mk(PW,PH),gl=cv.getContext('webgl2',{preserveDrawingBuffer:true,antialias:false,alpha:false,premultipliedAlpha:false});
  SKY.cv=cv;if(!gl){SKY.ok=false;return;}
  const sh=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;};
  const pr=gl.createProgram();gl.attachShader(pr,sh(gl.VERTEX_SHADER,'#version 300 es\nin vec2 p;void main(){gl_Position=vec4(p,0.0,1.0);}'));gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,SKY_FS));gl.linkProgram(pr);
  if(!gl.getProgramParameter(pr,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(pr));gl.useProgram(pr);
  const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
  const loc=gl.getAttribLocation(pr,'p');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
  const tx=gl.createTexture();gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,tx);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,PAPER);gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  for(const n of['uRes','uTA','uT','uStorm','uHit','uFlare','uPanY','uPoster','uMotes','uPaper'])SKY.u[n]=gl.getUniformLocation(pr,n);
  gl.uniform1i(SKY.u.uPaper,0);gl.uniform2f(SKY.u.uRes,PW,PH);gl.viewport(0,0,PW,PH);
  SKY.gl=gl;SKY.ok=true;}
function renderSky(st){
  if(!SKY.ok){const g=SKY.cv.getContext('2d');const gr=g.createLinearGradient(0,0,0,PH);gr.addColorStop(0,'#03070d');gr.addColorStop(.45,'#0a2230');gr.addColorStop(.62,'#2e5a5c');gr.addColorStop(1,'#3f6f6a');g.fillStyle=gr;g.fillRect(0,0,PW,PH);return SKY.cv;}
  const gl=SKY.gl,u=SKY.u;gl.uniform1f(u.uTA,st.ta);gl.uniform1f(u.uT,st.t);gl.uniform1f(u.uStorm,st.storm);gl.uniform1f(u.uHit,st.hit);gl.uniform1f(u.uFlare,st.flare);gl.uniform1f(u.uPanY,st.panY);gl.uniform1f(u.uPoster,st.poster);gl.uniform1f(u.uMotes,st.motes||0);
  gl.drawArrays(gl.TRIANGLES,0,3);return SKY.cv;}
