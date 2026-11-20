'use strict';
const {fs,os,path,root,platform,read}=require('./common.cjs');
const crypto=require('node:crypto');
const pkg='ski-ai-reels-production';
function verify(base=root){
  const r=read(path.join(base,'release.json')),key=platform(),prefix='runtime/'+key+'/';let count=0;
  for(const [name,hash] of Object.entries(r.sha256)){
    if(name.startsWith('runtime/')&&!name.startsWith(prefix))continue;
    const file=path.join(base,name);const d=crypto.createHash('sha256'), buf=Buffer.allocUnsafe(1024*1024), fd=fs.openSync(file,'r');try{let n;while((n=fs.readSync(fd,buf,0,buf.length,null))>0)d.update(buf.subarray(0,n));}finally{fs.closeSync(fd);}const digest=d.digest('hex');
    if(digest!==hash)throw Error('Package integrity mismatch: '+name);count++;
  }
  if(!count||!r.sha256['SKILL.md']||!r.sha256[prefix+(process.platform==='win32'?'ffmpeg.exe':'ffmpeg')])throw Error('Incomplete release manifest');
  return count;
}
function copyTree(source,destination){
  const info=fs.statSync(source);
  if(!info.isDirectory()){fs.copyFileSync(source,destination);if(process.platform!=='win32')fs.chmodSync(destination,info.mode&0o777);return;}
  fs.mkdirSync(destination,{recursive:true});for(const child of fs.readdirSync(source))copyTree(path.join(source,child),path.join(destination,child));
}
function install(args){
  const index=args.indexOf('--dest'),proj=args.indexOf('--project');
  if(index>=0&&(!args[index+1]||proj>=0)||proj>=0&&!args[proj+1])throw Error('Use --dest SKILLS_DIR or --project PROJECT_DIR');
  const userBase=process.env.CODEX_HOME?path.resolve(process.env.CODEX_HOME):path.join(os.homedir(),'.codex');
  const parent=index>=0?path.resolve(args[index+1]):proj>=0?path.resolve(args[proj+1],'.agents','skills'):path.join(userBase,'skills');
  const target=path.join(parent,pkg);
  const exists=p=>{try{return fs.lstatSync(p)}catch(err){if(err.code==='ENOENT')return null;throw err;}};
  function alias(){
    if(index>=0||proj>=0)return;
    const a=path.join(os.homedir(),'.agents','skills',pkg);if(path.resolve(a)===path.resolve(target))return;
    if(exists(a)){if(fs.realpathSync(a)!==fs.realpathSync(target))console.log('Existing discovery path retained: '+a);return;}
    fs.mkdirSync(path.dirname(a),{recursive:true});fs.symlinkSync(target,a,process.platform==='win32'?'junction':'dir');
  }
  if(exists(target)){
    const p=path.join(target,'release.json');
    if(fs.existsSync(p)&&fs.readFileSync(p).equals(fs.readFileSync(path.join(root,'release.json')))){verify(target);alias();return target;}
    throw Error('An existing skill was found at '+target+'. Choose another project (--project) or move the previous installation before installing.');
  }
  verify();fs.mkdirSync(parent,{recursive:true});const tmp=fs.mkdtempSync(path.join(parent,'.ski-install-'));
  try{
    for(const name of fs.readdirSync(root)){
      if(name==='runtime'){copyTree(path.join(root,name,platform()),path.join(tmp,name,platform()));}
      else copyTree(path.join(root,name),path.join(tmp,name));
    }
    verify(tmp);fs.renameSync(tmp,target);
  }catch(err){fs.rmSync(tmp,{recursive:true,force:true});throw err;}
  alias();return target;
}
module.exports={install,verify};
