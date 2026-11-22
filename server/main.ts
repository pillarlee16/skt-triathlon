import {createServer} from 'node:http'
import {createReadStream,existsSync,mkdirSync,statSync} from 'node:fs'
import {pipeline} from 'node:stream/promises'
import {extname,join,resolve,sep} from 'node:path'
import {fileURLToPath} from 'node:url'
import {createEventApi} from './event.ts'
import {serveEvent} from './http.ts'

const railway=Boolean(process.env.RAILWAY_ENVIRONMENT_ID)
const port=Number(process.env.PORT??3000)
const password=process.env.ADMIN_PASSWORD
const secret=process.env.SESSION_SECRET
const domain=process.env.RAILWAY_PUBLIC_DOMAIN
const origin=new URL(process.env.PUBLIC_ORIGIN||(domain?'https://'+domain:'http://127.0.0.1:'+port)).origin
if(!password||!secret||secret.length<32)throw new Error('Set ADMIN_PASSWORD and a SESSION_SECRET of at least 32 characters')
if(railway&&!origin.startsWith('https://'))throw new Error('Railway requires an HTTPS public origin')

const dataDir=process.env.RAILWAY_VOLUME_MOUNT_PATH??(railway?undefined:process.env.DATA_DIR)
if(!dataDir)throw new Error('Mount a Railway volume or set DATA_DIR locally')
if(!railway)mkdirSync(dataDir,{recursive:true})
if(!statSync(dataDir).isDirectory())throw new Error('The database path must be a directory')
const dist=fileURLToPath(new URL('../dist',import.meta.url))
const index=join(dist,'index.html')
if(!existsSync(index))throw new Error('Run npm run build before starting the server')
const api=createEventApi({database:join(dataDir,'triathlon.sqlite'),mode:'live',password,secret,secure:origin.startsWith('https://')})
const pages=new Set(['/','/admin','/display','/start'])
const mime=new Map([['.html','text/html; charset=utf-8'],['.js','text/javascript; charset=utf-8'],
  ['.css','text/css; charset=utf-8'],['.svg','image/svg+xml'],['.png','image/png'],['.webp','image/webp'],['.mp3','audio/mpeg'],['.ico','image/x-icon']])

const server=createServer(async(req,res)=>{
  try{
    const url=new URL(origin+(req.url??'/'))
    const path=url.pathname==='/'?'/':url.pathname.replace(/\/$/,'')
    if(path==='/api/event'){
      return await serveEvent(req,res,origin,api)
    }
    if(req.method!=='GET'&&req.method!=='HEAD'){
      res.writeHead(405).end()
      return
    }
    if(path==='/health'){
      res.writeHead(200,{'Content-Type':'text/plain','Cache-Control':'no-store'}).end('ok')
      return
    }
    const asset=resolve(dist,'.'+path)
    const staticAsset=asset.startsWith(join(dist,'assets')+sep)&&existsSync(asset)&&statSync(asset).isFile()
    if(!pages.has(path)&&!staticAsset){
      res.writeHead(404).end()
      return
    }
    const file=staticAsset?asset:index
    res.writeHead(200,{'Content-Type':mime.get(extname(file))??'application/octet-stream',
      'Cache-Control':staticAsset?'public, max-age=31536000, immutable':'no-cache','X-Content-Type-Options':'nosniff'})
    if(req.method==='HEAD')res.end()
    else await pipeline(createReadStream(file),res)
  }catch(error){
    console.error('HTTP request failed',error instanceof Error?error.name:'UnknownError')
    if(!res.headersSent)res.writeHead(500)
    res.end()
  }
})
server.listen(port,railway?'0.0.0.0':'127.0.0.1',()=>console.log('Triathlon HTTP server listening on '+port))
for(const signal of ['SIGINT','SIGTERM'] as const){
  process.once(signal,()=>server.close(()=>api.close()))
}
