'use strict';
const {fs,path,root,number,file}=require('./common.cjs');
const {Resvg,initWasm}=require('../vendor/resvg.cjs');
const ot=require('../vendor/opentype.cjs');
const fonts={};let ready;
function init(){if(!ready)ready=initWasm(fs.readFileSync(path.join(root,'vendor/resvg.wasm')));return ready;}
function font(weight){
  const name=weight===8?'Paperlogy-8ExtraBold.ttf':'Paperlogy-7Bold.ttf';
  if(!fonts[name]){const b=fs.readFileSync(path.join(root,'assets/fonts',name));fonts[name]=ot.parse(b.buffer.slice(b.byteOffset,b.byteOffset+b.length));}
  return fonts[name];
}
function color(value,otherwise){const c=value??otherwise;if(!/^#[a-fA-F0-9]{6}$/.test(c))throw Error('Use #RRGGBB: '+c);return c;}
function opacity(v){v=v??1;if(!Number.isFinite(v)||v<0||v>1)throw Error('Opacity should be 0..1');return v;}
function bounds(w,h){if(!Number.isFinite(w)||!Number.isFinite(h)||w<1||h<1||w>4096||h>4096)throw Error('Invalid sprite bounds');}
function textSprite(e,isCaption){
  const w=e.width??630;const pad=e.padding??(isCaption?5:16),gap=e.gap??6;
  number(w,'box width',1);number(pad,'padding');number(gap,'gap');
  const input=e.lines??String(e.text??'').split('\n');if(!input.length)throw Error('Empty label');
  const rows=input.map(v=>{
    const l=typeof v==='string'?{text:v}:v;
    if(typeof l.text!=='string'||!l.text.trim())throw Error('Each line needs text');
    const size=number(l.size??(isCaption?38:32),'size',1);const outline=number(l.stroke??(isCaption?3:0),'stroke');
    const f=font(l.weight??(isCaption?7:8));let glyph=f.getPath(l.text,0,0,size), b=glyph.getBoundingBox();
    const max=w-2*pad-outline;if(max<=0)throw Error('Box too narrow');
    if(b.x2-b.x1>max){glyph=f.getPath(l.text,0,0,size*max/(b.x2-b.x1));b=glyph.getBoundingBox();}
    return {glyph,b,outline,h:b.y2-b.y1+outline,fill:color(l.color,'#ffffff'),edge:color(l.strokeColor,'#111820')};
  });
  const block=rows.reduce((s,r)=>s+r.h,0)+(rows.length-1)*gap;const h=e.height??Math.ceil(block+2*pad);
  bounds(w,h);if(h+0.01<block+2*pad)throw Error('Text does not fit in '+String(e.text||'box')+'; increase height or wrap the text');
  let y=(h-block)/2;const parts=[];
  if(!isCaption||e.fill){parts.push('<rect width="'+w+'" height="'+h+'" rx="'+number(e.radius??12,'radius')+'" fill="'+color(e.fill,'#27384a')+'" fill-opacity="'+opacity(e.opacity)+'"/>');}
  for(const r of rows){
    const tx=w/2-(r.b.x1+r.b.x2)/2,ty=y-r.b.y1+r.outline/2;
    parts.push('<path transform="translate('+tx+' '+ty+')" d="'+r.glyph.toPathData(2)+'" fill="'+r.fill+'" stroke="'+r.edge+'" stroke-width="'+r.outline+'" stroke-linejoin="round" paint-order="stroke fill"/>');
    y+=r.h+gap;
  }
  return [w,h,parts.join('')];
}
function svgSprite(e,dir){
  if(e.kind==='label'||e.kind==='caption')return textSprite(e,e.kind==='caption');
  const w=e.width??130,h=e.height??90;bounds(w,h);
  if(e.kind==='logo'||e.kind==='image'){
    const p=e.file?file(path.resolve(dir,e.file)):file(path.join(root,'assets','brand','ask-inno.png'));
    const ext=path.extname(p).toLowerCase(),mime={'.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg'}[ext];
    if(!mime)throw Error('Unsupported image file '+p);
    return [w,h,'<image width="'+w+'" height="'+h+'" preserveAspectRatio="xMidYMid meet" xlink:href="data:'+mime+';base64,'+fs.readFileSync(p).toString('base64')+'"/>'];
  }
  const c=color(e.color,'#ffffff'),s=number(e.stroke??4,'stroke',0.5);
  if(e.kind==='x')return [w,h,'<path d="M '+s+' '+s+' L '+(w-s)+' '+(h-s)+' M '+(w-s)+' '+s+' L '+s+' '+(h-s)+'" stroke="'+c+'" stroke-width="'+s+'" stroke-linecap="round"/>'];
  if(e.kind==='leader'){
    const pts=e.points??[[5,h-5],[w/2,5],[w-5,5]];
    if(!Array.isArray(pts)||pts.length<2||pts.some(p=>!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)))throw Error('Invalid leader points');
    return [w,h,'<polyline fill="none" stroke="'+c+'" stroke-width="'+s+'" points="'+pts.map(p=>p.join(',')).join(' ')+'"/><circle cx="'+pts[0][0]+'" cy="'+pts[0][1]+'" r="'+(s+1)+'" fill="'+c+'"/>'];
  }
  throw Error('Unknown graphic kind: '+e.kind);
}
function sprite(e,dir){
  const [w,h,body]=svgSprite(e,dir);const img=new Resvg('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="'+Math.ceil(w)+'" height="'+Math.ceil(h)+'">'+body+'</svg>');
  let rendered;try{rendered=img.render();return {w:rendered.width,h:rendered.height,pixels:Buffer.from(rendered.pixels)};}finally{if(rendered)rendered.free();img.free();}
}
const ease=t=>1-(1-t)**3;
function draw(frame,W,H,event,t) {
  const e=event.spec,s=event.sprite;if(t<e.start||t>=e.end)return;
  const dur=e.end-e.start;const appear=Math.min(e.enter??0.22,dur/2), disappear=Math.min(e.exit??0.14,dur/2);
  const p=appear?ease(Math.min(1,(t-e.start)/appear)):1, alpha=(e.alpha??1)*p*(disappear?Math.min(1,(e.end-t)/disappear):1);
  const track=(t-e.start)/dur;
  const cx=(e.x??W/2)+((e.toX??e.x??W/2)-(e.x??W/2))*track;
  const cy=(e.y??(e.kind==='caption'?H*0.77:H/2))+((e.toY??e.y??(e.kind==='caption'?H*0.77:H/2))-(e.y??(e.kind==='caption'?H*0.77:H/2)))*track;
  const x0=Math.round(cx-s.w/2), y0=Math.round(cy-s.h/2+(e.rise??(e.kind==='leader'?0:15))*(1-p));
  const xstart=Math.max(0,-x0),xend=Math.min(s.w,W-x0,e.kind==='leader'?Math.ceil(s.w*p):s.w);
  for(let y=Math.max(0,-y0);y<Math.min(s.h,H-y0);y++){
    for(let x=xstart;x<xend;x++){
      const si=(y*s.w+x)*4,a=s.pixels[si+3]/255*alpha;if(!a)continue;
      const di=((y+y0)*W+x+x0)*4,da=frame[di+3]/255,oa=a+da*(1-a);
      for(let k=0;k<3;k++)frame[di+k]=Math.min(255,Math.round((s.pixels[si+k]*alpha+frame[di+k]*da*(1-a))/oa));
      frame[di+3]=Math.round(255*oa);
    }
  }
}
module.exports={init,sprite,draw};
