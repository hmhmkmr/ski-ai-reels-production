'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');
const root = path.resolve(__dirname,'..');
function platform() {
  if (process.platform === 'win32' && process.arch === 'x64') return 'win-x64';
  throw Error('Unsupported OS/architecture: '+process.platform+'/'+process.arch);
}
const suffix=process.platform==='win32'?'.exe':'';
const ff=path.join(root,'runtime',platform(),'ffmpeg'+suffix);
function run(args,options={}) {
  const r=cp.spawnSync(ff,['-hide_banner','-nostdin','-loglevel','error',...args],{encoding:'utf8',maxBuffer:8*1024*1024,windowsHide:true,...options});
  if(r.error) throw r.error;
  if(r.status!==0) throw Error('FFmpeg: '+(r.stderr||r.stdout||r.status));
  return r;
}
function read(p){return JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));}
function json(p,x){fs.writeFileSync(p,JSON.stringify(x,null,2)+'\n');}
function file(p){if(!fs.statSync(p,{throwIfNoEntry:false})?.isFile())throw Error('Missing file: '+p);return p;}
function number(x,name,min=0){if(!Number.isFinite(x)||x<min)throw Error('Invalid '+name+': '+x);return x;}
function lookup(tags,limit=6){
  const dir=path.join(root,'assets','tone'), bank=read(path.join(dir,'catalog.json')), groups=new Map();
  for(const item of bank.items){if(!groups.has(item.videoId))groups.set(item.videoId,[]);groups.get(item.videoId).push(item);}
  const ordered=[];for(let i=0;i<Math.max(...Array.from(groups.values(),g=>g.length));i++){for(const g of groups.values())if(g[i])ordered.push(g[i]);}
  const wanted=[...new Set(tags.map(s=>s.replace(/^#/,'').trim()).filter(Boolean))];
  const scored=ordered.map(item=>({item,score:wanted.filter(t=>item.tags.includes(t)).length}));
  let chosen=scored.filter(v=>wanted.length&&v.score===wanted.length),mode='all';
  if(!chosen.length){chosen=scored.filter(v=>v.score>0).sort((a,b)=>b.score-a.score);mode='partial';}
  if(!chosen.length){chosen=scored;mode='browse';}
  return {mode,total:chosen.length,candidates:chosen.slice(0,limit).map(({item})=>({...item,file:file(path.resolve(dir,bank.root,item.file))}))};
}
module.exports={fs,os,path,cp,root,platform,ff,run,read,json,file,number,lookup};
