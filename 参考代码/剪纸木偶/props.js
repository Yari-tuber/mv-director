'use strict';
/* ===== props: pictograms and runes, buildings, ropes, snow and ice, lanterns, terrain, impossible ground, things the wind moves =====
   Most of these draw silhouettes in the current fill/stroke style, so they can go into a piece's shape (baked) or straight
   onto the frame. No writing in the picture: signs are pictograms and runes. */

/* ---------- pictograms, in a -1..1 box ---------- */
const GLYPHS={
  bowl:g=>{g.beginPath();g.moveTo(-.85,-.15);g.quadraticCurveTo(0,1.1,.85,-.15);g.closePath();g.stroke();g.beginPath();g.moveTo(-.3,-.45);g.quadraticCurveTo(-.15,-.8,0,-.45);g.quadraticCurveTo(.15,-.1,.3,-.45);g.stroke();},
  sleep:g=>{g.beginPath();g.arc(-.62,-.05,.22,0,Math.PI*2);g.stroke();g.beginPath();g.moveTo(-.35,.1);g.lineTo(.85,.1);g.moveTo(-.9,.42);g.lineTo(.95,.42);g.stroke();},
  rope:g=>{g.beginPath();g.moveTo(-.8,.9);g.lineTo(-.8,-.6);g.moveTo(.8,.9);g.lineTo(.8,-.6);g.moveTo(-.8,-.45);g.quadraticCurveTo(0,.25,.8,-.45);g.stroke();},
  sky:g=>{g.beginPath();for(const y of[-.55,-.1,.35]){g.moveTo(-.9,y);g.bezierCurveTo(-.45,y-.3,-.15,y+.3,.25,y);g.quadraticCurveTo(.6,y-.22,.9,y);}g.stroke();g.beginPath();g.moveTo(-.95,.8);g.lineTo(.95,.8);g.stroke();},
  fire:g=>{g.beginPath();g.moveTo(0,.85);g.bezierCurveTo(-.75,.6,-.5,-.1,-.05,-.9);g.bezierCurveTo(.05,-.35,.55,-.2,.35,.25);g.bezierCurveTo(.7,.3,.5,.75,0,.85);g.stroke();g.beginPath();g.moveTo(-.7,.95);g.lineTo(.7,.95);g.stroke();},
  door:g=>{g.beginPath();g.moveTo(-.55,.95);g.lineTo(-.55,-.35);g.arc(0,-.35,.55,Math.PI,0);g.lineTo(.55,.95);g.stroke();g.beginPath();g.arc(.25,.25,.07,0,Math.PI*2);g.stroke();},
  snow:g=>{g.beginPath();for(let i=0;i<3;i++){const a=i*Math.PI/3;g.moveTo(Math.cos(a)*.85,Math.sin(a)*.85);g.lineTo(-Math.cos(a)*.85,-Math.sin(a)*.85);}g.stroke();},
  walk:g=>{g.beginPath();g.arc(.05,-.72,.18,0,Math.PI*2);g.stroke();g.beginPath();g.moveTo(.02,-.5);g.lineTo(-.08,.2);g.lineTo(-.5,.9);g.moveTo(-.08,.2);g.lineTo(.4,.9);g.moveTo(-.45,-.15);g.lineTo(.05,-.35);g.lineTo(.5,-.05);g.stroke();},
  grain:g=>{g.beginPath();g.moveTo(0,.95);g.lineTo(0,-.9);for(let i=0;i<4;i++){const y=-.6+i*.32;g.moveTo(0,y+.12);g.quadraticCurveTo(-.35,y,-.32,y-.25);g.moveTo(0,y+.12);g.quadraticCurveTo(.35,y,.32,y-.25);}g.stroke();},
  oil:g=>{g.beginPath();g.moveTo(0,-.9);g.bezierCurveTo(.2,-.4,.65,.05,.55,.45);g.arc(0,.45,.55,0,Math.PI);g.bezierCurveTo(-.65,.05,-.2,-.4,0,-.9);g.stroke();},
  fish:g=>{g.beginPath();g.moveTo(-.85,0);g.quadraticCurveTo(-.1,-.65,.5,0);g.quadraticCurveTo(-.1,.65,-.85,0);g.moveTo(.4,0);g.lineTo(.92,-.4);g.lineTo(.92,.4);g.closePath();g.stroke();},
  pass:g=>{g.beginPath();g.moveTo(-.95,.8);g.lineTo(-.45,-.6);g.lineTo(-.12,.15);g.moveTo(.12,.15);g.lineTo(.45,-.6);g.lineTo(.95,.8);g.stroke();g.beginPath();g.moveTo(0,.9);g.lineTo(0,-.85);g.moveTo(-.22,-.6);g.lineTo(0,-.88);g.lineTo(.22,-.6);g.stroke();},
  house:g=>{g.beginPath();g.moveTo(-.7,.9);g.lineTo(-.7,-.1);g.lineTo(0,-.8);g.lineTo(.7,-.1);g.lineTo(.7,.9);g.closePath();g.stroke();},
  knot:g=>{g.beginPath();g.moveTo(-.9,.2);g.bezierCurveTo(-.2,.2,-.2,-.7,.25,-.5);g.bezierCurveTo(.7,-.3,.2,.5,-.15,.25);g.bezierCurveTo(-.45,.05,.1,-.1,.9,-.1);g.stroke();},
  arrow:g=>{g.beginPath();g.moveTo(-.9,0);g.lineTo(.85,0);g.moveTo(.4,-.4);g.lineTo(.88,0);g.lineTo(.4,.4);g.stroke();},
  crossed:g=>{g.beginPath();g.moveTo(-.8,-.8);g.lineTo(.8,.8);g.moveTo(.8,-.8);g.lineTo(-.8,.8);g.stroke();},
  hills:g=>{g.beginPath();g.moveTo(-.95,.5);g.lineTo(-.55,-.2);g.lineTo(-.2,.3);g.lineTo(.15,-.35);g.lineTo(.55,.25);g.stroke();g.beginPath();g.arc(.8,.55,.14,0,Math.PI*2);g.stroke();},
  wind:g=>{g.beginPath();for(const[y,l]of[[-.45,.55],[0,.9],[.45,.4]]){g.moveTo(-.9,y);g.lineTo(l-.25,y);g.arc(l-.25,y-.2,.2,Math.PI/2,-Math.PI*.9,true);}g.stroke();},
};
function glyph(g,name,x,y,s,w=2,rot=0){g.save();g.translate(x,y);if(rot)g.rotate(rot);g.scale(s,s);g.lineWidth=w/s;g.lineCap='round';g.lineJoin='round';GLYPHS[name](g);g.restore();}
/* runes: a stem with one to three strokes, deterministic from the seed */
function runes(g,x,y,n,s,seed,w=2,vertical=true){const r=mulberry32(seed);g.save();g.lineWidth=w;g.lineCap='round';
  for(let i=0;i<n;i++){const cx=vertical?x:x+i*s*1.3,cy=vertical?y+i*s*1.5:y;g.beginPath();g.moveTo(cx,cy-s*.6);g.lineTo(cx,cy+s*.6);
    const k=1+((r()*3)|0);for(let j=0;j<k;j++){const tp=(r()*4)|0,yy=cy+(r()-.5)*s*.8,sd=r()<.5?-1:1;
      if(tp===0){g.moveTo(cx,yy);g.lineTo(cx+sd*s*.45,yy-s*.3);}else if(tp===1){g.moveTo(cx,yy);g.lineTo(cx+sd*s*.45,yy+s*.3);}
      else if(tp===2){g.moveTo(cx-s*.3,yy);g.lineTo(cx+s*.3,yy);}else{g.moveTo(cx,yy-s*.2);g.lineTo(cx+sd*s*.35,yy);g.lineTo(cx,yy+s*.2);}}g.stroke();}g.restore();}

