import * as T from 'three'
import {paintedPanel,panelLettering} from './scenery.ts'

export type Station = (progress:number,lane?:number)=>{x:number;y:number;z:number}
export type Place = (color:number,x:number,y:number,z:number,w:number,h:number,d:number,rx?:number,ry?:number,rz?:number)=>void

export function floorNumbers(group:T.Group,values:number[],x:number[],y:number,z:number,spacing:number,height:number){
  const atlas=paintedPanel(spacing*values.length,height,ctx=>{
    ctx.fillStyle='#fff0d4'
    ctx.font='900 '+Math.floor(ctx.canvas.height*.83)+'px system-ui,sans-serif'
    ctx.textAlign='center';ctx.textBaseline='middle'
    values.forEach((value,i)=>ctx.fillText(String(value),ctx.canvas.width*(i+.5)/values.length,ctx.canvas.height*.53))
  })
  atlas.material.transparent=true
  atlas.material.depthWrite=false
  atlas.rotation.x=-Math.PI/2
  atlas.position.set((x[0]+x[x.length-1])/2,y,z)
  group.add(atlas)
}

export function stadiumCanopy(group:T.Group,at:Station,side:number,box:Place){
  const length=at(0).z-at(1).z
  const bays=Math.round(length/5.62)
  const point=(u:number,t:number)=>{
    const p=at(u,side*(16+t*8.9))
    return new T.Vector3(p.x,5.68+Math.sin(t*Math.PI*.86)*2.55+t*.38,p.z)
  }
  const positions:number[]=[],index:number[]=[]
  const segments=bays*2,panels=9
  for(let i=0;i<=segments;i++)for(let j=0;j<=panels;j++){
    const p=point(i/segments,j/panels)
    positions.push(p.x,p.y,p.z)
    if(i&&j){
      const n=i*(panels+1)+j
      index.push(n,n-1,n-panels-2,n,n-panels-2,n-panels-1)
    }
  }
  const geometry=new T.BufferGeometry()
  geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3))
  geometry.setIndex(index);geometry.computeVertexNormals()
  const fabric=new T.MeshStandardMaterial({color:0xf9e9ce,side:T.DoubleSide,roughness:.59})
  fabric.onBeforeCompile=shader=>{
    shader.uniforms.canopyPitch={value:bays/length}
    shader.vertexShader='varying vec3 roofPoint;\n'+shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nroofPoint=position;')
    shader.fragmentShader='uniform float canopyPitch; varying vec3 roofPoint;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      float bay=abs(fract(roofPoint.z*canopyPitch+.5)-.5);
      float edge=1.0-smoothstep(.014,.044,bay);
      float rib=sin(roofPoint.z*1.12)*.022;
      float tension=smoothstep(5.7,6.85,roofPoint.y);
      diffuseColor.rgb*=.94+tension*.075+rib-edge*.090;
    `)
  }
  group.add(new T.Mesh(geometry,fabric))
  for(let i=0;i<=bays;i++){
    const u=i/bays,p=point(u,1)
    box(0x538080,p.x,p.y/2,p.z,.29,p.y,.35)
    for(let j=0;j<8;j++){
      const a=point(u,j/8),b=point(u,(j+1)/8)
      box(0xc58c65,(a.x+b.x)/2,(a.y+b.y)/2-.12,a.z,a.distanceTo(b)+.055,.18,.25,0,0,Math.atan2(b.y-a.y,b.x-a.x))
      box(0xdec4aa,(a.x+b.x)/2,(a.y+b.y)/2+.047,a.z,a.distanceTo(b)+.055,.077,.14,0,0,Math.atan2(b.y-a.y,b.x-a.x))
    }
    if(i===bays)continue
    const a=point(u,0),b=point((i+1)/bays,0)
    box(0xf6efdc,(a.x+b.x)/2,a.y,(a.z+b.z)/2,.25,.14,a.distanceTo(b)+.04,0,
      Math.atan2(b.x-a.x,b.z-a.z))
  }
}

export function shopSigns(group:T.Group,at:Station,streetSections:number){
  const neighborhoods=[
    {names:['을지 인쇄','한결 제본'],base:'#475c74',ink:'#fff3d8'},
    {names:['세운 철물','청계 조명'],base:'#dfad56',ink:'#483b38'},
    {names:['체크포인트','을지 상회'],base:'#437e79',ink:'#fff5dc'},
  ]
  const artwork=neighborhoods.map(({names,base,ink})=>names.map(name=>paintedPanel(4.4,.72,ctx=>{
    const {width,height}=ctx.canvas
    ctx.fillStyle=base;ctx.fillRect(0,0,width,height)
    ctx.strokeStyle=ink;ctx.lineWidth=4;ctx.strokeRect(18,15,width-36,height-30)
    panelLettering(ctx,name,ink,100,height/2)
  })))
  for(const side of [-1,1])for(let i=0;i*3<streetSections;i+=2){
    const u=i*3/streetSections,section=u<.32?0:u<.72?1:2
    const panel=artwork[section][Math.floor(i/2+Number(side===1))%2].clone()
    const p=at(u,side*16.79)
    panel.position.set(p.x,p.y+2.38,p.z)
    panel.rotation.y=-side*Math.PI/2;group.add(panel)
  }
}

export function runningTrackSurface(surface:T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>){
  const canvas=document.createElement('canvas')
  const size=512
  canvas.width=canvas.height=size
  const ctx=canvas.getContext('2d')!
  ctx.fillStyle='#ededed'
  ctx.fillRect(0,0,size,size)
  let seed=7253
  const sample=()=>{
    seed=(Math.imul(seed,1664525)+1013904223)>>>0
    return seed/4294967296
  }
  const flecks=(count:number,radius:number,shades:string[])=>{
    for(let i=0;i<count;i++){
      const x=sample()*size,y=sample()*size
      const rx=(.42+.58*sample())*radius,ry=rx*(.43+.55*sample()),angle=sample()*Math.PI
      ctx.fillStyle=shades[Math.floor(sample()*shades.length)]
      const wrapX=x<rx?size:x>size-rx?-size:0
      const wrapY=y<rx?size:y>size-rx?-size:0
      for(const dx of wrapX?[0,wrapX]:[0])for(const dy of wrapY?[0,wrapY]:[0]){
        ctx.beginPath()
        ctx.ellipse(x+dx,y+dy,rx,ry,angle,0,Math.PI*2)
        ctx.fill()
      }
    }
  }
  flecks(750,12,['#dcd8d6','#f8f7f2','#e1ddda','#f4f2ee'])
  flecks(3100,5.5,['#a69b97','#c5bab7','#fffdf8','#faf7f3','#ded8d4'])
  flecks(3900,2.1,['#a3928d','#c4bab5','#fffefa','#f8f6f2'])
  const grain=new T.CanvasTexture(canvas)
  grain.wrapS=grain.wrapT=T.RepeatWrapping
  grain.minFilter=T.LinearMipmapLinearFilter
  grain.anisotropy=8
  const points=surface.geometry.attributes.position
  const uv=new Float32Array(points.count*2)
  for(let i=0;i<points.count;i++){
    uv[i*2]=points.getX(i)/3.1
    uv[i*2+1]=points.getZ(i)/3.1
  }
  surface.geometry.setAttribute('uv',new T.BufferAttribute(uv,2))
  const {material}=surface
  // The texture serves as a linear tint and height multiplier.
  material.map=material.bumpMap=grain
  material.bumpScale=.025
  material.roughness=.89
  material.color.multiplyScalar(1.16)
  material.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec2 trackPoint;\n'+shader.vertexShader.replace(
      '#include <begin_vertex>','#include <begin_vertex>\ntrackPoint=position.xz;')
    shader.fragmentShader='varying vec2 trackPoint;\n'+shader.fragmentShader.replace(
      '#include <color_fragment>',`#include <color_fragment>
        float roll=sin(trackPoint.y*.75+sin(trackPoint.x*.48+trackPoint.y*.19)*1.8);
        float shade=cos(trackPoint.x*.92-trackPoint.y*.39)*sin(trackPoint.y*1.17+trackPoint.x*.31);
        diffuseColor.rgb*=.997+roll*.036+shade*.025;
      `)
  }
}

export function matteSurface(material:T.MeshStandardMaterial,scale:number,amount:number){
  material.onBeforeCompile=shader=>{
    shader.uniforms.grainScale={value:scale}
    shader.uniforms.grainAmount={value:amount}
    shader.vertexShader='varying vec2 surfacePoint;\n'+shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nsurfacePoint=position.xz;')
    shader.fragmentShader='uniform float grainScale; uniform float grainAmount; varying vec2 surfacePoint;\n'+
      shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        vec2 grainPoint=surfacePoint*grainScale;
        float falloff=1.0-smoothstep(.22,.98,length(fwidth(grainPoint)));
        vec2 cell=floor(grainPoint);
        float noise=fract(sin(dot(cell,vec2(127.1,311.7)))*43758.5453);
        vec2 pebble=fract(grainPoint)-vec2(.36+.27*noise,.63-.25*noise);
        float grain=(1.0-smoothstep(.098,.29,length(pebble)))*(noise-.42);
        vec2 fines=floor(grainPoint*2.42+13.2);
        float fine=fract(sin(dot(fines,vec2(71.9,95.7)))*17471.7)-.5;
        float fineFalloff=1.0-smoothstep(.20,.84,length(fwidth(grainPoint*2.42)));
        float mottling=sin(surfacePoint.x*2.3+sin(surfacePoint.y*2.7))*sin(surfacePoint.y*1.6);
        diffuseColor.rgb*=1.0+grainAmount*(mottling*.18+grain*falloff*1.95+fine*.67*fineFalloff);
      `)
  }
}
