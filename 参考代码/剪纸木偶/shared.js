'use strict';
/* ===== shared: palette, trees, storm billows, snow, wind, helpers for figures, the aurora clock ===== */
/* colours. The layer tones run from far and pale (peaks) to near and dark (fg): nearer paper blocks more of the light behind */
const PAL={
  peaks:[70,108,116],islet:[80,118,126],island:[60,98,108],cliff:[52,88,99],ridge:[40,70,82],slopes:[29,50,62],rowA:[22,39,50],rowB:[17,31,41],near:[11,21,28],fg:[6,12,17],
  rim:[196,236,226],fog:[118,170,164],warm:[255,196,118],fruit:[82,30,27],fruitHi:[150,70,52],cut:[150,128,98],leafDry:[128,84,50]};

/* ---------- trees ----------
   genTree(seed,o): a branching tree as data. o: {x,y (base), h (height), tw (trunk width), spread (radians), n (main limbs),
   leaf (leaf size, 0 = bare), dens (leaves per cluster), fruitP, fr (fruit size), cutP (pruned stubs), low:[x,y] (one low limb)}.
   Returns {segs, leaves, fruit, cuts, bb}; drawTreeShape() cuts it out, drawTreeColour() adds the coloured bits, bakeTree() bakes it. */
function genTree(seed,o){const r=mulberry32(seed),segs=[],leaves=[],fruit=[],cuts=[];
  const lean=(r()-.5)*.08,cr=[o.x+Math.sin(lean)*o.h*.28,o.y-o.h*.28];segs.push([o.x,o.y,cr[0],cr[1],o.tw,o.tw*.8]);
  segs.push([o.x-o.tw*.9,o.y+2,o.x-o.tw*.2,o.y-o.tw*.9,o.tw*.5,o.tw*.3],[o.x+o.tw*.9,o.y+2,o.x+o.tw*.2,o.y-o.tw*.9,o.tw*.5,o.tw*.3]);
  const cluster=(x,y,k)=>{const n=Math.round((4+r()*6)*k*o.dens);for(let j=0;j<n;j++){const a=r()*6.283,rr=o.leaf*(.25+r()*1.25)*Math.sqrt(k);leaves.push([x+Math.cos(a)*rr,y+Math.sin(a)*rr*.8,r()*6.283,o.leaf*(.7+r()*.6)]);}
    if(r()<o.fruitP*k){const a=r()*6.283;fruit.push([x+Math.cos(a)*o.leaf*.5,y+o.leaf*.35+r()*o.leaf*.6,o.fr*(.85+r()*.3)]);}};
  const grow=(x,y,a,len,w,dep)=>{let px=x,py=y,ang=a;const st=dep===0?4:3;
    for(let k=0;k<st;k++){const L=len/st*(.85+r()*.3);ang+=(r()-.5)*.35-ang*(dep===0?.10:.05);const nx=px+Math.sin(ang)*L,ny=py-Math.cos(ang)*L,w0=w*(1-k/st*.55),w1=w*(1-(k+1)/st*.55);
      segs.push([px,py,nx,ny,w0,w1]);
      if(dep<2&&r()<(dep===0?.85:.5)){const sd=r()<.5?-1:1;grow(nx,ny,ang+sd*(.45+r()*.55),len*(.40+r()*.22),w1*.72,dep+1);}
      if(dep>=1||k>=st-2)cluster(nx,ny,.55+dep*.35);px=nx;py=ny;}
    if(dep===1&&r()<o.cutP)cuts.push([px,py,ang,w*.62]);else cluster(px,py,1.3);};
  const n=o.n||4;for(let i=0;i<n;i++){const a=lerp(-o.spread,o.spread,(i+.5)/n)+(r()-.5)*.3;grow(cr[0],cr[1],a,o.h*(.44+r()*.12),o.tw*.64,0);}
  if(o.low){const L=o.low;segs.push([cr[0],cr[1]+18,L[0],L[1],o.tw*.42,o.tw*.14]);cluster(L[0],L[1]-6,.8);}
  let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;const ext=(x,y,m)=>{x0=Math.min(x0,x-m);y0=Math.min(y0,y-m);x1=Math.max(x1,x+m);y1=Math.max(y1,y+m);};
  segs.forEach(s=>{ext(s[0],s[1],s[4]);ext(s[2],s[3],s[5]);});leaves.forEach(l=>ext(l[0],l[1],l[3]));fruit.forEach(f=>ext(f[0],f[1]+f[2],f[2]+4));
  return{segs,leaves,fruit,cuts,x:o.x,y:o.y,bb:{x:x0,y:y0,w:x1-x0,h:y1-y0}};}