/* ---------- buildings ----------
   a longhouse seen at an angle: gable end (door) on the left, the long side running right (side=-1 mirrors it).
   (x,y) is the bottom of the gable's left wall. o: {gw gable width, len, wh wall height, rh roof height, wins, chimney, gableWin}.
   Returns window and door rects for lighting, the roof line (for snow), the eave, and the chimney top (for smoke). */
function longhouse(g,x,y,o={}){const gw=o.gw??64,len=o.len??170,wh=o.wh??36,rh=o.rh??42,side=o.side??1;
  const X=v=>x+v*side;
  polyFill(g,[[X(-2),y],[X(-2),y-wh],[X(gw/2),y-wh-rh],[X(gw+2),y-wh],[X(gw+len),y-wh-rh*.18],[X(gw+len),y]]);
  if(o.chimney)g.fillRect(X(gw+len*.6)-(side<0?10:0),y-wh-rh*.5,10,rh*.45);
  const wins=[],n=o.wins??3;for(let i=0;i<n;i++){const wx=X(gw+18+i*(len-36)/Math.max(1,n-1)*(n>1?1:0)+(n===1?len/2-24:0));wins.push([side>0?wx:wx-12,y-wh*.62,12,wh*.34]);}
  const door=[X(gw/2)-9,y-wh*.72,18,wh*.72];if(o.gableWin!==false)wins.push([X(gw/2)-5,y-wh-rh*.45,10,12]);
  return{wins,door,ridge:[[X(-2),y-wh],[X(gw/2),y-wh-rh],[X(gw+2),y-wh],[X(gw+len),y-wh-rh*.18]],eave:[X(gw+2),X(gw+len),y-wh],chimney:o.chimney?[X(gw+len*.6)+5*side,y-wh-rh*.5]:null,x,y};}
function shedShape(g,x,y,s=1){polyFill(g,[[x,y],[x,y-22*s],[x+24*s,y-44*s],[x+48*s,y-22*s],[x+48*s,y]]);return{door:[x+16*s,y-16*s,16*s,16*s],apex:[x+24*s,y-44*s]};}
function wellShape(g,x,y,s=1){g.fillRect(x-17*s,y-12*s,34*s,12*s);g.fillRect(x-15*s,y-40*s,3.5*s,30*s);g.fillRect(x+11.5*s,y-40*s,3.5*s,30*s);polyFill(g,[[x-24*s,y-36*s],[x,y-54*s],[x+24*s,y-36*s]]);g.fillRect(x-.8*s,y-36*s,1.6*s,18*s);g.fillRect(x-5*s,y-20*s,10*s,8*s);}
/* rope strung between posts, sagging. pts are the post feet */
function ropeLine(g,pts,sag=6,w=1.4,postH=14,postW=2.6){g.save();g.lineWidth=w;g.lineCap='round';g.beginPath();for(let i=0;i<pts.length-1;i++){const a=pts[i],b=pts[i+1];g.moveTo(a[0],a[1]-postH*.8);g.quadraticCurveTo((a[0]+b[0])/2,(a[1]+b[1])/2-postH*.8+sag,b[0],b[1]-postH*.8);}g.stroke();
  for(const p of pts)g.fillRect(p[0]-postW/2,p[1]-postH,postW,postH);g.restore();}
/* where such a rope hangs at x (the same curve ropeLine draws) */
function ropeYAt(pts,x,sag=6,postH=14){for(let i=0;i<pts.length-1;i++){const a=pts[i],b=pts[i+1],lo=Math.min(a[0],b[0]),hi=Math.max(a[0],b[0]);if(x>=lo&&x<=hi){const u=(x-a[0])/(b[0]-a[0]),ya=a[1]-postH*.8,yb=b[1]-postH*.8,my=(a[1]+b[1])/2-postH*.8+sag;return(1-u)*(1-u)*ya+2*u*(1-u)*my+u*u*yb;}}return pts[0][1]-postH*.8;}
function cairnShape(g,x,y,s=1){[[0,0,15,7],[-4,-9,12,6],[3,-17,10,5.5],[-1,-25,8,5],[1,-32,5.5,4]].forEach(c=>ellipseFill(g,x+c[0]*s,y+c[1]*s,c[2]*s,c[3]*s));g.fillRect(x+7*s,y-58*s,4*s,52*s);g.fillRect(x+1*s,y-52*s,16*s,3.4*s);}
/* palisade of pointed stakes along a line, with a gap for a gate */
function palisade(g,x0,x1,y,h,gap=null,seed=1){const r=mulberry32(seed);for(let x=x0;x<x1;x+=9+r()*3){if(gap&&x>gap[0]-4&&x<gap[1])continue;const hh=h*(.9+r()*.2),w=8;polyFill(g,[[x,y],[x,y-hh],[x+w/2,y-hh-9],[x+w,y-hh],[x+w,y]]);}}
function towerShape(g,x,y,w,h){g.fillRect(x,y-h,w,h);polyFill(g,[[x-6,y-h],[x+w/2,y-h-w*.7],[x+w+6,y-h]]);g.fillRect(x-4,y-h*.62,w+8,4);}
/* a hurried shelter. kind: 'tent' (hides on crossed poles), 'lean' (a lean-to), 'sledge' (a sledge stood on end, with a hide
   pulled off it to a stake), 'dome' (snow blocks). (x,y): the middle of its footing; s its size; dir 1 or -1, the way it faces */
