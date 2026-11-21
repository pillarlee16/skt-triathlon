import * as T from 'three'
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js'
import type {Sport} from './model.ts'

export function faceSurface(){
  const geometry=new T.PlaneGeometry(1.04,1.04,12,12).rotateY(Math.PI)
  const points=geometry.attributes.position
  for(let i=0;i<points.count;i++){
    const x=points.getX(i), y=points.getY(i)
    points.setZ(i,-Math.sqrt(Math.max(.019,.61**2-x*x-y*y))-.011)
  }
  geometry.computeVertexNormals()
  return geometry
}

export function faceTexture(image:HTMLImageElement|undefined, alive:()=>boolean){
  const canvas=document.createElement('canvas')
  canvas.width=canvas.height=192
  const ctx=canvas.getContext('2d')!
  const texture=new T.CanvasTexture(canvas)
  texture.colorSpace=T.SRGBColorSpace
  function paint(photo?:HTMLImageElement){
    ctx.clearRect(0,0,192,192)
    ctx.save()
    ctx.beginPath();ctx.arc(96,96,91,0,Math.PI*2);ctx.clip()
    if(photo){
      const size=Math.min(photo.naturalWidth,photo.naturalHeight)
      ctx.drawImage(photo,(photo.naturalWidth-size)/2,(photo.naturalHeight-size)/2,size,size,0,0,192,192)
    }else{
      ctx.fillStyle='#ffe9cb';ctx.fillRect(0,0,192,192)
      ctx.fillStyle='#ec9eaa'
      for(const x of [50,142]){ctx.beginPath();ctx.ellipse(x,115,11,7,0,0,7);ctx.fill()}
      ctx.fillStyle='#382640'
      for(const x of [69,123]){ctx.beginPath();ctx.ellipse(x,88,7,11,0,0,7);ctx.fill()}
      ctx.beginPath();ctx.ellipse(96,114,14,11,0,0,Math.PI);ctx.fill()
    }
    ctx.restore()
    ctx.strokeStyle='#fff4de';ctx.lineWidth=6
    ctx.beginPath();ctx.arc(96,96,88,0,Math.PI*2);ctx.stroke()
    texture.needsUpdate=true
  }
  paint(image?.naturalWidth?image:undefined)
  if(image&&!image.naturalWidth)image.addEventListener('load',()=>{if(alive())paint(image)},{once:true})
  return texture
}

export function contactTexture(){
  const canvas=document.createElement('canvas')
  canvas.width=canvas.height=48
  const ctx=canvas.getContext('2d')!
  const shade=ctx.createRadialGradient(24,24,3,24,24,24)
  shade.addColorStop(0,'rgba(32,23,61,.37)')
  shade.addColorStop(.54,'rgba(39,31,70,.23)')
  shade.addColorStop(1,'rgba(39,31,70,0)')
  ctx.fillStyle=shade;ctx.fillRect(0,0,48,48)
  const texture=new T.CanvasTexture(canvas)
  texture.colorSpace=T.SRGBColorSpace
  return texture
}

function profilePoints(points:number[][]){
  return new T.SplineCurve(points.map(([radius,height])=>new T.Vector2(radius,height)))
    .getPoints(points.length*2).map(p=>new T.Vector2(Math.max(0,p.x),p.y))
}

function roundedProfile(points:number[][],segments=20){
  return new T.LatheGeometry(profilePoints(points),segments)
}

const torsoProfile=profilePoints([[0,-.525],[.18,-.488],[.34,-.40],[.411,-.23],[.424,-.075],
  [.393,.115],[.354,.278],[.31,.407],[.209,.491],[0,.525]])
const bellyDepth=(y:number)=>.94+.24*Math.exp(-((y+.09)**2)/.095)

function torsoRadius(y:number){
  const top=torsoProfile.findIndex(point=>point.y>=y)
  const a=torsoProfile[top-1], b=torsoProfile[top]
  return T.MathUtils.lerp(a.x,b.x,(y-a.y)/(b.y-a.y))
}