/* a poplar: a tall straight trunk and many short branches angled up along it, longest a little below the middle, so the
   tree is a narrow flame. o: {x,y,h,tw (trunk width),w (widest branch as a share of h)}. Same shape as genTree's result */
function genPoplar(seed,o){const r=mulberry32(seed),segs=[],{x,y,h,tw}=o;segs.push([x,y,x+(r()-.5)*4,y-h*.97,tw,tw*.16]);
  for(let yy=y-h*.1;yy>y-h*.95;yy-=h*(.011+r()*.009)){const u=(y-yy)/h,prof=Math.pow(Math.sin(Math.PI*clamp((u-.04)/.98,0,1)),.7),L=h*(o.w??.11)*(.3+.7*prof)*(.7+r()*.5),sd=r()<.5?-1:1,a=sd*(.22+r()*.28),
    x1=x+Math.sin(a)*L,y1=yy-Math.cos(a)*L;segs.push([x,yy,x1,y1,Math.max(1.6,tw*.36*(1-u*.7)),1.1]);
    if(r()<.45){const a2=a+sd*(.2+r()*.25),L2=L*.45,mx=lerp(x,x1,.6),my=lerp(yy,y1,.6);segs.push([mx,my,mx+Math.sin(a2)*L2,my-Math.cos(a2)*L2,1.3,.7]);}}
  segs.push([x-tw*.9,y+2,x-tw*.2,y-tw*.9,tw*.5,tw*.3],[x+tw*.9,y+2,x+tw*.2,y-tw*.9,tw*.5,tw*.3]);
  let x0=1e9,y0=1e9,x2=-1e9,y2=-1e9;for(const s of segs){x0=Math.min(x0,s[0]-s[4],s[2]-s[5]);x2=Math.max(x2,s[0]+s[4],s[2]+s[5]);y0=Math.min(y0,s[1]-s[4],s[3]-s[5]);y2=Math.max(y2,s[1]+s[4],s[3]+s[5]);}
  return{segs,leaves:[],fruit:[],cuts:[],x,y,bb:{x:x0,y:y0,w:x2-x0,h:y2-y0}};}
function drawTreeShape(g,T,noLeaves){for(const s of T.segs)taper(g,s[0],s[1],s[2],s[3],s[4],s[5]);if(!noLeaves)for(const l of T.leaves)leaf(g,l[0],l[1],l[2],l[3]);
  g.lineWidth=1.4;g.strokeStyle='#000';for(const f of T.fruit){g.beginPath();g.moveTo(f[0],f[1]-f[2]*.8);g.lineTo(f[0]+1,f[1]-f[2]*1.9);g.stroke();}}
function drawTreeColour(g,T,k=1){
  for(const f of T.fruit){g.fillStyle=rgb(PAL.fruit);g.beginPath();g.arc(f[0],f[1],f[2],0,Math.PI*2);g.fill();g.strokeStyle=rgba(PAL.fruitHi,.75);g.lineWidth=f[2]*.28;g.beginPath();g.arc(f[0],f[1],f[2]*.78,-2.6,-1.1);g.stroke();}
  for(const c of T.cuts){g.fillStyle=rgb(PAL.cut);g.beginPath();g.ellipse(c[0],c[1],c[3]*.55,c[3]*.22,Math.PI/2-c[2]+Math.PI/2,0,Math.PI*2);g.fill();}}
function bakeTree(T,col,s,extra,noLeaves){return bakePiece({x:T.bb.x,y:T.bb.y,w:T.bb.w,h:T.bb.h,s,color:col,tex:.4,rimA:.42,rimW:1.6,shadow:{blur:9,a:.45,dy:6},
  shape:g=>{drawTreeShape(g,T,noLeaves);if(extra)extra(g);},after:g=>drawTreeColour(g,T)});}

