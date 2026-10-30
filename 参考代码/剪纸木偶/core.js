'use strict';
/* ===== core: frame, time range, math, noise, fonts, paper ===== */
const W=1920,H=1080,PW=1920,PH=960;                   // picture is PW x PH; the lyric band fills the rest
const DUR=SONG.duration,T_START=0,T_END=DUR;          // the whole song (SONG comes from lyrics_data.js)
const FPS=60;                                         // yari：渲染一律 60 帧（原版 24）
const clamp=(x,a,b)=>x<a?a:x>b?b:x;
const lerp=(a,b,t)=>a+(b-a)*t;
const sstep=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const easeOut=t=>{t=clamp(t,0,1);return 1-(1-t)*(1-t)*(1-t);};
const easeIn=t=>{t=clamp(t,0,1);return t*t*t;};
const easeInOut=t=>{t=clamp(t,0,1);return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;};
const easeSine=t=>.5-.5*Math.cos(Math.PI*clamp(t,0,1));
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function mk(w,h){const c=document.createElement('canvas');c.width=Math.max(1,Math.ceil(w));c.height=Math.max(1,Math.ceil(h));return c;}
const mix3=(a,b,t)=>[lerp(a[0],b[0],t),lerp(a[1],b[1],t),lerp(a[2],b[2],t)];
const rgb=(c,m=1)=>`rgb(${Math.round(clamp(c[0]*m,0,255))},${Math.round(clamp(c[1]*m,0,255))},${Math.round(clamp(c[2]*m,0,255))})`;
const rgba=(c,a)=>`rgba(${Math.round(clamp(c[0],0,255))},${Math.round(clamp(c[1],0,255))},${Math.round(clamp(c[2],0,255))},${clamp(a,0,1)})`;
/* keyframes: [[t,v],...], linear or eased between keys */
function kf(list,t,ease){if(t<=list[0][0])return list[0][1];for(let i=1;i<list.length;i++){if(t<list[i][0]){const a=list[i-1],b=list[i],u=(t-a[0])/(b[0]-a[0]);return lerp(a[1],b[1],ease?ease(u):u);}}return list[list.length-1][1];}

/* noise */
const PERM=new Uint16Array(512),VAL=new Float32Array(256);
(()=>{const r=mulberry32(4051),p=[];for(let i=0;i<256;i++)p.push(i);for(let i=255;i>0;i--){const j=(r()*(i+1))|0,t=p[i];p[i]=p[j];p[j]=t;}for(let i=0;i<512;i++)PERM[i]=p[i&255];for(let i=0;i<256;i++)VAL[i]=r()*2-1;})();
const fq=t=>t*t*t*(t*(t*6-15)+10);
function vn2(x,y){const xi=Math.floor(x),yi=Math.floor(y),u=fq(x-xi),v=fq(y-yi),X=xi&255,Y=yi&255,X1=(X+1)&255,Y1=(Y+1)&255;
  const a=VAL[PERM[PERM[X]+Y]],b=VAL[PERM[PERM[X1]+Y]],c=VAL[PERM[PERM[X]+Y1]],d=VAL[PERM[PERM[X1]+Y1]];return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v;}
function fbm2(x,y,o){let s=0,a=.5,f=1,n=0;for(let i=0;i<o;i++){s+=a*vn2(x*f,y*f);n+=a;a*=.5;f*=2.03;}return s/n;}
function hashi(x,y){let h=(Math.imul(x|0,374761393)+Math.imul(y|0,668265263))|0;h=Math.imul(h^(h>>>13),1274126177);h^=h>>>16;return(h>>>0)/4294967296;}
const rnd=(k,s)=>hashi(k,s*7919+13);

/* fonts: load the faces with the text they will draw, so the first frame doesn't fall back */
const F={fell:'"IM Fell English","Iowan Old Style","Palatino Linotype",Georgia,serif',ui:'"PT Sans","Helvetica Neue",Arial,sans-serif'};
async function fontsReady(){
  if(!document.fonts||!document.fonts.load)return;
  const words=SONG.lines.map(l=>l.text).join(' ');
  const jobs=[['46px "IM Fell English"',words],['italic 46px "IM Fell English"',SONG.title],['26px "PT Sans"',SONG.credit]];
  await Promise.race([Promise.all(jobs.map(([f,s])=>document.fonts.load(f,s).catch(()=>null))),new Promise(r=>setTimeout(r,6000))]);
}

/* paper: one grey texture (mottling, grain, fibres) that every cut piece, the sky and the band share */
let PAPER=null;
function makePaper(){const s=1024,c=mk(s,s),g=c.getContext('2d'),img=g.createImageData(s,s),d=img.data;
  // tileable: sample noise on a torus so the texture repeats with no visible join
  const R=s/(2*Math.PI),n4=(x,y,f)=>{const a=x/R,b=y/R;return vn2(Math.cos(a)*R*f+Math.sin(b)*R*f*.37,Math.sin(a)*R*f+Math.cos(b)*R*f*.61);};
  for(let y=0;y<s;y++)for(let x=0;x<s;x++){const cl=n4(x,y,.012)*.55+n4(x+31,y+17,.03)*.3+n4(x+7,y+91,.09)*.15,gr=hashi(x,y)-.5,v=clamp(.5+cl*.34+gr*.10,0,1)*255,i=(y*s+x)*4;d[i]=d[i+1]=d[i+2]=v;d[i+3]=255;}
  g.putImageData(img,0,0);const r=mulberry32(2718);g.lineCap='round';
  // fibres: short curved strands, light and dark; wrapped so they tile
  for(let k=0;k<2600;k++){const x=r()*s,y=r()*s,a=r()*6.283,l=6+r()*26,light=r()<.62;g.strokeStyle=light?`rgba(255,255,255,${.05+r()*.11})`:`rgba(0,0,0,${.04+r()*.07})`;g.lineWidth=.5+r()*.8;
    for(const ox of[-s,0,s])for(const oy of[-s,0,s]){const X=x+ox,Y=y+oy;if(X<-40||X>s+40||Y<-40||Y>s+40)continue;g.beginPath();g.moveTo(X,Y);g.quadraticCurveTo(X+Math.cos(a+.7)*l*.5,Y+Math.sin(a+.7)*l*.5,X+Math.cos(a)*l,Y+Math.sin(a)*l);g.stroke();}}
  return c;}
/* a paper tile tinted to one colour: colour x (1 + k*(texture-0.5)) */
const TINTS=new Map();
function tint(col,k=.35){const key=col.join(',')+'|'+k;if(TINTS.has(key))return TINTS.get(key);const s=512,c=mk(s,s),g=c.getContext('2d');g.drawImage(PAPER,0,0,1024,1024,0,0,s,s);  // the whole (tileable) texture, halved
  const img=g.getImageData(0,0,s,s),d=img.data;for(let i=0;i<d.length;i+=4){const m=1+k*(d[i]/255-.5)*2;d[i]=clamp(col[0]*m,0,255);d[i+1]=clamp(col[1]*m,0,255);d[i+2]=clamp(col[2]*m,0,255);d[i+3]=255;}
  g.putImageData(img,0,0);TINTS.set(key,c);return c;}
function tintPattern(g,col,k,scale=1){const p=g.createPattern(tint(col,k),'repeat');p.setTransform(new DOMMatrix().scale(scale*2));return p;}