export function bodyShape(){
  const geometry=new T.LatheGeometry(torsoProfile,24)
  const positions=geometry.attributes.position
  for(let i=0;i<positions.count;i++){
    const y=positions.getY(i), z=positions.getZ(i)
    positions.setZ(i,z*(z<0?bellyDepth(y):.92))
  }
  geometry.computeVertexNormals()
  return geometry
}

function joinSurfaces(geometries:T.BufferGeometry[]){
  const surfaces=geometries.map(geometry=>geometry.index?geometry.toNonIndexed():geometry)
  const merged=mergeGeometries(surfaces)
  surfaces.forEach((surface,i)=>{if(surface!==geometries[i])surface.dispose()})
  geometries.forEach(geometry=>geometry.dispose())
  return merged
}

export function faceBindingShape(sport:Sport){
  const points=Array.from({length:32},(_,i)=>{
    const angle=i*Math.PI/16
    const x=.497*Math.cos(angle), y=.497*Math.sin(angle)
    const underCap=sport==='running'?0:.057*T.MathUtils.smoothstep(y,.32,.48)
    return new T.Vector3(x,y,-Math.sqrt(.61**2-x*x-y*y)-.015+underCap)
  })
  return new T.TubeGeometry(new T.CatmullRomCurve3(points,true),32,.022,6,true)
}

export function uniformPipingShape(sport:Sport){
  const ring=(steps:number,radius:number,project:(angle:number)=>T.Vector3)=>
    new T.TubeGeometry(new T.CatmullRomCurve3(Array.from({length:steps},(_,i)=>project(i*2*Math.PI/steps)),true),steps,radius,5,true)
  const surface=(angle:number,y:number)=>{
    const width=torsoRadius(y)+.006
    const z=Math.sin(angle)*width
    return new T.Vector3(Math.cos(angle)*width,y,z*(z<0?bellyDepth(y):.92))
  }
  const neck=ring(24,sport==='swimming'?.018:.025,angle=>surface(angle,.356+.037*Math.sin(angle)))
  const hem=ring(26,.019,angle=>surface(angle,-.345+.017*Math.cos(2*angle)))
  return joinSurfaces([neck,hem])
}

export function nameBibs(names:string[]){
  const width=256, height=104, columns=8
  const rows=Math.max(1,Math.ceil(names.length/columns))
  const canvas=document.createElement('canvas')
  canvas.width=columns*width;canvas.height=rows*height
  const ctx=canvas.getContext('2d')!
  const tiles=new Float32Array(names.length*4)
  const font=(size:number)=>`800 ${size}px "Malgun Gothic",system-ui,sans-serif`
  names.forEach((rawName,index)=>{
    const x=index%columns, y=Math.floor(index/columns)
    tiles.set([x/columns,(rows-1-y)/rows,1/columns,1/rows],index*4)
    ctx.save();ctx.translate(x*width,y*height)
    ctx.fillStyle='#fff7e4';ctx.strokeStyle='#4c3b5b';ctx.lineWidth=5
    ctx.beginPath();ctx.roundRect(5,5,width-10,height-10,11);ctx.fill();ctx.stroke()
    ctx.fillStyle='#8a7296'
    for(const [px,py] of [[17,17],[239,17],[17,87],[239,87]]){
      ctx.beginPath();ctx.arc(px,py,3,0,Math.PI*2);ctx.fill()
    }
    ctx.fillStyle='#2c1d38';ctx.textAlign='center';ctx.textBaseline='middle'
    const name=rawName.trim()
    ctx.font=font(51)
    if(ctx.measureText(name).width<=218){
      ctx.fillText(name,width/2,height/2+2)
    }else{
      ctx.font=font(38)
      if(ctx.measureText(name).width<=218){
        ctx.fillText(name,width/2,height/2+2)
      }else{
        const letters=Array.from(name)
        const middle=Math.ceil(letters.length/2)
        const wordBreaks=letters.flatMap((letter,index)=>/\s/.test(letter)?[index]:[])
        const split=wordBreaks.length?wordBreaks.reduce((closest,index)=>
          Math.abs(index-middle)<Math.abs(closest-middle)?index:closest):middle
        ctx.font=font(35)
        ctx.fillText(letters.slice(0,split).join('').trim(),width/2,34,218)
        ctx.fillText(letters.slice(split).join('').trim(),width/2,71,218)
      }
    }
    ctx.restore()
  })
  const texture=new T.CanvasTexture(canvas)
  texture.colorSpace=T.SRGBColorSpace
  texture.generateMipmaps=false
  texture.minFilter=T.LinearFilter
  const material=new T.MeshBasicMaterial({map:texture,alphaTest:.5,toneMapped:false})
  material.onBeforeCompile=shader=>{
    shader.vertexShader='attribute vec4 bibTile;\n'+shader.vertexShader.replace(
      '#include <uv_vertex>','#include <uv_vertex>\nvMapUv = bibTile.xy + vMapUv * bibTile.zw;')
  }

  const geometry=new T.PlaneGeometry(.64,.26,14,5).rotateY(Math.PI).translate(0,-.147,0)
  const points=geometry.attributes.position
  for(let i=0;i<points.count;i++){
    const y=points.getY(i), x=points.getX(i)
    const radius=torsoRadius(y)
    points.setZ(i,-Math.sqrt(Math.max(0,radius**2-x*x))*bellyDepth(y)-.013)
  }
  geometry.setAttribute('bibTile',new T.InstancedBufferAttribute(tiles,4))
  return new T.InstancedMesh(geometry,material,names.length)
}

