import {defineConfig} from 'vite'
import {Readable} from 'node:stream'

export default defineConfig({
  server:{host:'127.0.0.1',watch:{ignored:['**/.local/**','**/.playwright-cli/**','**/output/playwright/**','**/dist/**']}},
  plugins:[{
    name:'local-rehearsal-api',
    configureServer(server) {
      server.middlewares.use(async (req,res,next)=>{
        if(!req.url?.startsWith('/api/event')) return next()
        try {
          const {default: handler}=await server.ssrLoadModule('/api/event.ts') as typeof import('./api/event.ts')
          const body=req.method==='GET' || req.method==='HEAD' ? undefined : Readable.toWeb(req) as ReadableStream
          const request=new Request('http://'+req.headers.host+req.url,{
            method:req.method,headers:req.headers as Record<string,string>,body,duplex:'half'
          } as RequestInit)
          const response=await handler.fetch(request)
          res.writeHead(response.status,Object.fromEntries(response.headers))
          res.end(Buffer.from(await response.arrayBuffer()))
        } catch {res.writeHead(500);res.end('Local API unavailable')}
      })
    }
  }]
})
