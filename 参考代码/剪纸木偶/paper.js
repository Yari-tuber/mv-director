'use strict';
/* ===== paper: baking cut pieces =====
   A piece is a silhouette cut from one tinted sheet. Baking gives it:
   - the paper texture (tinted tile),
   - a mist band near its base (light between the layers),
   - a rim: a thin bright line along upward-facing edges, where the light behind catches the cut,
   - a soft shadow sprite, drawn a little below and behind it on the layers further back.
   Coordinates are "rest" picture coordinates: where the piece sits in the 1920x960 frame with the camera at rest. */
function bakePiece(o){
  const s=o.s||1,pad=Math.ceil((o.pad??40)*s),cw=Math.ceil(o.w*s)+2*pad,ch=Math.ceil(o.h*s)+2*pad;
  const toLocal=(g)=>g.setTransform(s,0,0,s,pad-o.x*s,pad-o.y*s);
  const M=mk(cw,ch),m=M.getContext('2d');toLocal(m);m.fillStyle='#000';m.strokeStyle='#000';o.shape(m);
  const C=mk(cw,ch),g=C.getContext('2d');
  g.fillStyle=tintPattern(g,o.color,o.tex??.35,s*(o.texScale||1));g.fillRect(0,0,cw,ch);
  if(o.grad){toLocal(g);const gr=g.createLinearGradient(0,o.grad.y0,0,o.grad.y1);gr.addColorStop(0,rgba(o.grad.c0,o.grad.a0??1));gr.addColorStop(1,rgba(o.grad.c1,o.grad.a1??1));g.fillStyle=gr;g.fillRect(o.x-50,o.y-50,o.w+100,o.h+100);g.setTransform(1,0,0,1,0,0);}
  if(o.fog){toLocal(g);const f=o.fog,gr=g.createLinearGradient(0,f.y1,0,f.y0);gr.addColorStop(0,rgba(f.c,0));gr.addColorStop(1,rgba(f.c,f.a));g.fillStyle=gr;g.fillRect(o.x-50,Math.min(f.y0,f.y1),o.w+100,Math.abs(f.y0-f.y1)+400);g.setTransform(1,0,0,1,0,0);}
  g.globalCompositeOperation='destination-in';g.drawImage(M,0,0);g.globalCompositeOperation='source-over';
  if(o.rimA){const R=mk(cw,ch),r=R.getContext('2d');
    const rim=(w,blur,a)=>{r.setTransform(1,0,0,1,0,0);r.globalCompositeOperation='source-over';r.clearRect(0,0,cw,ch);r.drawImage(M,0,0);r.globalCompositeOperation='destination-out';r.drawImage(M,(o.rimDx||0)*s,w*s);
      r.globalCompositeOperation='source-in';r.fillStyle=rgb(o.rim||[200,236,226]);r.fillRect(0,0,cw,ch);g.save();g.globalCompositeOperation='source-atop';g.globalAlpha=a;if(blur)g.filter=`blur(${blur*s}px)`;g.drawImage(R,0,0);g.restore();};
    rim((o.rimW||2)*3.2,(o.rimW||2)*1.6,o.rimA*.35);   // halo: the glow soaking into the paper
    rim(o.rimW||2,.35,o.rimA);}                          // the lit cut edge itself
  if(o.after){g.save();toLocal(g);o.after(g,s);g.restore();}
  let SH=null;if(o.shadow){SH=mk(cw,ch);const q=SH.getContext('2d');q.filter=`blur(${o.shadow.blur*s}px)`;q.drawImage(M,0,0);q.filter='none';q.globalCompositeOperation='source-in';q.fillStyle=rgb(o.shadow.c||[0,4,8]);q.fillRect(0,0,cw,ch);}
  return{img:C,sh:SH,shadow:o.shadow,x:o.x-pad/s,y:o.y-pad/s,w:cw/s,h:ch/s,s};
}
function drawPiece(g,p,alpha=1){
  if(p.sh&&p.shadow.a>0){g.globalAlpha=p.shadow.a*alpha;g.drawImage(p.sh,p.x+(p.shadow.dx||0),p.y+(p.shadow.dy||0),p.w,p.h);}
  g.globalAlpha=alpha;g.drawImage(p.img,p.x,p.y,p.w,p.h);g.globalAlpha=1;
}
/* brighten a piece as if the light behind it grew stronger (additive copy of itself) */
function glowPiece(g,p,k){if(k<=0.001)return;g.save();g.globalCompositeOperation='lighter';g.globalAlpha=Math.min(1,k);g.drawImage(p.img,p.x,p.y,p.w,p.h);g.restore();}
/* draw a piece bent about its base (bx,by), the way a tree or a pole bends in the wind. The top moves A px sideways
   (A>0: to the right) and each height h above the base moves A*(h/Hb)^2, dropping a little so it doesn't stretch.
   Drawn in n horizontal slices, each sheared to meet its neighbours (overlapping a pixel, so no gap shows); below the
   base the piece is drawn straight. */