export function armShape(){
  const radius=.108
  const shaft=.28
  const shoulderToTip=shaft+radius
  return new T.CapsuleGeometry(radius,shaft,6,14).translate(0,-shaft/2,0)
    .scale(1,1/shoulderToTip,.94)
}

export function shoeShape(sport:Sport){
  const geometry=roundedProfile([[0,-.25],[.114,-.25],[.146,-.23],[.15,-.207],[.140,-.19],[.15,-.176],
    [.138,-.123],[.100,-.061],[.088,.068],[.102,.174],[.105,.199],[.081,.234],[0,.255]],16)
  const positions=geometry.attributes.position
  const colors:number[]=[]
  const tread=new T.Color('#7d7089'), sole=new T.Color('#fff0d2'), upper=new T.Color('#c9c0d7')
  const sock=new T.Color(sport==='swimming'?'#605575':'#e7dadb')
  for(let i=0;i<positions.count;i++){
    const y=positions.getY(i), z=positions.getZ(i)
    const foot=1-T.MathUtils.smoothstep(y,-.17,.015)
    positions.setZ(i,z*(1+(z<0?.95:.15)*foot)-.035*foot)
    const color=y<-.23?tread:y<-.185?sole:y<.085?upper:sock
    colors.push(color.r,color.g,color.b)
  }
  geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3))
  geometry.computeVertexNormals()
  const accents:T.BufferGeometry[]=[]
  if(sport==='swimming'){
    const ribs=new T.SphereGeometry(1,10,5).scale(.091,.025,.153).translate(0,-.154,-.167)
    tintGeometry(ribs,new T.Color('#f0dfce'));accents.push(ribs)
  }else{
    const count=sport==='running'?3:2
    for(let i=0;i<count;i++){
      const lace=new T.CapsuleGeometry(.014,sport==='running'?.104:.13,3,6)
      lace.rotateZ(Math.PI/2-.065)
      lace.translate(0,-.126+i*.04,-.205+i*.043)
      tintGeometry(lace,new T.Color('#fff2dd'));accents.push(lace)
    }
    const tab=new T.BoxGeometry(.079,.072,.021).translate(0,.12,.093)
    tintGeometry(tab,new T.Color('#eee4d9'));accents.push(tab)
  }
  return joinSurfaces([geometry,...accents])
}

function tintGeometry(geometry:T.BufferGeometry,color:T.Color){
  const colors=new Float32Array(geometry.attributes.position.count*3)
  for(let i=0;i<colors.length;i+=3)color.toArray(colors,i)
  geometry.setAttribute('color',new T.BufferAttribute(colors,3))
}

