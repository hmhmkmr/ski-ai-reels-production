'use strict';
const {fs,os,path,run,file}=require('./common.cjs');

const frames=88, fps=30;
const basename='ask-inno-outro.mkv';
const pixelHash='f9260716ff762cce7fcac4b2cbd4db28e9cdee4bd356f443041cee34c2a74807';

function extract(source,destination){
  file(source);
  if(fs.existsSync(destination))throw Error('Choose a new outro file: '+destination);
  const input=['-sseof','-4','-i',source,'-map','0:v:0','-an','-sn','-dn'];
  // The approved master and the approved full-length edit end on the same 88 pictures.
  const list=run([...input,'-fps_mode','passthrough','-f','framemd5','-']).stdout;
  const count=list.split(/\r?\n/).filter(line=>/^\s*0,/.test(line)).length;
  if(count<frames)throw Error('The supplied file is too short for the approved ASK Inno ending');
  const filter='trim=start_frame='+(count-frames)+',setpts=N/(30*TB),format=yuv420p';
  const hash=run([...input,'-vf',filter,'-fps_mode','passthrough','-f','hash','-hash','sha256','-']).stdout.trim();
  if(hash!=='SHA256='+pixelHash)throw Error('Ending does not match the approved ASK Inno master. Use the supplied original or the approved 30 fps edit.');
  fs.mkdirSync(path.dirname(destination),{recursive:true});
  const dir=fs.mkdtempSync(path.join(path.dirname(destination),'.ski-outro-'));
  try{
    const stage=path.join(dir,basename);
    run([...input,'-vf',filter,'-r',String(fps),'-c:v','ffv1','-level','3','-threads','4','-map_metadata','-1',stage]);
    fs.copyFileSync(stage,destination,fs.constants.COPYFILE_EXCL);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
  return destination;
}

function forRender(root,dir,setting,tmp){
  if(setting)return extract(path.resolve(dir,setting),path.join(tmp,basename));
  const approved=path.join(root,'assets','brand',basename);
  if(fs.existsSync(approved)){
    const hash=run(['-i',approved,'-map','0:v:0','-an','-sn','-dn','-pix_fmt','yuv420p','-fps_mode','passthrough','-f','hash','-hash','sha256','-']).stdout.trim();
    if(hash!=='SHA256='+pixelHash)throw Error('Installed ASK Inno ending does not match the approved 88 frames. Restore the approved master.');
    return approved;
  }
  const local=path.join(dir,'input',basename);
  if(fs.existsSync(local))return extract(local,path.join(tmp,basename));
  const downloaded=path.join(os.homedir(),'Downloads',basename);
  if(fs.existsSync(downloaded))return extract(downloaded,path.join(tmp,basename));
  throw Error('Place the team master ask-inno-outro.mkv in Downloads or the episode input folder, or set timeline.endingFile to the original approved video.');
}
module.exports={frames,fps,extract,forRender};
