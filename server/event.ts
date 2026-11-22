import {createHash, createHmac, randomUUID, timingSafeEqual} from 'node:crypto'
import {apply, RuleError} from '../src/engine.ts'
import {csv, currentRace, sports, type Sport, type Action, type Asset, type Mode, type State} from '../src/model.ts'
import {openStore,type StoredFile} from './store.ts'

export const maxFile=4_000_000
const sha=(value:string)=>createHash('sha256').update(value).digest()
const safeEqual=(a:string,b:string)=>timingSafeEqual(sha(a),sha(b))
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}
const json=(body:unknown,status=200,extra:HeadersInit={})=>Response.json(body,{status,headers:{...headers,...extra}})
class Conflict extends Error {}
class Unauthorized extends Error {}

function isAdmin(request:Request,sign:(value:string)=>string) {
  const cookie=request.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith('tri_admin='))?.slice(10)
  const [expires,signature]=cookie?.split('.')??[]
  return Number(expires)>Date.now() && !!signature && safeEqual(signature,sign(expires))
}
function projection(s:State, now:number, display:boolean) {
  const {pairing, requests, mode, ...publicState}=s
  const race=currentRace(s)
  return {...publicState,now,
    races: s.races.map(r=>display && r.id===race?.id || now>=r.endsAt || r.invalidated ? r : {...r,winners:[]})}
}
function imageType(bytes:Uint8Array) {
  if (bytes[0]===0xff && bytes[1]===0xd8 && bytes[2]===0xff) return 'image/jpeg'
  const text=(a:number,b:number)=>String.fromCharCode(...bytes.slice(a,b))
  if (bytes[0]===0x89 && text(1,4)==='PNG') return 'image/png'
  if (text(0,4)==='RIFF' && text(8,12)==='WEBP') return 'image/webp'
  if (text(0,3)==='ID3' || (bytes[0]===255 && (bytes[1]&224)===224)) return 'audio/mpeg'
  if (text(0,4)==='RIFF' && text(8,12)==='WAVE') return 'audio/wav'
  if (text(0,4)==='OggS') return 'audio/ogg'
}
type EventOptions={database:string;mode:Mode;password:string;secret:string;secure:boolean}

export function createEventApi({database,mode,password,secret,secure}:EventOptions){
 const store=openStore(database,mode)
 const sign=(value:string)=>createHmac('sha256',secret).update(value).digest('base64url')
 async function fetch(request:Request):Promise<Response> {
  const url=new URL(request.url)
  const op=url.searchParams.get('op')??'state'
  const legacyMode=url.searchParams.get('mode')
  if (legacyMode!==null&&legacyMode!==mode) return json({error:'이 링크는 현재 배포 환경에서 사용할 수 없습니다.'},403)
  const now=Date.now()
  const admin=isAdmin(request,sign)
  try {
    if (request.method==='POST' && request.headers.get('origin')!==url.origin) throw new Unauthorized()
    if(op==='login' && request.method==='POST') {
      const body=await request.json()
      if(typeof body.password!=='string' || !safeEqual(body.password,password)) throw new Unauthorized()
      const expires=String(now+12*60*60*1000)
      return json({ok:true},200,{'Set-Cookie':'tri_admin='+expires+'.'+sign(expires)+'; Path=/; HttpOnly; SameSite=Strict; Max-Age=43200'+(secure?'; Secure':'')})
    }
    if (!admin && op!=='tabletStart') throw new Unauthorized()
    if (op==='tabletStart' && request.method!=='POST') return json({error:'지원하지 않는 요청입니다.'},405)
    const state=store.read()
    if(op==='state' && request.method==='GET') return json(projection(state,Date.now(),url.searchParams.get('view')==='display'))
    if(op==='csv' && request.method==='GET') return new Response(csv(state,now),{headers:{
      ...headers,'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="triathlon-results.csv"'
    }})
    if(op==='file' && request.method==='GET') {
      const asset=state.assets.find(a=>a.id===url.searchParams.get('id'))
      if(!asset) return json({error:'파일이 없습니다.'},404)
      const saved=store.file(asset.id)
      return saved ? new Response(Buffer.from(saved.data),{headers:{...headers,'Content-Type':saved.mime}}) : json({error:'파일이 없습니다.'},404)
    }
    if(request.method!=='POST' || !['upload','action','tabletStart'].includes(op)) return json({error:'지원하지 않는 요청입니다.'},405)
    const id=request.headers.get('x-request-id')??''
    if(!/^[0-9a-f-]{36}$/i.test(id)) return json({error:'요청 ID를 확인하세요.'},400)
    const key=op==='tabletStart'?'tablet:'+id:id
    if(Object.hasOwn(state.requests,key)) return json({ok:true,...(admin?{state:projection(state,Date.now(),false)}:{})})
    if(op!=='tabletStart' && request.headers.get('x-revision')!==String(state.revision)) throw new Conflict('client-revision')
    let action:Action
    let upload:StoredFile|undefined
    if(op==='upload') {
      const name=url.searchParams.get('name')?.trim()??''
      if(!name || name.length>200 || /[\\/]/.test(name)) throw new RuleError('파일명을 확인하세요.')
      const bytes=await request.arrayBuffer()
      if(!bytes.byteLength || bytes.byteLength>maxFile) return json({error:'파일은 최대 4 MB입니다.'},413)
      const mime=imageType(new Uint8Array(bytes,0,Math.min(12,bytes.byteLength)))
      if(!mime) return json({error:'JPG, PNG, WebP, MP3, WAV, OGG를 지원합니다.'},415)
      const asset:Asset={id:randomUUID(),name,kind:mime.startsWith('image/')?'image':'audio'}
      upload={id:asset.id,bytes,mime}
      const person=url.searchParams.get('person')
      const prize=url.searchParams.get('prize') as Sport|null
      if((person!==null&&(!person||prize!==null))||(prize!==null&&!sports.includes(prize)))throw new RuleError('파일을 연결할 항목을 확인하세요.')
      action={type:'assets',assets:[asset],target:person?{person}:prize?{prize}:undefined}
    } else if(op==='tabletStart') action={type:'start'}
    else {
      action=await request.json()
      if (!action || typeof action.type!=='string' || action.type==='assets') throw new RuleError('잘못된 요청입니다.')
    }
    const next=apply(state,action,Date.now())
    next.revision++
    next.requests[key]=next.revision
    if(!store.write(next,upload)) throw new Conflict('revision')
    return json({ok:true,...(admin?{state:projection(next,Date.now(),false)}:{})})
  } catch(error) {
    if(error instanceof Unauthorized) return json({error:'요청 권한을 확인하세요.'},401)
    if(error instanceof RuleError || error instanceof SyntaxError) return json({error:error.message},400)
    if(error instanceof Conflict) {
      console.info('event state conflict',op,error.message || 'local-write')
      return json({error:'다른 화면에서 상태가 변경되었습니다. 새 상태를 확인하세요.'},409)
    }
    console.error('event request failed',error instanceof Error?error.name:'UnknownError')
    return json({error:'저장소 연결을 확인하고 다시 시도하세요.'},503)
  }
 }
 return {fetch,close:store.close}
}
