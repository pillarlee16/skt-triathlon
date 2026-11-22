import {defineConfig} from 'vite'
import {createEventApi} from './server/event.ts'
import {serveEvent} from './server/http.ts'

export default defineConfig({
  server:{host:'127.0.0.1',watch:{ignored:['**/.local/**','**/.playwright-cli/**','**/output/playwright/**','**/dist/**']}},
  plugins:[{
    name:'local-rehearsal-api',
    configureServer(server) {
      const api=createEventApi({database:':memory:',mode:'rehearsal',password:'rehearsal',secret:'local-rehearsal-only',secure:false})
      server.httpServer?.once('close',()=>api.close())
      server.middlewares.use(async (req,res,next)=>{
        if(req.url?.split('?')[0]!=='/api/event') return next()
        try {
          await serveEvent(req,res,'http://'+req.headers.host,api)
        } catch {res.writeHead(500);res.end('Local API unavailable')}
      })
    }
  }]
})