/* ---------- helpers for figures ---------- */
const ramp=(tw,v,tau)=>v*(tw-tau*(1-Math.exp(-tw/tau)));                 // distance after tw s, easing up to speed v over tau
const on=(a,b,t,f=.25)=>sstep(a,a+f,t)*(1-sstep(b,b+f,t));                // 0 before a, 1 from a to b, 0 after, with f-second ramps
/* how many seconds on(a,b,t,f) has been on by time t (its exact integral): subtract it from elapsed time and a walker
   slows into a stop and picks up again smoothly, instead of halting in one frame */
const onInt=(a,b,t,f=.25)=>{const S=u=>u*u*u-u*u*u*u/2,U=clamp((t-a)/f,0,1),V=clamp((t-b)/f,0,1);return f*S(U)+clamp(t-a-f,0,Math.max(0,b-a-f))+f*(V-S(V));};
const walkX=(x0,x1,t0,t1,t)=>{const u=clamp((t-t0)/(t1-t0),0,1);return lerp(x0,x1,easeSine(u)*.2+u*.8);};   // walk from x0 to x1, easing in and out a little
/* angles for an arm (side 0 far, 1 near) so the hand reaches point T: two-bone IK from the shoulder */
function armTo(B,q,T,side,bend){const S=pfk(B,{...q,arms:[{s:0,e:0},{s:0,e:0}]}).S,r=ik2(S,T,B.ua,B.fa,q.face,bend);return{s:r.a1,e:r.rel};}
/* the same for a figure drawn scaled by sc about its feet at ground Y: T is a point in layer coordinates (a rope, a rail) */
function reachArm(B,q,Y,sc,T,bend=1){const qq={...q,arms:[{s:0,e:0},{s:0,e:0}]};qq.y=Y-footLow(B,{...qq,y:0});return armTo(B,qq,[q.x+(T[0]-q.x)/sc,Y+(T[1]-Y)/sc],1,bend);}

/* blend two leg (or arm) sets, k 0..1 */
const mixLimbs=(a,b,k)=>a.map((l,i)=>{const m=b[i],o={};for(const key in l)o[key]=lerp(l[key],m[key]??l[key],k);return o;});
/* a scarf streaming downwind (to the right) from the neck, cut in the same silhouette: use it as a pose's after(g,j) */
function scarf(g,j,t,w,len=78){const W=clamp(w,0,1.5),n=7,sg=len/n;let x=j.N[0]+2,y=j.N[1]+6,a=.95*(1-Math.min(1,W))+.12;
  for(let i=0;i<n;i++){const th=a+(.22+.3*W)*Math.sin(t*(7+4*W)-i*.9)*(i/n),nx=x+Math.cos(th)*sg,ny=y+Math.sin(th)*sg;taper(g,x,y,nx,ny,lerp(10,4,i/n),lerp(10,4,(i+1)/n));x=nx;y=ny;a+=.04;}}
/* work done on the beat (digging, hammering, rowing): the phase 0..1 of the stroke round the nearest of `beats`, each stroke `dur`
   seconds long with its landing (the throw, the blow) `at` of the way through, so the landing falls on the beat; -1 between strokes */
function strokePhase(t,beats,dur=.62,at=.6){for(const b of beats){const u=(t-(b-at*dur))/dur;if(u>=0&&u<1)return u;}return -1;}
/* a pose eased between keyed poses: keys [[u, {lean, look, arms, legs, ...}], ...] in order of u (0..1); numbers, and numbers
   inside arrays and objects, ease to the next key's. u<0 gives the first key */
const blendV=(a,b,k)=>Array.isArray(a)?a.map((x,i)=>blendV(x,b?b[i]:x,k)):typeof a==='number'?lerp(a,b??a,k):a&&typeof a==='object'?Object.fromEntries(Object.keys(a).map(key=>[key,blendV(a[key],b?b[key]:a[key],k)])):a;
function keyPose(u,keys){if(u<0)return keys[0][1];let i=1;while(i<keys.length-1&&u>keys[i][0])i++;const[u0,a]=keys[i-1],[u1,b]=keys[i];return blendV(a,b,easeSine((u-u0)/Math.max(1e-6,u1-u0)));}
/* digging with a wide shovel. The near hand holds the shaft, which points along `tool` (an angle like the arms': 0 down, PI/2
   the way the figure faces), and the far hand reaches the handle's end by IK. The keys: rest, scoop (the blade into the snow
   ahead), toss (the snow leaves the blade at u .6, flicked forward at shoulder height: a shovel raised over the head reads as
   an axe or a hammer), rest */