function shelterShape(g,kind,x,y,s,seed,dir=1){const r=mulberry32(seed),X=v=>x+v*s*dir,Y=v=>y-v*s;g.lineCap='round';
  if(kind==='tent'){polyFill(g,[[X(-19),Y(-1)],[X(-4),Y(32)],[X(4),Y(33)],[X(20),Y(-1)]]);g.lineWidth=1.7*s;g.beginPath();g.moveTo(X(-5),Y(27));g.lineTo(X(8+r()*4),Y(45));g.moveTo(X(5),Y(27));g.lineTo(X(-7-r()*4),Y(44));g.moveTo(X(0),Y(29));g.lineTo(X(2),Y(47));g.stroke();}
  else if(kind==='lean'){polyFill(g,[[X(-3),Y(-1)],[X(-3),Y(31)],[X(42),Y(-1)]]);g.lineWidth=1.9*s;g.beginPath();g.moveTo(X(-9),Y(35));g.lineTo(X(47),Y(-3));g.moveTo(X(-1),Y(38));g.lineTo(X(5),Y(27));g.stroke();}
  else if(kind==='sledge'){g.save();g.translate(X(0),Y(0));g.rotate(-.08*dir);g.fillRect(-3*s,-40*s,6*s,40*s);polyFill(g,[[-3*s,-40*s],[3*s,-40*s],[9*s*dir,-47*s],[3*s*dir,-48*s]]);g.restore();
    polyFill(g,[[X(1),Y(37)],[X(36),Y(-1)],[X(29),Y(-1)],[X(1),Y(27)]]);g.fillRect(X(35)-1.2*s,Y(9),2.4*s,10*s);}
  else if(kind==='dome'){g.beginPath();g.ellipse(x,y+1,21*s,16*s,0,Math.PI,2*Math.PI);g.closePath();g.fill();}}
/* painted on after the cut: dark doorways, lighter patches sewn onto the hides, the joints between snow blocks */
function shelterAfter(g,kind,x,y,s,seed,dir,col){const r=mulberry32(seed+3),X=v=>x+v*s*dir,Y=v=>y-v*s;g.fillStyle=rgb([6,10,13]);
  if(kind==='tent')polyFill(g,[[X(-4),Y(-1)],[X(1),Y(14)],[X(6),Y(-1)]]);
  else if(kind==='lean')polyFill(g,[[X(3),Y(-1)],[X(3),Y(15)],[X(19),Y(-1)]]);
  else if(kind==='sledge')polyFill(g,[[X(6),Y(-1)],[X(6),Y(14)],[X(17),Y(-1)]]);
  else if(kind==='dome'){g.beginPath();g.ellipse(X(10),y+1,5*s,9*s,0,Math.PI,2*Math.PI);g.fill();g.strokeStyle=rgba([84,106,116],.55);g.lineWidth=Math.max(.8,s);
    for(const k of[.45,.78]){g.beginPath();g.ellipse(x,y+1,21*s*k,16*s*k,0,Math.PI*1.08,Math.PI*1.92);g.stroke();}return;}
  g.fillStyle=rgba(mix3(col,[190,168,138],.4),.9);for(let i=0;i<2;i++){const px=kind==='tent'?X(-9+r()*12):X(10+r()*16),py=kind==='tent'?Y(6+r()*14):Y(3+r()*10);g.fillRect(px,py,(4+r()*3)*s,(3+r()*2)*s);}}
/* a manor: a long two-storey range, a square tower with a pyramid roof and a pole, a walled court with a gatehouse.
   (x,y): the foot of the tower; dir 1 runs the range to the right. Returns the windows to light, the pole's top (for a
   pennant), the chimney top, the gate, and the roof line (left to right, for snow) */
function manorShape(g,x,y,s,dir=1){const X=v=>x+v*s*dir,Y=v=>y-v*s,L=(a,b)=>Math.min(X(a),X(b)),wins=[];
  g.fillRect(L(-64,0),Y(13),64*s,14*s);                                                        // the court wall
  polyFill(g,[[X(-50),Y(-1)],[X(-50),Y(26)],[X(-42),Y(33)],[X(-34),Y(26)],[X(-34),Y(-1)]]);      // the gatehouse
  g.fillRect(L(0,24),Y(76),24*s,77*s);polyFill(g,[[X(-4),Y(76)],[X(12),Y(100)],[X(28),Y(76)]]);g.fillRect(L(11,13),Y(118),2*s,20*s);   // the tower and its pole
  polyFill(g,[[X(22),Y(-1)],[X(22),Y(40)],[X(44),Y(64)],[X(66),Y(40)],[X(150),Y(44)],[X(150),Y(-1)]]);                                // the range
  g.fillRect(L(112,122),Y(66),10*s,24*s);                                                        // a chimney
  for(let i=0;i<5;i++)wins.push([L(72+i*15,78+i*15),Y(33),6*s,9*s]);for(let i=0;i<5;i++)wins.push([L(72+i*15,78+i*15),Y(17),6*s,9*s]);
  wins.push([L(9,15),Y(60),6*s,10*s],[L(38,45),Y(50),7*s,9*s]);
  const roof=[[X(18),Y(40)],[X(44),Y(64)],[X(66),Y(40)],[X(150),Y(44)]].sort((a,b)=>a[0]-b[0]);
  return{wins,pole:[X(12),Y(118)],chimney:[X(117),Y(66)],gate:[X(-42),Y(0)],roof};}
