'use strict';
/* ===== puppets: jointed silhouettes, like shadow-theatre figures =====
   Angles are absolute unless noted: 0 points straight down, +PI/2 points the way the figure faces,
   PI points up. pdir(a,face) gives the unit vector for a figure facing `face` (1 right, -1 left).
   A pose q: {x,y (the pelvis), face, lean (forward, radians), look (head tilt), arms:[{s (shoulder angle), e (elbow, relative)}]x2,
   legs:[{h (hip), k (knee, relative), p (foot pitch), a (ankle, digitigrade only)}]x2, coatSwing (hem angle; + swings it forward),
   hemMax (keep the hem above this y), after(g,joints) (draw extras in the same silhouette), rim (lit-edge colour),
   hair (long hair, see phair), and for drawPuppet: rot (lay the figure over, radians about the pelvis), alpha (fade it)} */
const pdir=(a,f)=>[Math.sin(a)*f,Math.cos(a)];
const pang=(vx,vy,f)=>Math.atan2(vx*f,vy);
const padd=(p,a,L,f)=>{const d=pdir(a,f);return[p[0]+d[0]*L,p[1]+d[1]*L];};
/* two-bone IK: from joint S reach target T with bones L1,L2. bend=+1 puts the middle joint forward of the line. */
function ik2(S,T,L1,L2,f,bend){const vx=T[0]-S[0],vy=T[1]-S[1];let d=Math.hypot(vx,vy);d=clamp(d,Math.abs(L1-L2)+.01,L1+L2-.01);
  const base=pang(vx,vy,f),al=Math.acos(clamp((L1*L1+d*d-L2*L2)/(2*L1*d),-1,1)),a1=base+bend*al,M=padd(S,a1,L1,f),a2=pang(T[0]-M[0],T[1]-M[1],f);return{a1,rel:a2-a1};}

/* body plans (pixels at the depth the figure stands at). kind 'plant' walks on flat feet; 'digi' walks on its toes, with an
   extra ankle joint (give it meta and hoof lengths), for animals and creatures built that way.
   coat: {len, flare, fur}; hood, ears and muz (a small muzzle, so a round head doesn't read as a toy) are optional */
const BODY={
  // stocky: short limbs, a heavy coat with a fur hem, small pointed ears
  stocky:{kind:'plant',torso:80,neck:9,hr:21,hrx:.92,muz:.2,thigh:54,shin:52,foot:30,ua:50,fa:46,hand:7,hipW:46,shW:40,armW:[15,11],legW:[20,13],coat:{len:48,flare:12,fur:true},ears:true},
  // the same build, hooded, with a longer coat
  hooded:{kind:'plant',torso:74,neck:8,hr:20,hrx:.95,muz:.16,thigh:50,shin:48,foot:28,ua:46,fa:44,hand:7,hipW:44,shW:38,armW:[14,10],legW:[19,12],coat:{len:70,flare:16,fur:false},hood:true},
  // the same again, bare-headed: give the pose long hair (q.hair) and the wind shows in it
  bare:{kind:'plant',torso:74,neck:8,hr:20,hrx:.95,muz:.16,thigh:50,shin:48,foot:28,ua:46,fa:44,hand:7,hipW:44,shW:38,armW:[14,10],legW:[19,12],coat:{len:66,flare:15,fur:false}},
  // a child, hooded, big-headed
  child:{kind:'plant',torso:52,neck:6,hr:18,hrx:.95,muz:.12,thigh:34,shin:32,foot:20,ua:30,fa:28,hand:5,hipW:32,shW:28,armW:[10,8],legW:[13,9],coat:{len:40,flare:8,fur:true},hood:true},
  // an elder: shawled, a little stooped, long coat
  elder:{kind:'plant',torso:72,neck:8,hr:19,hrx:.95,muz:.16,thigh:48,shin:46,foot:26,ua:44,fa:42,hand:6,hipW:44,shW:40,armW:[13,10],legW:[17,11],coat:{len:78,flare:18,fur:false},hood:true},
};
/* forward kinematics: returns joints, used for drawing and for things held in the hands */
function pfk(B,q){const f=q.face,P=[q.x,q.y],ta=Math.PI-(q.lean||0),S=padd(P,ta,B.torso,f),ha=ta+(q.look||0),N=padd(S,ha,B.neck,f),Hc=padd(N,ha,B.hr*.9,f);
  const arms=q.arms.map(a=>{const E=padd(S,a.s,B.ua,f),fa=a.s+a.e,Wr=padd(E,fa,B.fa,f),Hd=padd(Wr,fa,B.hand*.8,f);return{S,E,Wr,Hd,a1:a.s,a2:fa};});
  const legs=q.legs.map(l=>{const K=padd(P,l.h,B.thigh,f),sa=l.h+l.k,A=padd(K,sa,B.shin,f);
    if(B.kind==='digi'){const ma=sa+(l.a??1.1),Fl=padd(A,ma,B.meta,f),ho=Math.PI/2-.35+(l.p||0),Tip=padd(Fl,ho,B.hoof,f);return{K,A,F:Fl,Tip,sa,ma,low:Math.max(Fl[1],Tip[1])+2};}
    const pa=Math.PI/2+(l.p||0),Toe=padd(A,pa,B.foot*.78,f),Heel=padd(A,pa,-B.foot*.22,f);return{K,A,Toe,Heel,sa,low:Math.max(Toe[1],Heel[1])+4};});
  return{P,S,N,Hc,ha,ta,arms,legs,f};}
