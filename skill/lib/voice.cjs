'use strict';
const {fs,os,path,root,platform,run,json,file}=require('./common.cjs');
async function voice(input,output,lang='ko'){
  file(input);if(fs.existsSync(output))throw Error('Choose a new speech analysis directory');
  fs.mkdirSync(path.dirname(output),{recursive:true});const tmp=fs.mkdtempSync(path.join(path.dirname(output),'.ski-voice-'));
  try{
    const pcm=path.join(tmp,'speech.pcm');
    run(['-i',input,'-vn','-ac','1','-ar','16000','-f','s16le',pcm]);
    const samples=fs.readFileSync(pcm);fs.unlinkSync(pcm);if(!samples.length)throw Error('Empty audio');
    run(['-i',input,'-vn','-ac','1','-ar','16000','-c:a','pcm_s16le',path.join(tmp,'listen.wav')]);
    const silence=run(['-loglevel','info','-i',input,'-af','silencedetect=n=-36dB:d=0.16','-f','null','-']);
    const gaps=[];let start=0;for(const m of silence.stderr.matchAll(/silence_(start|end):\s*([.\d]+)/g)){if(m[1]==='start')start=Number(m[2]);else gaps.push([start,Number(m[2])]);}
    const native=require(path.join(root,'runtime',platform(),'asr','index.node'));
    const ctx=await new native.WhisperContext({filePath:path.join(root,'assets','asr','ggml-base-q5_1.bin'),useGpu:false});
    let result;try{const job=ctx.transcribeData(samples.buffer.slice(samples.byteOffset,samples.byteOffset+samples.byteLength),{language:lang,translate:false,temperature:0,tokenTimestamps:true,maxThreads:Math.max(1,Math.min(6,os.cpus().length))});result=await (job.promise??job);}finally{await ctx.release();}
    if(!Array.isArray(result.segments))throw Error('Speech engine returned no timing table');
    const data={language:lang,seconds:samples.length/32000,transcript:result.result,silences:gaps,segments:result.segments.map(s=>({text:s.text,start:s.t0/1000,end:s.t1/1000}))};
    if(data.segments.some(s=>!Number.isFinite(s.start)||!Number.isFinite(s.end)||s.start<0||s.end<s.start||s.end>data.seconds+0.3))throw Error('Speech timestamp outside source audio');
    json(path.join(tmp,'speech.json'),data);
    const escape=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
    const rows=data.segments.map(x=>'<li><button data-at="'+x.start+'">'+x.start.toFixed(2)+'s</button> '+escape(x.text)+'</li>').join('');
    fs.writeFileSync(path.join(tmp,'listen.html'),'<!doctype html><meta charset="utf-8"><title>발화 구간</title><h1>발화 구간</h1><audio controls src="listen.wav"></audio><ol>'+rows+'</ol><script>const a=document.querySelector("audio");document.querySelectorAll("button").forEach(b=>b.onclick=()=>{a.currentTime=Number(b.dataset.at);a.play()});</script>');
    fs.renameSync(tmp,output);console.log(path.join(output,'speech.json'));
  }catch(err){fs.rmSync(tmp,{recursive:true,force:true});throw err;}
}
module.exports={voice};