/* a small fire at a shelter's mouth: a pool of warm light and a flicker of flame. a its brightness, sc its size */
function fireAt(g,x,y,t,i,a,sc=1){if(a<=0)return;glow(g,x,y-4*sc,34*sc,[255,160,80],.6*a*flick(t,i+90));g.fillStyle=rgba([255,196,110],.95*a);const h=(6+2*Math.sin(t*9+i))*sc;
  g.beginPath();g.moveTo(x-3*sc,y);g.quadraticCurveTo(x-2*sc,y-h*.6,x,y-h);g.quadraticCurveTo(x+2*sc,y-h*.6,x+3*sc,y);g.closePath();g.fill();}
/* a signpost: arms [{dir:1|-1, g:'glyph name'}] from the top down; signGlyphs() carves their pictograms */
function signpost(g,x,y,arms,s=1){g.fillRect(x-3*s,y-120*s,6*s,120*s);arms.forEach((a,i)=>{const yy=y-(108-i*26)*s,d=a.dir,L=64*s;polyFill(g,[[x,yy-9*s],[x+d*L,yy-9*s],[x+d*(L+12*s),yy],[x+d*L,yy+9*s],[x,yy+9*s]]);});}
function signGlyphs(g,x,y,arms,s=1,w=2){arms.forEach((a,i)=>{const yy=y-(108-i*26)*s;glyph(g,a.g,x+a.dir*34*s,yy,7*s,w);});}

/* a spruce: trunk and stacked, slightly ragged tiers */
function spruce(g,x,y,h,seed=1){const r=mulberry32(seed),w=h*.36;g.fillRect(x-h*.03,y-h*.2,h*.06,h*.22);const n=4;for(let i=0;i<n;i++){const t0=i/n,yb=y-h*.12-t0*h*.78,ww=w*(1-t0*.72),th=h*.34;polyFill(g,[[x-ww,yb],[x-ww*.35,yb-th*.35+r()*2],[x-ww*.55,yb-th*.4],[x,yb-th],[x+ww*.55,yb-th*.4],[x+ww*.35,yb-th*.35+r()*2],[x+ww,yb]]);}}
/* snow lying on each tier of the same spruce (call with the same arguments, in a piece's after()) */
function spruceSnow(g,x,y,h,seed=1,th=3){const w=h*.36;for(let i=0;i<4;i++){const t0=i/4,yb=y-h*.12-t0*h*.78,ww=w*(1-t0*.72),tt=h*.34;
  snowOnEdge(g,[[x-ww*.8,yb-tt*.1],[x-ww*.55,yb-tt*.4],[x,yb-tt],[x+ww*.55,yb-tt*.4],[x+ww*.8,yb-tt*.1]],th*(1-t0*.4),(seed*7+i)|0,.5);}}
/* trees along the steep parts of an edge y(x) */
function edgeTrees(g,y,x0,x1,h,seed,dens=1,minSlope=.18){const r=mulberry32(seed);for(let x=x0;x<x1;x+=(18+r()*40)/dens){const sl=Math.abs(y(x+6)-y(x-6))/12;if(sl<minSlope||r()<.35)continue;const hh=h*(.6+r()*.7);if(r()<.8)spruce(g,x,y(x)+hh*.08,hh,seed*97+x|0);else{const T=genTree((seed*31+x)|0,{x,y:y(x)+2,h:hh*.9,tw:hh*.07,spread:.9,leaf:0,dens:0,fruitP:0,fr:0,cutP:0,n:3});drawTreeShape(g,T);}}}

/* ---------- snow and ice ---------- */
/* snow lying on an edge given as points left to right: a band from the edge down by thick(x) */
function snowOnEdge(g,pts,thick,seed=1,lift=1.5){const r=mulberry32(seed);g.beginPath();g.moveTo(pts[0][0],pts[0][1]-lift);for(const p of pts)g.lineTo(p[0],p[1]-lift);
  for(let i=pts.length-1;i>=0;i--){const p=pts[i],th=typeof thick==='function'?thick(p[0]):thick;g.lineTo(p[0],p[1]+th*(.55+r()*.6));}g.closePath();g.fill();}
function icicles(g,x0,x1,y,maxL,seed=1,dens=1){const r=mulberry32(seed);for(let x=x0;x<x1;x+=(4+r()*9)/dens){const L=maxL*(.2+r()*.8)*(r()<.2?.3:1),w=1.5+r()*2.5;polyFill(g,[[x-w,y-1],[x+w,y-1],[x+w*.2,y+L]]);}}
/* a path being dug through a drift, drawn live. p: {x0, x1 (where the path runs, left to right), y (the ground), k (0..1, how far
   it has been dug), bank (0..1, how high the thrown snow has piled)}. The drift still stands ahead of the digger; behind them is
   the dug trough, with a bank of thrown snow along its far side. col, bankCol: the snow's paper colours (fixed values) */
function snowTrench(g,p,col=[182,204,210],bankCol=[200,220,224],edge=[236,250,248]){const{x0,x1,y}=p,xd=lerp(x0,x1,p.k),snow=tintPattern(g,col,.25),banks=tintPattern(g,bankCol,.22);
  const top=x=>{const e=Math.min(1,(x-xd+2)/26)*Math.min(1,(x1+30-x)/40);return y+2-30*e-3*Math.sin(x*.07);};
  g.save();
  if(xd<x1){g.fillStyle=snow;g.beginPath();g.moveTo(xd-2,y+14);for(let x=xd-2;x<=x1+30;x+=6)g.lineTo(x,top(x));g.lineTo(x1+30,y+14);g.closePath();g.fill();
    g.strokeStyle=rgba(edge,.8);g.lineWidth=2;g.beginPath();for(let x=xd+4;x<=x1+24;x+=6)x===xd+4?g.moveTo(x,top(x)):g.lineTo(x,top(x));g.stroke();}
  if(xd>x0){g.fillStyle=rgba([78,102,112],.92);g.fillRect(x0,y-6,xd-x0,16);
    g.fillStyle=banks;g.beginPath();g.moveTo(x0-6,y-4);for(let x=x0-6;x<=xd+4;x+=8){const h=10+(p.bank??1)*10*Math.min(1,(xd-x+30)/60);g.lineTo(x,y-6-h*(.8+.2*Math.sin(x*.11)));}g.lineTo(xd+4,y-4);g.closePath();g.fill();
    g.fillStyle=snow;g.beginPath();g.moveTo(x0-6,y+8);for(let x=x0-6;x<=xd;x+=8)g.lineTo(x,y+14+2*Math.sin(x*.13));g.lineTo(xd,y+22);g.lineTo(x0-6,y+22);g.closePath();g.fill();}
  g.restore();}