function footLow(B,q){const j=pfk(B,q);return Math.max(...j.legs.map(l=>l.low));}
/* draws the silhouette into g in any single colour; returns the joints */
function pdraw(g,B,q,j){j=j||pfk(B,q);const f=q.face,{P,S,N,Hc,ha,ta}=j;
  const T=(a,b,w0,w1)=>taper(g,a[0],a[1],b[0],b[1],w0,w1);
  // legs (far first; everything is one colour, order only matters for readability of the code)
  j.legs.forEach(l=>{T(P,l.K,B.legW[0],B.legW[0]*.8);
    if(B.kind==='digi'){T(l.K,l.A,B.legW[0]*.7,B.legW[1]);T(l.A,l.F,B.legW[1],B.legW[1]*.7);
      const hd=pdir(Math.PI/2-.35,f),n=[-hd[1],hd[0]],w=B.legW[1]*.75;g.beginPath();g.moveTo(l.F[0]+n[0]*w*.6,l.F[1]+n[1]*w*.6);g.lineTo(l.Tip[0]+n[0]*w*.3,l.Tip[1]+n[1]*w*.3);g.lineTo(l.Tip[0]-n[0]*w*.55,l.Tip[1]-n[1]*w*.55);g.lineTo(l.F[0]-n[0]*w*.7,l.F[1]-n[1]*w*.7);g.closePath();g.fill();}
    else{T(l.K,l.A,B.legW[0]*.8,B.legW[1]);const fd=pdir(Math.PI/2+(l.p||0),f),ud=pdir(Math.PI+(l.p||0),f),w=B.legW[1];
      polyFill(g,[[l.A[0]-fd[0]*w*.55+ud[0]*6,l.A[1]-fd[1]*w*.55+ud[1]*6],[l.A[0]+fd[0]*w*.45+ud[0]*4,l.A[1]+fd[1]*w*.45+ud[1]*4],[l.Toe[0]+ud[0]*7,l.Toe[1]+ud[1]*7],[l.Toe[0]+fd[0]*2,l.Toe[1]+fd[1]*2+1],[l.Heel[0],l.Heel[1]+1]]);}});
  // torso and coat
  const fw=pdir(ta-Math.PI/2,f),dt=pdir(ta+Math.PI+(q.coatSwing||0),f),dw=pdir(q.coatSwing||0,f),dn0=[dt[0]*.35+dw[0]*.65,dt[1]*.35+dw[1]*.65],dl=Math.hypot(dn0[0],dn0[1]),dn=[dn0[0]/dl,dn0[1]/dl];
  T(P,S,B.hipW,B.shW);
  {const c=B.coat,fl=c.flare,L=c.len,hw=B.hipW/2,sw=B.shW/2;
    const Sf=[S[0]+fw[0]*sw,S[1]+fw[1]*sw],Sb=[S[0]-fw[0]*sw,S[1]-fw[1]*sw];
    const Hf=[P[0]+fw[0]*(hw+fl)+dn[0]*L,P[1]+fw[1]*(hw+fl)+dn[1]*L],Hb=[P[0]-fw[0]*(hw+fl*1.2)+dn[0]*L*1.04,P[1]-fw[1]*(hw+fl*1.2)+dn[1]*L*1.04];
    if(q.hemMax!==undefined){for(const h of[Hf,Hb])if(h[1]>q.hemMax){h[0]+=(h[0]-P[0])*.25;h[1]=q.hemMax;}}
    g.beginPath();g.moveTo(Sb[0],Sb[1]);g.quadraticCurveTo(Sb[0]-fw[0]*6,Sb[1]-fw[1]*6+8,Sb[0]+(Sf[0]-Sb[0])*.5-fw[0]*2,S[1]-6);g.lineTo(Sf[0],Sf[1]);
    g.lineTo(P[0]+fw[0]*(hw+2),P[1]+fw[1]*(hw+2));g.lineTo(Hf[0],Hf[1]);
    const n=c.fur?9:1;for(let i=1;i<=n;i++){const u=i/n,x=lerp(Hf[0],Hb[0],u),y=lerp(Hf[1],Hb[1],u);if(c.fur&&i<n){const mx=lerp(Hf[0],Hb[0],u-.5/n),my=lerp(Hf[1],Hb[1],u-.5/n);g.lineTo(mx+dn[0]*7,my+dn[1]*7);}g.lineTo(x,y);}
    g.lineTo(P[0]-fw[0]*(hw+3),P[1]-fw[1]*(hw+3));g.closePath();g.fill();
    if(c.fur){const cx=S[0]-fw[0]*sw*.2,cy=S[1];for(let i=0;i<7;i++){const a=ta-Math.PI/2+i*.45-1.2,d=pdir(a,f);g.beginPath();g.moveTo(cx+d[0]*sw*.9,cy+d[1]*sw*.9-4);g.lineTo(cx+d[0]*(sw+9),cy+d[1]*(sw+9)-4);g.lineTo(cx+pdir(a+.25,f)[0]*sw*.9,cy+pdir(a+.25,f)[1]*sw*.9-4);g.fill();}}}
  // neck and head
  T(S,N,B.shW*.42,B.shW*.34);
  g.beginPath();g.ellipse(Hc[0],Hc[1],B.hr*B.hrx,B.hr,-ha*f,0,Math.PI*2);g.fill();
  {const fr=pdir(ha-Math.PI/2+.28,f),nb=[Hc[0]+fr[0]*B.hr*1.02,Hc[1]+fr[1]*B.hr*1.02];if(B.muz){g.beginPath();g.arc(nb[0],nb[1],B.hr*B.muz,0,Math.PI*2);g.fill();}}  // nose / muzzle
  if(B.ears){const b0=padd(Hc,ha+.62,B.hr*.78,f),tip=padd(Hc,ha+.46,B.hr*1.62,f),b1=padd(Hc,ha+.26,B.hr*.86,f);polyFill(g,[b0,tip,b1]);}
  if(B.hood){const back=padd(Hc,ha+Math.PI/2,B.hr*1.05,f),tip=padd(Hc,ha+1.15,B.hr*2.0,f),top=padd(Hc,ha+.15,B.hr*1.18,f),chin=padd(Hc,ha-.9-Math.PI/2+Math.PI,B.hr*.9,f);
    g.beginPath();g.ellipse(Hc[0],Hc[1],B.hr*1.18,B.hr*1.14,0,0,Math.PI*2);g.fill();polyFill(g,[top,tip,back,padd(S,ta+Math.PI/2,B.shW*.6,f)]);}
  if(q.hair)phair(g,B,q,j);
  // arms
  j.arms.forEach(a=>{T(a.S,a.E,B.armW[0],B.armW[0]*.85);T(a.E,a.Wr,B.armW[0]*.8,B.armW[1]);g.beginPath();g.arc(a.Hd[0],a.Hd[1],B.hand,0,Math.PI*2);g.fill();});
  if(q.after)q.after(g,j);return j;
}
/* long hair, cut as filled locks from the crown and the back of the head (single strands read as antennae or a spiky crest).
   In a calm they hang down the back; as the wind rises they stream downwind (to the right on screen, whichever way the figure
   faces: past the face with the wind behind, straight back walking into it), each lock waving along its length and lifting
   at the end. q.hair: {n (locks, 7), len (in head radii, 2.6), w (the wind, 0..1.5), t (time, for the wave)} */
