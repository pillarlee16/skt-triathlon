import {findAsset,type State,type Mode,type Person} from './model.ts'
export type ViewState=Omit<State,'requests'|'pairing'> & {now:number;tabletArmed:boolean}
export type TvStatus={id:string; revision:number; audio:boolean; graphics:'loading'|'3d'|'html'; online:boolean; graphicsIssue?:string}
const params=new URLSearchParams(location.search)
export const mode:Mode=params.get('mode')==='live'?'live':'rehearsal'
export const operatorChannel=new BroadcastChannel('triathlon-operator-'+mode)
export const endpoint=(op:string,options:Record<string,string>={})=>'/api/event?'+new URLSearchParams({op,mode,...options})
export function assetUrl(state:ViewState,ref:string,kind:'image'|'audio'='image') {
  const asset=findAsset(state,ref)
  return asset?.kind===kind?endpoint('file',{id:asset.id}):''
}
export function personPhoto(state:ViewState,person:Pick<Person,'id'|'photo'>) {
  if(person.photo) return assetUrl(state,person.photo)
  for(const extension of ['webp','jpg','jpeg','png']){
    const url=assetUrl(state,person.id+'.'+extension)
    if(url)return url
  }
  return ''
}
export class ApiError extends Error {constructor(public status:number,message:string){super(message)}}
export async function api<T=ViewState>(op:string,options:Record<string,string>={},init?:RequestInit):Promise<T> {
  const r=await fetch(endpoint(op,options),{cache:'no-store',...init})
  const body=await r.json().catch(()=>({error:'서버 응답을 확인하세요.'}))
  if(!r.ok) throw new ApiError(r.status,body.error)
  return body
}
export function mutation<T=unknown>(op:string,body:BodyInit,revision:number,options:Record<string,string>={},token?:string) {
  const headers:Record<string,string>={'x-request-id':crypto.randomUUID(),'x-revision':String(revision)}
  if(op!=='upload') headers['Content-Type']='application/json'
  if(token) headers.Authorization='Bearer '+token
  const send=()=>api<T>(op,options,{method:'POST',body,headers,signal:AbortSignal.timeout(7000)})
  return ()=>send().catch(error=>{if(error instanceof ApiError && error.status!==503) throw error; return send()})
}
export const mutate=<T=unknown>(...args:Parameters<typeof mutation<T>>)=>mutation<T>(...args)()
export const esc=(s:unknown)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))
export const link=(path:string)=>path+'?mode='+mode
export function loginPanel(app:HTMLElement,onSuccess:()=>void) {
  app.innerHTML='<section class="gate"><div class="eyebrow">SKT · 2026</div><h1>철인3종 럭키드로우</h1><form><label>운영 비밀번호<input type="password" name="password" required autofocus autocomplete="current-password"></label><button>로그인</button><p role="alert"></p></form></section>'
  const form=app.querySelector('form')!
  form.onsubmit=async event=>{
    event.preventDefault()
    const button=form.querySelector('button')!
    button.disabled=true
    try {
      await api('login',{}, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(form)))})
      onSuccess()
    } catch(error) {form.querySelector('p')!.textContent=(error as Error).message}
    finally {button.disabled=false}
  }
}
export function poll<T>(read:()=>Promise<T>,success:(value:T)=>void,failure:(error:unknown)=>void,listen=false) {
  let active=true
  let timer:number
  let running=false, queued=false
  async function run(){
    if(running){queued=true;return}
    clearTimeout(timer)
    running=true
    try {const value=await read(); if(active) success(value)}
    catch(error){if(active) failure(error)}
    finally {
      running=false
      if(active) timer=window.setTimeout(run,queued?0:1000)
      queued=false
    }
  }
  const refresh=(event:MessageEvent)=>{if(event.data?.type==='refresh')void run()}
  if(listen)operatorChannel.addEventListener('message',refresh)
  void run()
  return ()=>{active=false;clearTimeout(timer);operatorChannel.removeEventListener('message',refresh)}
}
