import './style.css'
import {api, legacyMode, mutate, poll} from './client.ts'
const app=document.querySelector<HTMLElement>('#app')!
const path=location.pathname.replace(/\/$/,'')
if(path==='/admin')void import('./admin.ts').then(({admin})=>admin(app))
else if(path==='/display')void import('./display.ts').then(({display})=>display(app))
else if(path==='/start'){
  const key='skt-start'+(legacyMode===null?'':'-'+legacyMode)
  const fragment=location.hash.slice(1)
  if(fragment){sessionStorage.setItem(key,fragment);history.replaceState(null,'',location.pathname+location.search)}
  const token=sessionStorage.getItem(key)??''
  app.innerHTML='<section class="tablet"><button disabled>START</button><p role="status">관리자 연결 대기</p></section>'
  const button=app.querySelector('button')!,status=app.querySelector('p')!
  let sent=false,busy=false
  const stop=poll(()=>api<{enabled:boolean}>('tablet',{}, {headers:{Authorization:'Bearer '+token}}),result=>{
    if(!busy&&!sent){button.disabled=!result.enabled;status.textContent=result.enabled?'':'관리자 연결 대기'}
  },()=>{if(!sent&&!busy){button.disabled=true;status.textContent='연결 확인 중'}})
  button.onclick=async()=>{
    busy=true;button.disabled=true;status.textContent='시작 요청 중'
    try {await mutate('tabletStart','{}',0,{},token);sent=true;stop();status.textContent='경기가 시작되었습니다.'}
    catch(error){status.textContent=(error as Error).message}
    finally{busy=false}
  }
}else{
  app.innerHTML='<section class="landing"><div class="eyebrow">SKT · 2026 송년회</div><h1>철인3종<br><em>럭키드로우</em></h1><p>수영 · 사이클 · 달리기</p><div class="actions"><a href="/admin" class="button primary">관리자 열기</a></div></section>'
}
