import {api, ApiError, assetUrl, esc, loginPanel, operatorChannel, personPhoto, poll, type TvStatus, type ViewState} from './client.ts'
import {audioSlots, countdownMs, currentRace, podiumIntervalMs, podiumRevealed, podiumStartAt, stage, type Person, type Race} from './model.ts'
import {cuePoints,finishHoldMs,finishShotAt,photoFinishAt,photoFinishProgress,position,raceBeats,raceEvents,trackOrder,type Beat,type RaceEvent,type Runner} from './playback.ts'
import {assignAvatarStyles, starterStyle, type AvatarStyle} from './avatar-style.ts'
import countdownCard from './assets/countdown-mascot.webp'
import podiumIntroCard from './assets/podium-intro.webp'
import winnerCheer from './assets/winner-cheer.mp3'
import podiumFanfare from './assets/podium-fanfare.mp3'
import finishFanfare from './assets/finish-fanfare.mp3'
import countdownSound from './assets/race-countdown.wav'

type Slot=typeof audioSlots[number]
type Music='bgm'|'ceremony'|'finishMusic'
const isMusic=(slot:Slot):slot is Music=>slot==='bgm'||slot==='ceremony'||slot==='finishMusic'
const defaultAudio:Partial<Record<Slot,string>>={ceremony:podiumFanfare,cheer:winnerCheer,finishMusic:finishFanfare}
const notes:Record<Slot,number[]>={opening:[196,247,294,392],countdown:[440],start:[523,784],bgm:[130,196,155,196,117,175,147,175],
  item:[392,523,659],obstacle:[120,85],pass:[340,480],finish:[392,494,587],podium:[392,494,587,784],ceremony:[],cheer:[],finishMusic:[]}