/* snow thrown off a shovel: each lump flies from a to b in an arc h px high, over dur seconds from t0, and breaks up as it goes;
   blow (px) is how far the wind carries it sideways at full strength, so a gust takes a throw away downwind.
   list: [{t0, dur, a:[x,y], b:[x,y], h, seed, blow}] */
function thrownSnow(g,t,list,col=[232,244,242]){for(const c of list){if(t<c.t0)continue;const u=(t-c.t0)/c.dur;if(u>=1)continue;const w=c.blow?wind(t,c.a[0])*c.blow*u*u:0,
  x=lerp(c.a[0],c.b[0],u)+w,y=lerp(c.a[1],c.b[1],u)-c.h*4*u*(1-u)-w*.1,r=mulberry32(c.seed);
  g.fillStyle=rgba(col,.95*(1-u*.4));for(let i=0;i<7;i++){const sp=4+u*18+w*.2;g.beginPath();g.arc(x+(r()-.5)*sp,y+(r()-.5)*sp*.6,2+r()*3.5*(1-u*.5),0,Math.PI*2);g.fill();}}}

/* ---------- lights ---------- */
/* a warm window: filled rect plus glow */
function lit(g,w,a,t,seed=0,col=PAL.warm){if(a<=0)return;g.fillStyle=rgba(col,a);g.fillRect(w[0],w[1],w[2],w[3]);glow(g,w[0]+w[2]/2,w[1]+w[3]/2,Math.max(w[2],w[3])*2.4,col,.5*a*flick(t,seed));}
/* a hand lantern hanging from (x,y) (the hand), swung sw radians, with its light */
function drawLanternAt(g,x,y,sw,t,sc=1,col=[10,18,24]){g.save();g.translate(x,y-34*sc);g.rotate(sw);g.scale(sc,sc);g.fillStyle=tintPattern(g,col,.3);g.strokeStyle=rgb(col);g.lineWidth=2;
  g.beginPath();g.moveTo(0,-4);g.lineTo(0,18);g.stroke();polyFill(g,[[-11,24],[11,24],[7,16],[-7,16]]);g.fillStyle=rgb(PAL.warm);g.fillRect(-9,25,18,24);g.fillStyle=rgb(col);g.fillRect(-10,24,2.6,26);g.fillRect(7.4,24,2.6,26);g.fillRect(-12,48,24,5);g.restore();
  const cx=x-Math.sin(sw)*37*sc,cy=y-34*sc+Math.cos(sw)*37*sc;glow(g,cx,cy,150*sc,[255,184,104],.36*flick(t,3));glow(g,cx,cy,34*sc,[255,226,170],.7*flick(t,4));}

/* ---------- terrain ---------- */
/* a U-shaped valley cross-section: floor at fy between cx-fw and cx+fw, walls rising riseL/riseR over `span` px */
function uLine(cx,fw,fy,riseL,riseR,span,seed,amp=10){return x=>{const d=x-cx,a=Math.abs(d),k=Math.pow(sstep(fw,fw+span,a),.8),w=d<0?riseL:riseR;return fy-w*k+fbm2(x*.006,seed,3)*amp*(.3+k)+fbm2(x*.03,seed+3,2)*amp*.35*k;};}
const snowCol=c=>mix3(c,[214,232,230],.42);
/* one layer of land along y(x) from -260 to 2180: filled down to o.bottom, trees on its steep parts, snow on its top.
   o: {y, top, bottom, s, col, fog, snow (depth of the snow band), seed, trees (tree height, 0 for none), shape(g), after(g)} */
function bakeTerrain(o){return bakePiece({x:-260,y:o.top-80,w:2440,h:o.bottom-o.top+160,s:o.s,color:o.col,tex:.3,rimA:.5,rimW:1.8,fog:o.fog,shadow:{blur:12,a:.42,dy:5},
  shape:g=>{ridgeShape(g,ridgePoints(-260,2180,6,o.y),o.bottom+80);if(o.trees)edgeTrees(g,o.y,-240,2160,o.trees,o.seed,1.1);if(o.shape)o.shape(g);},
  after:g=>{g.fillStyle=tintPattern(g,snowCol(o.col),.25);snowOnEdge(g,ridgePoints(-260,2180,8,o.y),x=>o.snow*(1+.6*fbm2(x*.01,o.seed,2)),o.seed);if(o.after)o.after(g);}});}

/* ---------- impossible ground: folds, floating rock, bridges, tunnel mouths ---------- */
/* a smooth curve through points (Catmull-Rom), n samples per span */
function smoothPts(P,n=8){const out=[];for(let i=0;i<P.length-1;i++){const p0=P[Math.max(0,i-1)],p1=P[i],p2=P[i+1],p3=P[Math.min(P.length-1,i+2)];
  for(let k=0;k<n;k++){const t=k/n,t2=t*t,t3=t2*t,f=j=>.5*(2*p1[j]+(-p0[j]+p2[j])*t+(2*p0[j]-5*p1[j]+4*p2[j]-p3[j])*t2+(-p0[j]+3*p1[j]-3*p2[j]+p3[j])*t3);out.push([f(0),f(1)]);}}
  out.push(P[P.length-1].slice());return out;}
