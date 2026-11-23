import * as T from 'three'
import {contactTexture} from './avatar.ts'
import {coursePoint} from './course.ts'
import {eventForce, raceBeats, type RaceEvent} from './playback.ts'
import type {Sport} from './model.ts'
import {paintedPanel,panelLettering,rollingWave} from './scenery.ts'

function block(group:T.Group,color:number,w:number,h:number,d:number,x:number,y:number,z:number){
  const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),new T.MeshStandardMaterial({color,roughness:.69}))
  mesh.position.set(x,y,z)
  group.add(mesh)
  return mesh
}

export function itemRaceProps(sport:Sport,events:RaceEvent[],gateZ:(distance:number)=>number) {
  const group=new T.Group()
  const gold=new T.MeshStandardMaterial({color:0xffcc47,emissive:0xff8a18,emissiveIntensity:.55,roughness:.34})
  const cyan=new T.MeshStandardMaterial({color:0x48f5db,emissive:0x13cfce,emissiveIntensity:.65,roughness:.34})
  const white=new T.MeshStandardMaterial({color:0xffffe8,emissive:0xffaf55,emissiveIntensity:.18})
  const orange=new T.MeshStandardMaterial({color:0xff6941,roughness:.59})
  const deep=new T.MeshStandardMaterial({color:0xb93848,roughness:.64})
  const add=(parent:T.Group,geometry:T.BufferGeometry,material:T.Material,x=0,y=0,z=0)=>{
    const mesh=new T.Mesh(geometry,material)
    mesh.position.set(x,y,z);parent.add(mesh)
    return mesh
  }
  const arrow=new T.Shape()
  arrow.moveTo(-.58,.25);arrow.lineTo(0,-.30);arrow.lineTo(.58,.25)
  arrow.lineTo(.31,.25);arrow.lineTo(0,-.04);arrow.lineTo(-.31,.25);arrow.closePath()
  const pointerShape=new T.ExtrudeGeometry(arrow,{depth:.10,bevelEnabled:false})
  const models=events.map(event=>{
    const marker=new T.Group(), effect=new T.Group(), signal=new T.Group()
    const lane=(event.lane%15-7)*1.4
    const boost=event.kind==='item'
    const glow=event.variant?gold:cyan
    const here=coursePoint(sport,event.gate,lane), ahead=coursePoint(sport,event.gate+.003,lane)
    const angle=-Math.atan2(ahead.x-here.x,ahead.z-here.z)
    const swell=!boost&&sport==='swimming'&&event.variant===1?rollingWave():undefined
    if(boost){
      if(sport==='swimming'){
        add(marker,new T.TorusGeometry(.69,.10,8,24),glow,0,.76)
        add(marker,new T.TorusGeometry(.80,.031,6,28),white,0,.76)
      }else{
        add(marker,new T.BoxGeometry(1.34,.07,1.85),deep,0,.036)
        add(marker,new T.BoxGeometry(1.26,.06,1.75),glow,0,.077)
      }
      for(const z of [-.42,.25]){
        for(const side of [-1,1]){
          const arrow=add(marker,new T.BoxGeometry(.49,.047,.11),white,side*.15,.136,z)
          arrow.rotation.y=side*.72
        }
      }
    }else if(swell){
      swell.mesh.scale.set(.112,.67,.67)
      marker.add(swell.mesh)
    }else if(sport==='swimming'){
      const tube=add(marker,new T.TorusGeometry(.58,.17,10,24),gold,0,.22)
      tube.rotation.x=-Math.PI/2
      add(marker,new T.SphereGeometry(.33,14,10),gold,-.48,.57,.10)
      add(marker,new T.SphereGeometry(.15,10,8),orange,-.70,.52,.22)
      add(marker,new T.SphereGeometry(.065,8,6),deep,-.54,.65,.37)
    }else if(sport==='cycling'&&!event.variant){
      add(marker,new T.BoxGeometry(.66,.09,.66),deep,0,.045)
      add(marker,new T.CylinderGeometry(.061,.29,.80,12),orange,0,.48)
      add(marker,new T.CylinderGeometry(.127,.165,.13,12),white,0,.55)
    }else if(sport==='running'&&!event.variant){
      add(marker,new T.SphereGeometry(.51,16,10),orange,0,.51)
      add(marker,new T.TorusGeometry(.509,.041,7,24),white,0,.51)
    }else{
      for(const x of [-.50,.50]){
        add(marker,new T.BoxGeometry(.13,.59,.14),deep,x,.34)
        add(marker,new T.BoxGeometry(.20,.09,.47),deep,x,.045)
      }
      add(marker,new T.BoxGeometry(1.25,.24,.17),orange,0,.61)
      for(const x of [-.40,0,.40])add(marker,new T.BoxGeometry(.13,.20,.177),white,x,.61).rotation.z=-.34
    }
    for(const side of [-1,0,1]){
      const streak=add(effect,new T.BoxGeometry(.055,.055,.88),boost?glow:orange,side*.37,0,.76+Math.abs(side)*.29)
      streak.rotation.y=boost?side*.13:side*.68
    }
    const outline=add(signal,pointerShape,deep,0,0,-.025)
    outline.scale.set(1.15,1.22,1)
    add(signal,pointerShape,boost?glow:orange,0,0,.033)
    group.add(marker,effect,signal)
    marker.visible=effect.visible=signal.visible=false
    return {event,marker,effect,signal,here,angle,boost,swell}
  })
  return {group,update(t:number,time:number,poses:Map<string,{x:number;y:number;z:number;yaw:number}>){
    for(const {event,marker,effect,signal,here,angle,boost,swell} of models){
      const age=t-event.at
      const entry=T.MathUtils.smoothstep(t,event.appears,event.appears+.013)
      const departure=1-T.MathUtils.smoothstep(age,0,boost?.013:.032)
      marker.visible=entry>0&&departure>0
      if(marker.visible){
        marker.position.set(here.x,here.y+(sport==='swimming'?Math.sin(time*6)*.055:0),gateZ(event.gate))
        const shift=event.variant===0&&sport!=='cycling'&&!boost?Math.max(0,1-entry)*1.34:0
        marker.position.x+=shift
        marker.rotation.set(boost?0:(1-departure)*.88,angle,(1-departure)*.42)
        marker.scale.setScalar(.36+.64*entry*departure)
        if(swell)swell.update(time,.14+.86*entry*departure)
      }
      const pose=poses.get(event.runnerId), force=Math.abs(eventForce(event,t))
      effect.visible=force>.025&&pose!==undefined
      if(effect.visible&&pose){
        effect.position.set(pose.x,pose.y-(sport==='swimming'?.12:.62),pose.z)
        effect.rotation.y=pose.yaw
        effect.scale.set(1,1,.5+force*(boost?5:1.7))
      }
      signal.visible=effect.visible||(marker.visible&&age<0)
      if(signal.visible){
        if(effect.visible&&pose){
          signal.position.set(pose.x,pose.y+1.58+Math.sin(time*8)*.10,pose.z)
          signal.scale.setScalar(.82+force*.46)
        }else{
          signal.position.set(marker.position.x,marker.position.y+1.37+Math.sin(time*8)*.10,marker.position.z)
          signal.scale.setScalar(.6+.32*entry)
        }
      }
    }
  }}
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