const DIG_KEYS=[[0,{lean:.25,near:{s:.75,e:.25},tool:.8}],[.35,{lean:.5,near:{s:.5,e:.2},tool:.6}],[.6,{lean:.08,near:{s:1.4,e:.2},tool:2.25}],[1,{lean:.25,near:{s:.75,e:.25},tool:.8}]];
/* the pose q (with its legs) at phase u of a stroke (strokePhase): sets lean, arms and tool */
function digPose(B,q,u){const P=keyPose(u,DIG_KEYS),o={...q,lean:P.lean,tool:P.tool},j=pfk(B,{...o,arms:[P.near,P.near]}),h=j.arms[1].Hd,d=pdir(P.tool,q.face);
  o.arms=[armTo(B,o,[h[0]-d[0]*44,h[1]-d[1]*44],0,-1),P.near];return o;}
/* the shovel in those hands, cut in the figure's silhouette (draw it in the pose's after): the shaft through the near hand, the
   blade beyond it. shovelLoad puts a lump of snow on the blade (draw it in the snow's colour after the figure, from the scoop
   to the toss) */
function shovelEnds(j,q){const h=j.arms[1].Hd,d=pdir(q.tool,q.face);return{h,d,n:[-d[1],d[0]],c:[h[0]+d[0]*60,h[1]+d[1]*60]};}
function shovel(g,j,q){const{h,d,n,c}=shovelEnds(j,q);g.lineWidth=5.5;g.lineCap='round';g.beginPath();g.moveTo(h[0]-d[0]*52,h[1]-d[1]*52);g.lineTo(h[0]+d[0]*44,h[1]+d[1]*44);g.stroke();
  polyFill(g,[[c[0]-d[0]*17-n[0]*17,c[1]-d[1]*17-n[1]*17],[c[0]+d[0]*17-n[0]*19,c[1]+d[1]*17-n[1]*19],[c[0]+d[0]*17+n[0]*19,c[1]+d[1]*17+n[1]*19],[c[0]-d[0]*17+n[0]*17,c[1]-d[1]*17+n[1]*17]]);}
function shovelLoad(g,j,q){const{c}=shovelEnds(j,q);ellipseFill(g,c[0],c[1]-10,20,11);ellipseFill(g,c[0]+6,c[1]-18,11,8);}

/* ---------- storm: banks of overlapping paper billows ----------
   each billow is a disc with its own lit top edge; later discs cover earlier edges, so only the outer
   scallops and a few inner creases show. rise[k] 0..1 lifts bank k from `base` to its top. */
const BANKS=[{top:170,r:[70,150],dx:[70,120],col:[176,214,208],edge:[236,255,246],seed:1},{top:250,r:[55,120],dx:[60,100],col:[136,176,176],edge:[218,248,238],seed:2},{top:330,r:[45,95],dx:[50,85],col:[98,134,140],edge:[196,234,224],seed:3}];
function makeBillows(seed,x0=-340,x1=2260,scale=1){return BANKS.map(b=>{const r=mulberry32(900+b.seed+seed*31),out=[];for(let x=x0;x<x1;x+=lerp(b.dx[0],b.dx[1],r())*scale){out.push({x,r:lerp(b.r[0],b.r[1],r())*scale,dy:(r()-.5)*.5,ph:r()*6.28,sp:.5+r()*.6,dr:(r()-.5)*24});}out.sort((a,c)=>a.dy-c.dy);return out;});}
function drawBillowBanks(g,t,rise,billows,base=560,tops=null,drift=10){for(let k=0;k<3;k++){const b=BANKS[k];if(rise[k]<=0)continue;const topY=lerp(base,tops?tops[k]:b.top,rise[k]);
  const pat=g.createPattern(tint(b.col,.22),'repeat');pat.setTransform(new DOMMatrix().translate(-t*40*(k+1),-t*90));const edge=rgba(b.edge,.95);
  g.save();g.fillStyle=pat;g.fillRect(-600,topY+b.r[1]*.9,3200,1400);
  for(const c of billows[k]){const rr=c.r*(1+.09*Math.sin(t*c.sp+c.ph)),cx=c.x+c.dr*Math.sin(t*.4+c.ph)+t*drift*(k+1),cy=topY+rr*(.95+c.dy)+18*Math.sin(t*.7*c.sp+c.ph);
    g.fillStyle=pat;g.beginPath();g.arc(cx,cy,rr,0,Math.PI*2);g.fill();
    const sh=g.createRadialGradient(cx,cy-rr*.35,rr*.2,cx,cy+rr*.2,rr*1.05);sh.addColorStop(0,'rgba(0,0,0,0)');sh.addColorStop(1,rgba([20,50,56],.28));g.fillStyle=sh;g.beginPath();g.arc(cx,cy,rr,0,Math.PI*2);g.fill();
    g.strokeStyle=rgba(b.edge,.18);g.lineWidth=9;g.beginPath();g.arc(cx,cy,rr-3,Math.PI*1.08,Math.PI*1.92);g.stroke();
    g.strokeStyle=edge;g.lineWidth=2.2;g.beginPath();g.arc(cx,cy,rr,Math.PI*1.06,Math.PI*1.94);g.stroke();}
  g.restore();}}
