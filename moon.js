import{o as e}from"./app.js";var t=29.530589,n=Date.UTC(2e3,0,6,18,14),r=(e=new Date)=>((e.getTime()-n)/864e5/t%1+1)%1;function i(t,n,i,a,o,s=`rgba(120,130,160,.12)`,c=r()){t.save(),t.fillStyle=s,t.beginPath(),t.arc(n,i,a,0,Math.PI*2),t.fill();let l=c<.5,u=Math.cos(2*Math.PI*(l?c:c-.5));t.translate(n,i),!l!==e()&&t.scale(-1,1);let d=l?u:-u;t.fillStyle=o,t.beginPath(),t.moveTo(0,-a),t.arc(0,0,a,-Math.PI/2,Math.PI/2),t.ellipse(0,0,Math.max(.001,Math.abs(d)*a),a,0,Math.PI/2,-Math.PI/2,d>0),t.fill(),t.restore()}var a=(t,n=e())=>`
const float MOONP = ${t.toFixed(4)};
float moonLit(vec2 q){
  q.x *= ${n?`-1.`:`1.`};   // mirrored south of the equator
  float sx = sqrt(max(0., 1. - q.y * q.y)), aa = .04;
  if (MOONP < .5) return smoothstep(sx * cos(6.2832 * MOONP) - aa, sx * cos(6.2832 * MOONP) + aa, q.x);
  return smoothstep(sx * cos(6.2832 * (MOONP - .5)) + aa, sx * cos(6.2832 * (MOONP - .5)) - aa, q.x);
}`;export{i as n,r,a as t};