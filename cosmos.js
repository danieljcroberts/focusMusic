import{S as e,a as t,f as n,h as r,i,m as a,n as o,o as s,p as c,r as l,s as u,t as d,x as f}from"./util.js";import{Rt as p,r as m,zt as h}from"./music.js";import{c as g}from"./app.js";import{dotTexture as _,threeScene as v}from"./three-scenes.js";var y=Math.PI*2,b=()=>v(t=>{let n=new t.Scene,r=new t.PerspectiveCamera(50,1,.05,3e3),a=new t.Vector3(-129,0,0),c=new t.Vector3(-.3,.1,-1).normalize(),l=e=>e<1.24||e>2.34?0:e<1.53?.22+.08*Math.sin(e*140):e<1.95?.75+.2*Math.sin(e*90)*Math.sin(e*23):e<2.03?.04:e<2.27?(Math.abs(e-2.214)<.006?.05:.55+.12*Math.sin(e*120))*(e>2.2?.85:1):e>2.32?.5:0,d=document.createElement(`canvas`);d.width=64,d.height=1024;let p=d.getContext(`2d`);for(let e=0;e<1024;e++){let t=(e/1024-.5)*2,n=Math.abs(t),r=i([214,186,140],[150,140,120],n**1.6),a=Math.sin(t*38+Math.sin(t*9)*1.5)*.5+Math.sin(t*97)*.2+(o(Math.floor(t*60),3)-.5)*.5,s=i(r,a>0?[240,220,176]:[160,112,70],Math.min(1,Math.abs(a)*.7));p.fillStyle=u(n>.8?i(s,[120,140,150],(n-.8)*3):s),p.fillRect(0,e,64,1)}let h=new t.CanvasTexture(d);h.colorSpace=t.SRGBColorSpace;let g=new t.Mesh(new t.SphereGeometry(60,128,64),new t.MeshLambertMaterial({map:h}));g.position.copy(a),g.scale.y=.9,n.add(g);let v=new t.DirectionalLight(16774374,3.2);v.position.copy(c),n.add(v),n.add(new t.AmbientLight(4212824,.12));let y=document.createElement(`canvas`);y.width=1024,y.height=1;let b=y.getContext(`2d`);for(let e=0;e<1024;e++){let t=1.2+e/1024*1.2,n=l(t),r=i([196,176,150],[232,214,186],Math.min(1,n+.2*Math.sin(t*31)));b.fillStyle=u(r,Math.min(1,n*1.1)),b.fillRect(e,0,1,1)}let x=new t.CanvasTexture(y);x.colorSpace=t.SRGBColorSpace;let S=new t.Mesh(new t.RingGeometry(72,144,512,1),new t.ShaderMaterial({transparent:!0,depthWrite:!1,side:t.DoubleSide,uniforms:{tex:{value:x},cen:{value:a},sun:{value:c},R:{value:60},glow:{value:1}},vertexShader:`varying vec3 vP; void main(){ vec4 w = modelMatrix * vec4(position, 1.); vP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,fragmentShader:`uniform sampler2D tex; uniform vec3 cen, sun; uniform float R, glow; varying vec3 vP;
      void main(){
        vec3 q = vP - cen; float r = length(q.xz) / R;
        vec4 c = texture2D(tex, vec2((r - 1.2) / 1.2, .5));
        float along = dot(q, sun); vec3 perp = q - along * sun;
        float shadow = along < 0. ? smoothstep(R * .97, R * 1.03, length(perp)) : 1.;
        float near = smoothstep(3., 16., length(vP - cameraPosition));
        gl_FragColor = vec4(c.rgb * (.08 + .92 * shadow) * glow, c.a * near * .95);
      }`}));S.rotation.x=-Math.PI/2,S.position.copy(a),n.add(S);let C=_(t),w=[],T={r0:-40,r1:14,s0:-75,s1:25};for(let[r,i,a]of[[e?6e3:16e3,.09,.5],[e?1200:3200,.17,.7],[e?40:110,.36,.9]]){let e=new Float32Array(r*3),o=new Float32Array(r*3);for(let t=0;t<r;t++){let n,r;do n=s(T.r0,T.r1),r=l((129+n)/60);while(Math.random()>r);e[t*3]=n,e[t*3+1]=s(-a,a)*.5,e[t*3+2]=s(T.s0,T.s1);let i=s(.6,1.05),c=Math.random();o.set([i*(.95+.05*c),i*(.86+.04*c),i*(.74-.06*c)],t*3)}let c=new t.BufferGeometry;c.setAttribute(`position`,new t.BufferAttribute(e,3)),c.setAttribute(`color`,new t.BufferAttribute(o,3));let u=new t.PointsMaterial({size:i,map:C,vertexColors:!0,transparent:!0,opacity:.9,depthWrite:!1,sizeAttenuation:!0});n.add(new t.Points(c,u)),w.push({pos:e,geo:c,mat:u,n:r})}let E=new Float32Array(2700);for(let e=0;e<900;e++){let n=new t.Vector3(s(-1,1),s(-1,1),s(-1,1)).normalize().multiplyScalar(2e3);E.set([n.x,n.y,n.z],e*3)}let D=new t.BufferGeometry;D.setAttribute(`position`,new t.BufferAttribute(E,3)),n.add(new t.Points(D,new t.PointsMaterial({size:1.3,map:C,transparent:!0,opacity:.7,depthWrite:!1,sizeAttenuation:!1,color:14673663})));let O=new t.Vector3;return{scene:n,camera:r,update(e,n){let i=1.1*(f?2:1);for(let e of w){for(let t=0;t<e.n;t++){let r=e.pos[t*3],a=e.pos[t*3+2]+(i+r*.045)*n;a>T.s1?a-=T.s1-T.s0:a<T.s0&&(a+=T.s1-T.s0),e.pos[t*3+2]=a}e.geo.attributes.position.needsUpdate=!0,e.mat.opacity=.82+.15*m.bass}S.material.uniforms.glow.value=1+.08*m.bass;let a=Math.atan(Math.tan(t.MathUtils.degToRad(25))*r.aspect),o=t.MathUtils.degToRad(62+Math.max(0,1-r.aspect)*14)-a*.3+Math.sin(e*.021)*.02;r.position.set(0,1.4+Math.sin(e*.05)*.25,0),O.set(-Math.sin(o),-.06+Math.sin(e*.033)*.01,-Math.cos(o)).add(r.position),r.lookAt(O),r.rotateZ(Math.sin(e*.017)*.015)}}});function x(){let e=[[.2408,[150,146,140],.26],[.6152,[226,206,160],.38],[1,[58,112,178],.4,1],[1.881,[178,78,52],.32],[11.86,[204,170,128],.78,4],[29.46,[222,196,132],.66,1,!0],[84.01,[150,206,214],.5],[164.8,[64,98,190],.5]],o,f,p,h,g;return{init(){let n=c>a*1.1?.8:.44,r=Math.min(a*.41,c*.4/n),m=a/2,_=c*.48;h={R:r,cx:m,cy:_,tilt:n,unit:r/30},g=s(0,5e3);let v;[o,v]=l(a,c),v.fillStyle=`#0a0507`,v.fillRect(0,0,a,c);let[b,x]=t(160,160*c/a),S=x.createImageData(b.width,b.height);for(let e=0;e<S.data.length;e+=4){let t=s(0,1);S.data[e]=40+t*30,S.data[e+1]=14+t*10,S.data[e+2]=22+t*14,S.data[e+3]=255}x.putImageData(S,0,0),v.globalAlpha=.4,v.drawImage(b,0,0,a,c),v.globalAlpha=1,d(v,a*.28,c*.18,Math.max(a,c)*.9,[255,196,140],.22),d(v,m,_,r*1.3,[255,210,160],.1);let C=v.createRadialGradient(m,_,Math.min(a,c)*.3,m,_,Math.max(a,c)*.8);C.addColorStop(0,`rgba(0,0,0,0)`),C.addColorStop(1,`rgba(0,0,0,.65)`),v.fillStyle=C,v.fillRect(0,0,a,c);let w=h.unit*3;h.drop=w,v.save(),v.translate(m,_+w),v.scale(1,n),d(v,0,0,r*1.3,[0,0,0],.6);let T=r*1.16,E=v.createRadialGradient(-r*.3,-r*.3,0,0,0,T);E.addColorStop(0,`#3a2016`),E.addColorStop(1,`#170b07`),v.fillStyle=E,v.beginPath(),v.arc(0,0,T,0,y),v.fill(),v.strokeStyle=`rgba(214,170,96,.7)`,v.lineWidth=h.unit*.5,v.stroke(),v.strokeStyle=`rgba(214,174,104,.55)`;for(let e=0;e<120;e++){let t=e/120*y,n=e%10==0?1.6:e%5==0?1:.55;v.lineWidth=h.unit*(e%10==0?.22:.12),v.beginPath(),v.moveTo(Math.cos(t)*T*.985,Math.sin(t)*T*.985),v.lineTo(Math.cos(t)*(T*.985-h.unit*n),Math.sin(t)*(T*.985-h.unit*n)),v.stroke()}v.restore();for(let t=0;t<e.length;t++){let e=r*(.2+t*.1);v.strokeStyle=`rgba(222,180,108,${.32-t*.015})`,v.lineWidth=Math.max(.6,h.unit*.12),v.beginPath(),v.ellipse(m,_,e,e*n,0,0,y),v.stroke()}let D=(e,t,n)=>{let r=Math.ceil(t*2+8),[a,o]=l(r,r),s=r/2,c=o.createRadialGradient(s-t*.4,s-t*.45,t*.05,s,s,t);if(c.addColorStop(0,u(i(e,[255,250,236],.65))),c.addColorStop(.35,u(e)),c.addColorStop(1,u(i(e,[0,0,0],.72))),o.fillStyle=c,o.beginPath(),o.arc(s,s,t,0,y),o.fill(),n){o.save(),o.beginPath(),o.arc(s,s,t,0,y),o.clip();for(let[e,n,r]of[[-.35,.12,.25],[-.1,.16,.3],[.18,.12,.25],[.42,.1,.2]])o.fillStyle=`rgba(120,70,40,${r})`,o.fillRect(s-t,s+e*t,t*2,n*t);o.restore()}return o.fillStyle=`rgba(255,255,250,.75)`,o.beginPath(),o.arc(s-t*.38,s-t*.42,t*.16,0,y),o.fill(),a};f=e.map(e=>D(e[1],h.unit*e[2]*2.2,e[2]>.6)),f.moon=D([214,206,190],h.unit*.22,!1);let O=r*.085,k=Math.ceil(O*2+8),A;[p,A]=l(k,k);let j=k/2,M=A.createRadialGradient(j-O*.35,j-O*.4,O*.05,j,j,O);M.addColorStop(0,`#fff6d8`),M.addColorStop(.25,`#f1c66a`),M.addColorStop(.7,`#a8752c`),M.addColorStop(1,`#4a2c10`),A.fillStyle=M,A.beginPath(),A.arc(j,j,O,0,y),A.fill(),A.strokeStyle=`rgba(80,46,14,.5)`,A.lineWidth=1;for(let e=0;e<12;e++){let t=e/12*y;A.beginPath(),A.moveTo(j+Math.cos(t)*O*.55,j+Math.sin(t)*O*.55),A.lineTo(j+Math.cos(t)*O*.95,j+Math.sin(t)*O*.95),A.stroke()}},draw(t){let{R:i,cx:s,cy:l,tilt:u,unit:_}=h,v=g+t;r.drawImage(o,0,0,a,c);let b=e.map((e,t)=>{let n=(t*2.3+v*y/(20*e[0]/.2408))%y,r=i*(.2+t*.1);return{i:t,p:e,a:n,x:s+Math.cos(n)*r,y:l+Math.sin(n)*r*u,h:_*(1.2+t*.55)}}),x=Math.max(1,_*.22),S=_*6,C=r.createLinearGradient(s-_,0,s+_,0);C.addColorStop(0,`#5a3a16`),C.addColorStop(.35,`#e8c27a`),C.addColorStop(1,`#4a2c10`),r.fillStyle=C,r.fillRect(s-_*.6,l,_*1.2,S);let w=e=>{let{p:t,x:i,y:a,h:o}=e,c=f[e.i];d(r,i-_*.6,a+h.drop+_*.2,_*2.2,[0,0,0],.45),r.strokeStyle=`rgba(206,160,84,.9)`,r.lineWidth=x,r.lineCap=`round`,r.beginPath(),r.moveTo(s,l+o),r.lineTo(i,a+o),r.lineTo(i,a),r.stroke(),r.strokeStyle=`rgba(255,236,190,.35)`,r.lineWidth=x*.4,r.beginPath(),r.moveTo(s,l+o-x*.3),r.lineTo(i,a+o-x*.3),r.stroke(),t[4]&&(r.strokeStyle=`rgba(232,196,120,.8)`,r.lineWidth=x*.8,r.beginPath(),r.ellipse(i,a,c.width/2/n*1+_*.9,(_*.9+c.width/2/n)*.32,-.25,Math.PI,y),r.stroke());let p=t[3]||0,m=[_*1.4,_*1.9,_*2.4,_*2.9],g=[];for(let e=0;e<p;e++){let t=v*y/(5+e*4.5)+e*1.7;g.push({x:i+Math.cos(t)*m[e],y:a+Math.sin(t)*m[e]*u,back:Math.sin(t)<0,m:e})}let b=e=>{r.strokeStyle=`rgba(206,160,84,.55)`,r.lineWidth=x*.5,r.beginPath(),r.moveTo(i,a),r.lineTo(e.x,e.y),r.stroke();let t=f.moon.width/n;r.drawImage(f.moon,e.x-t/2,e.y-t/2,t,t)};g.filter(e=>e.back).forEach(b);let S=c.width/n;r.drawImage(c,i-S/2,a-S/2,S,S),t[4]&&(r.strokeStyle=`rgba(240,210,140,.9)`,r.lineWidth=x*.8,r.beginPath(),r.ellipse(i,a,S/2+_*.9,(S/2+_*.9)*.32,-.25,0,Math.PI),r.stroke()),g.filter(e=>!e.back).forEach(b)};b.filter(e=>e.y<l).sort((e,t)=>e.y-t.y).forEach(w);let T=p.width/n;d(r,s,l,i*.22,[255,210,130],.18+m.bass*.08),r.drawImage(p,s-T/2,l-T/2,T,T),b.filter(e=>e.y>=l).sort((e,t)=>e.y-t.y).forEach(w)}}}var S=()=>g(`
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
}`;function w(){let t=[[.43,.39,2.6],[.52,.52,2.3],[.64,.43,3.2],[.86,.38,3.4],[.57,.07,3],[.71,.57,3.2],[.44,.68,3],[.17,.74,2.6],[.5,.5,1.12]],n=null,r=0,i=null,o,s,l,u,d,m=e=>e*e*e*(e*(e*6-15)+10),_=e=>{let n;do n=r%3==2?t.length-1:Math.floor(Math.random()*(t.length-1));while(t[n]===e);return t[n]};return g(`float dither(float t){ return (h21(gl_FragCoord.xy + fract(t)) - .5) / 160.; }
`+C,{res:1.25,speed:1,before(g,v,y,b){d||(d=y.getParameter(y.CURRENT_PROGRAM),o=y.getUniformLocation(d,`uZoom`),s=y.getUniformLocation(d,`uReady`),l=y.getUniformLocation(d,`uImg`),u=y.getUniformLocation(d,`uRoll`));let x=p(`deep-field.jpg`);if(!i&&h(x)){i=y.createTexture(),y.activeTexture(y.TEXTURE2),y.bindTexture(y.TEXTURE_2D,i);for(let[e,t]of[[y.TEXTURE_MIN_FILTER,y.LINEAR],[y.TEXTURE_MAG_FILTER,y.LINEAR],[y.TEXTURE_WRAP_S,y.CLAMP_TO_EDGE],[y.TEXTURE_WRAP_T,y.CLAMP_TO_EDGE]])y.texParameteri(y.TEXTURE_2D,e,t);y.texImage2D(y.TEXTURE_2D,0,y.RGB,y.RGB,y.UNSIGNED_BYTE,x),y.uniform1i(l,2)}i&&(y.activeTexture(y.TEXTURE2),y.bindTexture(y.TEXTURE_2D,i)),y.uniform1f(s,+!!i);let S=(f?1.7:1)*(e?.8:1);n||={from:t[t.length-1],to:t[0],t0:g,dur:75,hold:22};let C=(g-n.t0)*S/n.dur;C>=1+n.hold/n.dur&&(r++,n={from:n.to,to:_(n.to),t0:g,dur:60+Math.random()*40,hold:15+Math.random()*20},C=0);let w=m(Math.max(0,Math.min(1,C))),T=n.from[0]+(n.to[0]-n.from[0])*w,E=n.from[1]+(n.to[1]-n.from[1])*w,D=Math.exp(Math.log(n.from[2])+(Math.log(n.to[2])-Math.log(n.from[2]))*w);T+=Math.sin(g*.05)*.012/D,E+=Math.cos(g*.041)*.012/D;let O=Math.max(a/c/.98,1),k=.5/(D*O*.98)+.002,A=.5/(D*O)+.002;T=Math.max(k,Math.min(1-k,T)),E=Math.max(A,Math.min(1-A,E)),y.uniform1f(b.uA,T),y.uniform1f(b.uB,1-E),y.uniform1f(o,D),y.uniform1f(u,Math.sin(g*.023)*.035)}})}export{S as blackholeScene,w as deepfieldScene,x as orreryScene,b as saturnScene};