/* a storm pouring over a ridge: a lobed curtain hanging from the ridge line yR(x), k 0..1 how far it has come down */
function drawSpillCurtain(g,t,k,yR,x0=-400,x1=2400){if(k<=0)return;const b=BANKS[0],L=150,sh=40*Math.sin(t*.3);
  const bottom=x=>{const u=(x+sh)/L,i=Math.floor(u),fr=u-i,lobe=Math.sqrt(Math.max(0,Math.sin(Math.PI*fr))),n=.5+.5*vn2(i*3.1,1.7);return yR(x)+k*(26+(55+80*n)*lobe);};
  const pat=g.createPattern(tint(b.col,.22),'repeat');pat.setTransform(new DOMMatrix().translate(-t*40,-t*90));
  const path=new Path2D();path.moveTo(x0,yR(x0)-16);for(let x=x0;x<=x1;x+=10)path.lineTo(x,yR(x)-16);for(let x=x1;x>=x0;x-=4)path.lineTo(x,bottom(x));path.closePath();
  g.save();g.globalAlpha=Math.min(1,k*3);g.fillStyle=pat;g.fill(path);
  const gr=g.createLinearGradient(0,420,0,640);gr.addColorStop(0,'rgba(0,0,0,0)');gr.addColorStop(1,rgba([20,50,56],.22));g.fillStyle=gr;g.fill(path);
  g.strokeStyle=rgba(b.edge,.6);g.lineWidth=2;g.beginPath();for(let x=x0;x<=x1;x+=4){const y=bottom(x);x===x0?g.moveTo(x,y):g.lineTo(x,y);}g.stroke();g.restore();}
/* lightning going up: violet-white bolts rising from a ridge into the storm for half a second after a hit at t0, cut as jagged
   slits of light with a branch or two. list: [[x, yBase, height], ...] in the layer's coordinates (draw it in the storm's step) */
function boltsUp(g,t,t0,list,seed){const age=t-t0;if(age<0||age>.55)return;const env=Math.exp(-age/.18)*(.55+.45*(Math.sin(age*70)>-.2?1:0));
  g.save();g.globalCompositeOperation='lighter';g.lineCap='round';g.lineJoin='round';
  list.forEach(([x0,y0,H],b)=>{const r=mulberry32(seed+b*17),pts=[[x0,y0]];let x=x0;for(let i=1;i<=11;i++){x+=(r()-.5)*26;pts.push([x,y0-H*i/11]);}
    const br=[];for(let k=0;k<2;k++){const i=3+((r()*6)|0),p=pts[i],sd=r()<.5?-1:1;br.push([p,[p[0]+sd*(24+r()*30),p[1]-30-r()*40],[p[0]+sd*(40+r()*40),p[1]-60-r()*50]]);}
    for(const[w,c,a]of[[9,[150,120,255],.22],[4,[200,180,255],.55],[1.6,[244,238,255],.95]]){g.strokeStyle=rgba(c,a*env);g.lineWidth=w;g.beginPath();pts.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));for(const L of br){g.moveTo(L[0][0],L[0][1]);g.lineTo(L[1][0],L[1][1]);g.lineTo(L[2][0],L[2][1]);}g.stroke();}
    glow(g,x0,y0,60,[180,160,255],.3*env);});
  g.restore();}

