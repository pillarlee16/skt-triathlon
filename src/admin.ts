import {api, ApiError, assetUrl, endpoint, esc, link, loginPanel, mode, mutate, personPhoto, poll, type ViewState} from './client.ts'
import {audioSlots, currentRace, labels, sports, stage, type Action, type Config, type Sport} from './model.ts'
import {parseWorkbook} from './import.ts'

const phase={setup:'설정',ready:'출발 대기',countdown:'카운트다운',racing:'경주 중',finish:'결승',podium:'시상',complete:'행사 완료'}
const audioNames=['오프닝','카운트다운','출발','BGM','부스터','충돌','추월','결승','시상']
export function admin(app:HTMLElement) {
  let state:ViewState
  let screen='control'
  let busy=false
  let message=''
  let pair=''
  let draft:Awaited<ReturnType<typeof parseWorkbook>>|undefined
  let stop=()=>{}
  const tell=(value:string)=>{message=value;const el=app.querySelector('#message');if(el)el.textContent=value}
  async function act(action:Action) {
    busy=true
    render()
    try {
      const result=await mutate<{token?:string}>('action',JSON.stringify(action),state.revision)
      if(result.token) pair=location.origin+link('/start')+'#'+result.token
      else if(['start','prepare','disarm','reset','emergency','redraw','import'].includes(action.type)) pair=''
      state=await api('state')
      message='저장되었습니다.'
      return true
    } catch(error) {
      message=(error as Error).message
      if(error instanceof ApiError && error.status===409){
        try {state=await api('state')} catch { /* The next poll retries the refresh. */ }
      }
      return false
    }
    finally {busy=false;render()}
  }
  function render() {
    const s=state
    const r=currentRace(s)
    const p=stage(s,s.now)
    const next=sports[s.races.filter(x=>x.completedAt && !x.invalidated).length]
    const active=s.people.filter(x=>x.active)
    const missing=active.filter(x=>!personPhoto(s,x)).length
    const select=(name:string,ref:string,kind:'image'|'audio')=>
      '<select name="'+name+'"><option value="">기본</option>'+s.assets.filter(a=>a.kind===kind).map(a=>
        '<option value="'+esc(a.id)+'" '+(assetUrl(s,ref,kind)===endpoint('file',{id:a.id})?'selected':'')+'>'+esc(a.name)+'</option>').join('')+'</select>'
    const preview=(ref:string)=>{const url=assetUrl(s,ref);return url?'<img class="preview" src="'+esc(url)+'" alt="">':''}
    const control='<section class="panel"><h2>경기 진행</h2><div class="stats">'+sports.map(k=>{
      const attempt=s.races.find(x=>x.sport===k && !x.invalidated)
      return '<div><strong>'+esc(s.config.names[k])+'</strong><span>'+(attempt?.completedAt?'완료':r?.sport===k?phase[p]:s.ready?.sport===k?'출발 대기':'대기')+'</span></div>'
    }).join('')+'</div><div class="actions">'+
      (!r && next?'<button data-act="prepare" data-sport="'+next+'">'+esc(s.config.names[next])+' 준비</button>':'')+
      (s.ready?'<button data-act="start" class="primary">START</button><button data-act="'+(s.tabletArmed?'disarm':'arm')+'">'+(s.tabletArmed?'태블릿 비활성화':'태블릿 활성화')+'</button>':'')+
      (p==='finish'||p==='podium'?'<button data-act="next" '+(p==='podium'&&s.now<(r?.podiumAt??0)+4000?'disabled':'')+'>NEXT</button>':'')+
      (s.ready||r && ['countdown','racing','finish'].includes(p)?'<button data-act="emergency" class="danger">비상 발표</button>':'')+
      (s.mode==='rehearsal'?'<button data-act="reset">리허설 초기화</button>':'')+
      '</div>'+(pair&&s.tabletArmed?'<label>태블릿 시작 링크<input readonly value="'+esc(pair)+'"></label><button id="copy">링크 복사</button>':'')+
      '<p>참가 '+active.length+'명 · 기본 얼굴 '+missing+'명</p></section>'+
      '<section class="panel"><h2>송출 음향</h2><form id="volume" class="form-grid"><label>BGM<input type="range" min="0" max="1" step=".05" name="bgm" value="'+s.volume.bgm+'"></label><label>효과음<input type="range" min="0" max="1" step=".05" name="sfx" value="'+s.volume.sfx+'"></label><label class="inline"><input type="checkbox" name="muted" '+(s.volume.muted?'checked':'')+'> 음소거</label><button>적용</button></form></section>'
    const data='<section class="panel"><h2>참가자 및 상품</h2><div class="actions"><a class="button" href="/roster-template.xlsx" download>Excel 템플릿</a><label class="button">Excel 선택<input id="workbook" type="file" accept=".xlsx" '+(s.locked?'disabled':'')+'></label></div>'+
      (s.locked?'<p>본행사 명단과 상품이 고정되었습니다.</p>':'')+
      (draft?'<div class="notice">'+(draft.errors.length?'<ul>'+draft.errors.map(e=>'<li>'+esc(e)+'</li>').join('')+'</ul>':'<p>가져올 참가자 '+draft.people.filter(x=>x.active).length+'명 · 상품 '+sports.map(k=>esc(draft!.prizes[k].name)).join(' / ')+'</p><button id="apply-import">명단과 상품 적용</button>')+'</div>':'')+
      '<div class="stats">'+sports.map(k=>'<div>'+preview(s.prizes[k].image)+'<strong>'+esc(s.config.names[k])+'</strong><span>'+esc(s.prizes[k].name||'미등록')+'</span></div>').join('')+'</div>'+
      '<div class="table-scroll"><table><thead><tr><th>번호</th><th>이름</th><th>조직</th><th>얼굴</th><th>상태</th></tr></thead><tbody>'+s.people.map(x=>{
        const url=personPhoto(s,x)
        return '<tr><td>'+esc(x.id)+'</td><td>'+esc(x.name)+'</td><td>'+esc(x.team)+'</td><td>'+(url?'<img class="preview" loading="lazy" src="'+esc(url)+'" alt="">':'기본')+' '+esc(x.photo)+'</td><td>'+(x.active?'참가':'불참')+'</td></tr>'
      }).join('')+'</tbody></table></div></section>'
    const settings='<section class="panel"><h2>에셋 파일</h2><p>사진과 상품 이미지는 Excel에 입력한 파일명으로 연결됩니다. 같은 이름으로 올리면 새 파일이 사용됩니다.</p><label class="button">파일 추가<input id="upload" type="file" accept=".jpg,.jpeg,.png,.webp,.mp3,.wav,.ogg" multiple></label><ul class="asset-list">'+s.assets.map(a=>'<li>'+preview(a.id)+'<span>'+esc(a.name)+'</span>'+(s.locked?'':'<button data-remove="'+a.id+'">연결 해제</button>')+'</li>').join('')+'</ul></section>'+
      '<section class="panel"><h2>방송 설정</h2><form id="config" class="form-grid"><label>타이틀<input required name="title" maxlength="100" value="'+esc(s.config.title)+'"></label><label>로고'+select('logo',s.config.logo,'image')+'</label><label>사장님 얼굴'+select('starter',s.config.starter,'image')+'</label>'+
      sports.map(k=>'<fieldset><legend>'+labels[k]+'</legend><label>종목명<input required name="name-'+k+'" value="'+esc(s.config.names[k])+'"></label><label>경주 시간(초)<input name="duration-'+k+'" type="number" min="15" max="120" value="'+s.config.duration[k]+'"></label><label>이벤트 자막<input required name="caption-'+k+'" value="'+esc(s.config.captions[k])+'"></label></fieldset>').join('')+
      audioSlots.map((k,i)=>'<label>'+audioNames[i]+select('audio-'+k,s.config.audio[k]??'','audio')+'</label>').join('')+'<button>방송 설정 저장</button></form></section>'
    const results='<section class="panel"><h2>추첨 결과와 변경 이력</h2><a class="button" href="'+esc(endpoint('csv'))+'">공식 결과 CSV</a>'+
      (s.races.length?s.races.slice().reverse().map(x=>'<article class="attempt"><h3>'+esc(s.config.names[x.sport])+' <small>'+(x.invalidated?'무효':x.winners.length?'확정':'경기 진행 중')+'</small></h3>'+
        x.winners.map((w,i)=>'<p>'+(i+1)+'위 · '+esc(w.id)+' '+esc(w.name)+' · '+esc(w.prize)+'</p>').join('')+
        (x.invalidated?'<p>'+esc(new Date(x.invalidated.at).toLocaleString('ko-KR'))+' · '+esc(x.invalidated.reason)+'</p>':'<button data-redraw="'+x.sport+'" class="danger">재추첨</button>')+'</article>').join(''):'<p>추첨 기록이 없습니다.</p>')+'</section>'
    app.innerHTML='<div class="admin"><header><div><div class="eyebrow">SKT · TRIATHLON</div><h1>운영 콘솔</h1></div><div class="actions"><a class="button" href="'+link('/display')+'" target="_blank" rel="noopener">TV 송출 열기</a><a class="button" href="/admin?mode='+(mode==='live'?'rehearsal':'live')+'">'+(mode==='live'?'리허설 전환':'본행사 전환')+'</a></div></header><nav>'+
      Object.entries({control:'경기 진행',data:'참가자·상품',settings:'에셋·방송 설정',results:'결과·이력'}).map(([k,v])=>'<button data-tab="'+k+'" aria-pressed="'+(screen===k)+'">'+v+'</button>').join('')+
      '</nav><div class="status"><strong>'+(mode==='live'?'본행사':'리허설')+'</strong><span>'+phase[p]+'</span><span id="message" role="status">'+esc(message)+'</span></div><div '+(busy?'inert':'')+'>'+({control,data,settings,results}[screen]??control)+'</div></div>'
    bind()
  }
  function bind(){
    app.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(b=>b.onclick=()=>{if(!busy){screen=b.dataset.tab!;render()}})
    app.querySelectorAll<HTMLButtonElement>('[data-act]').forEach(b=>b.onclick=()=>{
      const type=b.dataset.act as Action['type']
      if((type==='reset'||type==='emergency')&&!confirm(type==='reset'?'리허설을 초기화할까요?':'비상 발표로 전환할까요?')) return
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
    const copy=get<HTMLButtonElement>('#copy');if(copy)copy.onclick=()=>void navigator.clipboard.writeText(pair).then(()=>tell('링크를 복사했습니다.'),()=>tell('링크 입력란에서 직접 복사하세요.'))
    const workbook=get<HTMLInputElement>('#workbook');if(workbook)workbook.onchange=async()=>{
      const file=workbook.files?.[0];if(!file)return
      try {draft=await parseWorkbook(file);message='';render()} catch(error){tell((error as Error).message)}
    }
    const applyImport=get<HTMLButtonElement>('#apply-import');if(applyImport)applyImport.onclick=async()=>{
      if(draft&&await act({type:'import',people:draft.people,prizes:draft.prizes})){draft=undefined;render()}
    }
    const upload=get<HTMLInputElement>('#upload');if(upload)upload.onchange=async()=>{
      const list=Array.from(upload.files??[])
      if(!list.length)return
      busy=true;render()
      const errors:string[]=[]
      try {
        for(const file of list){
          tell('업로드 중 · '+file.name)
          try {
            const payload=file.type.startsWith('image/')?await resize(file):file
            if(payload.size>4_000_000) throw new Error('4 MB 이하 파일을 사용하세요.')
            await mutate('upload',payload,state.revision,{name:file.name})
            state=await api('state')
          } catch(error){errors.push(file.name+' '+(error as Error).message); if(error instanceof ApiError&&error.status===409)state=await api('state')}
        }
        message=errors.length?errors.join(' / '):list.length+'개 파일을 등록했습니다.'
      } catch(error){message=(error as Error).message}
      finally{busy=false;render()}
    }
    const volume=get<HTMLFormElement>('#volume');if(volume)volume.onsubmit=e=>{
      e.preventDefault();const f=new FormData(volume)
      void act({type:'volume',volume:{bgm:Number(f.get('bgm')),sfx:Number(f.get('sfx')),muted:f.has('muted')}})
    }
    const config=get<HTMLFormElement>('#config');if(config)config.onsubmit=e=>{
      e.preventDefault();const f=new FormData(config);const v=(key:string)=>String(f.get(key)??'')
      const c:Config=structuredClone(state.config)
      c.title=v('title');c.logo=v('logo');c.starter=v('starter')
      sports.forEach(k=>{c.names[k]=v('name-'+k);c.duration[k]=Number(v('duration-'+k));c.captions[k]=v('caption-'+k)})
      audioSlots.forEach(k=>{c.audio[k]=v('audio-'+k)})
      void act({type:'config',config:c})
    }
  }
  function connect(){
    stop()
    stop=poll(()=>api('state'),newState=>{
      if(busy)return
      const podiumReadyAt=(currentRace(newState)?.podiumAt??Infinity)+4000
      const changed=!state || newState.revision!==state.revision || stage(newState,newState.now)!==stage(state,state.now) ||
        newState.tabletArmed!==state.tabletArmed || podiumReadyAt<=newState.now && podiumReadyAt>state.now
      state=newState
      if(changed)render()
    },error=>{
      if(error instanceof ApiError&&error.status===401){stop();loginPanel(app,connect)}
      else if(!state)app.innerHTML='<section class="gate"><h1>운영 연결</h1><p>'+esc((error as Error).message)+'</p><a href="/admin?mode=rehearsal">리허설 열기</a></section>'
      else tell((error as Error).message)
    })
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
