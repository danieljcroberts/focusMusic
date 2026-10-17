import{At as e,Ht as t,Mt as n,Nt as r,Ot as i,Pt as a,Ut as o,_n as s,cn as c,gn as l,jt as u,kt as d,ln as f,r as p,sn as m,un as h}from"./music.js";import{s as g}from"./app.js";import{dotTexture as _,threeScene as v}from"./three-scenes.js";var y=Math.PI*2,b=()=>v(e=>{let t=new e.Scene,n=new e.PerspectiveCamera(50,1,.05,3e3),i=new e.Vector3(-129,0,0),o=new e.Vector3(-.3,.1,-1).normalize(),c=e=>e<1.24||e>2.34?0:e<1.53?.22+.08*Math.sin(e*140):e<1.95?.75+.2*Math.sin(e*90)*Math.sin(e*23):e<2.03?.04:e<2.27?(Math.abs(e-2.214)<.006?.05:.55+.12*Math.sin(e*120))*(e>2.2?.85:1):e>2.32?.5:0,f=document.createElement(`canvas`);f.width=64,f.height=1024;let m=f.getContext(`2d`);for(let e=0;e<1024;e++){let t=(e/1024-.5)*2,n=Math.abs(t),r=u([214,186,140],[150,140,120],n**1.6),i=Math.sin(t*38+Math.sin(t*9)*1.5)*.5+Math.sin(t*97)*.2+(d(Math.floor(t*60),3)-.5)*.5,o=u(r,i>0?[240,220,176]:[160,112,70],Math.min(1,Math.abs(i)*.7));m.fillStyle=a(n>.8?u(o,[120,140,150],(n-.8)*3):o),m.fillRect(0,e,64,1)}let h=new e.CanvasTexture(f);h.colorSpace=e.SRGBColorSpace;let g=new e.Mesh(new e.SphereGeometry(60,128,64),new e.MeshLambertMaterial({map:h}));g.position.copy(i),g.scale.y=.9,t.add(g);let v=new e.DirectionalLight(16774374,3.2);v.position.copy(o),t.add(v),t.add(new e.AmbientLight(4212824,.12));let y=document.createElement(`canvas`);y.width=1024,y.height=1;let b=y.getContext(`2d`);for(let e=0;e<1024;e++){let t=1.2+e/1024*1.2,n=c(t),r=u([196,176,150],[232,214,186],Math.min(1,n+.2*Math.sin(t*31)));b.fillStyle=a(r,Math.min(1,n*1.1)),b.fillRect(e,0,1,1)}let x=new e.CanvasTexture(y);x.colorSpace=e.SRGBColorSpace;let S=new e.Mesh(new e.RingGeometry(72,144,512,1),new e.ShaderMaterial({transparent:!0,depthWrite:!1,side:e.DoubleSide,uniforms:{tex:{value:x},cen:{value:i},sun:{value:o},R:{value:60},glow:{value:1}},vertexShader:`varying vec3 vP; void main(){ vec4 w = modelMatrix * vec4(position, 1.); vP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,fragmentShader:`uniform sampler2D tex; uniform vec3 cen, sun; uniform float R, glow; varying vec3 vP;
      void main(){
        vec3 q = vP - cen; float r = length(q.xz) / R;
        vec4 c = texture2D(tex, vec2((r - 1.2) / 1.2, .5));
        float along = dot(q, sun); vec3 perp = q - along * sun;
        float shadow = along < 0. ? smoothstep(R * .97, R * 1.03, length(perp)) : 1.;
        float near = smoothstep(3., 16., length(vP - cameraPosition));
        gl_FragColor = vec4(c.rgb * (.08 + .92 * shadow) * glow, c.a * near * .95);
      }`}));S.rotation.x=-Math.PI/2,S.position.copy(i),t.add(S);let C=_(e),w=[],T={r0:-40,r1:14,s0:-75,s1:25};for(let[n,i,a]of[[s?6e3:16e3,.09,.5],[s?1200:3200,.17,.7],[s?40:110,.36,.9]]){let o=new Float32Array(n*3),s=new Float32Array(n*3);for(let e=0;e<n;e++){let t,n;do t=r(T.r0,T.r1),n=c((129+t)/60);while(Math.random()>n);o[e*3]=t,o[e*3+1]=r(-a,a)*.5,o[e*3+2]=r(T.s0,T.s1);let i=r(.6,1.05),l=Math.random();s.set([i*(.95+.05*l),i*(.86+.04*l),i*(.74-.06*l)],e*3)}let l=new e.BufferGeometry;l.setAttribute(`position`,new e.BufferAttribute(o,3)),l.setAttribute(`color`,new e.BufferAttribute(s,3));let u=new e.PointsMaterial({size:i,map:C,vertexColors:!0,transparent:!0,opacity:.9,depthWrite:!1,sizeAttenuation:!0});t.add(new e.Points(l,u)),w.push({pos:o,geo:l,mat:u,n})}let E=new Float32Array(2700);for(let t=0;t<900;t++){let n=new e.Vector3(r(-1,1),r(-1,1),r(-1,1)).normalize().multiplyScalar(2e3);E.set([n.x,n.y,n.z],t*3)}let D=new e.BufferGeometry;D.setAttribute(`position`,new e.BufferAttribute(E,3)),t.add(new e.Points(D,new e.PointsMaterial({size:1.3,map:C,transparent:!0,opacity:.7,depthWrite:!1,sizeAttenuation:!1,color:14673663})));let O=new e.Vector3;return{scene:t,camera:n,update(t,r){let i=1.1*(l?2:1);for(let e of w){for(let t=0;t<e.n;t++){let n=e.pos[t*3],a=e.pos[t*3+2]+(i+n*.045)*r;a>T.s1?a-=T.s1-T.s0:a<T.s0&&(a+=T.s1-T.s0),e.pos[t*3+2]=a}e.geo.attributes.position.needsUpdate=!0,e.mat.opacity=.82+.15*p.bass}S.material.uniforms.glow.value=1+.08*p.bass;let a=Math.atan(Math.tan(e.MathUtils.degToRad(25))*n.aspect),o=e.MathUtils.degToRad(62+Math.max(0,1-n.aspect)*14)-a*.3+Math.sin(t*.021)*.02;n.position.set(0,1.4+Math.sin(t*.05)*.25,0),O.set(-Math.sin(o),-.06+Math.sin(t*.033)*.01,-Math.cos(o)).add(n.position),n.lookAt(O),n.rotateZ(Math.sin(t*.017)*.015)}}});function x(){let t=[[.2408,[150,146,140],.26],[.6152,[226,206,160],.38],[1,[58,112,178],.4,1],[1.881,[178,78,52],.32],[11.86,[204,170,128],.78,4],[29.46,[222,196,132],.66,1,!0],[84.01,[150,206,214],.5],[164.8,[64,98,190],.5]],o,s,l,d,g;return{init(){let p=c>f*1.1?.8:.44,m=Math.min(f*.41,c*.4/p),h=f/2,_=c*.48;d={R:m,cx:h,cy:_,tilt:p,unit:m/30},g=r(0,5e3);let v;[o,v]=e(f,c),v.fillStyle=`#0a0507`,v.fillRect(0,0,f,c);let[b,x]=n(160,160*c/f),S=x.createImageData(b.width,b.height);for(let e=0;e<S.data.length;e+=4){let t=r(0,1);S.data[e]=40+t*30,S.data[e+1]=14+t*10,S.data[e+2]=22+t*14,S.data[e+3]=255}x.putImageData(S,0,0),v.globalAlpha=.4,v.drawImage(b,0,0,f,c),v.globalAlpha=1,i(v,f*.28,c*.18,Math.max(f,c)*.9,[255,196,140],.22),i(v,h,_,m*1.3,[255,210,160],.1);let C=v.createRadialGradient(h,_,Math.min(f,c)*.3,h,_,Math.max(f,c)*.8);C.addColorStop(0,`rgba(0,0,0,0)`),C.addColorStop(1,`rgba(0,0,0,.65)`),v.fillStyle=C,v.fillRect(0,0,f,c);let w=d.unit*3;d.drop=w,v.save(),v.translate(h,_+w),v.scale(1,p),i(v,0,0,m*1.3,[0,0,0],.6);let T=m*1.16,E=v.createRadialGradient(-m*.3,-m*.3,0,0,0,T);E.addColorStop(0,`#3a2016`),E.addColorStop(1,`#170b07`),v.fillStyle=E,v.beginPath(),v.arc(0,0,T,0,y),v.fill(),v.strokeStyle=`rgba(214,170,96,.7)`,v.lineWidth=d.unit*.5,v.stroke(),v.strokeStyle=`rgba(214,174,104,.55)`;for(let e=0;e<120;e++){let t=e/120*y,n=e%10==0?1.6:e%5==0?1:.55;v.lineWidth=d.unit*(e%10==0?.22:.12),v.beginPath(),v.moveTo(Math.cos(t)*T*.985,Math.sin(t)*T*.985),v.lineTo(Math.cos(t)*(T*.985-d.unit*n),Math.sin(t)*(T*.985-d.unit*n)),v.stroke()}v.restore();for(let e=0;e<t.length;e++){let t=m*(.2+e*.1);v.strokeStyle=`rgba(222,180,108,${.32-e*.015})`,v.lineWidth=Math.max(.6,d.unit*.12),v.beginPath(),v.ellipse(h,_,t,t*p,0,0,y),v.stroke()}let D=(t,n,r)=>{let i=Math.ceil(n*2+8),[o,s]=e(i,i),c=i/2,l=s.createRadialGradient(c-n*.4,c-n*.45,n*.05,c,c,n);if(l.addColorStop(0,a(u(t,[255,250,236],.65))),l.addColorStop(.35,a(t)),l.addColorStop(1,a(u(t,[0,0,0],.72))),s.fillStyle=l,s.beginPath(),s.arc(c,c,n,0,y),s.fill(),r){s.save(),s.beginPath(),s.arc(c,c,n,0,y),s.clip();for(let[e,t,r]of[[-.35,.12,.25],[-.1,.16,.3],[.18,.12,.25],[.42,.1,.2]])s.fillStyle=`rgba(120,70,40,${r})`,s.fillRect(c-n,c+e*n,n*2,t*n);s.restore()}return s.fillStyle=`rgba(255,255,250,.75)`,s.beginPath(),s.arc(c-n*.38,c-n*.42,n*.16,0,y),s.fill(),o};s=t.map(e=>D(e[1],d.unit*e[2]*2.2,e[2]>.6)),s.moon=D([214,206,190],d.unit*.22,!1);let O=m*.085,k=Math.ceil(O*2+8),A;[l,A]=e(k,k);let j=k/2,M=A.createRadialGradient(j-O*.35,j-O*.4,O*.05,j,j,O);M.addColorStop(0,`#fff6d8`),M.addColorStop(.25,`#f1c66a`),M.addColorStop(.7,`#a8752c`),M.addColorStop(1,`#4a2c10`),A.fillStyle=M,A.beginPath(),A.arc(j,j,O,0,y),A.fill(),A.strokeStyle=`rgba(80,46,14,.5)`,A.lineWidth=1;for(let e=0;e<12;e++){let t=e/12*y;A.beginPath(),A.moveTo(j+Math.cos(t)*O*.55,j+Math.sin(t)*O*.55),A.lineTo(j+Math.cos(t)*O*.95,j+Math.sin(t)*O*.95),A.stroke()}},draw(e){let{R:n,cx:r,cy:a,tilt:u,unit:_}=d,v=g+e;h.drawImage(o,0,0,f,c);let b=t.map((e,t)=>{let i=(t*2.3+v*y/(20*e[0]/.2408))%y,o=n*(.2+t*.1);return{i:t,p:e,a:i,x:r+Math.cos(i)*o,y:a+Math.sin(i)*o*u,h:_*(1.2+t*.55)}}),x=Math.max(1,_*.22),S=_*6,C=h.createLinearGradient(r-_,0,r+_,0);C.addColorStop(0,`#5a3a16`),C.addColorStop(.35,`#e8c27a`),C.addColorStop(1,`#4a2c10`),h.fillStyle=C,h.fillRect(r-_*.6,a,_*1.2,S);let w=e=>{let{p:t,x:n,y:o,h:c}=e,l=s[e.i];i(h,n-_*.6,o+d.drop+_*.2,_*2.2,[0,0,0],.45),h.strokeStyle=`rgba(206,160,84,.9)`,h.lineWidth=x,h.lineCap=`round`,h.beginPath(),h.moveTo(r,a+c),h.lineTo(n,o+c),h.lineTo(n,o),h.stroke(),h.strokeStyle=`rgba(255,236,190,.35)`,h.lineWidth=x*.4,h.beginPath(),h.moveTo(r,a+c-x*.3),h.lineTo(n,o+c-x*.3),h.stroke(),t[4]&&(h.strokeStyle=`rgba(232,196,120,.8)`,h.lineWidth=x*.8,h.beginPath(),h.ellipse(n,o,l.width/2/m*1+_*.9,(_*.9+l.width/2/m)*.32,-.25,Math.PI,y),h.stroke());let f=t[3]||0,p=[_*1.4,_*1.9,_*2.4,_*2.9],g=[];for(let e=0;e<f;e++){let t=v*y/(5+e*4.5)+e*1.7;g.push({x:n+Math.cos(t)*p[e],y:o+Math.sin(t)*p[e]*u,back:Math.sin(t)<0,m:e})}let b=e=>{h.strokeStyle=`rgba(206,160,84,.55)`,h.lineWidth=x*.5,h.beginPath(),h.moveTo(n,o),h.lineTo(e.x,e.y),h.stroke();let t=s.moon.width/m;h.drawImage(s.moon,e.x-t/2,e.y-t/2,t,t)};g.filter(e=>e.back).forEach(b);let S=l.width/m;h.drawImage(l,n-S/2,o-S/2,S,S),t[4]&&(h.strokeStyle=`rgba(240,210,140,.9)`,h.lineWidth=x*.8,h.beginPath(),h.ellipse(n,o,S/2+_*.9,(S/2+_*.9)*.32,-.25,0,Math.PI),h.stroke()),g.filter(e=>!e.back).forEach(b)};b.filter(e=>e.y<a).sort((e,t)=>e.y-t.y).forEach(w);let T=l.width/m;i(h,r,a,n*.22,[255,210,130],.18+p.bass*.08),h.drawImage(l,r-T/2,a-T/2,T,T),b.filter(e=>e.y>=a).sort((e,t)=>e.y-t.y).forEach(w)}}}var S=()=>g(`
vec3 diskCol(vec3 p, vec3 v, float t){
  float r = length(p.xz);
  float ang = t * .9 / pow(r, 1.5);
  float c = cos(ang), s = sin(ang);
  vec2 q = mat2(c, -s, s, c) * p.xz;
  float a = atan(q.y, q.x);
  float n = fbm(vec2(a * 3.0, log(r) * 9.)) * .7 + fbm(q * 1.3) * .5;
  float rad = smoothstep(2.4, 3.2, r) * smoothstep(14., 7., r) * pow(3.2 / r, 1.15);
  float I = rad * (.45 + .9 * n * n);
  vec3 orbit = normalize(vec3(-p.z, 0., p.x));
  float beta = sqrt(.5 / r);
  float dop = 1. / (1. - beta * dot(orbit, -normalize(v)));
  dop = pow(dop, 2.6);
  vec3 hot = mix(vec3(1., .38, .08), vec3(1., .8, .5), clamp(rad * 1.1, 0., 1.));
  hot = mix(hot, vec3(.9, .95, 1.), clamp((dop - 1.4) * .4, 0., .5));
  return hot * I * dop * 2.2;
}
void main(){
  vec2 uv = (gl_FragCoord.xy - .5 * uRes) / min(uRes.x, uRes.y);
  float t = uT;
  float el = .1 + .015 * sin(t * .01);
  vec3 ro = vec3(0., sin(el), -cos(el)) * 24.;
  vec3 fw = normalize(-ro), rt = normalize(cross(vec3(0., 1., 0.), fw)), up = cross(fw, rt);
  float zoom = uRes.x < uRes.y ? .95 : .82;
  vec3 v = normalize(fw + (uv.x * rt + uv.y * up) * zoom);
  vec3 p = ro;
  vec3 col = vec3(0.); float al = 0.;
  float h2 = dot(cross(p, v), cross(p, v));
  float minR = 100.; bool hole = false;
  for (int i = 0; i < 260; i++) {
    float r = length(p);
    float dt = clamp(.06 * r, .03, 1.2);
    vec3 acc = -1.5 * h2 * p / pow(r, 5.);
    vec3 np = p + v * dt; v += acc * dt; np = p + v * dt;
    if (p.y * np.y < 0.) {
      vec3 x = mix(p, np, p.y / (p.y - np.y));
      float rr = length(x.xz);
      if (rr > 2.3 && rr < 14.5) {
        vec3 c = diskCol(x, v, t);
        float a = clamp(length(c) * .9, 0., .95);
        col += (1. - al) * c; al += (1. - al) * a;
      }
    }
    p = np; minR = min(minR, length(p));
    if (length(p) < 1.) { hole = true; break; }
    if (length(p) > 40. && dot(p, v) > 0.) break;
    if (al > .99) break;
  }
  if (!hole && al < .99) {
    vec3 d = normalize(v);
    vec3 sp = d * 90., cell = floor(sp);
    float hs = h21(cell.xy + cell.z * 7.31);
    float st = step(.985, hs) * fract(hs * 91.) * smoothstep(.4, .05, length(fract(sp) - .5));
    col += (1. - al) * vec3(.85, .9, 1.) * st * 1.6;
  }
  if (!hole) col += vec3(1., .72, .45) * exp(-max(minR - 1.5, 0.) * 7.) * .35 * (1. - al);
  float ex = 1.15 * (1. + uBass * .18);
  col = 1. - exp(-col * ex);
  col = pow(col, vec3(.95, 1., 1.08));
  gl_FragColor = vec4(col, 1.);
}`,{speed:1,res:.8}),C=`
uniform sampler2D uImg; uniform float uZoom, uReady, uRoll;
const float AR = .98;                                                // the photograph's width over its height
float lum(vec3 c){ return dot(c, vec3(.3, .55, .15)); }
// A field of faint stars in a plane nearer than the photograph; d is how much nearer.
vec3 nearStars(vec2 uv, vec2 c, float z, float d, float seed, float t){
  float zz = pow(z, 1. + d);
  vec2 q = (c - .5) * (1. + d) * 2. + uv / zz * 1.4;                 // moves and grows faster than the far layer
  float N = 26. + seed * 6.;
  vec2 g = q * N;
  vec2 cell = floor(g), f = fract(g) - .5;
  float h = h21(cell + seed);
  vec2 o = (vec2(h21(cell + 1.3 + seed), h21(cell + 7.1 + seed)) - .5) * .6;
  float r = length(f - o) / N * zz / 1.4;                              // back to screen units
  float px = 1. / uRes.y;
  float size = (.5 + 1.1 * pow(h21(cell + 3.3 + seed), 4.)) * px * (1. + .5 * d);
  float star = smoothstep(size * 1.8, size * .3, r) * step(.975 - d * .01, h);
  float tw = .7 + .3 * sin(t * (1.5 + h * 3.) + h * 40.);
  vec3 col = mix(vec3(.85, .9, 1.), vec3(1., .9, .75), step(.5, h21(cell + 9.9 + seed)));
  return col * star * tw * (.3 + .4 * d);
}
void main(){
  vec2 uv = (gl_FragCoord.xy - .5 * uRes) / uRes.y;
  float cr = cos(uRoll), sr = sin(uRoll); uv = vec2(cr * uv.x - sr * uv.y, sr * uv.x + cr * uv.y);
  float t = uT, asp = uRes.x / uRes.y;
  float s = max(asp / AR, 1.);                                        // cover the screen at zoom 1
  vec2 c = vec2(uA, uB);
  vec2 tc = c + uv / (uZoom * s) * vec2(1. / AR, 1.);
  vec3 col = vec3(0.);
  if (uReady > .5) {
    vec3 im = texture2D(uImg, tc).rgb;
    // Bloom: the brightest points get a soft halo from a ring of samples, pulsing with the bass and twinkling.
    float px = 1. / (uRes.y * uZoom * s);
    vec3 halo = vec3(0.);
    for (int i = 0; i < 12; i++) {
      float a = float(i) * .5236;
      vec2 o = vec2(cos(a) / AR, sin(a)) * px * 3.5;
      vec3 sm = texture2D(uImg, tc + o).rgb;
      halo += max(sm - .5, 0.) * .5;
      sm = texture2D(uImg, tc + o * 2.4).rgb;
      halo += max(sm - .62, 0.) * .3;
    }
    halo /= 12.;
    vec2 cell = floor(tc * vec2(AR, 1.) * 900.);
    float h = h21(cell);
    float tw = .8 + .2 * sin(t * (2. + 2. * h) + h * 60.) * (.5 + .5 * uTreble);
    col = im + halo * (1.3 + 2.2 * uBass) * tw * vec3(1., .95, .88);
    col += im * max(lum(im) - .75, 0.) * .5 * (.6 + .8 * uBass);        // cores and spikes brighten with the beat
    float inside = step(0., tc.x) * step(tc.x, 1.) * step(0., tc.y) * step(tc.y, 1.);
    col *= inside;
  }
  // Nearer stars, two planes, and a few motes close by.
  col += nearStars(uv, c, uZoom, .35, 0., t);
  col += nearStars(uv, c, uZoom, .8, 5., t) * .8;
  col = mix(col, col * .55, smoothstep(.55, 1.2, length(uv)) * .8);    // vignette
  col += dither(t);
  gl_FragColor = vec4(col, 1.);
}`;function w(){let e=[[.43,.39,2.6],[.52,.52,2.3],[.64,.43,3.2],[.86,.38,3.4],[.57,.07,3],[.71,.57,3.2],[.44,.68,3],[.17,.74,2.6],[.5,.5,1.12]],n=null,r=0,i=null,a,u,d,p,m,h=e=>e*e*e*(e*(e*6-15)+10),_=t=>{let n;do n=r%3==2?e.length-1:Math.floor(Math.random()*(e.length-1));while(e[n]===t);return e[n]};return g(`float dither(float t){ return (h21(gl_FragCoord.xy + fract(t)) - .5) / 160.; }
`+C,{res:1.25,speed:1,before(g,v,y,b){m||(m=y.getParameter(y.CURRENT_PROGRAM),a=y.getUniformLocation(m,`uZoom`),u=y.getUniformLocation(m,`uReady`),d=y.getUniformLocation(m,`uImg`),p=y.getUniformLocation(m,`uRoll`));let x=t(`deep-field.jpg`);if(!i&&o(x)){i=y.createTexture(),y.activeTexture(y.TEXTURE2),y.bindTexture(y.TEXTURE_2D,i);for(let[e,t]of[[y.TEXTURE_MIN_FILTER,y.LINEAR],[y.TEXTURE_MAG_FILTER,y.LINEAR],[y.TEXTURE_WRAP_S,y.CLAMP_TO_EDGE],[y.TEXTURE_WRAP_T,y.CLAMP_TO_EDGE]])y.texParameteri(y.TEXTURE_2D,e,t);y.texImage2D(y.TEXTURE_2D,0,y.RGB,y.RGB,y.UNSIGNED_BYTE,x),y.uniform1i(d,2)}i&&(y.activeTexture(y.TEXTURE2),y.bindTexture(y.TEXTURE_2D,i)),y.uniform1f(u,+!!i);let S=(l?1.7:1)*(s?.8:1);n||={from:e[e.length-1],to:e[0],t0:g,dur:75,hold:22};let C=(g-n.t0)*S/n.dur;C>=1+n.hold/n.dur&&(r++,n={from:n.to,to:_(n.to),t0:g,dur:60+Math.random()*40,hold:15+Math.random()*20},C=0);let w=h(Math.max(0,Math.min(1,C))),T=n.from[0]+(n.to[0]-n.from[0])*w,E=n.from[1]+(n.to[1]-n.from[1])*w,D=Math.exp(Math.log(n.from[2])+(Math.log(n.to[2])-Math.log(n.from[2]))*w);T+=Math.sin(g*.05)*.012/D,E+=Math.cos(g*.041)*.012/D;let O=Math.max(f/c/.98,1),k=.5/(D*O*.98)+.002,A=.5/(D*O)+.002;T=Math.max(k,Math.min(1-k,T)),E=Math.max(A,Math.min(1-A,E)),y.uniform1f(b.uA,T),y.uniform1f(b.uB,1-E),y.uniform1f(a,D),y.uniform1f(p,Math.sin(g*.023)*.035)}})}export{S as blackholeScene,w as deepfieldScene,x as orreryScene,b as saturnScene};