/* ---------- snow: paper dots. groups: [count, key, [rmin,rmax], vx, vy, t0, t1, lazy] ----------
   Each flake starts at a random time between t0 and t1 (use -5,-5 for snow that is already falling); lazy flakes don't streak.
   key names a depth layer, so one field can be drawn in several steps ('far', 'mid', 'near'). */
let FLAKE=null;function buildFlake(){const c=mk(64,64),g=c.getContext('2d'),gr=g.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,'rgba(238,249,246,1)');gr.addColorStop(.42,'rgba(238,249,246,.95)');gr.addColorStop(.62,'rgba(238,249,246,.35)');gr.addColorStop(1,'rgba(238,249,246,0)');g.fillStyle=gr;g.fillRect(0,0,64,64);FLAKE=c;}
function makeFlakes(seed,groups){const out=[],r=mulberry32(seed);for(const[n,key,rad,vx,vy,t0,t1,lazy]of groups)for(let i=0;i<n;i++)out.push({key,x:r()*2400-240,y:r()*1100-100,r:rad[0]+r()*(rad[1]-rad[0]),vx:vx*(.7+r()*.6),vy:vy*(.75+r()*.5),ts:lerp(t0,t1,Math.pow(r(),lazy?1:1.6)),te:1e9,ph:r()*6.3,lz:!!lazy});return out;}
/* soft=true draws the blurred sprite (for the nearest layer); windX adds a steady sideways speed; fade(t,f) scales alpha;
   wd={d,v} carries the flakes d px sideways with the wind at v px/s now (from windClock), so gusts push them without a jump */
function drawFlakes(g,t,flakes,key,soft,windX=0,fade=null,wd=null){const wdd=wd?wd.d:0,wdv=wd?wd.v:0;for(const f of flakes){if(f.key!==key||t<f.ts)continue;const age=t-f.ts,a=sstep(0,.25,age)*(fade?fade(t,f):1);if(a<=0)continue;
    const vx=f.vx+windX,vy=f.vy,spanX=2500,spanY=1150;let x=f.x+vx*age+wdd*(f.r*.12+.7)+Math.sin(age*1.7+f.ph)*14,y=f.y+vy*age+Math.cos(age*1.3+f.ph)*6;
    x=((x+260)%spanX+spanX)%spanX-260;y=((y+120)%spanY+spanY)%spanY-120;const ux=vx+wdv,sp=Math.hypot(ux,vy),st=f.lz?0:Math.min(sp/24*.5,f.r*4);
    if(soft){const R=f.r*1.9;g.save();g.globalAlpha=.85*a;g.translate(x,y);g.rotate(Math.atan2(vy,ux));g.scale(1+st/(f.r*2),1);g.drawImage(FLAKE,-R,-R,2*R,2*R);g.restore();continue;}
    g.fillStyle=rgba([236,248,244],.92*a);g.beginPath();g.ellipse(x,y,f.r+st*.5,f.r,Math.atan2(vy,ux),0,Math.PI*2);g.fill();}}
/* blowing snow at one depth: strips of torn pale paper flying past. pos is how far the air has gone (a clock, e.g. windClk(t)*700).
   o: {y0,y1 (the band they fly in), w,h (largest size), tilt}. Keep them low over a ground line for snow skimming along it */
function windStreaks(g,pos,a,seed,n=22,col=[232,244,244],o={}){if(a<=0)return;const r=mulberry32(seed*17),y0=o.y0??-100,y1=o.y1??1100,mw=o.w??1000,mh=o.h??32;g.save();g.globalAlpha=Math.min(1,a);g.fillStyle=tintPattern(g,col,.2);
  for(let i=0;i<n;i++){const y=y0+r()*(y1-y0),w=mw*(.3+r()*.7),h=mh*(.2+r()*.8),ph=r()*3000,x=((ph+pos*(1+r()))%3400+3400)%3400-900;g.beginPath();g.ellipse(x,y+Math.sin(pos*.005+i)*h*.4,w/2,h/2,o.tilt??.08,0,Math.PI*2);g.fill();}g.restore();}
