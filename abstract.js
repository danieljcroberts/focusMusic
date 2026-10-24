import{S as e,a as t,h as n,m as r,o as i,p as a,r as o,s,t as c,x as l}from"./util.js";import{W as u,h as d,r as f}from"./music.js";import{c as p}from"./app.js";function m(e){let t=r/Math.max(1,a);return t>=1?[e,Math.max(8,Math.round(e/t))]:[Math.max(8,Math.round(e*t)),e]}function h(e){n.imageSmoothingEnabled=!0,n.imageSmoothingQuality=`high`,n.drawImage(e,0,0,r,a)}function g(e=3){let t=0,n=0;return r=>{let i=f.bass,a=i>.4&&i-t>.22&&n<=0;return t+=(i-t)*Math.min(1,r*1.2),n-=r,a&&(n=e),a}}var _=e=>e<=0?0:e>=1?1:e*e*(3-2*e);function v(s={}){let c=!!s.beat,u=[[38,56,148],[176,36,72],[18,122,134],[206,142,36],[104,40,122],[222,88,66],[24,84,160]],d,p,_,v,y,b,x,S,C,w,T,E,D,O,k,A,j,M,N,P,F=0,I=g(c?.22:4),L=(e,t,n)=>e[Math.min(p-1,Math.max(0,n))*d+Math.min(d-1,Math.max(0,t))];function R(e,t,n){t<0?t=0:t>d-1.001&&(t=d-1.001),n<0?n=0:n>p-1.001&&(n=p-1.001);let r=t|0,i=n|0,a=t-r,o=n-i,s=i*d+r;return(e[s]*(1-a)+e[s+1]*a)*(1-o)+(e[s+d]*(1-a)+e[s+d+1]*a)*o}function z(e,t,n,r,i,a,o){let s=n*n,c=Math.max(0,Math.floor(e-n*2)),l=Math.min(d-1,Math.ceil(e+n*2)),u=Math.max(0,Math.floor(t-n*2)),f=Math.min(p-1,Math.ceil(t+n*2));for(let n=u;n<=f;n++)for(let a=c;a<=l;a++){let o=Math.exp(-((a-e)**2+(n-t)**2)/s),c=n*d+a;y[c]+=r*o,b[c]+=i*o}if(!a)return;let m=n*2*.7,h=m*m,g=e*2+.5,x=t*2+.5;for(let e=Math.max(0,Math.floor(x-m*2));e<=Math.min(v-1,Math.ceil(x+m*2));e++)for(let t=Math.max(0,Math.floor(g-m*2));t<=Math.min(_-1,Math.ceil(g+m*2));t++){let n=Math.exp(-((t-g)**2+(e-x)**2)/h)*o,r=(e*_+t)*3;E[r]+=a[0]*n,E[r+1]+=a[1]*n,E[r+2]+=a[2]*n}}function B(e=1){let t=u[F%u.length].map(e=>-Math.log(Math.max(.04,e/255))),n=c?d*i(.08,.92):d*(.2+.6*((F*.618+.3)%1));N.push({x:n,y:p*i(.06,.22),vy:p*i(.22,.32)*(c?.8+.8*e:1),wob:i(0,6),life:0,c:t,r:Math.max(1.6,Math.min(d,p)/(c?24:30))*(c?.7+.6*e:1),amt:c?8:4.5}),F++}function V(){for(let e=0;e<p;e++)for(let t=0;t<d;t++)w[e*d+t]=-.5*(L(y,t+1,e)-L(y,t-1,e)+L(b,t,e+1)-L(b,t,e-1));let t=e?10:18;for(let e=0;e<t;e++)for(let e=0;e<p;e++)for(let t=0;t<d;t++)C[e*d+t]=(w[e*d+t]+L(C,t-1,e)+L(C,t+1,e)+L(C,t,e-1)+L(C,t,e+1))*.25;for(let e=0;e<p;e++)for(let t=0;t<d;t++){let n=e*d+t;y[n]-=.5*(L(C,t+1,e)-L(C,t-1,e)),b[n]-=.5*(L(C,t,e+1)-L(C,t,e-1)),(t===0||t===d-1)&&(y[n]=0),(e===0||e===p-1)&&(b[n]=0)}}function H(e,t){for(let e=0;e<p;e++)for(let t=0;t<d;t++)T[e*d+t]=.5*(L(b,t+1,e)-L(b,t-1,e)-L(y,t,e+1)+L(y,t,e-1));for(let n=1;n<p-1;n++)for(let r=1;r<d-1;r++){let i=n*d+r,a=.5*(Math.abs(T[i+1])-Math.abs(T[i-1])),o=.5*(Math.abs(T[i+d])-Math.abs(T[i-d])),s=Math.hypot(a,o)+1e-5;y[i]+=t*e*(o/s)*T[i],b[i]-=t*e*(a/s)*T[i]}}return{init(){[d,p]=m(e?88:120),_=d*2,v=p*2;let n=d*p;[y,b,x,S,C,w,T]=Array.from({length:7},()=>new Float32Array(n)),E=new Float32Array(_*v*3),D=new Float32Array(_*v*3),O=new Float32Array(_*v*3);for(let e=0;e<v;e++)for(let t=0;t<_;t++){let n=t/_-.5,r=e/v-.42,i=.82+.2*Math.exp(-(n*n*3+r*r*2.4))-.1*(e/v)**2,a=(e*_+t)*3;O[a]=236*i,O[a+1]=244*i,O[a+2]=246*i}[k,A]=t(_,v),j=A.createImageData(_,v);let s;[M,s]=o(r,a);let c=s.createLinearGradient(0,0,r,0);c.addColorStop(0,`rgba(40,70,80,.22)`),c.addColorStop(.08,`rgba(255,255,255,.0)`),c.addColorStop(.16,`rgba(255,255,255,.06)`),c.addColorStop(.22,`rgba(255,255,255,0)`),c.addColorStop(.9,`rgba(255,255,255,0)`),c.addColorStop(1,`rgba(40,70,80,.22)`),s.fillStyle=c,s.fillRect(0,0,r,a);let l=s.createLinearGradient(0,0,0,a*.06);l.addColorStop(0,`rgba(120,160,170,.25)`),l.addColorStop(1,`rgba(255,255,255,0)`),s.fillStyle=l,s.fillRect(0,0,r,a*.06),N=[],P=1,F=Math.floor(i(0,u.length)),B()},draw(e,t){let o=t*(l?1.6:1);if(P-=o,c){if(I(t)){let e=1+(f.bass>.7?2:+(f.bass>.55));for(let t=0;t<e;t++)B(Math.min(1,f.bass));P=2.5}else P<=0&&(B(.4),P=i(2,3.5))}else(P<=0||I(t))&&(B(),P=i(6,10));for(let e=N.length-1;e>=0;e--){let t=N[e];t.life+=o;let n=Math.max(0,1-t.life/2.6);z(t.x+Math.sin(t.life*3+t.wob)*.3,t.y,t.r,0,t.vy*o*3*n,n>0?t.c:null,o*t.amt*n),t.y+=t.vy*o,t.vy*=Math.exp(-o*.9),n<=0&&N.splice(e,1)}let s=e*.07,u=d*.004*(1+f.mid*(c?2.5:1.5));for(let e=0;e<p;e++)for(let t=0;t<d;t++){let n=e*d+t,r=t/d*6.28,i=e/p*6.28;y[n]+=Math.sin(i*1.3+s)*u*o,b[n]+=Math.sin(r*1.1-s*.8)*u*o*.6}H(o,c?4.5+3*f.treble:3),V();for(let e=0;e<p;e++)for(let t=0;t<d;t++){let n=e*d+t;x[n]=R(y,t-o*y[n],e-o*b[n])*(1-o*.08),S[n]=R(b,t-o*y[n],e-o*b[n])*(1-o*.08)}[y,x]=[x,y],[b,S]=[S,b];let m=1-o*(c?.02:.009);for(let e=0;e<v;e++)for(let t=0;t<_;t++){let n=(t-.5)*.5,r=(e-.5)*.5,i=t-2*o*R(y,n,r),a=e-2*o*R(b,n,r);i<0?i=0:i>_-1.001&&(i=_-1.001),a<0?a=0:a>v-1.001&&(a=v-1.001);let s=i|0,c=a|0,l=i-s,u=a-c,d=(c*_+s)*3,f=d+3,p=d+_*3,h=p+3,g=(e*_+t)*3,x=(1-l)*(1-u),S=l*(1-u),C=(1-l)*u,w=l*u;for(let e=0;e<3;e++)D[g+e]=(E[d+e]*x+E[f+e]*S+E[p+e]*C+E[h+e]*w)*m}[E,D]=[D,E];let g=j.data;for(let e=0,t=0;e<E.length;e+=3,t+=4)g[t]=O[e]*Math.exp(-E[e]),g[t+1]=O[e+1]*Math.exp(-E[e+1]),g[t+2]=O[e+2]*Math.exp(-E[e+2]),g[t+3]=255;A.putImageData(j,0,0),h(k),n.drawImage(M,0,0,r,a)}}}function y(){let n,r,a,o,s,c,u,d,p,v,y=.0545,b=.062,x=8,S=0,C=g(5);function w(e,t){for(let s=0;s<e;s++){let e=i(0,n)|0,s=i(0,r)|0;for(let c=-t;c<=t;c++)for(let l=-t;l<=t;l++)if(l*l+c*c<=t*t){let t=(s+c+r)%r*n+(e+l+n)%n;o[t]=.5+i(0,.2),a[t]=.4}}}function T(){for(let e=0;e<r;e++){let t=e*n,i=(e-1+r)%r*n,l=(e+1)%r*n;for(let e=0;e<n;e++){let r=e===0?n-1:e-1,u=e===n-1?0:e+1,d=t+e,f=a[d],p=o[d],m=.2*(a[t+r]+a[t+u]+a[i+e]+a[l+e])+.05*(a[i+r]+a[i+u]+a[l+r]+a[l+u])-f,h=.2*(o[t+r]+o[t+u]+o[i+e]+o[l+e])+.05*(o[i+r]+o[i+u]+o[l+r]+o[l+u])-p,g=f*p*p;s[d]=f+m-g+y*(1-f),c[d]=p+.5*h+g-(b+y)*p}}[a,s]=[s,a],[o,c]=[c,o]}return{init(){[n,r]=m(e?160:240),a=new Float32Array(n*r).fill(1),o=new Float32Array(n*r),s=new Float32Array(n*r),c=new Float32Array(n*r),w(Math.round(n*r/300)+6,2);for(let e=0;e<150;e++)T();S=e?500:900,[u,d]=t(n,r),p=d.createImageData(n,r),v=new Float32Array(n*r*3);let l=[[236,118,96],[118,200,188],[242,204,128]],f=i(0,6.28);for(let e=0;e<r;e++)for(let t=0;t<n;t++){let i=t/n*6.28,a=e/r*6.28,o=(e*n+t)*3,s=.5+.5*Math.sin(i*.7+a*.4+f),c=.5+.5*Math.sin(a*.8-i*.3+f*2);for(let e=0;e<3;e++)v[o+e]=l[0][e]*(1-s)*(1-c*.6)+l[1][e]*s*(1-c*.6)+l[2][e]*c*.6}},draw(t,a){let s=.5+.5*Math.sin(t*6.28/300);y=.0367+(.0545-.0367)*s,b=.0649+-.0029*s,x-=a,(x<=0||C(a))&&(w(1,3),x=i(10,16));let c=Math.round((e?3:5)*(l?2:1)*(1+f.mid*.6));if(S>0){let t=Math.min(S,e?20:30);S-=t,c+=t}for(let e=0;e<c;e++)T();let m=p.data,g=1+f.bass*.12;for(let e=0;e<r;e++){let t=e*n,i=(e-1+r)%r*n;for(let e=0;e<n;e++){let r=t+e,a=o[r],s=(a-o[t+(e===0?n-1:e-1)]+(a-o[i+e]))*3.2,c=_((a-.05)*3.4),l=c*c*c*.3,u=r*4,d=r*3,f=(1+Math.min(0,s))*g,p=Math.max(0,s)*255;m[u]=(12+(v[d]*.8-12)*c+255*l)*f+p,m[u+1]=(22+(v[d+1]*.8-22)*c+240*l)*f+p,m[u+2]=(40+(v[d+2]*.8-40)*c+225*l)*f+p,m[u+3]=255}}d.putImageData(p,0,0),h(u)}}}function b(){let t=[8,10,22],c,u,d,p,m,h,g,_=0,v=0,y,b=e=>{m[e]=i(-10,r+10),h[e]=i(-10,a+10),g[e]=i(3,12)};return{init(){[c,u]=o(r,a),u.fillStyle=s(t),u.fillRect(0,0,r,a);let n;[d,n]=o(r,a);let l=n.createRadialGradient(r/2,a/2,Math.min(r,a)*.3,r/2,a/2,Math.hypot(r,a)*.6);l.addColorStop(0,`rgba(4,5,12,0)`),l.addColorStop(1,`rgba(4,5,12,.6)`),n.fillStyle=l,n.fillRect(0,0,r,a),p=Math.round((e?1400:4200)*Math.min(1.3,Math.max(.5,r*a/13e5))),m=new Float32Array(p),h=new Float32Array(p),g=new Float32Array(p);for(let e=0;e<p;e++)b(e);let f=Math.min(r,a);y=Array.from({length:5},(e,t)=>{let n=i(0,6.28),r=(1.6+t*1.1)/f*6.28;return{kx:Math.cos(n)*r,ky:Math.sin(n)*r,w:i(-.35,.35),ph:i(0,6.28),amp:1/(1+t*.7)/r}})},draw(e,i){_+=i*(l?2:1)*(1+f.mid*2.5);let o=Math.min(r,a)*.07*(l?1.8:1)*(1+f.bass*.35);u.globalCompositeOperation=`source-over`,u.fillStyle=s(t,++v%24?.014:.08),u.fillRect(0,0,r,a),u.lineWidth=Math.max(1,Math.min(r,a)/700),u.lineCap=`round`;let x=190+e/4%360;for(let e=0;e<6;e++){u.strokeStyle=`hsla(${(x+e*22)%360},66%,${64+e*3}%,.75)`,u.beginPath();for(let t=e;t<p;t+=6){let e=m[t],n=h[t],s=0,c=0;for(let t of y){let r=t.amp*Math.cos(t.kx*e+t.ky*n+t.w*_+t.ph);s+=r*t.ky,c-=r*t.kx}let l=e+s*o*i*1.6,d=n+c*o*i*1.6;g[t]-=i,g[t]<=0||l<-20||l>r+20||d<-20||d>a+20?b(t):(u.moveTo(e,n),u.lineTo(l,d),m[t]=l,h[t]=d)}u.stroke()}n.drawImage(c,0,0,r,a),n.drawImage(d,0,0,r,a)}}}var x=()=>p(`
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
}`,{speed:1});function S(){let s,f,p,m,h,g,_,v,y,b,x=new Float32Array(8),S=0,C=[1,3,6,10,16,26,40,64,104],w=[1,2,3,4,5,3,7,5],T=[1,3,2,5,4,7,6,8],E=Array.from({length:16},()=>i(0,6.28));function D(e,t,n,r,i,a){e.beginPath(),e.moveTo(t+a,n),e.arcTo(t+r,n,t+r,n+i,a),e.arcTo(t+r,n+i,t,n+i,a),e.arcTo(t,n+i,t,n,a),e.arcTo(t,n,t+r,n,a),e.closePath()}let O=e=>D(e,g,_,v,y,b);function k(e,t){let n=g+v/2,r=_+y/2,i=(e-n)/(v/2),a=(t-r)/(y/2),o=1-.05*(i*i+a*a);return[n+(e-n)*o,r+(t-r)*o]}return{init(){let e=Math.min(r,a),n=e*.055;g=n,_=n,v=r-n*2,y=a-n*2,b=e*.09;let i;[s,i]=o(r,a);let c=i.createLinearGradient(0,0,0,a);c.addColorStop(0,`#2a2b27`),c.addColorStop(1,`#141512`),i.fillStyle=c,i.fillRect(0,0,r,a),i.strokeStyle=`rgba(255,255,240,.06)`,i.lineWidth=2,D(i,g-n*.45,_-n*.45,v+n*.9,y+n*.9,b*1.3),i.stroke();let l=i.createRadialGradient(r/2,a/2,0,r/2,a/2,Math.hypot(v,y)/2);l.addColorStop(0,`#0d1a12`),l.addColorStop(.7,`#07100a`),l.addColorStop(1,`#020503`),i.fillStyle=l,O(i),i.fill();let u=e*.1,d=r/2,x=a/2,S=Math.floor(v/2/u),C=Math.floor(y/2/u);i.strokeStyle=`rgba(120,220,150,.10)`,i.lineWidth=1;let w=(e,t,n,r)=>{i.beginPath();for(let a=0;a<=24;a++){let[o,s]=k(e+(n-e)*a/24,t+(r-t)*a/24);a?i.lineTo(o,s):i.moveTo(o,s)}i.stroke()};for(let e=-S;e<=S;e++)w(d+e*u,x-C*u,d+e*u,x+C*u);for(let e=-C;e<=C;e++)w(d-S*u,x+e*u,d+S*u,x+e*u);i.strokeStyle=`rgba(120,220,150,.16)`;for(let e=-S*5;e<=S*5;e++){let[t,n]=k(d+e*u/5,x);i.beginPath(),i.moveTo(t,n-3),i.lineTo(t,n+3),i.stroke()}for(let e=-C*5;e<=C*5;e++){let[t,n]=k(d,x+e*u/5);i.beginPath(),i.moveTo(t-3,n),i.lineTo(t+3,n),i.stroke()}[f,i]=o(r,a),i.save(),O(i),i.clip(),i.fillStyle=`rgba(0,0,0,.22)`;for(let e=_;e<_+y;e+=3)i.fillRect(g,e,v,1);let T=i.createRadialGradient(r/2,a/2,Math.min(v,y)*.3,r/2,a/2,Math.hypot(v,y)*.55);T.addColorStop(0,`rgba(0,0,0,0)`),T.addColorStop(1,`rgba(0,0,0,.75)`),i.fillStyle=T,i.fillRect(0,0,r,a);let E=i.createRadialGradient(g+v*.3,_+y*.18,0,g+v*.3,_+y*.18,Math.max(v,y)*.45);E.addColorStop(0,`rgba(220,240,230,.07)`),E.addColorStop(1,`rgba(220,240,230,0)`),i.fillStyle=E,i.fillRect(0,0,r,a),i.restore(),i.strokeStyle=`rgba(0,0,0,.6)`,i.lineWidth=e*.012,O(i),i.stroke(),[p,m]=o(r,a),h=[2,4,8].map(e=>t(r/e,a/e))},draw(t,i){let o=u(),g=Math.min(r,a),_=0;for(let e=0;e<8;e++){let t=0;for(let n=C[e];n<C[e+1];n++)t+=o[n];let n=t/(C[e+1]-C[e])/255;x[e]+=(n-x[e])*Math.min(1,i*5),_+=x[e]}S+=((d&&_>.15?1:0)-S)*Math.min(1,i*.6);let b=l?2:1;for(let e=0;e<16;e++)E[e]+=i*b*(.04+.03*Math.sin(e*1.7))*(1+(e<8?x[e]:x[e-8])*.8);m.globalCompositeOperation=`destination-out`,m.fillStyle=`rgba(0,0,0,${Math.min(1,i*3.2)})`,m.fillRect(0,0,r,a),m.globalCompositeOperation=`lighter`;let D=e?360:640,A=Math.min(v,y)*.36*(1+S*_*.02),j=r/2,M=a/2,N=new Float32Array(D*2+2);for(let e=0;e<=D;e++){let t=e/D*6.2832,n=Math.sin(3*t+E[0]),r=Math.sin(2*t+E[1]*.5);if(S>.001){let e=0,i=0;for(let n=0;n<8;n++)e+=x[n]*Math.sin(w[n]*t+E[n]),i+=x[n]*Math.sin(T[n]*t+E[n+8]);let a=1.1/Math.max(.3,_);n+=(e*a-n)*S,r+=(i*a-r)*S}[N[e*2],N[e*2+1]]=k(j+n*A,M-r*A)}let P=(e,t)=>{m.lineWidth=e,m.strokeStyle=t,m.beginPath(),m.moveTo(N[0],N[1]);for(let e=1;e<=D;e++)m.lineTo(N[e*2],N[e*2+1]);m.stroke()};m.lineJoin=`round`,P(g*.008,`rgba(60,255,120,.016)`),P(Math.max(1,g*.0025),`rgba(170,255,190,.06)`),m.globalCompositeOperation=`source-over`,n.drawImage(s,0,0,r,a),n.save(),O(n),n.clip(),n.globalCompositeOperation=`lighter`,n.drawImage(p,0,0,r,a);let F=p;for(let[e,t]of h)t.clearRect(0,0,e.width,e.height),t.drawImage(F,0,0,e.width,e.height),F=e;n.imageSmoothingEnabled=!0,n.imageSmoothingQuality=`high`,n.globalAlpha=.8,n.drawImage(F,0,0,r,a),n.drawImage(h[1][0],0,0,r,a),n.globalAlpha=.5,c(n,r/2,a/2,A*1.6,[40,160,80],.05+.05*S*_/3),n.restore(),n.drawImage(f,0,0,r,a)}}}function C(){let t,s,u,d,p,m,h,_,v,y,b,x,S,C,w=14,T=g(8);return{init(){let n=Math.min(r,a),l=a*.8,f;[t,f]=o(r,a);let g=f.createLinearGradient(0,0,0,l);g.addColorStop(0,`#1c2342`),g.addColorStop(.4,`#4b4a72`),g.addColorStop(.72,`#b07686`),g.addColorStop(.9,`#e69a72`),g.addColorStop(1,`#f2bf80`),f.fillStyle=g,f.fillRect(0,0,r,l+2),c(f,r*.68,l,Math.max(r,a)*.45,[255,196,130],.5),c(f,r*.68,l,n*.12,[255,230,180],.7);for(let e=0;e<9;e++){let t=l*i(.35,.85),a=r*i(.25,.6),o=i(-.1,1)*r;f.fillStyle=`rgba(${e%2?`240,170,150`:`120,90,130`},${i(.06,.14)})`,f.beginPath(),f.ellipse(o,t,a/2,n*i(.006,.016),0,0,Math.PI*2),f.fill()}let w=l+a*.012,T=f.createLinearGradient(0,l,0,a);T.addColorStop(0,`#d89070`),T.addColorStop(1,`#5a4060`),f.fillStyle=T,f.fillRect(0,l,r,a-l),[s,f]=o(r,a),f.fillStyle=`#1a1520`,f.fillRect(0,l-n*.008,r,w-l+n*.008);for(let e=i(-40,0);e<r+40;e+=i(n*.01,n*.03)){let t=Math.max(0,Math.sin(e*.006+1.7)*Math.sin(e*.0023+.4)),r=n*(.008+.03*t)*i(.7,1.2);t<.05&&Math.random()<.7||(f.beginPath(),f.arc(e,l-r*.6,r,0,Math.PI*2),f.fill(),t>.3&&(f.beginPath(),f.arc(e+r*.5,l-r*1.3,r*.7,0,Math.PI*2),f.fill()))}f.strokeStyle=`#0d0a10`,f.fillStyle=`#0d0a10`;let E=Math.round(r/2.2);for(let e=0;e<E;e++){let e=i(-10,r+10),t=a+4,o=a-(a-w)*i(.2,1.1)-n*i(0,.05),s=i(-.25,.25)*(t-o);f.lineWidth=i(.6,1.6),f.beginPath(),f.moveTo(e,t),f.quadraticCurveTo(e,(t+o)/2,e+s,o),f.stroke(),Math.random()<.12&&(f.beginPath(),f.ellipse(e+s,o-n*.01,n*.0045,n*.014,Math.atan2(s,t-o)*.5,0,Math.PI*2),f.fill())}let D=f.createLinearGradient(0,a*.9,0,a);D.addColorStop(0,`rgba(13,10,16,0)`),D.addColorStop(1,`rgba(13,10,16,.9)`),f.fillStyle=D,f.fillRect(0,a*.9,r,a*.1),u=Math.round((e?550:1300)*Math.min(1,Math.max(.6,r*a/1e6))),d=new Float32Array(u),p=new Float32Array(u),m=new Float32Array(u),h=new Float32Array(u),_=new Float32Array(u);let O=n*.12;for(let e=0;e<u;e++){let t=i(0,6.28),o=Math.sqrt(Math.random())*n*.14;d[e]=r*.45+Math.cos(t)*o*1.6,p[e]=a*.4+Math.sin(t)*o*.7,m[e]=O+i(-10,10),h[e]=i(-10,10),_[e]=i(.6,1.25)}S=n*.035,b=Math.ceil(r/S)+2,x=Math.ceil(a/S)+2,v=new Int32Array(b*x),y=new Int32Array(u),C=null},draw(e,o){let c=Math.min(r,a),g=o*(l?1.5:1),E=c*.09,D=c*(.17+f.mid*.03),O=S,k=O*O,A=(O*.38)**2,j=r*(.5+.3*Math.sin(e*.071)*Math.cos(e*.023)),M=a*(.36+.14*Math.sin(e*.097+1.3)),N=.9+.5*Math.sin(e*.13)+f.bass*.4,P=4.2/c,F=e*.09;if(w-=g,!C&&(w<=0||T(o))){let e=Math.random()<.5;C={x:e?-c*.2:r+c*.2,y:M+i(-.1,.1)*a,vx:(e?1:-1)*c*.35,vy:i(-.05,.05)*c},w=i(20,35)}C&&(C.x+=C.vx*g,C.y+=C.vy*g,(C.x<-c*.3||C.x>r+c*.3)&&(C=null)),v.fill(-1);for(let e=0;e<u;e++){let t=Math.min(b-1,Math.max(0,(d[e]/S|0)+1))+Math.min(x-1,Math.max(0,(p[e]/S|0)+1))*b;y[e]=v[t],v[t]=e}for(let e=0;e<u;e++){let t=d[e],n=p[e],i=Math.min(b-1,Math.max(0,(t/S|0)+1)),o=Math.min(x-1,Math.max(0,(n/S|0)+1)),s=0,l=0,u=0,f=0,_=0,w=0,T=0;for(let r=o-1;r<=o+1&&s<14;r++)if(!(r<0||r>=x)){for(let a=i-1;a<=i+1&&s<14;a++)if(!(a<0||a>=b))for(let i=v[a+r*b];i>=0&&s<14;i=y[i]){if(i===e)continue;let r=d[i]-t,a=p[i]-n,o=r*r+a*a;if(!(o>k)&&(s++,l+=m[i],u+=h[i],f+=r,_+=a,o<A)){let e=1/(o+1);w-=r*e,T-=a*e}}}let O=0,I=0;s&&(O+=(l/s-m[e])*1.6+f/s*N+w*E*2.2,I+=(u/s-h[e])*1.6+_/s*N+T*E*2.2);let L=t*P,R=n*P,z=Math.cos(L+F),B=Math.cos(R*1.3-F*.8),V=Math.sin(L+F),H=Math.sin(R*1.3-F*.8),U=Math.cos(L*.7+R*.9+F*.6),W=-V*H*1.3+U*.9,G=-z*B-U*.7;O+=(W*D*.6-m[e])*.35,I+=(G*D*.6-h[e])*.35;let K=j-t,q=M-n,J=Math.hypot(K,q)+1,Y=Math.max(0,J-c*.2)*.9;if(O+=K/J*Y,I+=q/J*Y,n>a*.68&&(I-=(n-a*.68)*2),n<a*.08&&(I+=(a*.08-n)*2),t<r*.08?O+=(r*.08-t)*2:t>r*.92&&(O-=(t-r*.92)*2),C){let e=t-C.x,r=n-C.y,i=e*e+r*r,a=c*.16;if(i<a*a){let t=Math.sqrt(i)+1,n=(1-t/a)*D*4;O+=e/t*n,I+=r/t*n}}let X=m[e]+O*g,Z=h[e]+I*g,Q=Math.hypot(X,Z)+1e-6,$=Q>D?D/Q:Q<E?E/Q:1;m[e]=X*$,h[e]=Z*$}for(let e=0;e<u;e++)d[e]+=m[e]*g,p[e]+=h[e]*g;n.drawImage(t,0,0,r,a);let I=Math.max(1.6,c*.0045),L=e*9;for(let[e,t,r,i]of[[0,.9,.55,.9],[.9,2,.85,1.3]]){n.strokeStyle=`rgba(20,16,26,${r})`,n.lineWidth=i*Math.max(1,c/900),n.lineCap=`round`,n.beginPath();for(let r=0;r<u;r++){if(_[r]<e||_[r]>=t)continue;let i=Math.hypot(m[r],h[r])+1e-6,a=m[r]/i,o=h[r]/i,s=I*_[r],c=s*(.6+.5*Math.sin(L+r));n.moveTo(d[r]-a*s*.5-o*c*.5,p[r]-o*s*.5+a*c*.5),n.lineTo(d[r]+a*s*.5,p[r]+o*s*.5),n.lineTo(d[r]-a*s*.5+o*c*.5,p[r]-o*s*.5-a*c*.5)}n.stroke()}n.drawImage(s,0,0,r,a)}}}var w=()=>{let e=.2,t=0;return p(`
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
}`,{res:1,before(n,r,i,a){t+=r;let o=.18+.14*(.5+.5*Math.sin(t*.45)),s=Math.min(1,o+f.bass*(l?1:.8));e+=(s-e)*Math.min(1,r*(s>e?1.6:.6)),i.uniform1f(a.uA,e)}})};export{w as ferrofluidScene,b as flowScene,v as inkScene,C as murmurationScene,y as reactionScene,S as scopeScene,x as voronoiScene};