function curveLen(C){let L=0;for(let i=0;i<C.length-1;i++)L+=Math.hypot(C[i+1][0]-C[i][0],C[i+1][1]-C[i][1]);return L;}
/* frames every `step` along a curve: {x,y,phi,d}. phi turns something drawn upright (up = -y) to stand on the curve's left-hand side */
function curveFrames(C,step,off=0){const out=[];let acc=0,next=off;for(let i=0;i<C.length-1;i++){const a=C[i],b=C[i+1],L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(L<1e-6)continue;
  while(next<=acc+L){const k=(next-acc)/L;out.push({x:lerp(a[0],b[0],k),y:lerp(a[1],b[1],k),phi:Math.atan2(b[1]-a[1],b[0]-a[0]),d:next});next+=step;}acc+=L;}return out;}
function onFrame(g,F,f){g.save();g.translate(F.x,F.y);g.rotate(F.phi);f(g);g.restore();}
/* snow lying on the left-hand (ground) side of a curve: a band from just above the surface into the ground */
function snowOnCurve(g,C,thick,seed=1){const r=mulberry32(seed),F=curveFrames(C,6),top=[],bot=[];for(const f of F){const ux=Math.sin(f.phi),uy=-Math.cos(f.phi),th=thick*(.55+r()*.6);top.push([f.x+ux*1.5,f.y+uy*1.5]);bot.push([f.x-ux*th,f.y-uy*th]);}
  if(top.length>1)polyFill(g,top.concat(bot.reverse()));}
/* land floating free: a top edge y(x) from x0 to x1, a ragged underside hanging up to `depth` below, roots and ice hanging off it.
   o.lean shifts the deepest point, o.roots how many hang down, o.jag how spiky the underside is. Returns the top edge as points.
   Rotate the canvas a quarter turn first and it stands on its edge. */
function floatLand(g,y,x0,x1,depth,seed,o={}){const r=mulberry32(seed),n=Math.max(8,Math.round((x1-x0)/10)),top=[],bot=[];const end=o.end??Math.min(40,(x1-x0)*.12);
  for(let i=0;i<=n;i++){const x=lerp(x0,x1,i/n),e=Math.min(x-x0,x1-x)/end,dip=e<1?(1-Math.sqrt(Math.max(0,1-(1-e)*(1-e))))*Math.min(depth*.3,end*.7):0;top.push([x,y(x)+dip]);}
  for(let i=n;i>=0;i--){const u=i/n,x=lerp(x0,x1,u),pr=Math.pow(Math.sin(u*Math.PI),.55),core=Math.pow(Math.max(0,1-Math.abs(u-.5-(o.lean||0))*1.8),1.4),sp=r()<(o.jag??.3)?r()*.3:0;
    bot.push([x+(r()-.5)*3,y(x)+4+depth*pr*(.3+.7*core)+depth*sp*pr]);}
  polyFill(g,top.concat(bot));
  const nr=o.roots??Math.round((x1-x0)/28);for(let k=0;k<nr;k++){const p=bot[1+Math.floor(r()*(bot.length-2))],L=depth*(.1+r()*.28),w=1+r()*1.8;polyFill(g,[[p[0]-w,p[1]-3],[p[0]+w,p[1]-3],[p[0]+(r()-.5)*6,p[1]+L]]);}
  return top;}
function floatRock(g,x0,x1,y,depth,seed,o={}){return floatLand(g,x=>y+fbm2(x*.04,seed,2)*(o.bump??3),x0,x1,depth,seed,o);}
/* a rope bridge slung between a and b at one depth: planked deck, two hand-ropes, hangers */
function ropeBridge(g,a,b,sag,s=1){const N=Math.max(6,Math.round(Math.hypot(b[0]-a[0],b[1]-a[1])/(7*s))),pt=(u,dy,sg)=>[lerp(a[0],b[0],u),lerp(a[1],b[1],u)+4*u*(1-u)*sg+dy];
  const line=(dy,sg)=>{g.beginPath();for(let i=0;i<=N;i++){const p=pt(i/N,dy,sg);i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]);}g.stroke();};
  g.save();g.lineCap='round';g.lineWidth=2.4*s;line(0,sag);g.lineWidth=1.1*s;line(-9*s,sag*.7);
  g.beginPath();for(let i=1;i<N;i+=2){const p=pt(i/N,0,sag),q=pt(i/N,-9*s,sag*.7);g.moveTo(p[0],p[1]);g.lineTo(q[0],q[1]);}g.stroke();
  g.lineWidth=1.5*s;g.beginPath();for(let i=0;i<=N;i++){const p=pt(i/N,0,sag);g.moveTo(p[0],p[1]-1.8*s);g.lineTo(p[0],p[1]+1.8*s);}g.stroke();g.restore();}
/* a rope ladder hanging from a to b */
function ropeLadder(g,a,b,w,step=14,bow=8){const n=Math.max(2,Math.round(Math.hypot(b[0]-a[0],b[1]-a[1])/step)),P=u=>[lerp(a[0],b[0],u)+4*u*(1-u)*bow,lerp(a[1],b[1],u)];
  g.save();g.lineCap='round';g.lineWidth=1.8;g.beginPath();for(const sx of[-w/2,w/2]){for(let i=0;i<=n;i++){const p=P(i/n);i?g.lineTo(p[0]+sx,p[1]):g.moveTo(p[0]+sx,p[1]);}}g.stroke();
  g.lineWidth=2.4;g.beginPath();for(let i=1;i<n;i++){const p=P(i/n);g.moveTo(p[0]-w/2,p[1]);g.lineTo(p[0]+w/2,p[1]);}g.stroke();g.restore();}
/* a tunnel mouth: a dressed-stone surround and the dark inside, with a carved glyph over it. x,y is the middle of the threshold */
function portal(g,x,y,w,h,surround,dark,glyphName='pass'){const arch=(ww,hh,dy=0)=>{g.beginPath();g.moveTo(x-ww/2,y+dy);g.lineTo(x-ww/2,y-hh+ww/2);g.arc(x,y-hh+ww/2,ww/2,Math.PI,0);g.lineTo(x+ww/2,y+dy);g.closePath();g.fill();};
  g.fillStyle=surround;arch(w+w*.36,h+w*.2,1);g.fillStyle=dark;arch(w,h,1);g.strokeStyle=surround;glyph(g,glyphName,x,y-h-w*.34,w*.2,Math.max(1.2,w*.06));}