const countdownHz=[1047,880,660]
const transitionBlendMs=950
const finishFadeMs=1400
const ceremonyFadeMs=750
const fade=(progress:number)=>{
  const t=Math.max(0,Math.min(1,progress))
  return t*t*(3-2*t)
}
function sound(){
  let context:AudioContext|undefined
  const countdownBytes=fetch(countdownSound).then(response=>response.ok?response.arrayBuffer():null).catch(()=>null)
  let countdownBuffer:AudioBuffer|null|undefined
  let countdownSource:AudioBufferSourceNode|undefined
  let countdownGain:GainNode|undefined
  let files:Partial<Record<Slot,HTMLAudioElement>>={}
  let mix={bgm:.35,sfx:.7,muted:false}
  let loop:number|undefined
  let music:Music|undefined
  let musicStarted=false
  let musicEnvelope=1
  let notesIndex=0
  function play(type:Slot,sport?:Race['sport'],countdownStep?:number) {
    const level=mix.muted?0:isMusic(type)?mix.bgm*musicEnvelope:mix.sfx
    if(context?.state!=='running'||!level)return false
    const audio=files[type]
    if(audio){
      audio.volume=level
      if(!isMusic(type))audio.currentTime=0
      void audio.play().catch(()=>tone(type,level,sport,countdownStep))
    }else tone(type,level,sport,countdownStep)
    return true
  }
  function tone(type:Slot,level:number,sport?:Race['sport'],countdownStep?:number) {
    const ctx=context!
    const sequence=type==='bgm'?[notes.bgm[notesIndex++%notes.bgm.length]]:
      countdownStep?[countdownHz[countdownStep-1]]:notes[type]
    sequence.forEach((hz,i)=>{
      const start=ctx.currentTime+i*.12
      const wave=ctx.createOscillator(), gain=ctx.createGain()
      wave.frequency.value=hz;wave.type=type==='obstacle'||type==='countdown'?'triangle':'sine'
      if(sport&&type==='obstacle'){
        wave.frequency.setValueAtTime(hz*(sport==='swimming'?3:sport==='cycling'?1.8:1.3),start)
        wave.frequency.exponentialRampToValueAtTime(hz*.7,start+.15)
      }else if(sport==='cycling'&&type==='item'){
        wave.frequency.setValueAtTime(hz*.76,start)
        wave.frequency.exponentialRampToValueAtTime(hz*1.08,start+.12)
      }
      const peak=type==='countdown'?.26:.13
      gain.gain.setValueAtTime(.001,start);gain.gain.exponentialRampToValueAtTime(peak*level+.001,start+.015)
      gain.gain.exponentialRampToValueAtTime(.001,start+.18);wave.connect(gain).connect(ctx.destination)
      wave.start(start);wave.stop(start+.19)
    })
  }
  function stopMusic(){
    clearInterval(loop);loop=undefined
    if(music)files[music]?.pause()
    music=undefined
    musicStarted=false
  }
  function stopStartSequence(){
    countdownSource?.stop()
    countdownSource=undefined
    countdownGain=undefined
  }
  const usesSeparateStartCues=()=>Boolean(files.countdown||files.start||countdownBuffer===null)
  return {
    play,
    usesSeparateStartCues,
    stopCountdown(){files.countdown?.pause()},
    stopStartSequence,
    startSequence(elapsed:number){
      if(!countdownBuffer||context?.state!=='running'||mix.muted||!mix.sfx)return false
      const source=context.createBufferSource()
      const gain=context.createGain()
      source.buffer=countdownBuffer
      gain.gain.value=mix.sfx
      source.connect(gain).connect(context.destination)
      countdownSource=source
      countdownGain=gain
      source.onended=()=>{
        source.disconnect()
        gain.disconnect()
        if(countdownSource===source){countdownSource=undefined;countdownGain=undefined}
      }
      source.start(0,elapsed<.06?0:elapsed)
      return true
    },
    stop(){
      stopMusic()
      stopStartSequence()
      for(const audio of Object.values(files))audio.pause()
      if(context){
        context.onstatechange=null
        void context.close()
      }
    },
    enable(onState:(playing:boolean)=>void){
      if(!context){
        const audioContext=context=new AudioContext()
        audioContext.onstatechange=()=>onState(audioContext.state==='running')
        void countdownBytes.then(bytes=>bytes?audioContext.decodeAudioData(bytes):null)
          .then(buffer=>{countdownBuffer=buffer},()=>{countdownBuffer=null})
      }
      onState(context.state==='running')
      if(context.state!=='running')void context.resume().catch(()=>{})
    },
    setup(s:ViewState){
      const next:typeof files={}
      for(const slot of audioSlots){
        const url=assetUrl(s,s.config.audio[slot]??'','audio')||defaultAudio[slot]
        if(!url)continue
        if(files[slot]?.getAttribute('src')===url){next[slot]=files[slot];continue}
        const audio=new Audio(url);audio.preload='auto';audio.loop=slot==='bgm';next[slot]=audio
      }
      if(music&&next[music]!==files[music])stopMusic()
      for(const slot of audioSlots)if(next[slot]!==files[slot])files[slot]?.pause()
      files=next
    },
    update(s:ViewState,nextMusic:Music|undefined,envelope:number){
      mix=s.volume
      musicEnvelope=envelope
      if(countdownGain)countdownGain.gain.value=mix.muted?0:mix.sfx
      for(const slot of audioSlots)if(files[slot])files[slot]!.volume=mix.muted?0:isMusic(slot)?mix.bgm*musicEnvelope:mix.sfx
      if(music!==nextMusic){
        if(music==='ceremony'){files.cheer?.pause();files.podium?.pause()}
        stopMusic()
        music=nextMusic
        notesIndex=0
        if(music&&files[music])files[music]!.currentTime=0
      }
      if(!music||musicStarted)return
      const slot=music
      if(!play(slot))return
      musicStarted=true
      if(slot==='bgm'){
        loop=window.setInterval(()=>{if(!files.bgm||files.bgm.paused&&!mix.muted)play('bgm')},260)
      }
    }
  }
}

