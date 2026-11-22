import type {IncomingMessage,ServerResponse} from 'node:http'
import {maxFile,type createEventApi} from './event.ts'

export async function serveEvent(req:IncomingMessage,res:ServerResponse,origin:string,api:ReturnType<typeof createEventApi>){
  const url=new URL(origin+(req.url??'/api/event'))
  const method=req.method??'GET'
  const headers=new Headers()
  for(const [key,value] of Object.entries(req.headers)){
    if(value!==undefined)headers.set(key,Array.isArray(value)?value.join(', '):value)
  }
  let body:Buffer<ArrayBuffer>|undefined
  if(method!=='GET'&&method!=='HEAD'){
    const limit=url.searchParams.get('op')==='upload'?maxFile:64_000
    const chunks:Buffer[]=[]
    let total=0
    if(Number(req.headers['content-length'])<=limit||req.headers['content-length']===undefined){
      for await(const chunk of req.iterator({destroyOnReturn:false})){
        total+=chunk.length
        if(total>limit)break
        chunks.push(chunk)
      }
    }else total=limit+1
    if(total>limit){
      req.resume()
      res.writeHead(413,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'})
      res.end(JSON.stringify({error:'요청 크기 한도를 초과했습니다.'}))
      return
    }
    body=Buffer.concat(chunks,total)
  }
  const response=await api.fetch(new Request(url,{method,headers,body}))
  res.writeHead(response.status,Object.fromEntries(response.headers))
  res.end(Buffer.from(await response.arrayBuffer()))
}