function phair(g,B,q,j){const f=q.face,{Hc,ha}=j,H=q.hair,n=H.n||8,w=clamp(H.w??0,0,1.5),t=H.t??0,k=Math.min(1,w*(f>0?3.2:1.1)),sc=B.hr/19;   // with the wind behind, a breeze is enough to blow it forward
  {const c=padd(Hc,ha+1.1,B.hr*.16,f);g.beginPath();g.ellipse(c[0],c[1],B.hr*1.08,B.hr*1.05,0,0,Math.PI*2);g.fill();}   // the hair over the crown
  for(let i=0;i<n;i++){const u=i/(n-1),back=f>0?1-.55*k:1,b=padd(Hc,ha+.3+u*1.3*back,B.hr*.8,f);
    // each lock turns from hanging down the back toward downwind the way that goes over the top of the head, never under the
    // chin, and the locks spread like a fan: the upper ones lift, the lower ones droop
    const dc=pdir(ha+2.3+u*.3,f),ac=Math.atan2(dc[1],dc[0]),fan=(u-.4)*(.42+.2*k)+.06*Math.sin(i*2.7),aw=(f>0?2*Math.PI:0)-.1+fan,an=lerp(ac,aw,k),d=[Math.cos(an),Math.sin(an)],pd=[-d[1],d[0]];
    const sw=(.08+.28*w)*Math.sin(t*(3+7*w)-i*.9)+.05*Math.sin(t*1.7+i*2.1),L=B.hr*(H.len??2.6)*(.62+.5*Math.abs(Math.sin(i*1.9+.4)))*(1+.2*k);
    const m1=[b[0]+d[0]*L*.33+pd[0]*sw*L*.22,b[1]+d[1]*L*.33+pd[1]*sw*L*.22],m2=[b[0]+d[0]*L*.66-pd[0]*sw*L*.22,b[1]+d[1]*L*.66-pd[1]*sw*L*.22],e=[b[0]+d[0]*L+pd[0]*sw*L*.3,b[1]+d[1]*L+pd[1]*sw*L*.3-k*L*.06];
    const N=12,L1=[],L2=[];for(let s=0;s<=N;s++){const tt=s/N,P=bez3(b,m1,m2,e,tt),Pn=bez3(b,m1,m2,e,Math.min(1,tt+.02)),ex=Pn[0]-P[0],ey=Pn[1]-P[1],el=Math.hypot(ex,ey)||1,wd=(14-4*u)*sc*(1-tt*.72)/2;
      L1.push([P[0]-ey/el*wd,P[1]+ex/el*wd]);L2.push([P[0]+ey/el*wd,P[1]-ex/el*wd]);}
    polyFill(g,L1.concat(L2.reverse()));}}
