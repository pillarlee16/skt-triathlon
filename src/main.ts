import './style.css'
import {mutate, operatorChannel} from './client.ts'
const app=document.querySelector<HTMLElement>('#app')!
const path=location.pathname.replace(/\/$/,'')
if(path==='/admin')void import('./admin.ts').then(({admin})=>admin(app))
else if(path==='/display')void import('./display.ts').then(({display})=>display(app))
else if(path==='/start'){
  app.innerHTML='<section class="tablet"><button>START</button><span role="status"></span></section>'
  const button=app.querySelector('button')!,status=app.querySelector('[role="status"]')!
  button.onclick=async()=>{
    button.disabled=true
    status.textContent='시작 요청 중'
    try {
      await mutate('tabletStart','{}')
      operatorChannel.postMessage({type:'refresh'})
      status.textContent='시작 요청을 보냈습니다.'
    }catch(error){
      status.textContent=error instanceof Error?error.message:'시작 요청을 처리하지 못했습니다.'
    }finally{button.disabled=false}
  }
}else{
  app.innerHTML='<section class="landing"><div class="eyebrow">SKT · 2026 송년회</div><h1>철인3종<br><em>럭키드로우</em></h1><p>수영 · 사이클 · 달리기</p><div class="actions"><a href="/admin" class="button primary">관리자 열기</a></div></section>'
}
