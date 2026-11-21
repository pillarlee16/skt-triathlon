import {createHash, createHmac, randomBytes, randomUUID, timingSafeEqual} from 'node:crypto'
import {apply, RuleError} from '../src/engine.js'
import {csv, currentRace, initial, stage, sports, type Sport, type Action, type Asset, type Mode, type State} from '../src/model.js'

const local = !process.env.VERCEL && !process.env.BLOB_READ_WRITE_TOKEN
const memory = new Map<Mode,State>()
const maxFile=4_000_000
const sha=(value:string)=>createHash('sha256').update(value).digest()
const safeEqual=(a:string,b:string)=>timingSafeEqual(sha(a),sha(b))
const password=()=>process.env.ADMIN_PASSWORD ?? (local?'rehearsal':'')
const secret=()=>process.env.SESSION_SECRET ?? (local?'local-rehearsal-only':'')
const sign=(value:string)=>createHmac('sha256',secret()).update(value).digest('base64url')
const root=(mode:Mode)=>'triathlon-v1/'+mode+'/'
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}
const json=(body:unknown,status=200,extra:HeadersInit={})=>Response.json(body,{status,headers:{...headers,...extra}})
const fileMemory=new Map<string,{bytes:ArrayBuffer; mime:string}>()
class Conflict extends Error {}
class Unauthorized extends Error {}

