import{At as e,Mt as t,Nt as n,Ot as r,Pt as i,_n as a,cn as o,gn as s,ln as c,m as l,r as u,un as d,z as f}from"./music.js";import{s as p}from"./app.js";function m(e){let t=c/Math.max(1,o);return t>=1?[e,Math.max(8,Math.round(e/t))]:[Math.max(8,Math.round(e*t)),e]}function h(e){d.imageSmoothingEnabled=!0,d.imageSmoothingQuality=`high`,d.drawImage(e,0,0,c,o)}function g(e=3){let t=0,n=0;return r=>{let i=u.bass,a=i>.4&&i-t>.22&&n<=0;return t+=(i-t)*Math.min(1,r*1.2),n-=r,a&&(n=e),a}}var _=e=>e<=0?0:e>=1?1:e*e*(3-2*e);function v(r={}){let i=!!r.beat,l=[[38,56,148],[176,36,72],[18,122,134],[206,142,36],[104,40,122],[222,88,66],[24,84,160]],f,p,_,v,y,b,x,S,C,w,T,E,D,O,k,A,j,M,N,P,F=0,I=g(i?.22:4),L=(e,t,n)=>e[Math.min(p-1,Math.max(0,n))*f+Math.min(f-1,Math.max(0,t))];function R(e,t,n){t<0?t=0:t>f-1.001&&(t=f-1.001),n<0?n=0:n>p-1.001&&(n=p-1.001);let r=t|0,i=n|0,a=t-r,o=n-i,s=i*f+r;return(e[s]*(1-a)+e[s+1]*a)*(1-o)+(e[s+f]*(1-a)+e[s+f+1]*a)*o}function z(e,t,n,r,i,a,o){let s=n*n,c=Math.max(0,Math.floor(e-n*2)),l=Math.min(f-1,Math.ceil(e+n*2)),u=Math.max(0,Math.floor(t-n*2)),d=Math.min(p-1,Math.ceil(t+n*2));for(let n=u;n<=d;n++)for(let a=c;a<=l;a++){let o=Math.exp(-((a-e)**2+(n-t)**2)/s),c=n*f+a;y[c]+=r*o,b[c]+=i*o}if(!a)return;let m=n*2*.7,h=m*m,g=e*2+.5,x=t*2+.5;for(let e=Math.max(0,Math.floor(x-m*2));e<=Math.min(v-1,Math.ceil(x+m*2));e++)for(let t=Math.max(0,Math.floor(g-m*2));t<=Math.min(_-1,Math.ceil(g+m*2));t++){let n=Math.exp(-((t-g)**2+(e-x)**2)/h)*o,r=(e*_+t)*3;E[r]+=a[0]*n,E[r+1]+=a[1]*n,E[r+2]+=a[2]*n}}function B(e=1){let t=l[F%l.length].map(e=>-Math.log(Math.max(.04,e/255))),r=i?f*n(.08,.92):f*(.2+.6*((F*.618+.3)%1));N.push({x:r,y:p*n(.06,.22),vy:p*n(.22,.32)*(i?.8+.8*e:1),wob:n(0,6),life:0,c:t,r:Math.max(1.6,Math.min(f,p)/(i?24:30))*(i?.7+.6*e:1),amt:i?8:4.5}),F++}function V(){for(let e=0;e<p;e++)for(let t=0;t<f;t++)w[e*f+t]=-.5*(L(y,t+1,e)-L(y,t-1,e)+L(b,t,e+1)-L(b,t,e-1));let e=a?10:18;for(let t=0;t<e;t++)for(let e=0;e<p;e++)for(let t=0;t<f;t++)C[e*f+t]=(w[e*f+t]+L(C,t-1,e)+L(C,t+1,e)+L(C,t,e-1)+L(C,t,e+1))*.25;for(let e=0;e<p;e++)for(let t=0;t<f;t++){let n=e*f+t;y[n]-=.5*(L(C,t+1,e)-L(C,t-1,e)),b[n]-=.5*(L(C,t,e+1)-L(C,t,e-1)),(t===0||t===f-1)&&(y[n]=0),(e===0||e===p-1)&&(b[n]=0)}}function H(e,t){for(let e=0;e<p;e++)for(let t=0;t<f;t++)T[e*f+t]=.5*(L(b,t+1,e)-L(b,t-1,e)-L(y,t,e+1)+L(y,t,e-1));for(let n=1;n<p-1;n++)for(let r=1;r<f-1;r++){let i=n*f+r,a=.5*(Math.abs(T[i+1])-Math.abs(T[i-1])),o=.5*(Math.abs(T[i+f])-Math.abs(T[i-f])),s=Math.hypot(a,o)+1e-5;y[i]+=t*e*(o/s)*T[i],b[i]-=t*e*(a/s)*T[i]}}return{init(){[f,p]=m(a?88:120),_=f*2,v=p*2;let r=f*p;[y,b,x,S,C,w,T]=Array.from({length:7},()=>new Float32Array(r)),E=new Float32Array(_*v*3),D=new Float32Array(_*v*3),O=new Float32Array(_*v*3);for(let e=0;e<v;e++)for(let t=0;t<_;t++){let n=t/_-.5,r=e/v-.42,i=.82+.2*Math.exp(-(n*n*3+r*r*2.4))-.1*(e/v)**2,a=(e*_+t)*3;O[a]=236*i,O[a+1]=244*i,O[a+2]=246*i}[k,A]=t(_,v),j=A.createImageData(_,v);let i;[M,i]=e(c,o);let s=i.createLinearGradient(0,0,c,0);s.addColorStop(0,`rgba(40,70,80,.22)`),s.addColorStop(.08,`rgba(255,255,255,.0)`),s.addColorStop(.16,`rgba(255,255,255,.06)`),s.addColorStop(.22,`rgba(255,255,255,0)`),s.addColorStop(.9,`rgba(255,255,255,0)`),s.addColorStop(1,`rgba(40,70,80,.22)`),i.fillStyle=s,i.fillRect(0,0,c,o);let u=i.createLinearGradient(0,0,0,o*.06);u.addColorStop(0,`rgba(120,160,170,.25)`),u.addColorStop(1,`rgba(255,255,255,0)`),i.fillStyle=u,i.fillRect(0,0,c,o*.06),N=[],P=1,F=Math.floor(n(0,l.length)),B()},draw(e,t){let r=t*(s?1.6:1);if(P-=r,i){if(I(t)){let e=1+(u.bass>.7?2:+(u.bass>.55));for(let t=0;t<e;t++)B(Math.min(1,u.bass));P=2.5}else P<=0&&(B(.4),P=n(2,3.5))}else(P<=0||I(t))&&(B(),P=n(6,10));for(let e=N.length-1;e>=0;e--){let t=N[e];t.life+=r;let n=Math.max(0,1-t.life/2.6);z(t.x+Math.sin(t.life*3+t.wob)*.3,t.y,t.r,0,t.vy*r*3*n,n>0?t.c:null,r*t.amt*n),t.y+=t.vy*r,t.vy*=Math.exp(-r*.9),n<=0&&N.splice(e,1)}let a=e*.07,l=f*.004*(1+u.mid*(i?2.5:1.5));for(let e=0;e<p;e++)for(let t=0;t<f;t++){let n=e*f+t,i=t/f*6.28,o=e/p*6.28;y[n]+=Math.sin(o*1.3+a)*l*r,b[n]+=Math.sin(i*1.1-a*.8)*l*r*.6}H(r,i?4.5+3*u.treble:3),V();for(let e=0;e<p;e++)for(let t=0;t<f;t++){let n=e*f+t;x[n]=R(y,t-r*y[n],e-r*b[n])*(1-r*.08),S[n]=R(b,t-r*y[n],e-r*b[n])*(1-r*.08)}[y,x]=[x,y],[b,S]=[S,b];let m=1-r*(i?.02:.009);for(let e=0;e<v;e++)for(let t=0;t<_;t++){let n=(t-.5)*.5,i=(e-.5)*.5,a=t-2*r*R(y,n,i),o=e-2*r*R(b,n,i);a<0?a=0:a>_-1.001&&(a=_-1.001),o<0?o=0:o>v-1.001&&(o=v-1.001);let s=a|0,c=o|0,l=a-s,u=o-c,d=(c*_+s)*3,f=d+3,p=d+_*3,h=p+3,g=(e*_+t)*3,x=(1-l)*(1-u),S=l*(1-u),C=(1-l)*u,w=l*u;for(let e=0;e<3;e++)D[g+e]=(E[d+e]*x+E[f+e]*S+E[p+e]*C+E[h+e]*w)*m}[E,D]=[D,E];let g=j.data;for(let e=0,t=0;e<E.length;e+=3,t+=4)g[t]=O[e]*Math.exp(-E[e]),g[t+1]=O[e+1]*Math.exp(-E[e+1]),g[t+2]=O[e+2]*Math.exp(-E[e+2]),g[t+3]=255;A.putImageData(j,0,0),h(k),d.drawImage(M,0,0,c,o)}}}function y(){let e,r,i,o,c,l,d,f,p,v,y=.0545,b=.062,x=8,S=g(5);function C(t,a){for(let s=0;s<t;s++){let t=n(0,e)|0,s=n(0,r)|0;for(let c=-a;c<=a;c++)for(let l=-a;l<=a;l++)if(l*l+c*c<=a*a){let a=(s+c+r)%r*e+(t+l+e)%e;o[a]=.5+n(0,.2),i[a]=.4}}}function w(){for(let t=0;t<r;t++){let n=t*e,a=(t-1+r)%r*e,s=(t+1)%r*e;for(let t=0;t<e;t++){let r=t===0?e-1:t-1,u=t===e-1?0:t+1,d=n+t,f=i[d],p=o[d],m=.2*(i[n+r]+i[n+u]+i[a+t]+i[s+t])+.05*(i[a+r]+i[a+u]+i[s+r]+i[s+u])-f,h=.2*(o[n+r]+o[n+u]+o[a+t]+o[s+t])+.05*(o[a+r]+o[a+u]+o[s+r]+o[s+u])-p,g=f*p*p;c[d]=f+m-g+y*(1-f),l[d]=p+.5*h+g-(b+y)*p}}[i,c]=[c,i],[o,l]=[l,o]}return{init(){[e,r]=m(a?160:240),i=new Float32Array(e*r).fill(1),o=new Float32Array(e*r),c=new Float32Array(e*r),l=new Float32Array(e*r),C(Math.round(e*r/160)+8,3);for(let e=0;e<(a?600:1200);e++)w();[d,f]=t(e,r),p=f.createImageData(e,r),v=new Float32Array(e*r*3);let s=[[236,118,96],[118,200,188],[242,204,128]],u=n(0,6.28);for(let t=0;t<r;t++)for(let n=0;n<e;n++){let i=n/e*6.28,a=t/r*6.28,o=(t*e+n)*3,c=.5+.5*Math.sin(i*.7+a*.4+u),l=.5+.5*Math.sin(a*.8-i*.3+u*2);for(let e=0;e<3;e++)v[o+e]=s[0][e]*(1-c)*(1-l*.6)+s[1][e]*c*(1-l*.6)+s[2][e]*l*.6}},draw(t,i){let c=.5+.5*Math.sin(t*6.28/300);y=.0367+(.0545-.0367)*c,b=.0649+-.0029*c,x-=i,(x<=0||S(i))&&(C(1,3),x=n(10,16));let l=Math.round((a?3:5)*(s?2:1)*(1+u.mid*.6));for(let e=0;e<l;e++)w();let m=p.data,g=1+u.bass*.12;for(let t=0;t<r;t++){let n=t*e,i=(t-1+r)%r*e;for(let t=0;t<e;t++){let r=n+t,a=o[r],s=(a-o[n+(t===0?e-1:t-1)]+(a-o[i+t]))*3.2,c=_((a-.05)*3.4),l=c*c*c*.3,u=r*4,d=r*3,f=(1+Math.min(0,s))*g,p=Math.max(0,s)*255;m[u]=(12+(v[d]*.8-12)*c+255*l)*f+p,m[u+1]=(22+(v[d+1]*.8-22)*c+240*l)*f+p,m[u+2]=(40+(v[d+2]*.8-40)*c+225*l)*f+p,m[u+3]=255}}f.putImageData(p,0,0),h(d)}}}function b(){let t=[8,10,22],r,l,f,p,m,h,g,_=0,v=0,y,b=e=>{m[e]=n(-10,c+10),h[e]=n(-10,o+10),g[e]=n(3,12)};return{init(){[r,l]=e(c,o),l.fillStyle=i(t),l.fillRect(0,0,c,o);let s;[f,s]=e(c,o);let u=s.createRadialGradient(c/2,o/2,Math.min(c,o)*.3,c/2,o/2,Math.hypot(c,o)*.6);u.addColorStop(0,`rgba(4,5,12,0)`),u.addColorStop(1,`rgba(4,5,12,.6)`),s.fillStyle=u,s.fillRect(0,0,c,o),p=Math.round((a?1400:4200)*Math.min(1.3,Math.max(.5,c*o/13e5))),m=new Float32Array(p),h=new Float32Array(p),g=new Float32Array(p);for(let e=0;e<p;e++)b(e);let d=Math.min(c,o);y=Array.from({length:5},(e,t)=>{let r=n(0,6.28),i=(1.6+t*1.1)/d*6.28;return{kx:Math.cos(r)*i,ky:Math.sin(r)*i,w:n(-.35,.35),ph:n(0,6.28),amp:1/(1+t*.7)/i}})},draw(e,n){_+=n*(s?2:1)*(1+u.mid*2.5);let a=Math.min(c,o)*.07*(s?1.8:1)*(1+u.bass*.35);l.globalCompositeOperation=`source-over`,l.fillStyle=i(t,++v%24?.014:.08),l.fillRect(0,0,c,o),l.lineWidth=Math.max(1,Math.min(c,o)/700),l.lineCap=`round`;let x=190+e/4%360;for(let e=0;e<6;e++){l.strokeStyle=`hsla(${(x+e*22)%360},66%,${64+e*3}%,.75)`,l.beginPath();for(let t=e;t<p;t+=6){let e=m[t],r=h[t],i=0,s=0;for(let t of y){let n=t.amp*Math.cos(t.kx*e+t.ky*r+t.w*_+t.ph);i+=n*t.ky,s-=n*t.kx}let u=e+i*a*n*1.6,d=r+s*a*n*1.6;g[t]-=n,g[t]<=0||u<-20||u>c+20||d<-20||d>o+20?b(t):(l.moveTo(e,r),l.lineTo(u,d),m[t]=u,h[t]=d)}l.stroke()}d.drawImage(r,0,0,c,o),d.drawImage(f,0,0,c,o)}}}var x=()=>p(`
vec2 h22(vec2 p){ return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
vec2 site(vec2 c, float t){ vec2 o = h22(c); return .5 + .38 * sin(t * (.5 + .5 * o.yx) + 6.2831 * o); }
float wgt(vec2 c, float t){ float o = h22(c + 7.3).x; return .2 * sin(t * (.3 + .25 * o) + o * 40.); }
// A power diagram: each site carries a weight that swells and shrinks, so cells grow, vanish into their neighbours and return.
vec3 cells(vec2 x, float t){
  vec2 n = floor(x), f = fract(x), mg = vec2(0.), mr = vec2(0.); float md = 1e9, mw = 0.;
  for (int j = -2; j <= 2; j++) for (int i = -2; i <= 2; i++) {
    vec2 g = vec2(float(i), float(j)), r = g + site(n + g, t) - f; float w = wgt(n + g, t), d = dot(r, r) - w;
    if (d < md) { md = d; mr = r; mg = g; mw = w; }
  }
  float bd = 1e9;
  for (int j = -2; j <= 2; j++) for (int i = -2; i <= 2; i++) {
    vec2 g = mg + vec2(float(i), float(j)), r = g + site(n + g, t) - f; float w = wgt(n + g, t);
    vec2 e = r - mr; float l = length(e);
    if (l > .0001) bd = min(bd, (dot(r, r) - dot(mr, mr) - w + mw) / (2. * l));
  }
  return vec3(bd, n + mg);
}
vec3 jewel(float h){
  if (h < .16) return vec3(.62, .05, .1);
  if (h < .32) return vec3(.06, .17, .62);
  if (h < .46) return vec3(.04, .45, .26);
  if (h < .6) return vec3(.92, .55, .08);
  if (h < .72) return vec3(.42, .12, .55);
  if (h < .86) return vec3(.04, .42, .52);
  return vec3(.82, .8, .62);
}
void main(){
  vec2 uv = (gl_FragCoord.xy - .5 * uRes) / min(uRes.x, uRes.y);
  float t = uT * .12;
  vec2 p = uv * 4.2 + vec2(t * .25, t * .1);
  vec3 c = cells(p, t);
  float bd = c.x;
  float hId = h21(c.yz * 1.37 + 3.1);
  vec3 glass = jewel(hId);
  float mott = .78 + .35 * fbm(p * 2.6 + c.yz * 4.1);
  float streak = .92 + .08 * sin((p.x + p.y * .3) * 30. + fbm(p * 4.) * 6.);
  vec2 lp = vec2(.25 * sin(uT * .013), .45);
  float light = .35 + 1.05 * exp(-dot(uv - lp, uv - lp) * 1.6) + .15 * uLevel;
  light *= 1. + .3 * uMid;
  float thick = smoothstep(.0, .2, bd);
  vec3 col = glass * light * mott * streak * (.55 + .45 * thick);
  col += glass * glass * .5 * smoothstep(.75, 1.2, light) * thick;
  float lw = .055;
  float lead = smoothstep(lw, lw * .75, bd);
  float prof = clamp(bd / lw, 0., 1.);
  vec3 leadc = vec3(.05, .05, .055) + vec3(.16, .15, .14) * pow(sin(prof * PI) * .5 + .5 * (1. - prof), 3.) * (.6 + .4 * light);
  col = mix(col, leadc, lead);
  col *= smoothstep(1.35, .25, length(uv * vec2(.85, 1.)));
  gl_FragColor = vec4(pow(col, vec3(.85)), 1.);
}`,{speed:1});function S(){let i,u,p,m,h,g,_,v,y,b,x=new Float32Array(8),S=0,C=[1,3,6,10,16,26,40,64,104],w=[1,2,3,4,5,3,7,5],T=[1,3,2,5,4,7,6,8],E=Array.from({length:16},()=>n(0,6.28));function D(e,t,n,r,i,a){e.beginPath(),e.moveTo(t+a,n),e.arcTo(t+r,n,t+r,n+i,a),e.arcTo(t+r,n+i,t,n+i,a),e.arcTo(t,n+i,t,n,a),e.arcTo(t,n,t+r,n,a),e.closePath()}let O=e=>D(e,g,_,v,y,b);function k(e,t){let n=g+v/2,r=_+y/2,i=(e-n)/(v/2),a=(t-r)/(y/2),o=1-.05*(i*i+a*a);return[n+(e-n)*o,r+(t-r)*o]}return{init(){let n=Math.min(c,o),r=n*.055;g=r,_=r,v=c-r*2,y=o-r*2,b=n*.09;let a;[i,a]=e(c,o);let s=a.createLinearGradient(0,0,0,o);s.addColorStop(0,`#2a2b27`),s.addColorStop(1,`#141512`),a.fillStyle=s,a.fillRect(0,0,c,o),a.strokeStyle=`rgba(255,255,240,.06)`,a.lineWidth=2,D(a,g-r*.45,_-r*.45,v+r*.9,y+r*.9,b*1.3),a.stroke();let l=a.createRadialGradient(c/2,o/2,0,c/2,o/2,Math.hypot(v,y)/2);l.addColorStop(0,`#0d1a12`),l.addColorStop(.7,`#07100a`),l.addColorStop(1,`#020503`),a.fillStyle=l,O(a),a.fill();let d=n*.1,f=c/2,x=o/2,S=Math.floor(v/2/d),C=Math.floor(y/2/d);a.strokeStyle=`rgba(120,220,150,.10)`,a.lineWidth=1;let w=(e,t,n,r)=>{a.beginPath();for(let i=0;i<=24;i++){let[o,s]=k(e+(n-e)*i/24,t+(r-t)*i/24);i?a.lineTo(o,s):a.moveTo(o,s)}a.stroke()};for(let e=-S;e<=S;e++)w(f+e*d,x-C*d,f+e*d,x+C*d);for(let e=-C;e<=C;e++)w(f-S*d,x+e*d,f+S*d,x+e*d);a.strokeStyle=`rgba(120,220,150,.16)`;for(let e=-S*5;e<=S*5;e++){let[t,n]=k(f+e*d/5,x);a.beginPath(),a.moveTo(t,n-3),a.lineTo(t,n+3),a.stroke()}for(let e=-C*5;e<=C*5;e++){let[t,n]=k(f,x+e*d/5);a.beginPath(),a.moveTo(t-3,n),a.lineTo(t+3,n),a.stroke()}[u,a]=e(c,o),a.save(),O(a),a.clip(),a.fillStyle=`rgba(0,0,0,.22)`;for(let e=_;e<_+y;e+=3)a.fillRect(g,e,v,1);let T=a.createRadialGradient(c/2,o/2,Math.min(v,y)*.3,c/2,o/2,Math.hypot(v,y)*.55);T.addColorStop(0,`rgba(0,0,0,0)`),T.addColorStop(1,`rgba(0,0,0,.75)`),a.fillStyle=T,a.fillRect(0,0,c,o);let E=a.createRadialGradient(g+v*.3,_+y*.18,0,g+v*.3,_+y*.18,Math.max(v,y)*.45);E.addColorStop(0,`rgba(220,240,230,.07)`),E.addColorStop(1,`rgba(220,240,230,0)`),a.fillStyle=E,a.fillRect(0,0,c,o),a.restore(),a.strokeStyle=`rgba(0,0,0,.6)`,a.lineWidth=n*.012,O(a),a.stroke(),[p,m]=e(c,o),h=[2,4,8].map(e=>t(c/e,o/e))},draw(e,t){let n=f(),g=Math.min(c,o),_=0;for(let e=0;e<8;e++){let r=0;for(let t=C[e];t<C[e+1];t++)r+=n[t];let i=r/(C[e+1]-C[e])/255;x[e]+=(i-x[e])*Math.min(1,t*5),_+=x[e]}S+=((l&&_>.15?1:0)-S)*Math.min(1,t*.6);let b=s?2:1;for(let e=0;e<16;e++)E[e]+=t*b*(.04+.03*Math.sin(e*1.7))*(1+(e<8?x[e]:x[e-8])*.8);m.globalCompositeOperation=`destination-out`,m.fillStyle=`rgba(0,0,0,${Math.min(1,t*3.2)})`,m.fillRect(0,0,c,o),m.globalCompositeOperation=`lighter`;let D=a?360:640,A=Math.min(v,y)*.36*(1+S*_*.02),j=c/2,M=o/2,N=new Float32Array(D*2+2);for(let e=0;e<=D;e++){let t=e/D*6.2832,n=Math.sin(3*t+E[0]),r=Math.sin(2*t+E[1]*.5);if(S>.001){let e=0,i=0;for(let n=0;n<8;n++)e+=x[n]*Math.sin(w[n]*t+E[n]),i+=x[n]*Math.sin(T[n]*t+E[n+8]);let a=1.1/Math.max(.3,_);n+=(e*a-n)*S,r+=(i*a-r)*S}[N[e*2],N[e*2+1]]=k(j+n*A,M-r*A)}let P=(e,t)=>{m.lineWidth=e,m.strokeStyle=t,m.beginPath(),m.moveTo(N[0],N[1]);for(let e=1;e<=D;e++)m.lineTo(N[e*2],N[e*2+1]);m.stroke()};m.lineJoin=`round`,P(g*.008,`rgba(60,255,120,.016)`),P(Math.max(1,g*.0025),`rgba(170,255,190,.06)`),m.globalCompositeOperation=`source-over`,d.drawImage(i,0,0,c,o),d.save(),O(d),d.clip(),d.globalCompositeOperation=`lighter`,d.drawImage(p,0,0,c,o);let F=p;for(let[e,t]of h)t.clearRect(0,0,e.width,e.height),t.drawImage(F,0,0,e.width,e.height),F=e;d.imageSmoothingEnabled=!0,d.imageSmoothingQuality=`high`,d.globalAlpha=.8,d.drawImage(F,0,0,c,o),d.drawImage(h[1][0],0,0,c,o),d.globalAlpha=.5,r(d,c/2,o/2,A*1.6,[40,160,80],.05+.05*S*_/3),d.restore(),d.drawImage(u,0,0,c,o)}}}function C(){let t,i,l,f,p,m,h,_,v,y,b,x,S,C,w=14,T=g(8);return{init(){let s=Math.min(c,o),u=o*.8,d;[t,d]=e(c,o);let g=d.createLinearGradient(0,0,0,u);g.addColorStop(0,`#1c2342`),g.addColorStop(.4,`#4b4a72`),g.addColorStop(.72,`#b07686`),g.addColorStop(.9,`#e69a72`),g.addColorStop(1,`#f2bf80`),d.fillStyle=g,d.fillRect(0,0,c,u+2),r(d,c*.68,u,Math.max(c,o)*.45,[255,196,130],.5),r(d,c*.68,u,s*.12,[255,230,180],.7);for(let e=0;e<9;e++){let t=u*n(.35,.85),r=c*n(.25,.6),i=n(-.1,1)*c;d.fillStyle=`rgba(${e%2?`240,170,150`:`120,90,130`},${n(.06,.14)})`,d.beginPath(),d.ellipse(i,t,r/2,s*n(.006,.016),0,0,Math.PI*2),d.fill()}let w=u+o*.012,T=d.createLinearGradient(0,u,0,o);T.addColorStop(0,`#d89070`),T.addColorStop(1,`#5a4060`),d.fillStyle=T,d.fillRect(0,u,c,o-u),[i,d]=e(c,o),d.fillStyle=`#1a1520`,d.fillRect(0,u-s*.008,c,w-u+s*.008);for(let e=n(-40,0);e<c+40;e+=n(s*.01,s*.03)){let t=Math.max(0,Math.sin(e*.006+1.7)*Math.sin(e*.0023+.4)),r=s*(.008+.03*t)*n(.7,1.2);t<.05&&Math.random()<.7||(d.beginPath(),d.arc(e,u-r*.6,r,0,Math.PI*2),d.fill(),t>.3&&(d.beginPath(),d.arc(e+r*.5,u-r*1.3,r*.7,0,Math.PI*2),d.fill()))}d.strokeStyle=`#0d0a10`,d.fillStyle=`#0d0a10`;let E=Math.round(c/2.2);for(let e=0;e<E;e++){let e=n(-10,c+10),t=o+4,r=o-(o-w)*n(.2,1.1)-s*n(0,.05),i=n(-.25,.25)*(t-r);d.lineWidth=n(.6,1.6),d.beginPath(),d.moveTo(e,t),d.quadraticCurveTo(e,(t+r)/2,e+i,r),d.stroke(),Math.random()<.12&&(d.beginPath(),d.ellipse(e+i,r-s*.01,s*.0045,s*.014,Math.atan2(i,t-r)*.5,0,Math.PI*2),d.fill())}let D=d.createLinearGradient(0,o*.9,0,o);D.addColorStop(0,`rgba(13,10,16,0)`),D.addColorStop(1,`rgba(13,10,16,.9)`),d.fillStyle=D,d.fillRect(0,o*.9,c,o*.1),l=Math.round((a?550:1300)*Math.min(1,Math.max(.6,c*o/1e6))),f=new Float32Array(l),p=new Float32Array(l),m=new Float32Array(l),h=new Float32Array(l),_=new Float32Array(l);let O=s*.12;for(let e=0;e<l;e++){let t=n(0,6.28),r=Math.sqrt(Math.random())*s*.14;f[e]=c*.45+Math.cos(t)*r*1.6,p[e]=o*.4+Math.sin(t)*r*.7,m[e]=O+n(-10,10),h[e]=n(-10,10),_[e]=n(.6,1.25)}S=s*.035,b=Math.ceil(c/S)+2,x=Math.ceil(o/S)+2,v=new Int32Array(b*x),y=new Int32Array(l),C=null},draw(e,r){let a=Math.min(c,o),g=r*(s?1.5:1),E=a*.09,D=a*(.17+u.mid*.03),O=S,k=O*O,A=(O*.38)**2,j=c*(.5+.3*Math.sin(e*.071)*Math.cos(e*.023)),M=o*(.36+.14*Math.sin(e*.097+1.3)),N=.9+.5*Math.sin(e*.13)+u.bass*.4,P=4.2/a,F=e*.09;if(w-=g,!C&&(w<=0||T(r))){let e=Math.random()<.5;C={x:e?-a*.2:c+a*.2,y:M+n(-.1,.1)*o,vx:(e?1:-1)*a*.35,vy:n(-.05,.05)*a},w=n(20,35)}C&&(C.x+=C.vx*g,C.y+=C.vy*g,(C.x<-a*.3||C.x>c+a*.3)&&(C=null)),v.fill(-1);for(let e=0;e<l;e++){let t=Math.min(b-1,Math.max(0,(f[e]/S|0)+1))+Math.min(x-1,Math.max(0,(p[e]/S|0)+1))*b;y[e]=v[t],v[t]=e}for(let e=0;e<l;e++){let t=f[e],n=p[e],r=Math.min(b-1,Math.max(0,(t/S|0)+1)),i=Math.min(x-1,Math.max(0,(n/S|0)+1)),s=0,l=0,u=0,d=0,_=0,w=0,T=0;for(let a=i-1;a<=i+1&&s<14;a++)if(!(a<0||a>=x)){for(let i=r-1;i<=r+1&&s<14;i++)if(!(i<0||i>=b))for(let r=v[i+a*b];r>=0&&s<14;r=y[r]){if(r===e)continue;let i=f[r]-t,a=p[r]-n,o=i*i+a*a;if(!(o>k)&&(s++,l+=m[r],u+=h[r],d+=i,_+=a,o<A)){let e=1/(o+1);w-=i*e,T-=a*e}}}let O=0,I=0;s&&(O+=(l/s-m[e])*1.6+d/s*N+w*E*2.2,I+=(u/s-h[e])*1.6+_/s*N+T*E*2.2);let L=t*P,R=n*P,z=Math.cos(L+F),B=Math.cos(R*1.3-F*.8),V=Math.sin(L+F),H=Math.sin(R*1.3-F*.8),U=Math.cos(L*.7+R*.9+F*.6),W=-V*H*1.3+U*.9,G=-z*B-U*.7;O+=(W*D*.6-m[e])*.35,I+=(G*D*.6-h[e])*.35;let K=j-t,q=M-n,J=Math.hypot(K,q)+1,Y=Math.max(0,J-a*.2)*.9;if(O+=K/J*Y,I+=q/J*Y,n>o*.68&&(I-=(n-o*.68)*2),n<o*.08&&(I+=(o*.08-n)*2),t<c*.08?O+=(c*.08-t)*2:t>c*.92&&(O-=(t-c*.92)*2),C){let e=t-C.x,r=n-C.y,i=e*e+r*r,o=a*.16;if(i<o*o){let t=Math.sqrt(i)+1,n=(1-t/o)*D*4;O+=e/t*n,I+=r/t*n}}let X=m[e]+O*g,Z=h[e]+I*g,Q=Math.hypot(X,Z)+1e-6,$=Q>D?D/Q:Q<E?E/Q:1;m[e]=X*$,h[e]=Z*$}for(let e=0;e<l;e++)f[e]+=m[e]*g,p[e]+=h[e]*g;d.drawImage(t,0,0,c,o);let I=Math.max(1.6,a*.0045),L=e*9;for(let[e,t,n,r]of[[0,.9,.55,.9],[.9,2,.85,1.3]]){d.strokeStyle=`rgba(20,16,26,${n})`,d.lineWidth=r*Math.max(1,a/900),d.lineCap=`round`,d.beginPath();for(let n=0;n<l;n++){if(_[n]<e||_[n]>=t)continue;let r=Math.hypot(m[n],h[n])+1e-6,i=m[n]/r,a=h[n]/r,o=I*_[n],s=o*(.6+.5*Math.sin(L+n));d.moveTo(f[n]-i*o*.5-a*s*.5,p[n]-a*o*.5+i*s*.5),d.lineTo(f[n]+i*o*.5,p[n]+a*o*.5),d.lineTo(f[n]-i*o*.5+a*s*.5,p[n]-a*o*.5-i*s*.5)}d.stroke()}d.drawImage(i,0,0,c,o)}}}var w=()=>{let e=.2,t=0;return p(`
float spikes(vec2 p){
  float a = uT * .02; p = mat2(cos(a), -sin(a), sin(a), cos(a)) * p / .15;
  vec2 s = vec2(1., 1.7320508), q1 = mod(p, s) - .5 * s, q2 = mod(p - .5 * s, s) - .5 * s;
  float d = sqrt(min(dot(q1, q1), dot(q2, q2)));
  return pow(max(0., 1. - d / .52), 2.4);
}
float rim(vec2 p){
  float an = atan(p.y, p.x);
  return 1. + .035 * sin(an * 3. + uT * .23) + .025 * sin(an * 5. - uT * .17) + .02 * uA;
}
float hgt(vec2 p){
  float r = length(p) / rim(p);
  if (r >= 1.) return 0.;
  float dome = .26 * sqrt(1. - r * r) * (1. - .3 * uA);
  return dome + uA * .5 * smoothstep(1., .2, r) * spikes(p);
}
vec3 env(vec3 d){
  vec3 c = mix(vec3(.02, .02, .025), vec3(.22, .22, .25), smoothstep(-.2, .9, d.y));
  c += vec3(1.6) * smoothstep(.94, .99, dot(d, normalize(vec3(-.35, .9, .25))));
  c += vec3(1.3, 1.05, .8) * smoothstep(.86, .97, dot(d, normalize(vec3(.75, .45, -.5))));
  c += vec3(.6, .7, .9) * .5 * smoothstep(.9, .99, dot(d, normalize(vec3(-.8, .35, -.45))));
  return c;
}
void main(){
  vec2 uv = (gl_FragCoord.xy - .5 * uRes) / min(uRes.x, uRes.y);
  float ca = .4 + uT * .01;
  vec3 ro = vec3(sin(ca) * 2.3, 2.45, cos(ca) * 2.3), ta = vec3(0., .08, 0.);
  vec3 fw = normalize(ta - ro), rt = normalize(cross(fw, vec3(0., 1., 0.))), up = cross(rt, fw);
  vec3 rd = normalize(fw * 1.25 + rt * uv.x + up * uv.y);
  float top = .8, t0 = (ro.y - top) / -rd.y, t1 = ro.y / -rd.y, t = t0, lt = t0;
  bool hit = false;
  for (int i = 0; i < 160; i++) {
    vec3 p = ro + rd * t; float h = hgt(p.xz), f = p.y - h;
    if (f < .0005 && h > 0.) { hit = true; break; }
    lt = t; t += max(.003, f * .32);
    if (t > t1) break;
  }
  vec3 col;
  vec3 fp = ro + rd * t1;
  float fr = length(fp.xz) / rim(fp.xz);
  vec3 floorc = vec3(.78, .76, .72) * (1. - .45 * smoothstep(1., 3.2, length(fp.xz)));
  floorc *= .45 + .55 * smoothstep(.95, 1.6, fr + .25 * dot(normalize(fp.xz + 1e-4), vec2(.6, -.5)));
  floorc += vec3(1., .95, .85) * .12 * exp(-length(fp.xz - vec2(-.8, 1.)) * 1.5);
  if (hit && t < t1) {
    float a = lt, b = t;
    for (int i = 0; i < 6; i++) { float m = .5 * (a + b); vec3 q = ro + rd * m; if (q.y - hgt(q.xz) < 0.) b = m; else a = m; }
    vec3 p = ro + rd * b; float e = .0025;
    vec3 n = normalize(vec3(hgt(p.xz - vec2(e, 0.)) - hgt(p.xz + vec2(e, 0.)), 2. * e, hgt(p.xz - vec2(0., e)) - hgt(p.xz + vec2(0., e))));
    vec3 rf = reflect(rd, n);
    float fres = .05 + .95 * pow(1. - max(0., dot(n, -rd)), 5.);
    vec3 refl = rf.y < 0. ? vec3(.5, .48, .45) * .3 : env(rf);
    col = vec3(.004) + refl * (.04 + .96 * fres);
    col += vec3(1.) * pow(max(0., dot(rf, normalize(vec3(-.35, .9, .25)))), 300.) * 2.5;
    col += vec3(1., .9, .75) * pow(max(0., dot(rf, normalize(vec3(.75, .45, -.5)))), 120.) * 1.2;
    float edge = smoothstep(.0, .015, hgt(p.xz));
    col = mix(floorc * .25, col, edge);
  } else col = floorc;
  col *= 1. - .35 * dot(uv, uv);
  col = col / (1. + col * .25);
  gl_FragColor = vec4(pow(col, vec3(.4545)), 1.);
}`,{res:1,before(n,r,i,a){t+=r;let o=.18+.14*(.5+.5*Math.sin(t*.45)),c=Math.min(1,o+u.bass*(s?1:.8));e+=(c-e)*Math.min(1,r*(c>e?1.6:.6)),i.uniform1f(a.uA,e)}})};export{w as ferrofluidScene,b as flowScene,v as inkScene,C as murmurationScene,y as reactionScene,S as scopeScene,x as voronoiScene};