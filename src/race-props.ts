import * as T from 'three'
import {contactTexture} from './avatar.ts'
import {coursePoint} from './course.ts'
import {raceBeats} from './playback.ts'
import {paintedPanel,panelLettering} from './scenery.ts'

function block(group:T.Group,color:number,w:number,h:number,d:number,x:number,y:number,z:number){
  const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),new T.MeshStandardMaterial({color,roughness:.69}))
  mesh.position.set(x,y,z)
  group.add(mesh)
  return mesh
}

export function cyclingProps(){
  const group=new T.Group()
  const [slalom,,descent]=raceBeats.cycling
  const cone=new T.CylinderGeometry(.065,.36,.87,12)
  const stripe=new T.CylinderGeometry(.173,.228,.15,12)
  const orange=new T.MeshStandardMaterial({color:0xff783f,roughness:.66})
  const reflective=new T.MeshStandardMaterial({color:0xfff5d9,roughness:.42})
  for(const [index,offset] of [-.039,-.022,-.005,.012,.029,.046].entries()){
    const point=coursePoint('cycling',slalom.gate+offset,index%2===0?-1.30:1.30)
    const footing=block(group,0x3a3a4e,.79,.105,.75,point.x,point.y+.06,point.z)
    const top=new T.Mesh(cone,orange), band=new T.Mesh(stripe,reflective)
    top.position.y=.49
    band.position.y=.57
    footing.add(top,band)
  }
  for(const side of [-1,1]){
    const edge=coursePoint('cycling',slalom.gate-.022,side*8.38)
    block(group,0x654855,.34,.16,.95,edge.x,edge.y+.08,edge.z)
    block(group,0xe38950,.13,1.03,.19,edge.x,edge.y+.55,edge.z)
    const sign=paintedPanel(1.42,.74,ctx=>{
      const {width,height}=ctx.canvas
      ctx.fillStyle='#211f31';ctx.fillRect(0,0,width,height)
      ctx.fillStyle='#ffc85a';ctx.fillRect(18,18,width-36,height-36)
      panelLettering(ctx,side<0?'↘':'↙','#342a33',height*.74,height*.50)
    })
    sign.position.set(edge.x,edge.y+1.19,edge.z+.105)
    sign.material.side=T.DoubleSide
    group.add(sign)
  }
  const wind=new T.Group()
  wind.visible=false
  group.add(wind)
  const ribbons:T.Mesh<T.PlaneGeometry,T.MeshBasicMaterial>[]=[]
  for(const side of [-1,1])for(let i=0;i<3;i++){
    const point=coursePoint('cycling',descent.gate+(i-1)*.033,side*10.75)
    block(group,0x59667e,.09,2.25,.09,point.x,point.y+1.13,point.z)
    const cloth=new T.Mesh(new T.PlaneGeometry(1.85,.37,8),new T.MeshBasicMaterial({
      color:i%2?0xffdc87:0x9eeed9,side:T.DoubleSide,
    }))
    cloth.position.set(point.x,point.y+2.03,point.z)
    cloth.rotation.y=-Math.PI/2+side*.38
    wind.add(cloth)
    ribbons.push(cloth)
  }
  const gusts=new T.InstancedMesh(new T.BoxGeometry(),
    new T.MeshBasicMaterial({color:0xc8faef,transparent:true,opacity:.61,depthWrite:false}),18)
  gusts.instanceMatrix.setUsage(T.DynamicDrawUsage)
  gusts.frustumCulled=false
  wind.add(gusts)
  const pose=new T.Object3D()
  return {group,update(time:number,active:boolean){
    wind.visible=active
    if(!active)return
    ribbons.forEach((cloth,index)=>{
      const vertices=cloth.geometry.attributes.position
      for(let i=0;i<vertices.count;i++){
        const along=vertices.getX(i)+.925
        vertices.setZ(i,Math.sin(along*6-time*12+index)*along*.21)
      }
      vertices.needsUpdate=true
    })
    for(let i=0;i<gusts.count;i++){
      const phase=(time*.94+i*.173)%1
      const side=i%2?1:-1
      const point=coursePoint('cycling',descent.gate-.04+phase*.115,side*(4.7+i%4*1.5))
      pose.position.set(point.x,point.y+.42+i%3*.48,point.z)
      pose.rotation.set(.13,side*-.18,0)
      pose.scale.set(.028,.028,1.88*Math.sin(phase*Math.PI))
      pose.updateMatrix()
      gusts.setMatrixAt(i,pose.matrix)
    }
    gusts.instanceMatrix.needsUpdate=true
  }}
}

