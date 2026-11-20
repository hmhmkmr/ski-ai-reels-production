'use strict';
const {fs,path,root,file}=require('./common.cjs');
const crypto=require('node:crypto');
const frames=88, fps=30;
const master=path.join(root,'assets','brand','ask-inno-overlay.mkv');
const expected='1d2e8636f61b89ab0d527b1f826a655fbfc888a62b1631fdc3382ca4d7b88028';
function forRender(){
  file(master);
  if(crypto.createHash('sha256').update(fs.readFileSync(master)).digest('hex')!==expected)throw Error('ASK Inno overlay differs from the approved package. Restore the latest team release.');
  return master;
}
function exportOverlay(destination){
  fs.mkdirSync(path.dirname(destination),{recursive:true});
  fs.copyFileSync(forRender(),destination,fs.constants.COPYFILE_EXCL);
  return destination;
}
module.exports={frames,fps,forRender,exportOverlay};
