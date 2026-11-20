'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const name = 'ski-ai-reels-production';
const source = __dirname;
const metadata = 'release.json';
function read(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
}
function exists(file) {
  try { return fs.lstatSync(file); } catch (e) { if (e.code === 'ENOENT') return null; throw e; }
}
function sha(file) {
  const h=crypto.createHash('sha256'), buf=Buffer.allocUnsafe(1024*1024), fd=fs.openSync(file,'r');
  try { let n; while ((n=fs.readSync(fd,buf,0,buf.length,null))>0) h.update(buf.subarray(0,n)); }
  finally { fs.closeSync(fd); }
  return h.digest('hex');
}
function safeKey(k) {
  return typeof k==='string' && k.split('/').every(s=>s && s!=='.' && s!=='..' &&
    !/[<>:"\\|?*\x00-\x1f]/.test(s) && !/[. ]$/.test(s) && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(s)) &&
    ![metadata,'.git'].some(s=>k.toLowerCase()===s||k.toLowerCase().startsWith(s+'/'));
}
function validate(m) {
  if(m.name!==name || !m.sha256 || typeof m.sha256!=='object' || Array.isArray(m.sha256) ||
    !m.sha256['SKILL.md'] || !m.sha256['runtime/win-x64/node.exe'] ||
    !Array.isArray(m.platforms) || !m.platforms.includes('win-x64')) throw Error('Expected a managed SKI Windows package');
  const seen=new Set();
  for(const [k,v] of Object.entries(m.sha256)){
    if(!safeKey(k)||seen.has(k.toLowerCase())||!/^[a-f0-9]{64}$/.test(v)) throw Error('Invalid manifest key: '+k);
    seen.add(k.toLowerCase());
  }
}
function version(s){
  const m=/^(\d+)\.(\d+)\.(\d+)-windows-x64-existing-codex$/.exec(s);
  if(!m)throw Error('Unsupported distribution: '+s);
  return m.slice(1).map(Number);
}
function compare(a,b){for(let i=0;i<3;i++)if(a[i]!==b[i])return a[i]<b[i]?-1:1;return 0;}
function safePath(root,k){
  let p=root;
  for(const part of k.split('/')){
    p=path.join(p,part);const stat=exists(p);
    if(stat?.isSymbolicLink())throw Error('Link inside install tree: '+k);
  }
  return p;
}
function treeCopy(a,b){
  const st=fs.lstatSync(a);
  if(st.isSymbolicLink())throw Error('Local symbolic link inside the skill. No files changed: '+a);
  if(st.isDirectory()){
    fs.mkdirSync(b,{recursive:true});
    for(const entry of fs.readdirSync(a))treeCopy(path.join(a,entry),path.join(b,entry));
  }else if(st.isFile())fs.copyFileSync(a,b);
  else throw Error('Unexpected local entry: '+a);
}
function verify(root,m){
  for(const [k,h] of Object.entries(m.sha256)){
    const f=safePath(root,k);
    if(!exists(f)?.isFile()||sha(f)!==h)throw Error('Incomplete installation or local modification: '+k);
  }
}
function update(input){
  // Resolve the user discovery junction once and operate on its real target.
  const target=fs.realpathSync(path.resolve(input)),oldPath=path.join(target,metadata);
  const next=read(path.join(source,'next.json')),base=read(path.join(source,'base.json'));
  validate(next);validate(base);
  if(!exists(oldPath)?.isFile())throw Error('No installed Windows release metadata in '+target);
  const parent=path.dirname(target),scope=crypto.createHash('sha256').update(target.toLowerCase()).digest('hex').slice(0,12);
  const work=path.join(path.dirname(parent),'.ski-reels-updates',scope);
  fs.mkdirSync(work,{recursive:true});const lock=path.join(work,'active.lock');
  let fd;
  try {fd=fs.openSync(lock,'wx');}catch(e){if(e.code==='EEXIST')throw Error('Another update or interrupted run owns '+lock+'. Check its journal before retrying.');throw e;}
  let stage,backup,journal,moved=false,installed=false,keepLock=false;
  try{
    fs.writeFileSync(fd,JSON.stringify({pid:process.pid,target,time:new Date().toISOString()}));fs.closeSync(fd);fd=null;
    const prev=read(oldPath);validate(prev);
    const delta=compare(version(next.release),version(prev.release));
    if(delta<0)throw Error('Refusing to downgrade '+prev.release+' to '+next.release);
    if(delta===0){
      if(Object.keys(prev.sha256).length!==Object.keys(next.sha256).length ||
        Object.entries(next.sha256).some(([k,h])=>prev.sha256[k]!==h))throw Error('Different manifests claim the same installed version; preserving local files');
      verify(target,next);return {status:'already-current',version:prev.release,target};
    }
    // Reject modified managed files. Preserve untracked user files in the staging copy and backup.
    verify(target,prev);
    const put=[],drop=[];
    for(const [k,h] of Object.entries(next.sha256)){
      if(h===prev.sha256[k])continue;
      const f=safePath(target,k);
      if(!prev.sha256[k]&&exists(f)&&(!exists(f).isFile()||sha(f)!==h))throw Error('New release conflicts with a local file: '+k);
      const payload=safePath(path.join(source,'payload'),k);
      if(!exists(payload)?.isFile()||sha(payload)!==h)throw Error('Update is missing a required file: '+k);
      put.push(k);
    }
    for(const k of Object.keys(prev.sha256))if(!next.sha256[k])drop.push(k);
    const tx=fs.mkdtempSync(path.join(work,'run-'));
    stage=path.join(tx,'stage');backup=path.join(tx,'previous');journal=path.join(tx,'transaction.json');
    const log=state=>fs.writeFileSync(journal,JSON.stringify({target,stage,backup,from:prev.release,to:next.release,state},null,2));
    log('preparing');
    treeCopy(target,stage);
    for(const k of drop)fs.unlinkSync(safePath(stage,k));
    for(const k of put){
      const dst=safePath(stage,k);fs.mkdirSync(path.dirname(dst),{recursive:true});
      fs.copyFileSync(safePath(path.join(source,'payload'),k),dst);
    }
    fs.copyFileSync(path.join(source,'next.json'),path.join(stage,metadata));
    verify(stage,next);
    // The original directory is untouched until the complete replacement passes every hash.
    log('prepared');fs.renameSync(target,backup);moved=true;
    try{fs.renameSync(stage,target);installed=true;}
    catch(e){fs.renameSync(backup,target);moved=false;throw e;}
    log('installed');
    return {status:'updated',from:prev.release,version:next.release,target,backup,changed:put.length,removed:drop.length};
  }finally{
    if(fd!=null)fs.closeSync(fd);
    if(moved&&!installed&&!exists(target)&&backup&&exists(backup)){
      try{fs.renameSync(backup,target);moved=false;}catch{keepLock=true;}
    }
    if(stage&&!installed&&exists(stage)&&!keepLock)fs.rmSync(stage,{recursive:true,force:true});
    if(!keepLock)fs.rmSync(lock,{force:true});
  }
}
try{
  if(process.platform!=='win32'||process.argv.length!==3)throw Error('Run update.cmd from Windows with the installed skill folder');
  console.log(JSON.stringify(update(process.argv[2]),null,2));
}catch(e){console.error(e.message);process.exitCode=1;}