export const runningBallLane=(progress:number,at:number)=>11-22*T.MathUtils.smoothstep(progress,at-.044,at+.092)
export const runningBallDistance=raceBeats.running[0].gate+.025

export function runningProps(){
  const sprint=raceBeats.running[2]
  const group=new T.Group()
  const ballGroup=new T.Group()
  ballGroup.visible=false
  group.add(ballGroup)
  const canvas=document.createElement('canvas')
  canvas.width=512;canvas.height=256
  const ctx=canvas.getContext('2d')!
  const bands=['#f48a83','#fff1bf','#9f79cf','#81d7c8','#f48a83','#fff1bf','#9f79cf','#81d7c8']
  bands.forEach((color,i)=>{
    ctx.fillStyle=color
    ctx.fillRect(i*64,0,64,256)
    ctx.fillStyle='#fff7df'
    ctx.fillRect(i*64,0,3,256)
  })
  ctx.fillStyle='#fff0ca'
  ctx.fillRect(0,118,512,19)
  ctx.fillStyle='#efb266'
  ctx.fillRect(0,125,512,4)
  const map=new T.CanvasTexture(canvas)
  map.colorSpace=T.SRGBColorSpace
  const radius=1.62
  const ball=new T.Mesh(new T.SphereGeometry(radius,28,18),new T.MeshStandardMaterial({map,roughness:.41}))
  const shadow=new T.Mesh(new T.PlaneGeometry(3.95,3.3).rotateX(-Math.PI/2),
    new T.MeshBasicMaterial({map:contactTexture(),transparent:true,opacity:.91,depthWrite:false}))
  shadow.position.set(.20,.019,-.14)
  ballGroup.add(ball,shadow)

  const lightCount=16
  const lights=new T.InstancedMesh(new T.BoxGeometry(.25,.032,.55),
    new T.MeshBasicMaterial({toneMapped:false}),lightCount*2)
  const pose=new T.Object3D()
  const tint=new T.Color(), idle=new T.Color(0x846766), lit=new T.Color(0xe6fff0)
  for(let i=0;i<lights.count;i++){
    const point=coursePoint('running',sprint.gate-.038+(i%lightCount)*.0056,i<lightCount?-3.21:3.21)
    pose.position.set(point.x,.025,point.z)
    pose.updateMatrix()
    lights.setMatrixAt(i,pose.matrix)
    lights.setColorAt(i,idle)
  }
  lights.instanceColor!.setUsage(T.DynamicDrawUsage)
  group.add(lights)
  let wasLit=false
  return {group,update(t:number,time:number,ballLane:number|undefined,sprinting:boolean){
    ballGroup.visible=ballLane!==undefined
    if(ballLane!==undefined){
      const point=coursePoint('running',runningBallDistance,ballLane)
      ballGroup.position.set(point.x,point.y,point.z)
      ball.position.y=radius+.08*Math.abs(Math.sin(time*7))
      ball.rotation.set(.25,0,(11-ballLane)/radius)
    }
    if(sprinting||wasLit){
      for(let i=0;i<lights.count;i++){
        const phase=(t-sprint.gate+.085)*37-(i%lightCount)*.18
        const pulse=sprinting?T.MathUtils.smoothstep(phase,-.5,.2)*(.72+.28*Math.cos(phase*6)**2):0
        lights.setColorAt(i,tint.copy(idle).lerp(lit,pulse))
      }
      lights.instanceColor!.needsUpdate=true
    }
    wasLit=sprinting
  }}
}
