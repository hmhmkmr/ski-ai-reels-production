'use strict';
const {fs,path,cp,root,ff,run,read,json,file,number}=require('./common.cjs');
const gfx=require('./graphics.cjs');
const {Readable}=require('node:stream');const {pipeline}=require('node:stream/promises');
const fmt=x=>Number(x).toFixed(6);
function validate(t,dir){
  const fps=t.fps??24,W=t.width??720,H=t.height??1280;
  if(![W,H].every(x=>Number.isInteger(x)&&x>0&&x%2===0&&x<=4096)||!Number.isInteger(fps)||fps<1||fps>120)throw Error('Invalid timeline dimensions/fps');
  if(!Array.isArray(t.scenes)||!t.scenes.length)throw Error('No scenes');
  let cursor=0,last=0;const scenes=t.scenes.map(s=>{
    const dur=number(s.duration,'scene duration',0.001),start=number(s.from??0,'scene start');
    const end=number(s.to??start+dur,'scene end',start+0.00001);
    cursor+=dur;const frameEnd=Math.round(cursor*fps),frames=frameEnd-last;last=frameEnd;
    if(frames<1)throw Error('Scene shorter than one frame');
    return {file:file(path.resolve(dir,s.file)),start,end,frames,dur:frames/fps};
  });
  const length=last/fps;
  function audio(a,voice){return (a??[]).map(v=>{
    const from=number(v.from??0,'audio from'),to=number(v.to,'audio to',from+0.00001),at=number(v.at,'audio at');
    const duration=number(v.duration??(to-from),'audio duration',0.00001);
    if(voice&&Math.abs(duration-(to-from))>0.001)throw Error('Keep the provided voice at its natural rate');
    if(at+duration>length+1/fps)throw Error('Audio ends after the picture');
    if(!Number.isFinite(v.gainDb??0))throw Error('Invalid audio gain');
    return {...v,file:file(path.resolve(dir,v.file)),from,to,at,duration};
  });}
  const captions=(t.captions??[]).map(e=>({...e,kind:'caption'}));
  const events=[...(t.graphics??[]),...captions];
  for(const e of events){
    number(e.start,'graphic start');number(e.end,'graphic end',e.start+0.001);
    if(e.end>length+1/fps)throw Error('Graphic ends after the picture');
    for(const k of ['enter','exit'])if(e[k]!=null)number(e[k],k);
    for(const k of ['x','y','toX','toY','rise','alpha'])if(e[k]!=null&&!Number.isFinite(e[k]))throw Error('Invalid '+k);
  }
  return {fps,W,H,scenes,length,frames:last,captions,events,voices:audio(t.voices,true),sfx:audio(t.sfx,false)};
}
function picture(t,tmp){
  const list=[];t.scenes.forEach((s,i)=>{
    const name='s'+String(i+1).padStart(3,'0')+'.mp4';
    const vf='trim=start='+fmt(s.start)+':end='+fmt(s.end)+',setpts=(PTS-STARTPTS)*'+fmt(s.dur/(s.end-s.start))+',fps='+t.fps+',scale='+t.W+':'+t.H+':force_original_aspect_ratio=increase,crop='+t.W+':'+t.H+',setsar=1,tpad=stop_mode=clone:stop_duration='+fmt(s.dur)+',format=yuv420p';
    run(['-i',s.file,'-map','0:v:0','-an','-vf',vf,'-frames:v',String(s.frames),'-c:v','libx264','-preset','veryfast','-crf','16',path.join(tmp,name)]);
    list.push("file '"+name+"'");
  });
  fs.writeFileSync(path.join(tmp,'list.txt'),list.join('\n')+'\n');
  run(['-f','concat','-safe','1','-i','list.txt','-map','0:v:0','-c','copy','picture.mp4'],{cwd:tmp});
}
function tempo(speed){const filters=[];while(speed>2){filters.push('atempo=2');speed/=2;}while(speed<0.5){filters.push('atempo=0.5');speed*=2;}filters.push('atempo='+fmt(speed));return filters;}
function audioTrack(items,dir,t,voice,tmp){
  const args=['-f','lavfi','-i','anullsrc=r=48000:cl=stereo:d='+fmt(t.length)],filters=[];
  const labels=['[0:a]'];
  items.forEach((a,i)=>{
    const wav=path.join(dir,(voice?'voice-':'sfx-')+String(i+1).padStart(3,'0')+'.wav');
    const chain=['atrim=start='+fmt(a.from)+':end='+fmt(a.to),'asetpts=PTS-STARTPTS','aresample=48000','aformat=sample_fmts=fltp:channel_layouts=stereo'];
    if(Math.abs((a.to-a.from)/a.duration-1)>0.0001)chain.push(...tempo((a.to-a.from)/a.duration));
    chain.push('atrim=duration='+fmt(a.duration));
    run(['-i',a.file,'-map','0:a:0','-af',chain.join(','),'-c:a','pcm_s16le',wav]);
    args.push('-i',wav);const tag='a'+i;
    filters.push('['+(i+1)+':a]volume='+fmt(a.gainDb??0)+'dB,adelay='+Math.round(a.at*48000)+'S:all=1['+tag+']');
    labels.push('['+tag+']');
  });
  filters.push(labels.join('')+'amix=inputs='+labels.length+':normalize=0:duration=first[mix]');
  const dest=path.join(tmp,voice?'vo.wav':'fx.wav');
  run([...args,'-filter_complex',filters.join(';'),'-map','[mix]','-t',fmt(t.length),'-c:a','pcm_s24le',dest]);return dest;
}
function stamp(s){const n=Math.round(s*1000),d=(i,w=2)=>String(i).padStart(w,'0');return d(Math.floor(n/3600000))+':'+d(Math.floor(n/60000)%60)+':'+d(Math.floor(n/1000)%60)+','+d(n%1000,3);}
async function outputMovie(t,tmp,output,dir){
  await gfx.init();const events=t.events.map(e=>({spec:e,sprite:gfx.sprite(e,dir)}));
  const args=['-hide_banner','-loglevel','error','-i',path.join(tmp,'picture.mp4'),'-f','rawvideo','-pix_fmt','rgba','-s',t.W+'x'+t.H,'-r',String(t.fps),'-i','pipe:0','-i',path.join(tmp,'mix.wav'),'-filter_complex','[0:v][1:v]overlay=0:0:format=auto,format=yuv420p[v]','-map','[v]','-map','2:a','-frames:v',String(t.frames),'-t',fmt(t.length),'-c:v','libx264','-crf','18','-preset','veryfast','-c:a','aac','-b:a','192k','-movflags','+faststart',output];
  const child=cp.spawn(ff,args,{stdio:['pipe','ignore','pipe'],windowsHide:true});let err='';
  child.stderr.on('data',x=>err=(err+x.toString()).slice(-4096));
  const done=new Promise((res,rej)=>{child.once('error',rej);child.once('close',c=>c===0?res():rej(Error('FFmpeg render: '+err+' ('+c+')')));});
  async function* frames(){for(let i=0;i<t.frames;i++){const buf=Buffer.alloc(t.W*t.H*4);const time=i/t.fps;for(const e of events)if(time>=e.spec.start&&time<e.spec.end)gfx.draw(buf,t.W,t.H,e,time);yield buf;}}
  const tasks=await Promise.allSettled([pipeline(Readable.from(frames()),child.stdin),done]);
  if(tasks[1].status==='rejected')throw tasks[1].reason;if(tasks[0].status==='rejected')throw tasks[0].reason;
}
async function render(timeline,out){
  file(timeline);const dir=path.dirname(timeline);const d=read(timeline),t=validate(d,dir);
  if(fs.existsSync(out))throw Error('Choose a new output directory: '+out);
  fs.mkdirSync(path.dirname(out),{recursive:true});const stage=fs.mkdtempSync(path.join(path.dirname(out),'.ski-render-'));
  const tmp=fs.mkdtempSync(path.join(stage,'.media-'));
  try{
    const edit=path.join(stage,'edit'),voiceParts=path.join(edit,'voice'),fxParts=path.join(tmp,'sfx');[voiceParts,fxParts].forEach(x=>fs.mkdirSync(x,{recursive:true}));
    picture(t,tmp);const v=audioTrack(t.voices,voiceParts,t,true,tmp),s=audioTrack(t.sfx,fxParts,t,false,tmp);
    run(['-i',v,'-i',s,'-filter_complex','[0:a]asplit[v][side];[1:a][side]sidechaincompress=threshold=0.04:ratio=6:attack=20:release=230[duck];[v][duck]amix=inputs=2:normalize=0,alimiter=limit=0.96:level=false:latency=true[out]','-map','[out]','-t',fmt(t.length),'-c:a','pcm_s24le',path.join(tmp,'mix.wav')]);
    await outputMovie(t,tmp,path.join(stage,'reel.mp4'),dir);
    const srt=t.captions.map((e,i)=>[i+1,stamp(e.start)+' --> '+stamp(e.end),e.lines?e.lines.map(l=>typeof l==='string'?l:l.text).join('\n'):e.text,''].join('\n')).join('\n');
    fs.writeFileSync(path.join(edit,'captions.srt'),srt+'\n','utf8');
    fs.copyFileSync(v,path.join(edit,'voice.wav'));fs.copyFileSync(s,path.join(edit,'effects.wav'));
    const portable={...d};
    const remap=e=>e.file?{...e,file:path.relative(path.join(out,'edit'),path.resolve(dir,e.file)).split(path.sep).join('/')}:e;
    for(const k of ['scenes','voices','sfx','graphics'])if(Array.isArray(portable[k]))portable[k]=portable[k].map(remap);
    json(path.join(edit,'timeline.json'),portable);
    fs.rmSync(tmp,{recursive:true,force:true});fs.renameSync(stage,out);
  }catch(err){fs.rmSync(stage,{recursive:true,force:true});throw err;}
  return path.join(out,'reel.mp4');
}
module.exports={render};