export function outfitTexture(sport:Sport){
  const canvas=document.createElement('canvas')
  canvas.width=256;canvas.height=128
  const ctx=canvas.getContext('2d')!
  ctx.fillStyle='#fff';ctx.fillRect(0,0,256,128)
  ctx.fillStyle='#a59bb8';ctx.fillRect(0,98,256,15)
  if(sport==='swimming'){
    for(const x of [57,185]){
      ctx.fillStyle='#afa1c3';ctx.fillRect(x,17,14,91)
      ctx.fillStyle='#eae0ed';ctx.fillRect(x+4,19,4,80)
    }
  }else{
    ctx.strokeStyle='#b4a7c3';ctx.lineWidth=4
    ctx.beginPath();ctx.ellipse(128,8,35,23,0,0,Math.PI);ctx.stroke()
    if(sport==='cycling'){
      ctx.fillStyle='#a59bb8';ctx.fillRect(125,30,5,47)
      ctx.fillStyle='#eee6e7';ctx.fillRect(123,32,9,10)
      ctx.fillStyle='#cfc4da';ctx.fillRect(0,61,256,4)
    }else{
      for(const x of [86,170]){
        ctx.beginPath();ctx.ellipse(x,22,13,30,0,0,Math.PI);ctx.stroke()
      }
    }
  }
  const texture=new T.CanvasTexture(canvas)
  texture.colorSpace=T.SRGBColorSpace
  return texture
}

export function helmetShape(sport:Sport){
  const geometry=new T.SphereGeometry(.623,28,14,0,Math.PI*2,0,sport==='running'?.66:1.03)
  if(sport==='cycling'){
    const points=geometry.attributes.position
    for(let i=0;i<points.count;i++){
      const z=points.getZ(i)
      const x=points.getX(i),y=points.getY(i)
      const ridge=.028*Math.exp(-((x/.132)**2))*T.MathUtils.smoothstep(y,.37,.58)
      points.setY(i,y+ridge)
      if(z>0)points.setZ(i,z*(1.27+.06*Math.exp(-((x/.22)**2))))
    }
    geometry.computeVertexNormals()
  }
  return geometry
}

export function swimGoggleShape(){
  const gasket=new T.SphereGeometry(1,14,8).scale(.108,.080,.038)
  const lens=new T.SphereGeometry(1,14,8).scale(.083,.061,.032).translate(0,.001,-.030)
  const glint=new T.SphereGeometry(1,8,5).scale(.031,.010,.009).rotateZ(-.37).translate(-.023,.025,-.058)
  const reflection=new T.SphereGeometry(1,8,5).scale(.009,.007,.008).translate(.036,-.019,-.056)
  tintGeometry(gasket,new T.Color('#fff7e6'))
  tintGeometry(lens,new T.Color('#525d80'))
  tintGeometry(glint,new T.Color('#e6eeff'))
  tintGeometry(reflection,new T.Color('#a6c5e5'))
  return joinSurfaces([gasket,lens,glint,reflection])
}

export function helmetTexture(sport:Sport){
  const canvas=document.createElement('canvas')
  canvas.width=256;canvas.height=96
  const ctx=canvas.getContext('2d')!
  ctx.fillStyle='#fff';ctx.fillRect(0,0,256,96)
  ctx.fillStyle='#c9b9d0';ctx.fillRect(0,84,256,8)
  if(sport==='swimming'){
    ctx.fillStyle='#9186ad';ctx.fillRect(0,57,256,8)
  }else if(sport==='cycling'){
    ctx.fillStyle='#9d8cae';ctx.fillRect(0,72,256,8)
    for(const x of [51,67,83,177,193,209]){
      ctx.fillStyle='#d7c6d9'
      ctx.beginPath();ctx.ellipse(x+1,47,5.4,16,.22,0,Math.PI*2);ctx.fill()
      ctx.fillStyle='#544861'
      ctx.beginPath();ctx.ellipse(x,46,3.5,15,.22,0,Math.PI*2);ctx.fill()
    }
  }
  if(sport==='running'){
    ctx.fillStyle='#d2c2ce'
    for(let i=8;i<256;i+=12){ctx.beginPath();ctx.ellipse(i,79,1.8,7,.18,0,Math.PI*2);ctx.fill()}
    ctx.fillStyle='#eee0e9'
    ctx.fillRect(0,71,256,2)
    ctx.fillRect(0,91,256,2)
  }
  const texture=new T.CanvasTexture(canvas)
  texture.colorSpace=T.SRGBColorSpace
  return texture
}
