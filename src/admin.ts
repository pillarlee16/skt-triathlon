import {api, ApiError, assetUrl, endpoint, esc, loginPanel, mutate, mutation, operatorChannel, personPhoto, poll, type TvStatus, type ViewState} from './client.ts'
import {audioSlots, canPrepare, preparationLocked, currentRace, labels, podiumReadyAt, sports, stage, type Action, type Config, type Sport} from './model.ts'

const phase={setup:'준비 중',ready:'출발 대기',countdown:'출발 카운트다운',racing:'경주 중',podium:'시상',complete:'행사 완료'}
const audioNames=['오프닝','카운트다운','출발','경주 BGM','부스터','충돌','추월','결승','시상 효과음','시상식 BGM','1위 환호성']
const prepStatus=(s:ViewState,unsaved:boolean)=>{
  if(unsaved)return '변경한 이름과 상품명을 먼저 저장하세요.'
  const people=s.people.filter(p=>p.active).length
  if(people<9)return '참가자를 '+(9-people)+'명 더 등록하세요.'
  if(!canPrepare(s))return '아래에서 세 종목 상품명을 저장하세요.'
  return '준비가 끝났습니다. 경기 운영으로 이동할 수 있습니다.'
}
export function admin(app:HTMLElement) {
  let state:ViewState
  let screen:'prepare'|'operate'|undefined
  let editingPerson:string|undefined
  const drafts=new Map<string,string>()
  const expanded=new Set<string>()
  let rosterScroll=0
  let busy=false
  let message=''
  let retry:(()=>Promise<boolean>)|undefined
  let connected=true
  const televisions=new Map<string,TvStatus & {received:number}>()
  let stop=()=>{}
  const tell=(value:string)=>{
    message=value
    const el=app.querySelector('#message')
    if(el){el.textContent=value;el.parentElement!.hidden=!value}
  }
  function tvStatus() {
    for(const [id,tv] of televisions)if(Date.now()-tv.received>4500)televisions.delete(id)
    const label=app.querySelector('#tv-status')
    if(!label)return
    const reports=[...televisions.values()]
    const tv=reports.find(t=>t.online&&t.revision>=state.revision)??reports[0]
    label.textContent=!tv?'연결 대기 · TV 송출 열기를 누르세요.':
      !tv.online?'재연결 중 · TV 창을 확인하세요.':
      tv.revision<state.revision?'새 화면을 TV에 반영 중입니다.':
      (tv.graphics==='3d'?'연결됨':tv.graphics==='html'?'대체 화면 연결됨'+(tv.graphicsIssue?' ('+tv.graphicsIssue+')':''):'연결됨 · 화면 준비 중')+' · '+
      (tv.audio?'음향 준비 완료':'TV 창에서 음향 켜기를 누르세요.')
    if(reports.length>1)label.textContent+=' · 열린 TV 창 '+reports.length+'개'
  }
  operatorChannel.addEventListener('message',event=>{
    if(event.data?.type==='tv-status') {
      const tv=event.data.status as TvStatus
      televisions.set(tv.id,{...tv,received:Date.now()})
    }else if(event.data?.type==='tv-close')televisions.delete(event.data.id)
    tvStatus()
  })
  function act(action:Action) {
    return save(action,mutation<{state:ViewState}>('action',JSON.stringify(action),state.revision))
  }
  async function save(action:Action,send:()=>Promise<{state:ViewState}>) {
    if(busy)return false
    busy=true
    retry=undefined
    message='처리 중 · 다시 누르지 않아도 됩니다.'
    render()
    try {
      const result=await send()
      state=result.state
      connected=true
      operatorChannel.postMessage({type:'refresh'})
      if(action.type==='prepare'||action.type==='reset')screen='operate'
      if(action.type==='savePerson'){
        drafts.delete(action.id?'person:'+action.id:'new-person')
        editingPerson=undefined
      }
      if(action.type==='removePerson'){
        drafts.delete('person:'+action.id)
        if(editingPerson===action.id)editingPerson=undefined
      }
      if(action.type==='prizeNames')for(const sport of sports)drafts.delete(sport)
      message=action.type==='reset'?'수영 출발 대기 화면으로 돌아갔습니다.':'저장되었습니다.'
      return true
    } catch(error) {
      if(!(error instanceof ApiError) || error.status>=500) {
        retry=()=>save(action,send)
        message='처리 결과 확인 중입니다. 연결이 돌아오면 같은 요청을 재시도할 수 있습니다.'
        operatorChannel.postMessage({type:'refresh'})
      } else {
        try {state=await api('state');connected=true} catch {connected=false}
        message=error.message+' '+(connected?'현재 단계에서 가능한 동작을 선택하세요.':'연결 복구 후 현재 단계를 확인하세요.')
      }
      return false
    }
    finally {busy=false;render()}
  }
  function render() {
    const visibleRoster=app.querySelector('.prep-list')
    if(visibleRoster)rosterScroll=visibleRoster.scrollTop
    const s=state
    const r=currentRace(s)
    const p=stage(s,s.now)
    const next=sports[s.races.filter(x=>x.completedAt && !x.invalidated).length]
    const following=r?sports[sports.indexOf(r.sport)+1]:undefined
    const announced=!!r && s.now>=podiumReadyAt(r)
    const nextLabel=p==='podium'?(announced?(following?s.config.names[following]+' 준비 화면으로':'철인3종 종료'):'시상 발표 중'):undefined
    const active=s.people.filter(x=>x.active)
    const missing=active.filter(x=>!personPhoto(s,x)).length
    const select=(name:string,ref:string,kind:'image'|'audio')=>
      '<select name="'+name+'"><option value="">기본</option>'+s.assets.filter(a=>a.kind===kind&&(!a.targeted||a.id===ref)).map(a=>
        '<option value="'+esc(a.id)+'" '+(assetUrl(s,ref,kind)===endpoint('file',{id:a.id})?'selected':'')+'>'+esc(a.name)+'</option>').join('')+'</select>'
    const preview=(ref:string)=>{const url=assetUrl(s,ref);return url?'<img class="preview" src="'+esc(url)+'" alt="">':''}
    const locked=preparationLocked(s)
    const operate=!!(s.ready||s.races.length)
    const selected=operate?screen??'operate':'prepare'
    const folder=(id:string,label:string,html:string)=>'<details class="panel" data-fold="'+id+'" '+(expanded.has(id)?'open':'')+'><summary>'+label+'</summary>'+html+'</details>'
    const photoInput=(label:string,target:string,id:string)=>'<label class="button">'+label+
      '<input type="file" accept="image/jpeg,image/png,image/webp" data-upload="'+target+'" data-id="'+esc(id)+'"></label>'
    const sport=(r??s.ready)?.sport
    const sportProgress='<ol class="sport-steps" aria-label="종목 진행 순서">'+sports.map(k=>{
      const done=s.races.some(attempt=>attempt.sport===k&&attempt.completedAt&&!attempt.invalidated)
      return '<li '+(k===sport?'aria-current="step"':'')+'>'+esc(s.config.names[k])+(done?' <small>완료</small>':'')+'</li>'
    }).join('')+'</ol>'
    const cue=p==='ready'?'TV 화면과 음향을 확인한 뒤 START를 누르세요. 누르면 당첨 결과가 저장되고 카운트다운이 시작됩니다.':
      p==='countdown'?'TV 화면에서 출발 카운트다운을 확인하세요.':
      p==='racing'?'상위 10명이 결승선을 통과하면 시상식으로 자동 전환됩니다.':
      p==='podium'?(announced?'호명과 촬영이 끝나면 다음 단계로 진행하세요.':'수상자 공개가 끝나면 다음 단계로 이동할 수 있습니다.'):''
    const control=(p!=='complete'?'<section class="panel operation-main">'+sportProgress+'<h2>'+esc(sport?s.config.names[sport]+' · '+phase[p]:phase[p])+'</h2>'+
      (cue?'<p class="operation-cue">'+cue+'</p>':'')+
      '<div class="actions">'+
      (s.ready?'<button data-act="start" class="primary">START</button>':'')+
      (nextLabel?'<button class="primary" data-act="next" '+(p==='podium'&&!announced?'disabled':'')+'>'+esc(nextLabel)+'</button>':'')+
      '</div></section>':'')+
      folder('volume','송출 음향','<form id="volume" class="form-grid"><label>BGM<input type="range" min="0" max="1" step=".05" name="bgm" value="'+s.volume.bgm+'"></label><label>효과음<input type="range" min="0" max="1" step=".05" name="sfx" value="'+s.volume.sfx+'"></label><label class="inline"><input type="checkbox" name="muted" '+(s.volume.muted?'checked':'')+'> 음소거</label><button>적용</button></form>')+
      (s.ready||r&&(p==='countdown'||p==='racing')?folder('emergency','비상 진행','<p><button data-act="emergency" class="danger">비상 발표</button></p>'):'')
    const data='<section class="panel prep-roster" id="prep-roster"><h2>참가자</h2>'+
      (active.length?'<p>참가 '+active.length+'명 · 사진 미등록 '+missing+'명'+(missing?' (게임에서 기본 얼굴 사용)':'')+'</p>':
        '<p>이름을 입력해 참가자를 추가하세요. 사진은 추가한 행에서 올릴 수 있습니다.</p>')+
      (!locked?'<form class="prep-add" data-person=""><label>참가자 이름<input required maxlength="80" name="name" data-draft="new-person" value="'+esc(drafts.get('new-person')??'')+'"></label><button>추가</button></form>':'')+
      (s.people.length?'<ul class="prep-list">'+s.people.map(person=>{
        const url=personPhoto(s,person)
        return '<li>'+(url?'<img class="preview" loading="lazy" src="'+esc(url)+'" alt="">':'<span class="prep-avatar" aria-hidden="true"></span>')+
          (!locked&&editingPerson===person.id?'<form data-person="'+esc(person.id)+'"><input aria-label="이름 · '+esc(person.name)+'" required maxlength="80" name="name" data-draft="person:'+esc(person.id)+'" value="'+esc(drafts.get('person:'+person.id)??person.name)+'"><button>저장</button><button type="button" data-name-cancel>취소</button></form>':'<strong>'+esc(person.name)+'</strong>')+
          (!person.active?'<small>제외됨</small>':'')+
          (!locked?photoInput(url?'사진 바꾸기':'사진 올리기','person',person.id)+(editingPerson===person.id?'':'<button data-name-edit="'+esc(person.id)+'" class="quiet">이름 수정</button>')+'<button data-person-remove="'+esc(person.id)+'" class="quiet" aria-label="'+esc(person.name)+' 삭제">삭제</button>':'')+'</li>'
      }).join('')+'</ul>':'')+'</section>'+
      '<section class="panel" id="prep-prizes"><h2>종목별 상품</h2><form id="prize-names" class="form-grid">'+sports.map(k=>'<label>'+esc(s.config.names[k])+' 상품명<input maxlength="100" name="'+k+'" data-draft="'+k+'" value="'+esc((locked?undefined:drafts.get(k))??s.prizes[k].name)+'" '+(locked?'readonly':'')+'></label>').join('')+
      (!locked?'<button>상품명 저장</button>':'')+'</form></section>'
    const settings='<section><h3>송출 파일</h3><p>상품 이미지는 종목별로 연결하세요.</p><div class="actions">'+sports.map(k=>preview(s.prizes[k].image)+photoInput(esc(s.config.names[k])+' 상품 이미지','prize',k)).join('')+'</div><label class="button">방송 파일 추가<input data-upload="general" type="file" accept=".jpg,.jpeg,.png,.webp,.mp3,.wav,.ogg" multiple></label><ul class="asset-list">'+s.assets.filter(a=>!a.targeted&&!s.people.some(p=>p.photo===a.id)&&!sports.some(k=>s.prizes[k].image===a.id)).map(a=>'<li>'+preview(a.id)+'<span>'+esc(a.name)+'</span>'+(s.locked?'':'<button data-remove="'+a.id+'">연결 해제</button>')+'</li>').join('')+'</ul></section>'+
      '<section class="panel"><h2>방송 설정</h2><form id="config" class="form-grid"><label>타이틀<input required name="title" maxlength="100" value="'+esc(s.config.title)+'"></label><label>로고'+select('logo',s.config.logo,'image')+'</label><label>사장님 얼굴'+select('starter',s.config.starter,'image')+'</label>'+
      '<label>시상식 포토월'+select('podiumBackdrop',s.config.podiumBackdrop??'','image')+'</label><label>달리기 경기장 광고판'+select('stadiumAd',s.config.stadiumAd??'','image')+'</label>'+
      sports.map(k=>'<fieldset><legend>'+labels[k]+'</legend><label>종목명<input required name="name-'+k+'" value="'+esc(s.config.names[k])+'"></label><label>경주 시간(초)<input name="duration-'+k+'" type="number" min="15" max="120" value="'+s.config.duration[k]+'"></label><label>이벤트 자막<input required name="caption-'+k+'" value="'+esc(s.config.captions[k])+'"></label></fieldset>').join('')+
      audioSlots.map((k,i)=>'<label>'+audioNames[i]+select('audio-'+k,s.config.audio[k]??'','audio')+'</label>').join('')+'<button>방송 설정 저장</button></form></section>'
    const history='<section class="panel"><h3>추첨 이력</h3>'+
      (s.races.length?s.races.slice().reverse().map(x=>'<article class="attempt"><h3>'+esc(s.config.names[x.sport])+' <small>'+(x.invalidated?'무효':x.winners.length?'확정':'경기 진행 중')+'</small></h3>'+
        x.winners.map((w,i)=>'<p>'+(i+1)+'위 · '+esc(w.id)+' '+esc(w.name)+' · '+esc(w.prize)+'</p>').join('')+
        (x.createdAt?'<p>추첨 '+esc(new Date(x.createdAt).toLocaleString('ko-KR'))+' · 후보 '+x.eligibleCount+'명</p>':'')+
        (x.invalidated?'<p>무효 처리 '+esc(new Date(x.invalidated.at).toLocaleString('ko-KR'))+' · '+esc(x.invalidated.reason)+'</p>'+
          (x.invalidated.redrawId?'<p>새 결과 · '+esc(s.races.find(y=>y.redrawId===x.invalidated?.redrawId&&y.sport===x.sport)?.winners.map((w,i)=>(i+1)+'위 '+w.id+' '+w.name).join(' / ')||'재실행 또는 결승 대기')+'</p>':''):
          '<button data-redraw="'+x.sport+'" class="danger">'+esc(s.config.names[x.sport])+' 재추첨</button>')+'</article>').join(''):'<p>추첨 기록이 없습니다.</p>')+'</section>'
    const csvLink='<a class="button" href="'+esc(endpoint('csv'))+'">CSV 다운로드</a>'
    const summary=p==='complete'?'<section class="panel"><div class="results-heading"><h2>최종 당첨 결과</h2><div class="actions">'+csvLink+
      '<button data-act="reset">처음부터 다시 시작</button></div></div><div class="stats">'+sports.map(k=>{
      const result=s.races.find(attempt=>attempt.sport===k&&!attempt.invalidated)
      return '<div><strong>'+esc(s.config.names[k])+'</strong><ol>'+result?.winners.map(w=>'<li>'+esc(w.name)+' · '+esc(w.prize)+'</li>').join('')+'</ol></div>'
    }).join('')+'</div></section>':''
    const pendingDraft=drafts.size>0
    const prizesReady=sports.filter(k=>s.prizes[k].name.trim()).length
    const footer=!locked&&!operate?'<section class="panel prep-next"><div><h2>운영 전 준비</h2><div class="prep-checks">'+
      '<a href="#prep-roster">참가자 '+active.length+'명 <small>최소 9명</small></a>'+
      '<a href="#prep-prizes">상품명 '+prizesReady+'/3 <small>저장 완료</small></a></div>'+
      '<p id="prep-hint">'+prepStatus(s,pendingDraft)+'</p></div>'+
      '<button class="primary" data-act="prepare" data-sport="'+(next??'swimming')+'" '+(!canPrepare(s)||pendingDraft?'disabled':'')+'>경기 운영으로</button></section>':''
    const preparation=footer+(locked?'<p>첫 추첨 이후 준비 정보는 읽기 전용입니다.</p>':'')+data+
      (!locked?folder('settings','방송 설정',settings):'')
    const operations=summary+control+(s.races.some(attempt=>s.now>=attempt.endsAt)?folder('history','결과 및 복구',(p==='complete'?'':csvLink)+history):'')
    const tvPanel=selected==='operate'&&p!=='complete'?'<section class="panel operation-tv"><div><h2>TV 송출</h2><p id="tv-status"></p>'+
      (p==='ready'?'<p>TV 창의 <strong>음향 켜기</strong>와 <strong>전체 화면</strong>을 누르세요.</p>':'')+
      '</div><a class="button" href="/display" target="triathlon-display">TV 송출 열기</a></section>':''
    app.innerHTML='<div class="admin prep-admin"><header><h1>철인3종 운영 콘솔</h1>'+
      '<a class="button" href="/start" target="_blank" rel="noopener">태블릿 리모컨 열기</a></header><nav aria-label="운영 단계">'+
      '<button data-tab="prepare" aria-pressed="'+(selected==='prepare')+'">참가자 준비</button>'+
      '<button data-tab="operate" aria-pressed="'+(selected==='operate')+'" '+(!operate?'disabled':'')+'>경기 운영</button>'+
      '</nav><div class="status operation-status" data-stage="'+p+'" data-revision="'+s.revision+'" '+(!message&&!retry?'hidden':'')+'><span id="message" role="status">'+esc(message)+'</span>'+
      (retry?'<button id="retry">같은 요청 재시도</button>':'')+'</div>'+
      tvPanel+
      '<div '+(busy||retry||!connected?'inert':'')+'>'+(selected==='prepare'?preparation:operations)+'</div></div>'
    bind()
    const roster=app.querySelector('.prep-list')
    if(roster)roster.scrollTop=rosterScroll
    tvStatus()
  }
  function bind(){
    const retryButton=app.querySelector<HTMLButtonElement>('#retry')
    if(retryButton)retryButton.onclick=()=>void retry?.()
    app.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(b=>b.onclick=()=>{if(!busy){screen=b.dataset.tab==='prepare'?'prepare':'operate';render()}})
    app.querySelectorAll<HTMLButtonElement>('[data-act]').forEach(b=>b.onclick=()=>{
      const type=b.dataset.act as Action['type']
      if(type==='emergency'&&!confirm('비상 발표로 전환할까요?'))return
      if(type==='reset'&&!confirm('이번 경기와 당첨 기록을 지우고 수영 출발 대기로 돌아갈까요? 참가자와 행사 설정은 유지됩니다.'))return
      void act(type==='prepare'?{type,sport:b.dataset.sport as Sport}:{type} as Action)
    })
    app.querySelectorAll<HTMLButtonElement>('[data-redraw]').forEach(b=>b.onclick=()=>{
      const sport=b.dataset.redraw as Sport
      const affected=sports.slice(sports.indexOf(sport)).filter(k=>state.races.some(r=>r.sport===k&&!r.invalidated))
      const reason=prompt(affected.map(k=>labels[k]).join(', ')+' 결과를 무효화합니다. 재추첨 사유를 입력하세요.')
      if(reason?.trim()&&confirm('선택 종목의 준비 화면으로 돌아갑니다. 계속할까요?')) void act({type:'redraw',sport,reason})
    })
    app.querySelectorAll<HTMLButtonElement>('[data-remove]').forEach(b=>b.onclick=()=>void act({type:'removeAsset',id:b.dataset.remove!}))
    const get=<T extends HTMLElement>(selector:string)=>app.querySelector<T>(selector)
    app.querySelectorAll<HTMLDetailsElement>('details[data-fold]').forEach(details=>details.ontoggle=()=>{
      if(details.open)expanded.add(details.dataset.fold!)
      else expanded.delete(details.dataset.fold!)
    })
    app.querySelectorAll<HTMLInputElement>('[data-draft]').forEach(input=>input.oninput=()=>{
      const key=input.dataset.draft!
      const previous=key==='new-person'?'':key.startsWith('person:')?
        state.people.find(p=>p.id===key.slice(7))?.name:state.prizes[key as Sport].name
      if(input.value===previous)drafts.delete(key)
      else drafts.set(key,input.value)
      const prepare=get<HTMLButtonElement>('[data-act=prepare]')
      if(prepare)prepare.disabled=!canPrepare(state)||drafts.size>0
      const hint=get<HTMLElement>('#prep-hint')
      if(hint)hint.textContent=prepStatus(state,drafts.size>0)
    })
    app.querySelectorAll<HTMLButtonElement>('[data-name-edit]').forEach(button=>button.onclick=()=>{
      if(editingPerson)drafts.delete('person:'+editingPerson)
      editingPerson=button.dataset.nameEdit
      render()
      get<HTMLInputElement>('.prep-list input[name=name]')?.focus()
    })
    const cancelName=get<HTMLButtonElement>('[data-name-cancel]')
    if(cancelName)cancelName.onclick=()=>{
      drafts.delete('person:'+editingPerson)
      editingPerson=undefined
      render()
    }
    app.querySelectorAll<HTMLFormElement>('[data-person]').forEach(form=>form.onsubmit=async e=>{
      e.preventDefault()
      const id=form.dataset.person||undefined
      const name=String(new FormData(form).get('name')??'')
      if(await act({type:'savePerson',id,name})&&!id){
        const roster=get<HTMLElement>('.prep-list')
        if(roster)roster.scrollTop=roster.scrollHeight
        get<HTMLInputElement>('.prep-add input')?.focus({preventScroll:true})
      }
    })
    app.querySelectorAll<HTMLButtonElement>('[data-person-remove]').forEach(button=>button.onclick=()=>{
      const id=button.dataset.personRemove!
      const person=state.people.find(p=>p.id===id)
      if(person&&confirm(person.name+' 님을 명단에서 삭제할까요?'))void act({type:'removePerson',id})
    })
    const prizes=get<HTMLFormElement>('#prize-names')
    if(prizes)prizes.onsubmit=e=>{
      e.preventDefault()
      const names=Object.fromEntries(new FormData(prizes)) as Record<Sport,string>
      void act({type:'prizeNames',names})
    }
    app.querySelectorAll<HTMLInputElement>('[data-upload]').forEach(upload=>upload.onchange=async()=>{
      const list=Array.from(upload.files??[])
      if(!list.length)return
      const target=upload.dataset.upload!
      const fields:Record<string,string>=target==='general'?{}:{[target]:upload.dataset.id!}
      busy=true;render()
      const errors:string[]=[]
      try {
        for(const file of list){
          tell('업로드 중 · '+file.name)
          try {
            const payload=file.type.startsWith('image/')?await resize(file):file
            if(payload.size>4_000_000)throw new Error('4 MB 이하 파일을 사용하세요.')
            const result=await mutate<{state:ViewState}>('upload',payload,state.revision,{name:file.name,...fields})
            state=result.state
            operatorChannel.postMessage({type:'refresh'})
          }catch(error){
            errors.push(file.name+' '+(error as Error).message)
            if(error instanceof ApiError&&error.status===409)state=await api('state')
          }
        }
        message=errors.length?errors.join(' / '):list.length+'개 파일을 등록했습니다.'
      }catch(error){message=(error as Error).message}
      finally{busy=false;render()}
    })
    const volume=get<HTMLFormElement>('#volume');if(volume)volume.onsubmit=e=>{
      e.preventDefault();const f=new FormData(volume)
      void act({type:'volume',volume:{bgm:Number(f.get('bgm')),sfx:Number(f.get('sfx')),muted:f.has('muted')}})
    }
    const config=get<HTMLFormElement>('#config');if(config)config.onsubmit=e=>{
      e.preventDefault();const f=new FormData(config);const v=(key:string)=>String(f.get(key)??'')
      const c:Config=structuredClone(state.config)
      c.title=v('title');c.logo=v('logo');c.starter=v('starter')
      c.podiumBackdrop=v('podiumBackdrop');c.stadiumAd=v('stadiumAd')
      sports.forEach(k=>{c.names[k]=v('name-'+k);c.duration[k]=Number(v('duration-'+k));c.captions[k]=v('caption-'+k)})
      audioSlots.forEach(k=>{c.audio[k]=v('audio-'+k)})
      void act({type:'config',config:c})
    }
  }
  function connect(){
    stop()
    stop=poll(()=>api('state'),newState=>{
      if(busy || state && (newState.revision<state.revision || newState.now<state.now))return
      const race=currentRace(newState)
      const announcement=race?podiumReadyAt(race):Infinity
      const changed=!state || !connected || newState.revision!==state.revision || stage(newState,newState.now)!==stage(state,state.now) ||
        announcement<=newState.now && announcement>state.now
      if(!connected&&!retry)message='연결이 복구되었습니다.'
      connected=true
      state=newState
      if(changed)render()
      else tvStatus()
    },error=>{
      if(error instanceof ApiError&&error.status===401){stop();loginPanel(app,connect)}
      else if(!state)app.innerHTML='<section class="gate"><h1>운영 연결</h1><p>'+esc((error as Error).message)+'</p><a href="/admin">관리자 열기</a></section>'
      else if(connected&&!busy){connected=false;if(!retry)message='서버 재연결 중 · 현재 단계에서 대기해 주세요.';render()}
    },true)
  }
  connect()
}
async function resize(file:File) {
  const image=await createImageBitmap(file)
  try {
    const scale=Math.min(1,1024/Math.max(image.width,image.height))
    const c=document.createElement('canvas')
    c.width=Math.max(1,Math.round(image.width*scale));c.height=Math.max(1,Math.round(image.height*scale))
    c.getContext('2d')!.drawImage(image,0,0,c.width,c.height)
    return await new Promise<Blob>((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(new Error('이미지를 변환할 수 없습니다.')),'image/webp',.88))
  } finally{image.close()}
}