export function display(app:HTMLElement) {
  let stop=()=>{}
  let generation=0
  function connect(){
    stop();const instance=++generation
    app.innerHTML='<section class="broadcast"><div id="track" aria-hidden="true"></div><canvas class="finish-frame" aria-hidden="true" hidden></canvas><header class="broadcast-head"></header><div id="signal" role="status"></div><div id="overlay"></div><footer class="broadcast-tools"><button id="full">전체 화면</button></footer></section>'
    const host=app.querySelector<HTMLElement>('#track')!
    const finishFrame=app.querySelector<HTMLCanvasElement>('.finish-frame')!
    const head=app.querySelector<HTMLElement>('.broadcast-head')!
    const overlay=app.querySelector<HTMLElement>('#overlay')!
    const signal=app.querySelector<HTMLElement>('#signal')!
    const audio=sound()
    const tv:TvStatus={id:crypto.randomUUID(),revision:-1,audio:false,graphics:'loading',online:false}
    const report=()=>operatorChannel.postMessage({type:'tv-status',status:tv})
    const closed=()=>operatorChannel.postMessage({type:'tv-close',id:tv.id})
    const heartbeat=window.setInterval(report,1000)
    window.addEventListener('pagehide',closed)
    let track:ReturnType<typeof import('./track.ts')['createTrack']>|undefined
    let needSetup=true
    let graphicsLost=false
    const fallback=(reason:string)=>{graphicsLost=true;tv.graphics='html';tv.graphicsIssue=reason;host.hidden=true;finishFrame.hidden=true;report()}
    host.addEventListener('webglcontextlost',event=>{
      event.preventDefault()
      fallback('WebGL 연결 끊김')
    },true)
    host.addEventListener('webglcontextrestored',()=>{
      graphicsLost=false
      needSetup=true
      tv.graphics='3d';delete tv.graphicsIssue;host.hidden=false;report()
    },true)
    void import('./track.ts').then(m=>{
      if(instance!==generation)return
      try {track=m.createTrack(host);needSetup=true;tv.graphics='3d';report()}catch{fallback('WebGL 초기화 실패')}
    }).catch(()=>{if(instance===generation)fallback('3D 화면 로드 실패')})
    const enableAudio=()=>audio.enable(playing=>{
      if(instance===generation&&tv.audio!==playing){tv.audio=playing;report()}
    })
    window.addEventListener('click',enableAudio,true)
    window.addEventListener('keydown',enableAudio,true)
    enableAudio()
    const full=app.querySelector<HTMLButtonElement>('#full')!
    full.onclick=()=>{if(document.fullscreenElement)void document.exitFullscreen();else void app.requestFullscreen?.().catch(()=>{signal.textContent='브라우저 전체 화면을 사용하세요.'})}
    let state:ViewState|undefined
    let offset=0
    let lastNow=0
    let lastKey=''
    let renderedRace=''
    let lastMarkup=''
    let soundStage=''
    let soundRace=''
    let marker=-1
    let countdownPlayed=0
    let startSequencePlayed=false
    let lastLeader=''
    let beats:Beat[]=[]
    let events:RaceEvent[]=[]
    let playedBeat=-1,playedItem=-1
    let lastPass=0
    let runners:Runner[]=[]
    let tick=0
    let lastHud=0
    let lastRanking=0
    let shownFinishers=0
    let ranking:Runner[]=[]
    let previousPlaces=new Map<string,number>()
    const rankMovement=new Map<string,{from:number;until:number}>()
    let leaderUntil=0
    let rosterKey=''
    let avatarStyles=new Map<string,AvatarStyle>()
    const appearance=(person:Person)=>avatarStyles.get(person.id)??starterStyle
    const loaded=new Map<string,HTMLImageElement>()
    const preload=(s:ViewState)=>{
      const urls=[countdownCard,podiumIntroCard,...s.people.filter(p=>p.active).map(p=>personPhoto(s,p)),assetUrl(s,s.config.logo),assetUrl(s,s.config.starter),
        assetUrl(s,s.config.podiumBackdrop??''),assetUrl(s,s.config.stadiumAd??'')]
      for(const url of urls)if(url&&!loaded.has(url)){const img=new Image();img.src=url;loaded.set(url,img)}
    }
    const setMarkup=(markup:string)=>{
      if(markup!==lastMarkup){overlay.innerHTML=markup;lastMarkup=markup}
    }
    function frame(time:number){
      if(instance!==generation)return
      tick=requestAnimationFrame(frame)
      if(!state)return
      const s=state
      const now=lastNow=Math.max(lastNow,performance.now()+offset)
      const race=currentRace(s)
      const p=stage(s,now)
      const sport=race?.sport??s.ready?.sport??'swimming'
      const photo=race&&(race.playbackVersion??0)>=2&&race.winners.length===3&&race.podiumAt===undefined
      const finishHold=photo&&p==='transition'&&now-race!.endsAt<finishHoldMs
      const podiumAt=race?podiumStartAt(race):undefined
      const untilPodium=podiumAt===undefined?Infinity:podiumAt-now
      const blending=p==='transition'&&untilPodium<=transitionBlendMs
      const podiumScene=p==='podium'||blending
      if(!blending)finishFrame.hidden=true
      else finishFrame.style.opacity=String(fade(untilPodium/transitionBlendMs))
      if(p==='transition'&&race){
        const introOpacity=fade((now-race.endsAt-(photo?finishHoldMs:0))/420)*fade(untilPodium/360)
        overlay.style.setProperty('--podium-intro-opacity',String(introOpacity))
      }
      const starter=race?.sport==='swimming'&&p==='countdown'
      const key=[sport,race?.id??s.ready?.id??'idle',starter,podiumScene,rosterKey].join('|')
      if(key!==lastKey||needSetup){
        const list=s.people.filter(x=>x.active)
        if(starter)list.unshift({id:'START',name:'사장님',team:'',photo:s.config.starter,active:true,color:'#f43a65'})
        const timeline:Race=race??{id:'ready',sport,seed:0,startsAt:0,endsAt:1,winners:[]}
        runners=trackOrder(list,timeline)
        events=race?.playbackVersion&&!podiumScene?raceEvents(runners):[]
        const showCourseBeats=!timeline.playbackVersion||timeline.playbackVersion===4
        beats=podiumScene||!showCourseBeats?[]:cuePoints(sport,runners)
        const artwork=loaded.get(assetUrl(s,(podiumScene?s.config.podiumBackdrop:s.config.stadiumAd)??''))
        try {
          if(!graphicsLost&&track){
            if(blending&&race?.id===renderedRace)finishFrame.hidden=!track.capture(finishFrame)
            track.setup(sport,podiumScene?runners.slice(0,3):runners,
              person=>loaded.get(personPhoto(s,person)),appearance,podiumScene,artwork,showCourseBeats)
          }
        }
        catch{fallback('3D 경기장 구성 실패')}
        renderedRace=''
        lastKey=key;needSetup=false;ranking=[];shownFinishers=0;previousPlaces.clear();rankMovement.clear();leaderUntil=0
      }
      const raceTime=p==='transition'?now:Math.min(now,race?.endsAt??now)
      const elapsed=race?Math.max(0,(raceTime-race.startsAt)/Math.max(1,race.endsAt-race.startsAt)):0
      const progress=photo?photoFinishProgress(elapsed):elapsed
      const photoShot=photo&&progress>=photoFinishAt
      const finishers=photoShot&&(p==='racing'||finishHold)
        ?runners.slice(0,3).filter(runner=>progress>=runner.finish).length:0
      const finishChanged=finishers!==shownFinishers
      const beat=beats.find(cue=>progress>=Math.max(0,cue.at-.045)&&progress<raceBeats[sport][cue.index].end)
      const incident=p==='racing'?events.findLast(candidate=>progress>=candidate.appears&&progress<candidate.ends):undefined
      const effect=p==='racing'?events.findLast(candidate=>progress>=candidate.at&&progress<candidate.ends):undefined
      const event=beat&&p==='racing'?raceBeats[sport][beat.index]:undefined
      const introduceCourse=beat&&event&&progress>=beat.at-.018&&progress<beat.at+.024
      const shot=photoShot?'photo':progress>=finishShotAt?'finish':incident||beat?'event':progress>=.10?'leader':'wide'
      const ranked=runners.map(r=>({r,p:position(r,progress)})).sort((a,b)=>b.p-a.p||a.r.rank-b.r.rank)
      const motionTime=time/1000+(progress-elapsed)*(race?race.endsAt-race.startsAt:0)/1000
      const revealed=p==='podium'&&race?podiumRevealed(race,now):0
      const podiumAge=revealed&&podiumAt!==undefined?(now-podiumAt-(revealed-1)*podiumIntervalMs)/1000:Infinity
      if(!graphicsLost&&p!=='complete'){
        try {
          track?.frame(progress,time/1000,podiumScene?'podium':shot,ranked.slice(0,6).map(x=>x.r),
            starter,revealed,beat,podiumAge,ranked[Math.min(17,ranked.length-1)]?.p,incident,motionTime)
          if(track&&!podiumScene)renderedRace=race?.id??''
        }
        catch{fallback('3D 프레임 그리기 실패')}
      }
      if(soundRace!==(race?.id??'')){
        audio.stopStartSequence()
        marker=-1;countdownPlayed=0;startSequencePlayed=false;soundRace=race?.id??'';lastLeader='';lastPass=0;playedBeat=-1;playedItem=-1
      }
      const cue=p+'|'+(race?.id??s.ready?.id??'')
      if(soundStage!==cue){
        soundStage=cue
        if(p!=='countdown')audio.stopCountdown()
        if(p!=='countdown'&&p!=='racing')audio.stopStartSequence()
        if(p==='ready')audio.play('opening')
        if(p==='podium'&&race&&race.podiumAt===undefined&&!race.transitionMs&&now-race.endsAt<700)audio.play('finish')
      }
      const musicEnvelope=p==='racing'&&photo?1-.78*fade((elapsed-.943)/.05):
        p==='transition'?fade(untilPodium/finishFadeMs):p==='podium'?fade(-untilPodium/ceremonyFadeMs):1
      audio.update(s,p==='racing'?'bgm':p==='transition'&&!finishHold?'finishMusic':p==='podium'&&revealed>0?'ceremony':undefined,musicEnvelope)
      if(p==='racing'&&beat&&event&&beat.index>playedBeat&&progress>=beat.at){
        playedBeat=beat.index
        if((progress-beat.at)*(race!.endsAt-race!.startsAt)<700)audio.play(event.sound,sport)
      }
      if(effect&&effect.index>playedItem){
        playedItem=effect.index
        if((progress-effect.at)*(race!.endsAt-race!.startsAt)<550)audio.play(effect.kind,sport)
      }
      const leader=ranked[0]?.r.person.id??''
      if(p==='racing'&&!event&&!incident&&shot!=='finish'&&!photoShot&&lastLeader&&lastLeader!==leader&&now-lastPass>2000){lastPass=now;audio.play('pass')}
      lastLeader=leader
      if(!finishChanged&&time-lastHud<70&&p!=='countdown'&&overlay.dataset.stage!=='countdown')return
      lastHud=time
      shownFinishers=finishers
      overlay.dataset.stage=p
      overlay.dataset.sport=sport
      overlay.dataset.beat=incident?String(incident.index):beat&&p==='racing'?String(beat.index):''
      overlay.dataset.courseBeat=beat&&p==='racing'?String(beat.index):''
      overlay.dataset.eventKind=incident?.kind??''
      overlay.dataset.eventPhase=incident?(progress<incident.at?'approach':'effect'):''
      overlay.parentElement!.dataset.sport=sport
      overlay.dataset.revision=String(s.revision)
      overlay.dataset.graphics=tv.graphics
      overlay.dataset.shot=p==='racing'||finishHold?shot:p
      overlay.dataset.runners=String(p==='racing'&&tv.graphics==='3d'?runners.length:0)
      const startSequenceElapsed=race?(now-race.startsAt+countdownMs)/1000:-1
      if(!startSequencePlayed&&(p==='countdown'||p==='racing')&&startSequenceElapsed>=0&&startSequenceElapsed<3.7){
        startSequencePlayed=audio.usesSeparateStartCues()
          ?p==='racing'&&audio.play('start')
          :audio.startSequence(startSequenceElapsed)
      }
      if(p==='countdown'){
        const count=Math.ceil(((race?.startsAt??now)-now)/1000)
        if(count>=1&&count<=3){
          setMarkup('<div class="countdown-card"><img src="'+esc(countdownCard)+'" alt=""><div class="count" aria-live="polite"></div></div>')
          if(count!==marker){
            marker=count
            overlay.querySelector('.count')!.textContent=String(count)
          }
          if(count!==countdownPlayed&&audio.usesSeparateStartCues()&&audio.play('countdown',undefined,count))countdownPlayed=count
        }else setMarkup('')
      }else if(p==='racing'||finishHold){
        if(finishChanged||!ranking.length||time-lastRanking>=145){
          const next=ranked.slice(0,10).map(({r})=>r)
          if(progress>.035&&ranking.length){
            if(next[0]&&next[0]!==ranking[0])leaderUntil=time+1000
            next.forEach(({person},index)=>{
              const place=index+1
              const prior=previousPlaces.get(person.id)??place
              const recent=rankMovement.get(person.id)
              if(prior!==place){
                const from=recent&&time<recent.until?recent.from:prior
                rankMovement.set(person.id,{from,until:time+850})
              }
            })
          }
          ranking=next;lastRanking=time
          previousPlaces=new Map(ranked.map(({r},i)=>[r.person.id,i+1]))
        }
        const savedCaption=s.config.captions[sport]
        const customCaption=savedCaption&&savedCaption!==raceBeats[sport][1].title&&savedCaption!=='급커브! 선두권 대혼전'
        const useExtraCaption=effect&&!introduceCourse
        const courseCaption=beat?.index===1&&customCaption?savedCaption:event?.title
        const caption=useExtraCaption
          ?effect.kind==='obstacle'&&customCaption&&race?.playbackVersion!==4?savedCaption:effect.title
          :courseCaption
        setMarkup('<div class="leaderboard"><ul role="list" aria-label="경기 순위">'+ranking.map((runner,index)=>{
            const {person}=runner
            const photo=loaded.get(personPhoto(s,person))
            const place=index+1
            const locked=place<=finishers&&runner.rank===index
            const medal=place<=3?'<span class="runner-medal" data-place="'+place+'" role="img" aria-label="'+place+'위"><span>'+place+'</span></span>':''
            const recent=rankMovement.get(person.id)
            const delta=recent&&time<recent.until?recent.from-place:0
            const showingDelta=Math.abs(delta)>=(place<=3?1:2)
            const highlight=!locked&&index===0&&time<leaderUntil?' class="lead-change"':''
            const eventLabel=effect?.runnerId===person.id?' data-event="'+effect.kind+'"':''
            const finishLabel=locked?' data-locked-place="'+place+'"':''
            const change=showingDelta?'<span class="rank-delta '+(delta>0?'rank-up':'rank-down')+'" aria-label="'+Math.abs(delta)+'계단 '+(delta>0?'상승':'하락')+'">'+(delta>0?'▲':'▼')+Math.abs(delta)+'</span>':''
            return '<li'+highlight+eventLabel+finishLabel+'>'+(photo?.naturalWidth?'<img src="'+esc(photo.src)+'" alt="">':
              '<span class="runner-avatar" style="background-color:'+appearance(person).primary+'" aria-hidden="true"></span>')+
              '<span class="runner-name">'+medal+esc(person.name)+'</span>'+
              (locked?'<span class="finish-check" role="img" aria-label="'+place+'위 확정">✓</span>':change)+'</li>'
          }).join('')+'</ul></div>'+
          (caption?'<div class="ticker"'+(useExtraCaption?' data-event="'+effect.kind+'"':event?' data-event="'+event.sound+'"':'')+'>'+esc(caption)+'</div>':''))
      }else if(p==='transition'){
        setMarkup('<div class="podium-intro"><div class="podium-intro-card"><img src="'+esc(podiumIntroCard)+'" alt="Finish"></div></div>')
      }else if(p==='podium'&&race){
        if(revealed>0&&marker!==10+revealed){
          marker=10+revealed
          audio.play('podium')
          if(revealed===3)audio.play('cheer')
        }
        const backdrop=tv.graphics==='html'?assetUrl(s,s.config.podiumBackdrop??''):''
        setMarkup('<div class="podium'+(tv.graphics==='3d'?' podium-3d':'')+'">'+
          (backdrop?'<img class="podium-backdrop" src="'+esc(backdrop)+'" alt="">':'')+
          '<h1>'+esc(s.config.names[sport])+' 시상식</h1><div class="podium-grid">'+[1,0,2].map(i=>{
          const w=race.winners[i]
          const visible=w&&i>=3-revealed
          const person=visible?s.people.find(x=>x.id===w.id):undefined
          const photo=person?personPhoto(s,person):''
          const prize=visible?assetUrl(s,w.image):''
          return '<article class="place place-'+(i+1)+'"><strong>'+(i+1)+'위</strong>'+(visible?
            (loaded.get(photo)?.naturalWidth?'<img class="winner-face" src="'+esc(photo)+'" alt="">':'<div class="winner-face placeholder">'+esc(w.id)+'</div>')+
            '<h2'+(w.name.length>20?' class="long-copy"':'')+'>'+esc(w.name)+'</h2>'+
            '<p'+(w.prize.length>35?' class="long-copy"':'')+'>'+esc(w.prize)+'</p>'+
            (prize?'<img class="prize" src="'+esc(prize)+'" alt="">':''):'<h2>발표 대기</h2>')+'</article>'
        }).join('')+'</div></div>')
      }else{
        const active=s.people.filter(x=>x.active).length
        setMarkup('<div class="center'+(p==='ready'?' start-ready':'')+'"><div class="eyebrow">'+(p==='complete'?'FINISH':'TRIATHLON LUCKY DRAW')+'</div><h1>'+esc(p==='complete'?'축하합니다':p==='ready'?s.config.names[sport]:s.config.title)+'</h1><p>'+esc(p==='complete'?'철인3종 럭키드로우 종료':p==='ready'?'참가 '+active+'명 · 출발 대기':'경기 준비 중')+'</p></div>')
      }
    }
    tick=requestAnimationFrame(frame)
    const cancel=poll(()=>api('state',{view:'display'}, {signal:AbortSignal.timeout(4500)}),s=>{
      if(state&&s.revision<state.revision)return
      offset=s.now-performance.now()
      if(state?.revision!==s.revision){
        const logo=assetUrl(s,s.config.logo)
        head.innerHTML=(logo?'<img src="'+esc(logo)+'" alt="">':s.config.title.startsWith('SKT')?'':'<strong>SKT</strong>')+'<span>'+esc(s.config.title)+'</span>'
        audio.setup(s);preload(s)
        avatarStyles=assignAvatarStyles(s.people)
        rosterKey=JSON.stringify([s.people,s.assets,s.config.starter,s.config.podiumBackdrop,s.config.stadiumAd])
      }
      state=s
      if(!tv.online||tv.revision!==s.revision){tv.online=true;tv.revision=s.revision;report()}
    },error=>{
      if(error instanceof ApiError&&error.status===401){stop();loginPanel(app,connect)}
      else {tv.online=false;report()}
    },true)
    stop=()=>{
      cancel()
      clearInterval(heartbeat)
      window.removeEventListener('pagehide',closed)
      window.removeEventListener('click',enableAudio,true)
      window.removeEventListener('keydown',enableAudio,true)
      closed();generation++;cancelAnimationFrame(tick);audio.stop();track?.destroy()
    }
  }
  connect()
}