function drawBent(g,p,bx,by,A,n=14,alpha=1){if(Math.abs(A)<.05){drawPiece(g,p,alpha);return;}
  const Hb=Math.max(1,by-p.y),s=p.s,M0=g.getTransform(),H4=Hb*Hb*Hb*Hb;
  const dx=h=>A*h*h/(Hb*Hb),dxp=h=>2*A*h/(Hb*Hb),dy=h=>A*A*h*h*h/(2*H4),dyp=h=>1.5*A*A*h*h/H4;
  const pass=(img,ox,oy,a,ovl)=>{g.globalAlpha=a;
    const below=p.y+p.h-by;if(below>0){g.setTransform(M0);g.drawImage(img,0,(by-p.y)*s,img.width,below*s,p.x+ox,by+oy,p.w,below);}
    for(let i=0;i<n;i++){const h0=Hb*i/n,h1=Hb*(i+1)/n,hm=(h0+h1)/2,ym=by-hm,ov=i?ovl:0,top=by-h1,sl=h1-h0+ov;
      g.setTransform(M0);g.transform(1,0,-dxp(hm),1-dyp(hm),dx(hm)+dxp(hm)*ym,dy(hm)+dyp(hm)*ym);
      g.drawImage(img,0,(top-p.y)*s,img.width,sl*s,p.x+ox,top+oy,p.w,sl);}};
  if(p.sh&&p.shadow.a>0)pass(p.sh,p.shadow.dx||0,p.shadow.dy||0,p.shadow.a*alpha,0);   // the soft shadow can't overlap itself: it would darken in lines
  pass(p.img,0,0,alpha,1.2);g.setTransform(M0);g.globalAlpha=1;}
/* where a point (x,y) of piece p ends up when drawBent(g,p,bx,by,A) bends it: for things attached to it (leaves, snow) */
function bentPoint(p,bx,by,A,x,y){const Hb=Math.max(1,by-p.y),h=Math.max(0,by-y),d=A*h*h/(Hb*Hb);return[x+d,y+d*d/(2*Math.max(h,1))];}

/* ---------- shape helpers ---------- */
function polyFill(g,pts){g.beginPath();pts.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));g.closePath();g.fill();}
/* a jagged ridge line from x0 to x1, filled down to yBottom */
function ridgeShape(g,pts,yBottom){g.beginPath();g.moveTo(pts[0][0],yBottom);for(const p of pts)g.lineTo(p[0],p[1]);g.lineTo(pts[pts.length-1][0],yBottom);g.closePath();g.fill();}
function ridgePoints(x0,x1,step,fn){const out=[];for(let x=x0;x<=x1+1e-6;x+=step)out.push([x,fn(x)]);return out;}
/* a tapered limb or branch: quad from (x0,y0) width w0 to (x1,y1) width w1, with round joints */
function taper(g,x0,y0,x1,y1,w0,w1,capStart=true,capEnd=true){const dx=x1-x0,dy=y1-y0,L=Math.hypot(dx,dy)||1,nx=-dy/L,ny=dx/L;
  g.beginPath();g.moveTo(x0+nx*w0/2,y0+ny*w0/2);g.lineTo(x1+nx*w1/2,y1+ny*w1/2);g.lineTo(x1-nx*w1/2,y1-ny*w1/2);g.lineTo(x0-nx*w0/2,y0-ny*w0/2);g.closePath();g.fill();
  if(capStart){g.beginPath();g.arc(x0,y0,w0/2,0,Math.PI*2);g.fill();}if(capEnd){g.beginPath();g.arc(x1,y1,w1/2,0,Math.PI*2);g.fill();}}
function leaf(g,x,y,a,l,wk=.42){g.beginPath();leafPath(g,x,y,a,l,wk);g.fill();}
/* the same leaf added to the current path, so many leaves can be filled at once */
function leafPath(g,x,y,a,l,wk=.42){const c=Math.cos(a),s=Math.sin(a),w=l*wk;g.moveTo(x-c*l/2,y-s*l/2);g.quadraticCurveTo(x-s*w,y+c*w,x+c*l/2,y+s*l/2);g.quadraticCurveTo(x+s*w,y-c*w,x-c*l/2,y-s*l/2);g.closePath();}
function ellipseFill(g,x,y,rx,ry,a=0){g.beginPath();g.ellipse(x,y,rx,ry,a,0,Math.PI*2);g.fill();}