async function read(mode:Mode):Promise<State> {
  if (local) return memory.get(mode)??initial(mode)
  const {get}=await import('@vercel/blob')
  const blob=await get(root(mode)+'state.json',{access:'private',useCache:false})
  return blob?.statusCode===200 ? await new Response(blob.stream).json() as State : initial(mode)
}
async function stateWriteTag(mode:Mode) {
  const {head,BlobNotFoundError}=await import('@vercel/blob')
  try {
    const {etag}=await head(root(mode)+'state.json')
    if(!etag) throw new Error('Blob state metadata is missing an ETag')
    return etag
  } catch(error) {
    if(error instanceof BlobNotFoundError) return undefined
    throw error
  }
}
async function write(state:State,etag?:string) {
  if (local) {
    if ((memory.get(state.mode)?.revision??0)!==state.revision-1) throw new Conflict()
    memory.set(state.mode,state)
    return
  }
  const {put,BlobPreconditionFailedError}=await import('@vercel/blob')
  try {
    await put(root(state.mode)+'state.json',JSON.stringify(state),{
      access:'private',contentType:'application/json',allowOverwrite:!!etag,...(etag?{ifMatch:etag}:{})
    })
  } catch(error) {
    if (error instanceof BlobPreconditionFailedError || (!etag && (await read(state.mode)).revision>0)) {
      throw new Conflict('blob-write')
    }
    throw error
  }
}
function isAdmin(request:Request) {
  const cookie=request.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith('tri_admin='))?.slice(10)
  const [expires,signature]=cookie?.split('.')??[]
  return !!secret() && Number(expires)>Date.now() && !!signature && safeEqual(signature,sign(expires))
}
function tabletAllowed(s:State, request:Request, now:number) {
  const token=request.headers.get('authorization')?.replace(/^Bearer /,'')??''
  return !!(s.ready && s.pairing && s.pairing.readyId===s.ready.id && s.pairing.expires>now &&
    token && safeEqual(sha(token).toString('hex'),s.pairing.hash))
}
function projection(s:State, now:number, display:boolean) {
  const {pairing, requests, mode, ...publicState}=s
  const race=currentRace(s)
  return {...publicState,now,tabletArmed:!!(pairing && pairing.expires>now),
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
export default {async fetch(request:Request):Promise<Response> {
  const url=new URL(request.url)
  const op=url.searchParams.get('op')??'state'
  const mode:Mode=process.env.VERCEL&&process.env.VERCEL_ENV==='production'?'live':'rehearsal'
  const legacyMode=url.searchParams.get('mode')
  if (legacyMode!==null&&legacyMode!==mode) return json({error:'이 링크는 현재 배포 환경에서 사용할 수 없습니다.'},403)
  const now=Date.now()
  if (mode==='live' && process.env.APP_LIVE_ENABLED!=='true') {
    return json({error:'운영 배포가 활성화되지 않았습니다.'},403)
  }
  if (!password() || (!local && secret().length<32)) return json({error:'운영 환경의 인증 설정을 확인하세요.'},503)
  const admin=isAdmin(request)
  try {
    if (request.method==='POST' && request.headers.get('origin')!==url.origin) throw new Unauthorized()
    if(op==='login' && request.method==='POST') {
      const body=await request.json()
      if(typeof body.password!=='string' || !safeEqual(body.password,password())) throw new Unauthorized()
      const expires=String(now+12*60*60*1000)
      return json({ok:true},200,{'Set-Cookie':'tri_admin='+expires+'.'+sign(expires)+'; Path=/; HttpOnly; SameSite=Strict; Max-Age=43200'+(local?'':'; Secure')})
    }
    if (!admin && op!=='tablet' && op!=='tabletStart') throw new Unauthorized()
    if (op==='tabletStart' && request.method!=='POST') return json({error:'지원하지 않는 요청입니다.'},405)
    const willWrite=request.method==='POST' && ['upload','action','tabletStart'].includes(op)
    // Take the storage metadata version before reading the latest body.
    // A concurrent overwrite makes this version fail the conditional write.
    const etag=willWrite && !local ? await stateWriteTag(mode) : undefined
    const state=await read(mode)
    if(op==='tablet' && request.method==='GET') return json({enabled:tabletAllowed(state,request,now)})
    if(op==='state' && request.method==='GET') return json(projection(state,Date.now(),url.searchParams.get('view')==='display'))
    if(op==='csv' && request.method==='GET') return new Response(csv(state,now),{headers:{
      ...headers,'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="triathlon-results.csv"'
    }})
    if(op==='file' && request.method==='GET') {
      const asset=state.assets.find(a=>a.id===url.searchParams.get('id'))
      if(!asset) return json({error:'파일이 없습니다.'},404)
      const path=root(mode)+'asset/'+asset.id
      const saved=fileMemory.get(path)
      if(local) return saved ? new Response(saved.bytes,{headers:{...headers,'Content-Type':saved.mime}}) : json({error:'파일이 없습니다.'},404)
      const {get}=await import('@vercel/blob')
      const blob=await get(path,{access:'private'})
      return blob?.statusCode===200 ? new Response(blob.stream,{headers:{...headers,'Content-Type':blob.blob.contentType}}) : json({error:'파일이 없습니다.'},404)
    }
    if(request.method!=='POST' || !['upload','action','tabletStart'].includes(op)) return json({error:'지원하지 않는 요청입니다.'},405)
    const id=request.headers.get('x-request-id')??''
    if(!/^[0-9a-f-]{36}$/i.test(id)) return json({error:'요청 ID를 확인하세요.'},400)
    if(op==='tabletStart' && !tabletAllowed(state,request,now)) {
      if (Object.hasOwn(state.requests,sha((request.headers.get('authorization')??'')+id).toString('hex'))) return json({ok:true})
      throw new Unauthorized()
    }
    const key=op==='tabletStart'?sha((request.headers.get('authorization')??'')+id).toString('hex'):id
    if(Object.hasOwn(state.requests,key)) return json({ok:true,...(admin?{state:projection(state,Date.now(),false)}:{})})
    if(op!=='tabletStart' && request.headers.get('x-revision')!==String(state.revision)) throw new Conflict('client-revision')
    if(!local && !etag && state.revision>0) throw new Conflict('blob-created-during-read')
    let action:Action
    let token:string|undefined
    let upload:{asset:Asset;bytes:ArrayBuffer;mime:string}|undefined
    if(op==='upload') {
      const name=url.searchParams.get('name')?.trim()??''
      if(!name || name.length>200 || /[\\/]/.test(name)) throw new RuleError('파일명을 확인하세요.')
      const bytes=await request.arrayBuffer()
      if(!bytes.byteLength || bytes.byteLength>maxFile) return json({error:'파일은 최대 4 MB입니다.'},413)
      const mime=imageType(new Uint8Array(bytes,0,Math.min(12,bytes.byteLength)))
      if(!mime) return json({error:'JPG, PNG, WebP, MP3, WAV, OGG를 지원합니다.'},415)
      const asset:Asset={id:randomUUID(),name,kind:mime.startsWith('image/')?'image':'audio'}
      upload={asset,bytes,mime}
      const person=url.searchParams.get('person')
      const prize=url.searchParams.get('prize') as Sport|null
      if((person!==null&&(!person||prize!==null))||(prize!==null&&!sports.includes(prize)))throw new RuleError('파일을 연결할 항목을 확인하세요.')
      action={type:'assets',assets:[asset],target:person?{person}:prize?{prize}:undefined}
    } else if(op==='tabletStart') action={type:'start'}
    else {
      action=await request.json()
      if (!action || typeof action.type!=='string' || action.type==='assets') throw new RuleError('잘못된 요청입니다.')
      if(action.type==='arm') {
        token=randomBytes(24).toString('base64url')
        action={type:'arm',hash:sha(token).toString('hex'),expires:now+30*60*1000}
      }
    }
    const next=apply(state,action,Date.now())
    next.revision++
    next.requests[key]=next.revision
    if(upload) {
      const path=root(mode)+'asset/'+upload.asset.id
      if(local) fileMemory.set(path,{bytes:upload.bytes,mime:upload.mime})
      else {
        const {put}=await import('@vercel/blob')
        await put(path,Buffer.from(upload.bytes),{access:'private',contentType:upload.mime})
      }
    }
    await write(next,etag)
    return json({ok:true,token,...(admin?{state:projection(next,Date.now(),false)}:{})})
  } catch(error) {
    if(error instanceof Unauthorized) return json({error:'로그인 또는 유효한 시작 링크가 필요합니다.'},401)
    if(error instanceof RuleError || error instanceof SyntaxError) return json({error:error.message},400)
    if(error instanceof Conflict) {
      console.info('event state conflict',op,error.message || 'local-write')
      return json({error:'다른 화면에서 상태가 변경되었습니다. 새 상태를 확인하세요.'},409)
    }
    console.error('event request failed',error instanceof Error?error.name:'UnknownError')
    return json({error:'저장소 연결을 확인하고 다시 시도하세요.'},503)
  }
}}