/* chimney smoke going off along direction ang (radians, screen: -PI/2 is up), soft puffs drifting and fading.
   bend turns the plume as it goes (radians by its end: wind bends a rising plume over), clk is the clock the puffs ride
   (song time, or something faster in a gust), len how far a puff goes before it fades, s the scale */
function smoke(g,x,y,ang,t,seed,s=1,bend=0,clk=t,len=80){const r=mulberry32(seed);g.save();for(let i=0;i<16;i++){const j=r(),ph=(((clk*.16+i/16+j*.05)%1)+1)%1,d=ph*len*s,a=ang+bend*ph*.5,ca=Math.cos(a),sa=Math.sin(a),wob=(Math.sin(t*.9+i*1.7)*6+(j-.5)*8)*s*ph,rad=(3+ph*12+j*3)*s,px=x+ca*d-sa*wob,py=y+sa*d+ca*wob;
  const al=.16*(1-ph)*sstep(0,.1,ph),gr=g.createRadialGradient(px,py,0,px,py,rad);gr.addColorStop(0,rgba([200,214,216],al));gr.addColorStop(1,rgba([200,214,216],0));g.fillStyle=gr;g.fillRect(px-rad,py-rad,rad*2,rad*2);}g.restore();}
/* smoke from a chimney at (x,y) on ground turned phi radians (onFrame's angle; 0 for level ground), bent over by wind w
   blowing to the right on screen. It leaves the chimney going "up" for that house, then turns downwind */
function plume(g,x,y,phi,t,seed,s,w,clk){const up=-Math.PI/2,wl=-phi,d=Math.atan2(Math.sin(wl-up),Math.cos(wl-up)),k=clamp(w,0,1.4);smoke(g,x,y,up+d*.3*k,t,seed,s,d*.95*k,clk,80+40*k);}
/* a rope bridge between two screen points at different depths: the deck narrows into the distance (wA near, wB far),
   hand-ropes on both sides, hangers between them. sway (px) swings the middle sideways-down, as wind or a walker moves it */
function spanBridge(g,A,B,wA,wB,sag,col,sway=0){const N=26,dx=B[0]-A[0],dy=B[1]-A[1],L=Math.hypot(dx,dy)||1,nx=-dy/L,ny=dx/L,P=[];
  for(let i=0;i<=N;i++){const u=i/N,k=4*u*(1-u);P.push({x:lerp(A[0],B[0],u)+k*sway*.4,y:lerp(A[1],B[1],u)+k*(sag+Math.abs(sway)*.3),w:lerp(wA,wB,u)});}
  const E=(sgn,up)=>P.map(p=>[p.x+nx*p.w*.5*sgn,p.y+ny*p.w*.5*sgn*.5-up*p.w]);const d0=E(-1,0),d1=E(1,0),h0=E(-1,.8),h1=E(1,.8);
  g.save();g.lineCap='round';g.lineJoin='round';g.strokeStyle=rgb(col);g.fillStyle=tintPattern(g,col,.3);
  for(let i=0;i<N;i++){const w=P[i].w;g.lineWidth=Math.max(1,w*.16);g.beginPath();g.moveTo(d0[i][0],d0[i][1]);g.lineTo(d1[i][0],d1[i][1]);g.stroke();}
  const line=(E,w)=>{g.beginPath();E.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));g.lineWidth=w;g.stroke();};
  line(d0,Math.max(1,wA*.07));line(d1,Math.max(1,wA*.07));line(h0,Math.max(.8,wA*.045));line(h1,Math.max(.8,wA*.045));
  g.beginPath();for(let i=0;i<=N;i+=2){for(const[h,d]of[[h0,d0],[h1,d1]]){g.moveTo(h[i][0],h[i][1]);g.lineTo(d[i][0],d[i][1]);}}g.lineWidth=Math.max(.7,wA*.03);g.stroke();
  // a little snow along the planks
  g.strokeStyle=rgba([214,232,230],.55);g.beginPath();for(let i=0;i<N;i+=1){g.moveTo(d0[i][0],d0[i][1]-1);g.lineTo(d0[i+1][0],d0[i+1][1]-1);}g.lineWidth=Math.max(1,wA*.05);g.stroke();g.restore();
  return P;}

/* ---------- things the wind moves (drawn live, each frame) ---------- */
/* a live shape lit like a baked piece: filled in the rim colour, then in paper shifted down a little, so only the
   upward-facing edges show the light. shape(g) adds the path; col is the paper colour (use fixed colours: each new
   colour bakes a new paper tile) */
function litFill(g,shape,col,rim=PAL.rim,off=1.6,k=.3){g.fillStyle=rgb(rim);g.beginPath();shape(g);g.fill();g.save();g.translate(0,off);g.fillStyle=tintPattern(g,col,k);g.beginPath();shape(g);g.fill();g.restore();}
/* washing on a line: a cloth pegged at a and b (its top corners), hanging L px, blown to the right by wind w (0..1.5).
   Its free edge swings out and up, the middle bellies downwind and a ripple runs along the hem */
function clothShape(g,a,b,L,t,w,ph=0){const W=clamp(w,0,1.6),th=W*.92+.14*W*Math.sin(t*8.3+ph)+.06*Math.sin(t*2.1+ph),s=Math.sin(th),c=Math.cos(th),
  A=[a[0]+s*L,a[1]+c*L],B=[b[0]+s*L*.93,b[1]+c*L*.93],bl=L*.2*Math.min(1,W)*(1+.35*Math.sin(t*6.1+ph));
  g.moveTo(a[0],a[1]);g.lineTo(b[0],b[1]);g.quadraticCurveTo((b[0]+B[0])/2+c*bl,(b[1]+B[1])/2-s*bl,B[0],B[1]);
  const ex=A[0]-B[0],ey=A[1]-B[1],el=Math.hypot(ex,ey)||1,nx=-ey/el,ny=ex/el;
  for(let i=1;i<=10;i++){const u=i/10,rp=L*.07*(.25+W)*Math.sin(u*Math.PI*2-t*(9+5*W)+ph)*Math.sin(u*Math.PI);g.lineTo(lerp(B[0],A[0],u)+nx*rp,lerp(B[1],A[1],u)+ny*rp);}
  g.quadraticCurveTo((a[0]+A[0])/2+c*bl*.8,(a[1]+A[1])/2-s*bl*.8,a[0],a[1]);g.closePath();}
