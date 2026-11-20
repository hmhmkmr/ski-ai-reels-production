'use strict';
const {fs,path,file,json}=require('./common.cjs');
const {unzipSync}=require('../vendor/fflate.cjs');const {DOMParser}=require('../vendor/xmldom/lib/index.js');
const pp=path.posix;const kids=n=>Array.from(n?.childNodes??[]).filter(x=>x.nodeType===1);
const child=(n,name)=>kids(n).find(x=>x.localName===name);
const all=(n,name)=>Array.from(n?.getElementsByTagNameNS?.('*',name)??[]);const at=(n,k)=>n?.getAttribute(k)||'';
const esc=x=>String(x).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const nattr=(n,k,d=0)=>at(n,k)===''?d:Number(at(n,k));const leaftext=n=>all(n,'t').map(t=>t.textContent).join('');
function brief(input,out) {
  file(input);if(fs.existsSync(out))throw Error('Choose a new storyboard directory');
  const entries=unzipSync(fs.readFileSync(input));const parse=p=>{if(!entries[p])return null;const s=Buffer.from(entries[p]).toString('utf8');if(/<!DOCTYPE/i.test(s))throw Error('Unexpected DTD in '+p);return new DOMParser().parseFromString(s,'text/xml');};
  function rels(src){const xml=parse(pp.join(pp.dirname(src),'_rels',pp.basename(src)+'.rels'));const out=new Map();
    for(const r of all(xml,'Relationship')){const remote=at(r,'TargetMode')==='External',target=at(r,'Target');out.set(at(r,'Id'),{type:at(r,'Type').split('/').pop(),remote,target:remote?target:target.startsWith('/')?target.slice(1):pp.normalize(pp.join(pp.dirname(src),target))});}return out;}
  const main='ppt/presentation.xml',pr=parse(main);if(!pr)throw Error('This file is not a valid .pptx');
  const presR=rels(main),size=all(pr,'sldSz')[0],W=nattr(size,'cx',12192000),H=nattr(size,'cy',6858000),scale=1080/W;
  fs.mkdirSync(path.dirname(out),{recursive:true});const tmp=fs.mkdtempSync(path.join(path.dirname(out),'.ski-brief-'));const images=new Map(),slides=[];
  function extract(k){if(images.has(k))return images.get(k);if(!entries[k])return null;const ext=pp.extname(k).toLowerCase().replace(/[^.a-z0-9]/g,''),dest='media/image-'+String(images.size+1).padStart(3,'0')+ext;fs.writeFileSync(path.join(tmp,dest),entries[k]);images.set(k,dest);return dest;}
  try{
    fs.mkdirSync(path.join(tmp,'media'));let seq=0;
    for(const id of all(pr,'sldId')){
      const src=presR.get(at(id,'r:id'))?.target;if(!src||!entries[src])continue;seq++;
      const dom=parse(src),links=rels(src),tree=all(dom,'spTree')[0],items=[],drawing=[];
      function walk(n,trans){
        if(!['sp','pic','cxnSp','graphicFrame','grpSp'].includes(n.localName))return;
        const props=child(n,n.localName==='grpSp'?'grpSpPr':'spPr'),xf=child(props,'xfrm')||child(n,'xfrm');
        const off=child(xf,'off'),ext=child(xf,'ext');const ox=nattr(off,'x'),oy=nattr(off,'y'),ew=nattr(ext,'cx'),eh=nattr(ext,'cy');
        const x=(trans.x+ox*trans.sx)*scale,y=(trans.y+oy*trans.sy)*scale,w=ew*trans.sx*scale,h=eh*trans.sy*scale;
        if(n.localName==='grpSp'){
          const coff=child(xf,'chOff'),cext=child(xf,'chExt');const sx=trans.sx*(ew/(nattr(cext,'cx',ew)||1)),sy=trans.sy*(eh/(nattr(cext,'cy',eh)||1));
          for(const el of kids(n))walk(el,{x:trans.x+ox*trans.sx-nattr(coff,'x')*sx,y:trans.y+oy*trans.sy-nattr(coff,'y')*sy,sx,sy});return;
        }
        const paras=all(n,'p').map(leaftext).filter(Boolean),name=at(all(n,'cNvPr')[0],'name');
        const blip=all(n,'blip')[0],link=links.get(at(blip,'r:embed')),asset=link&&!link.remote?extract(link.target):null;
        items.push({kind:n.localName,name,x,y,width:w,height:h,text:paras,asset});
        if(!w||!h)return;
        const rot=nattr(xf,'rot')/60000;let el='';
        if(asset&&/\.(png|jpe?g|gif|svg|webp)$/i.test(asset)){
          const crop=all(n,'srcRect')[0],l=nattr(crop,'l')/100,r=nattr(crop,'r')/100,t=nattr(crop,'t')/100,b=nattr(crop,'b')/100;
          el+='<svg x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" viewBox="'+[l,t,Math.max(1,1000-l-r),Math.max(1,1000-t-b)].join(' ')+'" preserveAspectRatio="none"><image href="'+asset+'" width="1000" height="1000" preserveAspectRatio="none"/></svg>';
        }
        if(paras.length){
          const c=at(all(child(props,'solidFill'),'srgbClr')[0],'val');if(/^[A-Fa-f0-9]{6}$/.test(c))el+='<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="#'+c+'"/>';
          const font=Math.max(9,Math.min(36,Math.round(nattr(all(n,'rPr')[0],'sz',1500)/100*12700*scale)));
          el+='<foreignObject x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'"><div xmlns="http://www.w3.org/1999/xhtml" style="font: '+font+'px/1.18 system-ui;overflow:hidden;color:#14191b">'+paras.map(esc).join('<br/>')+'</div></foreignObject>';
        }
        drawing.push(rot?'<g transform="rotate('+rot+' '+(x+w/2)+' '+(y+h/2)+')">'+el+'</g>':el);
      }
      for(const n of kids(tree))walk(n,{x:0,y:0,sx:1,sy:1});
      const nr=Array.from(links.values()).find(r=>r.type==='notesSlide'),notes=nr?all(parse(nr.target),'p').map(leaftext).filter(Boolean):[];
      const title='page-'+String(seq).padStart(3,'0')+'.html';
      const body='<h1>슬라이드 '+seq+'</h1><svg viewBox="0 0 1080 '+H*scale+'" style="width:min(100%,1080px);border:1px solid #aaa">'+drawing.join('')+'</svg><h2>원문</h2>'+items.flatMap(s=>s.text.map(t=>'<p>'+esc(t)+'</p>')).join('')+'<h2>메모</h2>'+notes.map(t=>'<p>'+esc(t)+'</p>').join('');
      fs.writeFileSync(path.join(tmp,title),'<!doctype html><meta charset="utf-8"><title>스토리보드 '+seq+'</title>'+body);
      slides.push({slide:seq,file:src,preview:title,notes,items,externalReferences:Array.from(links.values()).filter(r=>r.remote).map(r=>r.target)});
    }
    if(!slides.length)throw Error('No slides found');
    json(path.join(tmp,'storyboard.json'),{slides,sizeEMU:{width:W,height:H}});
    fs.writeFileSync(path.join(tmp,'index.html'),'<!doctype html><meta charset="utf-8"><title>스토리보드</title><h1>스토리보드</h1><ul>'+slides.map(s=>'<li><a href="'+s.preview+'">슬라이드 '+s.slide+'</a></li>').join('')+'</ul>');
    fs.renameSync(tmp,out);console.log(path.join(out,'storyboard.json'));
  }catch(err){fs.rmSync(tmp,{recursive:true,force:true});throw err;}
}
module.exports={brief};
