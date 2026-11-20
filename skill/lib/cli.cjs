'use strict';
const {fs,path,root,platform,run,read,json,lookup}=require('./common.cjs');
const {render}=require('./render.cjs');const {install,verify}=require('./install.cjs');
const [cmd='help',...args]=process.argv.slice(2);
function timeline(){
  return {width:720,height:1280,fps:24,
    scenes:[{file:'input/scene-01.mp4',from:0,to:1,duration:1},{file:'input/scene-02.mp4',from:0,to:1,duration:1}],
    voices:[{file:'input/voice.wav',from:0.12,to:0.66,at:0.12},{file:'input/voice.wav',from:1.12,to:1.68,at:1.18}],
    sfx:[{file:'input/effect.wav',from:0,to:0.23,at:0.75,gainDb:-10}],
    captions:[{start:0.12,end:0.72,text:'첫 번째 발화'},{start:1.15,end:1.85,text:'두 번째 발화'}],
    graphics:[{kind:'leader',start:0.1,end:1.1,x:216,y:508,width:140,height:80},
      {kind:'label',start:0.26,end:1.24,x:368,y:462,width:270,lines:[{text:'포인트 그래픽',size:32},{text:'가운데 정렬',size:21}]},
      {kind:'logo',start:1.22,end:2,x:360,y:540,width:140,height:100}]};
}
async function smoke(dir){
  if(fs.existsSync(dir))throw Error('Choose a new sample directory: '+dir);
  const inp=path.join(dir,'input');fs.mkdirSync(inp,{recursive:true});
  for(const [name,col] of [['scene-01','0x164656'],['scene-02','0x674527']]){
    run(['-f','lavfi','-i','color=c='+col+':s=360x640:r=24:d=1','-c:v','libx264','-pix_fmt','yuv420p',path.join(inp,name+'.mp4')]);
  }
  for(const [name,hz,sec] of [['voice',440,2],['effect',880,0.25]]){
    run(['-f','lavfi','-i','sine=f='+hz+':r=48000:d='+sec,'-ac','2','-c:a','pcm_s16le',path.join(inp,name+'.wav')]);
  }
  const spec=path.join(dir,'timeline.json');json(spec,timeline());
  const movie=await render(spec,path.join(dir,'output'));run(['-i',movie,'-map','0:v:0','-map','0:a:0','-f','null','-']);
  const exact=lookup(['단면'],3),fallback=lookup(['__unlisted__'],3);
  if(!exact.candidates.length||fallback.mode!=='browse'||!fallback.candidates.length)throw Error('Reference lookup failed');
  console.log(movie);
}
async function main(){
  if(cmd==='brief'&&args.length===2){require('./brief.cjs').brief(path.resolve(args[0]),path.resolve(args[1]));return;}
  if(cmd==='voice'&&(args.length===2||args.length===3)){await require('./voice.cjs').voice(path.resolve(args[0]),path.resolve(args[1]),args[2]||'ko');return;}
  if(cmd==='media'&&args.length){const r=require('node:child_process').spawnSync(require('./common.cjs').ff,args,{stdio:'inherit',windowsHide:true});if(r.error)throw r.error;if(r.status!==0)throw Error('Media command failed: '+r.status);return;}
  if(cmd==='install'){console.log('Installed: '+install(args)+'\nOpen a new Codex chat.');return;}
  if(cmd==='doctor'){const n=verify();const f=run(['-version']);console.log(JSON.stringify({platform:platform(),files:n,ffmpeg:f.stdout.split(/\r?\n/)[0],references:lookup([],1).total,cloud:'Check Codex image generation and authorized Higgsfield in the target chat.'},null,2));return;}
  if(cmd==='refs'){
    let limit=6;const pos=args.indexOf('--limit');if(pos>=0){limit=Number(args[pos+1]);args.splice(pos,2);}
    if(!Number.isInteger(limit)||limit<1)throw Error('Invalid --limit');
    console.log(JSON.stringify(lookup(args,limit),null,2));return;
  }
  if(cmd==='init'&&args.length===1){const p=path.resolve(args[0]);if(fs.existsSync(p))throw Error('Choose a new project directory');fs.mkdirSync(path.join(p,'input'),{recursive:true});json(path.join(p,'timeline.json'),timeline());json(path.join(p,'ledger.json'),{episode:'',brief:'',voice:'',references:[],scenes:[],attempts:[],feedback:[],outputs:[]});console.log(p);return;}
  if(cmd==='render'&&args.length===2){console.log(await render(path.resolve(args[0]),path.resolve(args[1])));return;}
  if(cmd==='smoke'&&args.length===1){await smoke(path.resolve(args[0]));return;}
  if(cmd==='help'){console.log('reels: doctor | brief DECK.pptx NEW_DIR | voice NARRATION NEW_DIR [ko] | media FFMPEG_ARGUMENTS | refs [tags] [--limit N] | init NEW_DIR | render TIMELINE_JSON NEW_OUTPUT_DIR | smoke NEW_SAMPLE_DIR');return;}
  throw Error('Unknown command or missing argument. Use help.');
}
main().catch(err=>{console.error(err.message);process.exitCode=1;});