const bez3=(a,b,c,d,t)=>{const s=1-t;return[s*s*s*a[0]+3*s*s*t*b[0]+3*s*t*t*c[0]+t*t*t*d[0],s*s*s*a[1]+3*s*s*t*b[1]+3*s*t*t*c[1]+t*t*t*d[1]];};
/* walk cycle angles. ph counts strides (one stride = two steps). */
function walkLegs(B,ph,amp=1){const w=2*Math.PI,out=[];
  for(const o of[0,.5]){const p=ph+o,s=Math.sin(w*p),sw=Math.max(0,Math.sin(w*(p-.72)));
    if(B.kind==='digi')out.push({h:.28+.26*s*amp,k:-1.05-.38*sw*amp,a:1.10+.26*Math.max(0,Math.sin(w*(p-.6)))*amp,p:-.12*sw});
    else out.push({h:.40*s*amp,k:-.08-.95*Math.pow(sw,1.4)*amp,p:.25*Math.max(0,Math.sin(w*(p-.55)))*amp});}
  return out;}
function walkArms(ph,amp=1,base=.18){const w=2*Math.PI;return[0,.5].map(o=>{const s=Math.sin(w*(ph+o+.5));return{s:base+.34*s*amp,e:.32+.22*Math.max(0,s)*amp};});}

/* sitting on a seat of height h below the pelvis: thighs forward, shins down */
function sitLegs(){return[{h:1.45,k:-1.45,p:0},{h:1.35,k:-1.4,p:0}];}

/* a shaggy pack beast (side view, facing +1): humped back, low head, short horns, fur fringe. ph drives the legs */
function beastShape(g,x,y,ph,face=1,sc=1){g.save();g.translate(x,y);g.scale(face*sc,sc);
  ellipseFill(g,0,-58,70,34);ellipseFill(g,-18,-76,44,24);ellipseFill(g,62,-44,26,20);polyFill(g,[[78,-52],[98,-66],[86,-44]]);polyFill(g,[[70,-60],[62,-80],[58,-58]]);
  for(let i=0;i<14;i++)polyFill(g,[[-66+i*10,-30],[-62+i*10,-14+(i%2)*6],[-58+i*10,-30]]);
  const L=(x0,p)=>{const a=.35*Math.sin(p);taper(g,x0,-36,x0+Math.sin(a)*34,-4,11,8);};L(-44,ph*6.28);L(-30,ph*6.28+Math.PI);L(34,ph*6.28+Math.PI);L(48,ph*6.28);g.restore();}
/* a loaded sledge: curved front runners, a pile of sacks, a strap forward */
function sledgeShape(g,x,y,len=150,sacks=4,face=1){g.save();g.translate(x,y);g.scale(face,1);g.fillRect(-len/2,-10,len,7);g.beginPath();g.moveTo(-len/2,-2);g.lineTo(len/2-14,-2);g.quadraticCurveTo(len/2+6,-2,len/2+8,-22);g.lineTo(len/2+3,-22);g.quadraticCurveTo(len/2,-6,len/2-14,-6);g.lineTo(-len/2,-6);g.closePath();g.fill();
  for(let i=0;i<sacks;i++){const sx=-len/2+18+i*(len-36)/Math.max(1,sacks-1),sy=-12;g.beginPath();g.moveTo(sx-18,sy);g.quadraticCurveTo(sx-20,sy-30,sx-6,sy-38);g.lineTo(sx+6,sy-38);g.quadraticCurveTo(sx+20,sy-30,sx+18,sy);g.closePath();g.fill();}g.restore();}