/* snow blown off the tops of things in a gust: soft streamers leaving each point [x,y] downwind. k 0..1 how hard it blows */
function spindrift(g,pts,t,k,seed,len=170){if(k<=.02)return;const r=mulberry32(seed);g.save();
  for(const p of pts){if(r()<.35){r();r();r();r();r();r();continue;}for(let i=0;i<3;i++){const j=r(),ph=(t*.7+i/3+j*.3)%1,d=ph*len*(.5+.5*k),R=(6+ph*22)*(.7+j*.6);
    g.globalAlpha=Math.min(1,k)*.4*(1-ph)*sstep(0,.15,ph);g.save();g.translate(p[0]+d,p[1]+d*.1*(j-.4)+ph*ph*20);g.rotate(.12);g.scale(2.6,.8);g.drawImage(FLAKE,-R,-R,2*R,2*R);g.restore();}}
  g.restore();}

/* ---------- wind: a breeze plus gusts that travel across the picture ----------
   BREEZE [[t,v],...] keyframes the steady part (timeline.js). A gust [t, strength, rise, hold, release] peaks at time t
   where x = WIND_X0 and arrives at other x WIND_C px a second later (or earlier), so a row of trees bows one after another.
   wind(t,x) is the air itself: smoke, snow, cloth and flags follow it. sway(t,x) is what springy things do: trees and poles
   lean with the gust, then spring back past upright and settle. Both are about 0..1.5; add each tree's own flutter on top. */
function gust(u,r,h,rl,spring){if(u<-r)return 0;if(u<0)return easeSine((u+r)/r);if(u<h)return 1;const v=u-h;return spring?Math.exp(-v/(1.6*rl))*Math.cos(Math.PI*v/(2*rl)):Math.exp(-v/rl);}
function windAt(t,x,spring){let w=kf(BREEZE,t,easeSine);for(const[t0,a,r,h,rl]of GUSTS){const u=t-t0-(x-WIND_X0)/WIND_C;if(u<-r||u>h+rl*9)continue;w+=a*gust(u,r,h,rl,spring);}return w;}
const wind=(t,x=WIND_X0)=>windAt(t,x,false),sway=(t,x=WIND_X0)=>windAt(t,x,true);
/* a tree or pole baked as its own piece, drawn bent by the wind. T: {p (the piece), x,y (its base), h (height), ph (phase),
   give (how far the top goes per unit of sway, as a share of h), fq (its own quiver, radians/s), n (slices)}.
   Returns how far the top moved, for things attached to it (bentPoint() moves any other point of it the same way) */
function swayTree(g,t,T,extra=0){const s=sway(t,T.x),A=T.h*(T.give??.12)*(s+.12*Math.max(s,.2)*Math.sin(t*(T.fq||4.4)+T.ph)+.04*Math.sin(t*1.3+T.ph))+extra;drawBent(g,T.p,T.x,T.y,A,T.n||12);return A;}

/* ---------- integrated clocks: speed is keyframed and summed once at build, so speeding up never makes anything jump ---------- */
function makeClock(speed,t0=-2,t1=DUR+2,rate=240){const n=Math.ceil((t1-t0)*rate),T=new Float32Array(n+1);let a=0;for(let i=1;i<=n;i++){a+=speed(t0+i/rate)/rate;T[i]=a;}
  return t=>{const f=(t-t0)*rate,i=clamp(Math.floor(f),0,n-1);return lerp(T[i],T[i+1],clamp(f-i,0,1));};}
let auroraClock=null,windClock=null;       // aurora: its curtains' own time (skySpeed in timeline.js); wind: how far the air has moved
/* what moving things ride: windClk(t) for smoke puffs (drifting in a calm, hurrying in a gust); windDrift(t,k) for drawFlakes */
const windClk=t=>t*.35+windClock(t)*1.3,windDrift=(t,k)=>({d:windClock(t)*k,v:wind(t)*k});
/* uniforms for the sky shader (sky.js), with defaults */
function sky(o){return Object.assign({t:0,ta:0,storm:0,hit:0,flare:0,panY:0,poster:.72,motes:0},o);}

function buildShared(){buildFlake();const ac=makeClock(skySpeed);auroraClock=t=>30+ac(t);windClock=makeClock(t=>wind(t));}