/* a pennant or banner flying from a pole: (x,y) the top of its hoist, len long, hgt deep. In a calm it hangs down the pole;
   in wind w it lifts and streams to the right with a wave running down it. swallow cuts a forked tail */
function flagShape(g,x,y,len,hgt,t,w,ph=0,swallow=false){const W=clamp(w,0,1.6),lift=Math.min(1,W*1.25),phi=1.35*(1-lift)+.1*(1-lift)*Math.sin(t*2.3+ph),
  c=Math.cos(phi),s=Math.sin(phi),n=16,top=[],bot=[],P=(u,v)=>{const X=u*len*(.72+.28*lift),Y=v+hgt*(.1+.4*W)*u*Math.sin(u*4.6-t*(6+7*W)+ph)*(.35+.65*lift);return[x+X*c-Y*s,y+X*s+Y*c];};
  for(let i=0;i<=n;i++){const u=i/n,hh=hgt*(1-u*(swallow?.18:.9));top.push(P(u,0));bot.push(P(u,hh));}
  g.moveTo(top[0][0],top[0][1]);for(const p of top)g.lineTo(p[0],p[1]);if(swallow){const m=P(.8,hgt*.45);g.lineTo(m[0],m[1]);}for(let i=n;i>=0;i--)g.lineTo(bot[i][0],bot[i][1]);g.closePath();}
/* a weathervane on a rod at (x,y) (the rod's foot), h tall: the arrow turns to point where the wind comes from.
   yaw 0 shows it side-on pointing left; the silhouette narrows as it turns toward or away from us */
function weathervane(g,x,y,h,yaw,s=1){g.fillRect(x-1.6*s,y-h,3.2*s,h);g.fillRect(x-14*s,y-h*.62,28*s,2.4*s);ellipseFill(g,x-15*s,y-h*.62+1,3*s,3*s);ellipseFill(g,x+15*s,y-h*.62+1,3*s,3*s);
  g.save();g.translate(x,y-h-2*s);g.scale(Math.cos(yaw)||.04,1);g.fillRect(-26*s,-1.6*s,52*s,3.2*s);polyFill(g,[[-34*s,0],[-22*s,-8*s],[-22*s,8*s]]);polyFill(g,[[14*s,0],[30*s,-12*s],[34*s,-12*s],[26*s,0],[34*s,12*s],[30*s,12*s]]);g.restore();
  ellipseFill(g,x,y-h-2*s,3.4*s,3.4*s);}
/* a post windmill: a tapering tower and cap (bake this), with windmillSails() drawn live on top. (x,y) is the foot, h the
   height to the hub */
function windmill(g,x,y,h,s=1){polyFill(g,[[x-h*.2,y],[x-h*.12,y-h*.8],[x+h*.12,y-h*.8],[x+h*.2,y]]);polyFill(g,[[x-h*.16,y-h*.8],[x-h*.1,y-h*.98],[x+h*.08,y-h*1.02],[x+h*.16,y-h*.8]]);
  g.fillRect(x-h*.05,y-h*.34,h*.1,h*.16);}
/* its four sails turned to angle ang (radians; drive it with a wind clock so it speeds up in the gusts without jumping):
   a spar each, with a lattice sail on one side of it. Fill it (litFill works) */
function windmillSails(g,x,y,h,ang){const L=h*.62,cx=x+h*.04,cy=y-h*.9;for(let k=0;k<4;k++){const a=ang+k*Math.PI/2,c=Math.cos(a),s=Math.sin(a),nx=-s,ny=c,P=(u,v)=>[cx+c*u+nx*v,cy+s*u+ny*v];
  const sp=[P(0,-h*.012),P(L,-h*.008),P(L,h*.008),P(0,h*.012)];g.moveTo(sp[0][0],sp[0][1]);sp.forEach(p=>g.lineTo(p[0],p[1]));g.closePath();
  for(let i=0;i<5;i++){const u0=L*(.25+i*.15),u1=u0+L*.11,q=[P(u0,h*.02),P(u1,h*.02),P(u1,h*.14),P(u0,h*.14)];g.moveTo(q[0][0],q[0][1]);q.forEach(p=>g.lineTo(p[0],p[1]));g.closePath();}
  const r=[P(L*.25,h*.14),P(L,h*.14),P(L,h*.155),P(L*.25,h*.155)];g.moveTo(r[0][0],r[0][1]);r.forEach(p=>g.lineTo(p[0],p[1]));g.closePath();}
  g.moveTo(cx+h*.03,cy);g.arc(cx,cy,h*.03,0,Math.PI*2);}
/* grass along a ground line y(x): tufts of blades bending right as the wind bends them. windX(x) gives the bend at x;
   o: {h (tallest blade), step (spacing), tallP (share of tall tufts)}. Adds a path: fill it (litFill) */
function grassBlades(g,x0,x1,y,t,windX,seed,o={}){const r=mulberry32(seed),hmax=o.h??26,step=o.step??7;
  for(let x=x0;x<x1;x+=step*(.5+r())){const n=2+((r()*3)|0),base=y(x)+2,w=windX(x);for(let k=0;k<n;k++){const bx=x+(r()-.5)*6,h=hmax*(.35+r()*.8)*(r()<(o.tallP??.15)?1.8:1),
    b=(r()-.5)*.35+w*(.9+r()*.4)+.12*w*Math.sin(t*(7+r()*5)+r()*6),tx=bx+Math.sin(b)*h,ty=base-Math.cos(b)*h,mx=bx+Math.sin(b*.45)*h*.55,my=base-Math.cos(b*.45)*h*.55,bw=1.4+r()*1.6;
    g.moveTo(bx-bw,base);g.quadraticCurveTo(mx-bw*.6,my,tx,ty);g.quadraticCurveTo(mx+bw*.6,my,bx+bw,base);g.closePath();}}}
