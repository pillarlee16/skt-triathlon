import * as T from 'three'
import {armShape,bodyShape,contactTexture,faceBindingShape,faceSurface,faceTexture,helmetShape,helmetTexture,nameBibs,outfitTexture,shoeShape,swimGoggleShape,uniformPipingShape} from './avatar.ts'
import type {Sport,Person} from './model.ts'
import {eventForce,finishShotAt,position,raceBeats,raceEvents,type Beat,type RaceEvent,type Runner} from './playback.ts'
import {buildCourse,courseColors,coursePoint,world} from './course.ts'
import {paintedPanel,panelLettering,podiumEnvironment,poolItems,rollingWave,speedBump,speedBumpHeight,skyGradient,swimmingWake} from './scenery.ts'
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js'
import type {AvatarStyle} from './avatar-style.ts'
import {styledSurface} from './avatar-material.ts'
import {buildCostumeBatches} from './avatar-costumes.ts'
import {cyclingProps,itemRaceProps,runningBallDistance,runningBallLane,runningProps} from './race-props.ts'

const tireRadius=.37
const axleOffset=.64
const launchDepth=42
const launchMerge=.09
const launchEnd=.21
const launchSpacing=1.28
const launchZ=(distance:number)=>-world*distance+launchDepth*Math.max(0,1-distance/launchEnd)
const lighting={
  swimming:{sky:0xebf7ff,ground:0x87b8ca,fill:1.18,sun:0xfff2df,key:3.4,keyX:-11,rim:0xc3edff,edge:.83,exposure:1.10},
  cycling:{sky:0xe9f2ff,ground:0xb6adc8,fill:1.27,sun:0xffeedc,key:3.35,keyX:12,rim:0xddeaff,edge:.87,exposure:1.12},
  running:{sky:0xfff4ee,ground:0xd8aab3,fill:1.24,sun:0xfff0dc,key:3.24,keyX:9,rim:0xffe8cf,edge:.86,exposure:1.10},
  podium:{sky:0xfff8ed,ground:0xd4a7ad,fill:1.23,sun:0xfff1dc,key:3.24,keyX:-10,rim:0xd2e9ff,edge:1.0,exposure:1.13},
}
export function createTrack(host:HTMLElement) {
  const renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'})
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5))
  renderer.outputColorSpace=T.SRGBColorSpace
  renderer.toneMapping=T.NeutralToneMapping
  host.append(renderer.domElement)
  const scene=new T.Scene()
  const skies=new Map<keyof typeof courseColors,T.Texture>()
  const camera=new T.PerspectiveCamera(43,1,.1,250)
  const course=new T.Group(), players=new T.Group()
  const ambient=new T.HemisphereLight()
  const sun=new T.DirectionalLight()
  const shadowOffset=new T.Vector3()
  const rim=new T.DirectionalLight()
  rim.position.set(-6,7,-11)
  scene.add(course,players,ambient,sun,rim)
  const stageFill=new T.DirectionalLight(0xfff4df,.67)
  stageFill.position.set(5,7,-world+12)
  stageFill.target.position.set(0,.7,-world+4)
  scene.add(stageFill,stageFill.target)
  const matrix=new T.Object3D()
  const body=[[0,0,0],[.43,.02,0],[-.43,.02,0],[.16,-.41,0],[-.16,-.41,0],[0,-.64,-.46],[0,-.64,.48],[0,-.43,0],[0,-.31,-.5],[0,-.37,.38],[0,-.64,-.46],[0,-.64,.48],[.16,-.64,0],[-.16,-.64,0]]
  let runners:Runner[]=[]
  let faces:T.Mesh[]=[]
  let helmets:T.InstancedMesh, headShell:T.InstancedMesh, shadows:T.InstancedMesh
  let castShadows:T.InstancedMesh|undefined
  let stageReflection:T.WebGLRenderTarget|undefined
  let rimBase=0
  let faceBinding:T.InstancedMesh, uniformPiping:T.InstancedMesh
  let headBands:T.InstancedMesh|undefined, goggles:T.InstancedMesh|undefined
  let wristbands:T.InstancedMesh
  let visors:T.InstancedMesh|undefined
  let styles:AvatarStyle[]=[]
  let costumes:ReturnType<typeof buildCostumeBatches>
  const gearOffset=new T.Vector3()
  let parts:(T.InstancedMesh|undefined)[]=[]
  let arms:T.InstancedMesh, bibs:T.InstancedMesh
  const torso=new T.Matrix4()
  const up=new T.Vector3(0,1,0), down=new T.Vector3(0,-1,0), pitch=new T.Vector3(1,0,0), roll=new T.Vector3(0,0,1)
  const shoulder=new T.Vector3(), hand=new T.Vector3(), direction=new T.Vector3()
  const gripY=-.16, gripZ=-.38
  let hurdles:{base:T.Group;pad:T.Mesh;distance:number;kick:number}[]=[]
  let cycleProps:ReturnType<typeof cyclingProps>|undefined
  let stadiumProps:ReturnType<typeof runningProps>|undefined
  let dynamicProps:ReturnType<typeof itemRaceProps>|undefined
  const eventPoses=new Map<string,{x:number;y:number;z:number;yaw:number;distance:number}>()
  let bumpProfile:{x:number;z:number;sin:number;cos:number}|undefined
  let wave:ReturnType<typeof rollingWave>|undefined
  let swimmerWakes:T.InstancedMesh|undefined
  let swimItems:ReturnType<typeof poolItems>|undefined
  let itemRipples:T.InstancedMesh|undefined
  let rankPanels:T.Mesh[]=[]
  let effects:T.InstancedMesh
  let animateCourse:(time:number,sprinting:boolean)=>void=()=>{}
  let previousFrame=0, frameAverage=16, dpr=Math.min(devicePixelRatio,1.5)
  const target=new T.Vector3()
  let sport:Sport='running'
  let cameraReady=false, cameraPodium=false
  let launchWidth=0
  let generation=0
  const goal=new T.Vector3(), look=new T.Vector3(), photoGoal=new T.Vector3(), photoTarget=new T.Vector3()
  function dispose(group:T.Group) {
    const geometry=new Set<T.BufferGeometry>()
    const materials=new Set<T.Material>()
    group.traverse(o=>{
      if(o instanceof T.InstancedMesh)o.dispose()
      if(o instanceof T.Mesh || o instanceof T.Line)geometry.add(o.geometry)
      if(o instanceof T.Mesh || o instanceof T.Line || o instanceof T.Sprite)materials.add(o.material)
    })
    geometry.forEach(item=>item.dispose())
    const textures=new Set<T.Texture>()
    materials.forEach(material=>{
      const map=(material as T.MeshStandardMaterial).map
      if(map)textures.add(map)
      material.dispose()
    })
    textures.forEach(texture=>texture.dispose())
    group.clear()
  }
  function box(w:number,h:number,d:number,x:number,y:number,z:number,color:number) {
    const mesh=new T.Mesh(new RoundedBoxGeometry(w,h,d,2,.14),new T.MeshStandardMaterial({color,roughness:.82}))
    mesh.position.set(x,y,z);course.add(mesh);return mesh
  }
  function poseArms(index:number,kind:Sport,x:number,y:number,z:number,yaw:number,phase:number,
    moving:boolean,podium:boolean,starter:boolean,visible:boolean,time:number,rank:number,bikePitch:number){
    const cycling=kind==='cycling'&&!podium
    const swim=kind==='swimming'&&!podium
    for(let arm=0;arm<2;arm++){
      const side=arm===0?1:-1
      const slot=index*2+arm
      shoulder.set(side*(cycling?.344:.319),.195,cycling?-.096:0).applyMatrix4(torso)
      if(cycling){
        hand.set(side*.217,gripY,gripZ).applyAxisAngle(pitch,bikePitch).applyAxisAngle(up,yaw).add(gearOffset.set(x,y,z))
      }else if(podium&&rank!==1){
        const wave=(rank===2?.21:.06)*Math.sin(time*8+arm*.7)
        hand.set(side*.47,rank===0?.36:.33,-.19).applyAxisAngle(roll,side*wave)
          .applyAxisAngle(up,yaw).add(shoulder)
      }else if(podium&&arm===0){
        hand.set(side*(.39+.064*Math.sin(time*6)),.285,-.16).applyAxisAngle(up,yaw).add(shoulder)
      }else if(arm===0&&starter){
        hand.set(side*(.33+.05*Math.sin(time*6)),.27,-.15).applyAxisAngle(up,yaw).add(shoulder)
      }else{
        const cycle=phase+arm*Math.PI
        const swing=moving?(swim?cycle:Math.sin(cycle)*.89):0
        hand.set(side*(swim?.16:.13),swim?-.46:-.39,-.025).applyAxisAngle(pitch,swing)
          .applyAxisAngle(up,yaw).add(shoulder)
      }
      const length=direction.subVectors(hand,shoulder).length()
      matrix.position.copy(shoulder)
      matrix.quaternion.setFromUnitVectors(down,direction.divideScalar(length))
      matrix.scale.set(visible?1:0,visible?length:0,visible?1:0)
      matrix.updateMatrix();arms.setMatrixAt(slot,matrix.matrix)
      matrix.position.lerp(hand,.69)
      matrix.scale.setScalar(visible&&arm===0&&styles[index].wrist?1:0)
      matrix.updateMatrix();wristbands.setMatrixAt(slot,matrix.matrix)
    }
  }

  const platform=.30
  const podiumX=[0,-3.7,3.7]
  const podiumHeight=[1.15,.82,.56]
  function setup(kind:Sport,roster:Runner[],photo:(person:Person)=>HTMLImageElement|undefined,
    appearance:(person:Person)=>AvatarStyle,podium=false,art?:HTMLImageElement) {
    if(kind!==sport||podium!==cameraPodium)cameraReady=false
    cameraPodium=podium
    generation++; sport=kind;runners=roster
    styles=roster.map(({person})=>appearance(person))
    dispose(course);dispose(players);hurdles=[];rankPanels=[];wave=undefined;swimmerWakes=undefined;swimItems=undefined;itemRipples=undefined;bumpProfile=undefined
    dynamicProps=undefined;eventPoses.clear()
    cycleProps=undefined;stadiumProps=undefined
    const swim=!podium&&sport==='swimming',bike=!podium&&sport==='cycling'
    const setting=podium?'podium':sport
    const palette=courseColors[setting]
    const light=lighting[setting]
    ambient.color.setHex(light.sky)
    ambient.groundColor.setHex(light.ground)
    ambient.intensity=light.fill
    sun.color.setHex(light.sun)
    sun.intensity=light.key
    sun.position.set(light.keyX,18,8)
    shadowOffset.copy(sun.position).multiplyScalar(-1/sun.position.y)
    rim.color.setHex(light.rim)
    rim.intensity=rimBase=light.edge
    renderer.toneMappingExposure=light.exposure
    let sky=skies.get(setting)
    if(!sky){
      sky=skyGradient(palette.sky,palette.horizon)
      skies.set(setting,sky)
    }
    scene.background=sky
    scene.fog=new T.Fog(palette.horizon,62,168)
    stageFill.visible=podium
    animateCourse=buildCourse(course,sport,podium,sun.position,art)
    launchWidth=podium?0:Math.max(24,(roster.length-1)*launchSpacing+3)
    if(!podium){
      const apron=new T.Shape()
      apron.moveTo(-launchWidth/2,launchDepth+2)
      apron.lineTo(launchWidth/2,launchDepth+2)
      for(const side of [1,-1]){
        for(let step=0;step<=12;step++){
          const distance=launchMerge*(side===1?step:12-step)/12
          const halfWidth=T.MathUtils.lerp(launchWidth/2,11.7,T.MathUtils.smoothstep(distance,0,launchMerge))
          apron.lineTo(side*halfWidth,launchZ(distance))
        }
        if(side===1){
          apron.lineTo(11.7,0)
          apron.lineTo(-11.7,0)
        }
      }
      const surface=new T.Mesh(new T.ShapeGeometry(apron),new T.MeshStandardMaterial({color:palette.road,roughness:.72,side:T.DoubleSide}))
      surface.rotation.x=Math.PI/2
      surface.position.y=.023
      course.add(surface)
      box(launchWidth+3,.24,12,0,-.12,launchDepth+6,palette.ground)
      box(launchWidth+2,.48,.32,0,.24,launchDepth+10,palette.accent)
      const line=paintedPanel(launchWidth,.85,ctx=>{
        const cells=Math.ceil(launchWidth/.55)
        for(let i=0;i<cells;i++)for(let row=0;row<2;row++){
          ctx.fillStyle=(i+row)%2?'#fff8df':'#33435c'
          ctx.fillRect(Math.floor(i*ctx.canvas.width/cells),row*ctx.canvas.height/2,
            Math.ceil(ctx.canvas.width/cells)+1,ctx.canvas.height/2)
        }
      })
      line.rotation.x=-Math.PI/2
      line.position.set(0,.044,launchDepth)
      course.add(line)
      const guides:number[]=[]
      for(let division=-4;division<=4;division++){
        for(let step=0;step<12;step++){
          for(const part of [step/12,(step+.58)/12]){
            const distance=launchMerge*part
            const width=T.MathUtils.lerp(launchWidth-2,21,T.MathUtils.smoothstep(distance,0,launchMerge))
            guides.push(width*division/10,.048,launchZ(distance)-.5)
          }
        }
      }
      course.add(new T.LineSegments(
        new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(guides,3)),
        new T.LineBasicMaterial({color:palette.line,transparent:true,opacity:.45})
      ))
    }
    const events=podium?[]:raceEvents(runners)
    if(swim){
      const wakePaint=new T.MeshBasicMaterial({color:0xd7faf6,transparent:true,opacity:.46,depthWrite:false,side:T.DoubleSide})
      swimmerWakes=new T.InstancedMesh(swimmingWake(),wakePaint,runners.length*2)
      swimmerWakes.frustumCulled=false;swimmerWakes.instanceMatrix.setUsage(T.DynamicDrawUsage)
      course.add(swimmerWakes)
    }
    if(events.length){
      dynamicProps=itemRaceProps(sport,events,launchZ)
      course.add(dynamicProps.group)
      for(const event of events)eventPoses.set(event.runnerId,{x:0,y:0,z:0,yaw:0,distance:0})
    }else if(swim){
      wave=rollingWave();wave.mesh.visible=false;course.add(wave.mesh)
      swimItems=poolItems()
      for(const item of swimItems){item.visible=false;course.add(item)}
      itemRipples=new T.InstancedMesh(new T.RingGeometry(.83,1,24,1,.22,Math.PI*1.57).rotateX(-Math.PI/2),
        new T.MeshBasicMaterial({color:0xdafbfb,transparent:true,opacity:.53,depthWrite:false}),4)
      itemRipples.visible=false;itemRipples.frustumCulled=false
      itemRipples.instanceMatrix.setUsage(T.DynamicDrawUsage);course.add(itemRipples)
    }else if(bike){
      cycleProps=cyclingProps();course.add(cycleProps.group)
      const gate=raceBeats[sport][1].gate
      const point=coursePoint(sport,gate), next=coursePoint(sport,gate+.002)
      const bump=speedBump()
      bump.position.set(point.x,point.y+.004,point.z)
      bump.rotation.y=-Math.atan2(next.x-point.x,point.z-next.z)
      bumpProfile={x:point.x,z:point.z,sin:Math.sin(bump.rotation.y),cos:Math.cos(bump.rotation.y)}
      course.add(bump)
    }else if(!podium) {
      stadiumProps=runningProps();course.add(stadiumProps.group)
      const gate=raceBeats.running[1].gate
      const shadeGeometry=new T.PlaneGeometry(1.55,.99).rotateX(-Math.PI/2)
      const shadeMaterial=new T.MeshBasicMaterial({map:contactTexture(),transparent:true,depthWrite:false,opacity:.66})
      for(let i=0;i<15;i++){
        const distance=gate+(i%2?.014:-.014)
        const point=coursePoint('running',distance,(i-7)*1.4)
        const base=new T.Group()
        base.position.set(point.x,point.y,point.z)
        base.visible=false;course.add(base)
        const pad=box(1.14,.25,.31,0,.57,0,i%2?0xeaa37a:0xf2b169)
        base.add(pad)
        for(const side of [-1,1]){
          pad.add(box(.045,.237,.302,side*.56,0,0,0xd98572))
          pad.add(box(.041,.255,.315,side*.42,0,0,0xf6cc89))
          for(const dz of [-.102,0,.102])pad.add(box(.067,.013,.024,side*.42,.127,dz,0xffe6b4))
        }
        for(const side of [-1,1]){
          base.add(box(.13,.53,.16,side*.45,.32,0,0x6d537f))
          base.add(box(.22,.10,.62,side*.45,.055,.05,0x625c75))
          for(const dz of [-.21,.30])base.add(box(.23,.08,.093,side*.45,.047,dz,0x887596))
        }
        const shade=new T.Mesh(shadeGeometry,shadeMaterial)
        shade.position.set(.08,.02,-.09);base.add(shade)
        hurdles.push({base,pad,distance,kick:0})
      }
    }
    effects=new T.InstancedMesh(new T.SphereGeometry(.18,7,5),
      new T.MeshBasicMaterial({color:swim?0xe6ffff:0xffdf9f}),48)
    effects.frustumCulled=false;course.add(effects)
    const podiumShadowGeometry=podium?new T.PlaneGeometry(4.25,2.86).rotateX(-Math.PI/2):undefined
    const podiumShadowMaterial=podium?new T.MeshBasicMaterial({
      map:contactTexture(),transparent:true,opacity:.84,depthWrite:false,toneMapped:false,
    }):undefined
    if(podium)stageReflection??=podiumEnvironment(renderer)
    if(podiumShadowGeometry&&podiumShadowMaterial)podiumX.forEach((x,i)=>{
      const height=podiumHeight[i], y=platform+height/2
      const z=-world+4
      const trim=[0xffdc80,0xdce6f4,0xf0b795][i]
      const footShadow=new T.Mesh(podiumShadowGeometry,podiumShadowMaterial)
      footShadow.position.set(x+shadowOffset.x*.41,platform+.008,z+shadowOffset.z*.41)
      course.add(footShadow)
      const shell=box(3.25,height,2,x,y,z,[0xc69436,0x909dae,0xb46e4d][i])
      shell.material.roughness=[.30,.42,.35][i]
      shell.material.metalness=[.58,.65,.52][i]
      shell.material.envMap=stageReflection!.texture
      shell.material.envMapIntensity=1.44
      shell.material.onBeforeCompile=shader=>{
        shader.uniforms.podiumHalfHeight={value:height/2}
        shader.vertexShader='varying vec3 podiumPoint;\n'+shader.vertexShader.replace('#include <begin_vertex>',
          '#include <begin_vertex>\npodiumPoint=position;')
        shader.fragmentShader='uniform float podiumHalfHeight; varying vec3 podiumPoint;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
          float grain=sin(podiumPoint.y*355.0)*.024*(1.0-smoothstep(.002,.010,fwidth(podiumPoint.y)));
          float lightBand=(podiumPoint.y-podiumPoint.x*.035-.18)*4.8;
          float reflection=exp(-lightBand*lightBand);
          float broadLight=1.0-smoothstep(.2,1.72,abs(podiumPoint.x+.33));
          diffuseColor.rgb*=.94+grain+.12*sin(podiumPoint.y*5.2)+reflection*.28;
          diffuseColor.rgb=mix(diffuseColor.rgb,vec3(1.0,.90,.72),reflection*broadLight*.15);
        `).replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
          float bevel=pow(smoothstep(1.34,1.64,abs(podiumPoint.x)),2.0);
          float railDistance=(abs(podiumPoint.y)-podiumHalfHeight+.107)*30.0;
          float postDistance=(abs(podiumPoint.x)-1.51)*30.0;
          float trimLight=exp(-railDistance*railDistance)*(.28+reflection*.48)
            +exp(-postDistance*postDistance)*(.21+broadLight*.16);
          vec3 edgeTint=mix(diffuseColor.rgb,vec3(.99,.95,.88),.56);
          totalEmissiveRadiance+=diffuseColor.rgb*(reflection*broadLight*.13+bevel*.13)+edgeTint*trimLight*.42;
        `)
      }
      for(const edge of [platform+.061,platform+height-.069]){
        const lip=box(3.28,.076,2.05,x,edge,z,trim)
        lip.material.roughness=.25
        lip.material.metalness=.44
        lip.material.envMap=stageReflection!.texture
        lip.material.envMapIntensity=1.18
        lip.material.emissive.setHex(trim)
        lip.material.emissiveIntensity=.095
      }
      const top=box(3.07,.045,1.82,x,platform+height-.017,z,[0xe7ba63,0xb5bfcc,0xc88a6b][i])
      top.material.roughness=.48
      const badge=paintedPanel(1.62,height*.73,ctx=>{
        const {width,height}=ctx.canvas
        ctx.fillStyle=['#563409','#34455d','#572d26'][i]
        ctx.roundRect(0,0,width,height,48);ctx.fill()
        ctx.strokeStyle=['#dca958','#a5b3c4','#d6a580'][i];ctx.lineWidth=6
        ctx.beginPath();ctx.roundRect(8,8,width-16,height-16,39);ctx.stroke()
        for(const px of [width*.09,width*.91])for(const py of [height*.16,height*.84]){
          ctx.fillStyle='#edc794';ctx.beginPath();ctx.arc(px,py,Math.max(4,height*.035),0,Math.PI*2);ctx.fill()
        }
        panelLettering(ctx,(i+1)+'위','#fff5de',Math.min(width*.31,height*.79),height*.52)
      })
      badge.position.set(x,y-.021,z+1.028);badge.visible=false
      badge.add(box(1.70,height*.78,.064,0,0,-.035,trim))
      if(i===0){
        const leaves=new T.InstancedMesh(new T.SphereGeometry(1,9,6),
          new T.MeshStandardMaterial({color:0xe6b44c,roughness:.4,metalness:.18}),12)
        let leafIndex=0
        for(const side of [-1,1])for(let step=0;step<6;step++){
          const row=Math.floor(step/2)
          matrix.position.set(side*(.98+row*.105+(step%2)*.11),-.27+row*.18+(step%2)*.062,-.004)
          matrix.rotation.set(0,0,-side*(step%2?.38:.95))
          matrix.scale.set(.065,.139,.035)
          matrix.updateMatrix();leaves.setMatrixAt(leafIndex++,matrix.matrix)
        }
        badge.add(leaves)
      }
      course.add(badge);rankPanels.push(badge)
    })
    costumes=buildCostumeBatches(players,styles,kind)
    const specs:[[number,number,number],boolean][]=[[[.9,.91,.66],false],[[.23,.55,.24],false],[[.23,.55,.24],false],[[.27,.52,.29],false],[[.27,.52,.29],false]]
    if(bike)specs.push([[.26,.035,.22],true],[[.26,.035,.22],true],[[.15,.2,1.05],false],[[.47,.22,.15],false],[[.30,.16,.24],false],
      [[.055,.55,.055],false],[[.055,.55,.055],false],[[.20,.055,.15],false],[[.20,.055,.15],false])
    parts=specs.map(([size,wheel],partIndex)=>{
      if(partIndex===1||partIndex===2)return
      const geometry=partIndex===0?bodyShape():partIndex<5?shoeShape(kind):wheel?new T.TorusGeometry(.3,.07,6,12):new RoundedBoxGeometry(...size,1,.15)
      const cloth=partIndex===0
      const material=cloth?styledSurface(geometry,styles,outfitTexture(kind),'uniform',.81):
        new T.MeshStandardMaterial({roughness:.63,vertexColors:partIndex<5})
      const part=new T.InstancedMesh(geometry,material,runners.length)
      part.frustumCulled=false;part.instanceMatrix.setUsage(T.DynamicDrawUsage);players.add(part);return part
    })
    styles.forEach(({primary,accent},i)=>parts.forEach((part,j)=>part?.setColorAt(i,
      j===3||j===4?new T.Color('#fff7ec').lerp(new T.Color(accent),.76):
        new T.Color(j===0?primary:j===7?accent:j===10||j===11?'#fff2ce':'#42466d'))))
    arms=new T.InstancedMesh(armShape(),new T.MeshStandardMaterial({roughness:.72}),runners.length*2)
    arms.frustumCulled=false;arms.instanceMatrix.setUsage(T.DynamicDrawUsage);players.add(arms)
    wristbands=new T.InstancedMesh(new T.CylinderGeometry(.112,.112,.046,14),new T.MeshStandardMaterial({roughness:.55}),runners.length*2)
    wristbands.frustumCulled=false;wristbands.instanceMatrix.setUsage(T.DynamicDrawUsage);players.add(wristbands)
    bibs=nameBibs(runners.map(r=>r.person.name))
    bibs.frustumCulled=false;bibs.instanceMatrix.setUsage(T.DynamicDrawUsage);players.add(bibs)
    const faceGeometry=faceSurface()
    const gen=generation
    faces=runners.map(r=>{
      const mesh=new T.Mesh(faceGeometry,new T.MeshBasicMaterial({
        map:faceTexture(photo(r.person),()=>gen===generation),alphaTest:.4,toneMapped:false
      }))
      players.add(mesh)
      return mesh
    })
    headShell=new T.InstancedMesh(new T.SphereGeometry(.605,22,16),new T.MeshStandardMaterial({roughness:.63}),runners.length)
    faceBinding=new T.InstancedMesh(faceBindingShape(kind),new T.MeshStandardMaterial({roughness:.57}),runners.length)
    uniformPiping=new T.InstancedMesh(uniformPipingShape(kind),new T.MeshStandardMaterial({roughness:.67}),runners.length)
    const crown=helmetShape(kind)
    helmets=new T.InstancedMesh(crown,styledSurface(crown,styles,helmetTexture(kind),
      kind==='swimming'?'swimCap':'helmet',kind==='cycling'?.29:kind==='swimming'?.43:.72),runners.length)
    if(kind==='running'){
      const band=new T.SphereGeometry(.636,20,5,0,Math.PI*2,.51,.164)
      headBands=new T.InstancedMesh(band,styledSurface(band,styles,helmetTexture(kind),'headband',.77),runners.length)
      const brim=new T.SphereGeometry(1,16,8).scale(.345,.034,.238).translate(0,.527,-.356)
      visors=new T.InstancedMesh(brim,new T.MeshStandardMaterial({roughness:.67}),runners.length)
    }else{
      headBands=swim?new T.InstancedMesh(new T.SphereGeometry(.658,20,4,0,Math.PI*2,.645,.06),
        new T.MeshStandardMaterial({roughness:.64}),runners.length):undefined
      visors=undefined
    }
    goggles=kind==='swimming'?new T.InstancedMesh(
      swimGoggleShape(),
      new T.MeshStandardMaterial({vertexColors:true,metalness:.18,roughness:.32}),runners.length*2):undefined
    const contact=contactTexture()
    const shadowMaterial=(opacity:number)=>new T.MeshBasicMaterial({
      map:contact,transparent:true,depthWrite:false,toneMapped:false,opacity,
    })
    const shadowPlane=new T.PlaneGeometry(1.9,1.8).rotateX(-Math.PI/2)
    shadows=new T.InstancedMesh(shadowPlane,shadowMaterial(swim?.40:.94),runners.length*(bike?2:1))
    castShadows=swim?undefined:new T.InstancedMesh(shadowPlane,shadowMaterial(.56),runners.length)
    for(const mesh of [headShell,helmets,shadows,castShadows,headBands,visors,goggles,faceBinding,uniformPiping]){
      if(!mesh)continue
      mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);players.add(mesh)
    }
    styles.forEach(({primary,accent},i)=>{
      const color=new T.Color(primary)
      const trim=new T.Color(accent)
      headShell.setColorAt(i,color.clone().multiplyScalar(kind==='running'?.79:1))
      faceBinding.setColorAt(i,trim.clone().lerp(new T.Color('#fff1d8'),.58))
      uniformPiping.setColorAt(i,trim.clone().lerp(color,.32))
      helmets.setColorAt(i,color)
      headBands?.setColorAt(i,swim?trim:color)
      visors?.setColorAt(i,trim)
      wristbands.setColorAt(i*2,trim)
      wristbands.setColorAt(i*2+1,trim)
      arms.setColorAt(i*2,color)
      arms.setColorAt(i*2+1,color)
      goggles?.setColorAt(i*2,trim)
      goggles?.setColorAt(i*2+1,trim)
    })
  }
  let w=0,h=0
  const laneX=(runner:Runner)=> (runner.lane%15-7)*1.4
  function frame(t:number,clock:number,shot:string,leaders:Runner[],starter=false,revealed=0,beat?:Beat,podiumAge=Infinity,chasePosition?:number,event?:RaceEvent,time=clock) {
    if(w!==host.clientWidth||h!==host.clientHeight){
      w=host.clientWidth;h=host.clientHeight
      if(w&&h){renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}
    }
    const podium=shot==='podium'
    const swim=!podium&&sport==='swimming',bike=!podium&&sport==='cycling'
    const dt=previousFrame?Math.min(.06,Math.max(.001,clock-previousFrame)):.016
    previousFrame=clock
    frameAverage=frameAverage*.96+dt*1000*.04
    if(frameAverage>33&&dpr>.85&&w&&h){
      dpr=Math.max(.85,dpr-.15);renderer.setPixelRatio(dpr);renderer.setSize(w,h,false);frameAverage=25
    }
    const gate=event?.gate??(beat?raceBeats[sport][beat.index].gate:0)
    const active=!podium&&(beat!==undefined||event!==undefined)
    const early=active&&beat?.index===0, middle=active&&beat?.index===1, late=active&&beat?.index===2
    const ballLane=early&&stadiumProps&&beat&&t<=beat.at+.094?runningBallLane(t,beat.at):undefined
    animateCourse(time,late&&sport==='running')
    cycleProps?.update(time,late)
    stadiumProps?.update(t,time,ballLane,late)
    for(const hurdle of hurdles)hurdle.kick=0
    runners.forEach((r,i)=>{
      const distance=position(r,t)
      const moving=!podium&&t>0
      const force=r.events?.reduce((sum,incident)=>sum+eventForce(incident,t),0)??0
      const phase=time*(swim?8:bike?14:14.4)+r.lane
      const hurdle=middle?hurdles[r.lane%15]:undefined
      const delta=distance-(hurdle?.distance??gate)
      const eventWidth=hurdle ? .018 : .031
      const reaction=active?Math.exp(-((delta/eventWidth)**2)):0
      const stumble=Math.max(-force*1.85,middle&&r.affected?reaction:0)
      if(hurdle&&r.affected&&delta>-.009&&delta<.027){
        const spring=(delta+.009)/.036
        hurdle.kick=Math.max(hurdle.kick,Math.sin(spring*Math.PI*2.2)*(1-spring)*.83)
      }
      const lane=laneX(r),side=lane===0?(r.lane%2?1:-1):Math.sign(lane)
      const launch=T.MathUtils.smoothstep(distance,0,launchMerge)
      const startSlot=(r.lane-(runners.length-1)/2)*launchSpacing
      const steering=early&&bike?reaction*(1-T.MathUtils.smoothstep(Math.abs(lane),2,5)):0
      const dodge=ballLane===undefined?0:
        Math.exp(-(((distance-runningBallDistance)/.027)**2))*(1-T.MathUtils.smoothstep(Math.abs(lane-ballLane),1.1,3.7))
      const surge=Math.max(force*1.7,late&&!swim&&r.affected?reaction:0)
      const line=T.MathUtils.lerp(startSlot,lane+.27*Math.sin(t*13+r.lane),launch)+stumble*(swim?.55:.31)*Math.sin(r.lane)
        +side*(2.24+Math.sin(delta*134)*.32)*steering+side*dodge*1.45+(force===0?side*surge*(bike?.84:.57):0)
      const point=coursePoint(sport,distance,line)
      const next=coursePoint(sport,distance+.003,line)
      const x=podium?podiumX[r.rank]:point.x
      const z=podium?-world+4:launchZ(distance)
      const bounce=r.rank===0?.41*Math.abs(Math.sin(time*4.1))**1.4:.030*Math.sin(time*4+r.rank)
      const yaw=podium?Math.PI:-Math.atan2(next.x-point.x,point.z-next.z)+side*(steering*.21*Math.cos(delta*134)+dodge*.15)
      const along=bumpProfile?(x-bumpProfile.x)*bumpProfile.sin+(z-bumpProfile.z)*bumpProfile.cos:0
      const alongAxle=bumpProfile?Math.sin(yaw)*bumpProfile.sin+Math.cos(yaw)*bumpProfile.cos:0
      const frontLift=bumpProfile?speedBumpHeight(along-.46*alongAxle):0
      const rearLift=bumpProfile?speedBumpHeight(along+.48*alongAxle):0
      const frontGround=bike?coursePoint(sport,distance+.46/world).y:0
      const rearGround=bike?coursePoint(sport,distance-.48/world).y:0
      const frontY=frontGround+frontLift
      const rearY=rearGround+rearLift
      const bikePitch=bike?Math.atan2(frontY-rearY,.94):0
      const strideBob=moving&&!swim&&!bike?.065*(1-Math.cos(phase*2)):0
      const y=podium?.66+platform+podiumHeight[r.rank]+bounce:
        bike?(frontY+rearY)*.5+tireRadius+axleOffset*Math.cos(bikePitch):
        point.y+(swim?.25:.85)+(moving&&swim?.105*Math.abs(Math.sin(phase)):strideBob)+(swim?.23:hurdle?.75:0)*reaction*(stumble?.68:1)
      const eventPose=eventPoses.get(r.person.id)
      if(eventPose){eventPose.x=x;eventPose.y=y;eventPose.z=z;eventPose.yaw=yaw;eventPose.distance=distance}
      const visible=!podium||r.rank>=3-revealed
      if(swimmerWakes){
        for(let band=0;band<2;band++){
          const age=(time*1.95+r.lane*.161+band*.5)%1
          const tail=.32+age*1.03
          const size=moving?.16+.21*Math.sin(age*Math.PI):0
          matrix.position.set(x+tail*Math.sin(yaw),.035+band*.004,z+tail*Math.cos(yaw))
          matrix.rotation.set(0,yaw,0)
          matrix.scale.set(size,1,size*1.9)
          matrix.updateMatrix();swimmerWakes.setMatrixAt(i*2+band,matrix.matrix)
        }
      }
      const costume=costumes.mounts[i]
      const starterPose=starter && r.lane===0
      parts.forEach((part,j)=>{
        if(!part)return
        const wheel=bike&&(j===5||j===6||j===10||j===11)
        let [dx,dy,dz]=body[j]
        let angle=moving&&swim&&j>=3&&j<=4?Math.sin(phase+(j%2)*Math.PI)*.7:0
        const wobble=j===0?stumble*.48*Math.sin(phase):0
        let swing=j>0&&j<5?angle*.13:0
        if(bike&&j===8){
          dy=gripY;dz=gripZ
        }else if(bike&&(j===3||j===4||j===12||j===13)){
          const pedal=phase+(j===4||j===13?Math.PI:0)
          dz=.095+.115*Math.cos(pedal)-(j>=12?.055:0)
          dy=(j>=12?-.64:-.375)+.115*Math.sin(pedal)
          angle=0;swing=0
        }else if(!swim&&j>=3&&j<=4){
          dy=podium?-.41:-.54
          if(moving){
            const step=phase+(j===4?Math.PI:0)
            const lift=Math.max(0,-Math.cos(step))
            const reach=.32+surge*.09
            dz+=reach*Math.sin(step)
            dy+=.20*lift-strideBob
            angle=.36*lift
          }
        }
        if(bike&&j>0&&!wheel){
          const raisedY=dy*Math.cos(bikePitch)-dz*Math.sin(bikePitch)
          dz=dy*Math.sin(bikePitch)+dz*Math.cos(bikePitch)
          dy=raisedY
        }
        const localZ=dz+swing
        matrix.position.set(x+dx*Math.cos(yaw)+localZ*Math.sin(yaw),wheel?(dz<0?frontY:rearY)+tireRadius:y+dy,z+localZ*Math.cos(yaw)-dx*Math.sin(yaw))
        if(wheel)matrix.rotation.set(0,yaw+Math.PI/2,(launchDepth-z)/tireRadius,'YXZ')
        else matrix.rotation.set(j===0?(swim?-1.02:bike?-.38+bikePitch-surge*.26:moving?-.12-surge*.15:0):angle+bikePitch,
          yaw,wobble+(j===0?side*(steering*.24+dodge*.13):0),'YXZ')
        const squash=j===0&&t>0?.065*Math.sin(phase):0
        matrix.scale.set(visible?1-squash:0,visible?1+squash:0,visible?(j===0?.85:1):0)
        matrix.updateMatrix();part.setMatrixAt(i,matrix.matrix)
        if(j===0){
          torso.copy(matrix.matrix)
          bibs.setMatrixAt(i,torso)
          uniformPiping.setMatrixAt(i,torso)
          costume.torso?.mesh.setMatrixAt(costume.torso.index,torso)
        }
      })
      poseArms(i,sport,x,y,z,yaw,phase,t>0,podium,starterPose,visible,time,r.rank,bikePitch)
      const face=faces[i]
      const gear=styles[i].gear
      const tilt=podium?0:swim?-.25+stumble*.13:bike?-.08-surge*.19:-surge*.10
      const turn=podium?yaw:yaw+Math.sin(phase*.65)*.07+stumble*Math.sin(phase)*.28
      const front=swim?.47:bike?.23:.08
      face.visible=visible
      face.position.set(x-front*Math.sin(yaw),y+(swim?.49:.77)-surge*(bike?.13:.041),z-front*Math.cos(yaw))
      face.rotation.set(tilt,turn,0,'YXZ')
      matrix.position.copy(face.position);matrix.rotation.copy(face.rotation)
      matrix.scale.setScalar(visible?1:0);matrix.updateMatrix();headShell.setMatrixAt(i,matrix.matrix)
      faceBinding.setMatrixAt(i,matrix.matrix)
      costume.head?.mesh.setMatrixAt(costume.head.index,matrix.matrix)
      const showCrown=visible&&(sport!=='running'||gear===2)
      matrix.scale.set(showCrown?1.04:0,showCrown?(sport==='cycling'?1.09:1.015):0,showCrown?1.015:0)
      matrix.updateMatrix();helmets.setMatrixAt(i,matrix.matrix)
      matrix.scale.setScalar(visible?1:0);matrix.updateMatrix()
      headBands?.setMatrixAt(i,matrix.matrix)
      if(visors){
        const showVisor=visible&&gear>=2
        matrix.scale.set(showVisor?(gear===3?.84:1):0,showVisor?1:0,showVisor?(gear===3?1.08:1):0)
        matrix.updateMatrix();visors.setMatrixAt(i,matrix.matrix)
      }
      if(goggles){
        for(let lens=0;lens<2;lens++){
          gearOffset.set(lens===0?-.113:.113,.548,-.317).applyEuler(face.rotation)
          matrix.position.copy(face.position).add(gearOffset)
          matrix.scale.setScalar(visible?(gear===2?1.08:gear===3?.85:1):0)
          matrix.updateMatrix();goggles.setMatrixAt(i*2+lens,matrix.matrix)
        }
      }
      if(bike){
        const shadowPitch=Math.atan2(frontGround-rearGround,.94)
        for(let wheel=0;wheel<2;wheel++){
          const dz=wheel===0?-.46:.48
          matrix.position.set(x+dz*Math.sin(yaw),(wheel===0?frontGround:rearGround)+.038,z+dz*Math.cos(yaw))
          matrix.rotation.set(shadowPitch,yaw,0,'YXZ')
          matrix.scale.set(.31,1,.48);matrix.updateMatrix();shadows.setMatrixAt(i*2+wheel,matrix.matrix)
        }
      }else{
        matrix.position.set(x,(podium?platform+podiumHeight[r.rank]:point.y)+.032,z)
        matrix.rotation.set(0,yaw,0)
        matrix.scale.set(visible?.76:0,1,visible?.70:0)
        matrix.updateMatrix();shadows.setMatrixAt(i,matrix.matrix)
      }
      if(castShadows){
        const ground=podium?platform+podiumHeight[r.rank]:point.y
        matrix.position.set(x+shadowOffset.x,ground+.024,z+shadowOffset.z)
        matrix.rotation.set(bike?Math.atan2(frontGround-rearGround,.94):0,
          -Math.atan2(shadowOffset.z,shadowOffset.x),0,'YXZ')
        matrix.scale.set(visible?(bike?1.46:1.10):0,1,visible?.73:0)
        matrix.updateMatrix();castShadows.setMatrixAt(i,matrix.matrix)
      }
    })
    for(const mesh of [...parts,headShell,helmets,shadows,arms,bibs,wristbands,visors,faceBinding,uniformPiping]){
      if(mesh)mesh.instanceMatrix.needsUpdate=true
    }
    if(headBands)headBands.instanceMatrix.needsUpdate=true
    if(castShadows)castShadows.instanceMatrix.needsUpdate=true
    if(goggles)goggles.instanceMatrix.needsUpdate=true
    if(swimmerWakes)swimmerWakes.instanceMatrix.needsUpdate=true
    for(const mesh of costumes.meshes)mesh.instanceMatrix.needsUpdate=true
    dynamicProps?.update(t,time,eventPoses)
    const main=coursePoint(sport,raceBeats[sport][1].gate)
    rankPanels.forEach((panel,i)=>{panel.visible=i>=3-revealed})
    if(wave){
      wave.mesh.visible=beat?.index===1
      if(wave.mesh.visible&&beat){
        const progress=T.MathUtils.clamp((t-beat.at+.040)/.11,0,1)
        wave.mesh.position.set(main.x,0,main.z-2.8+progress*5.9)
        wave.update(time,Math.max(.05,Math.sin(progress*Math.PI)))
      }
    }
    if(itemRipples)itemRipples.visible=false
    swimItems?.forEach((item,i)=>{
      const index=i===0?0:2
      item.visible=beat?.index===index
      if(!item.visible||!beat)return
      const point=coursePoint(sport,raceBeats[sport][index].gate)
      const phase=T.MathUtils.clamp((t-beat.at+.045)/.12,0,1)
      item.position.set(point.x+(i===0?1:-1)*(9.4-phase*7.3),-.035+Math.sin(time*5+i)*.20,point.z+phase*(i===0?5:2))
      item.rotation.set(Math.sin(time*4)*.09,i===0?-.24:Math.PI+.25,Math.sin(time*4+i)*.16)
      item.scale.setScalar(i===0?1.18:1.25)
      if(itemRipples){
        itemRipples.visible=true
        for(let ripple=0;ripple<itemRipples.count;ripple++){
          const arc=(time*.87+ripple/itemRipples.count)%1
          const spread=1.54+arc*.62
          matrix.position.set(item.position.x,.038+ripple*.004,item.position.z+arc*.16)
          matrix.rotation.set(0,ripple*1.96+time*.31,0)
          matrix.scale.set(spread*(i===0?1.44:1),1,spread*(i===0?.68:1))
          matrix.updateMatrix();itemRipples.setMatrixAt(ripple,matrix.matrix)
        }
        itemRipples.instanceMatrix.needsUpdate=true
      }
    })
    hurdles.forEach(({base,pad,kick})=>{
      base.visible=middle
      pad.rotation.x=-kick
    })
    const celebrate=podium&&revealed>0&&podiumAge>=0&&podiumAge<1.35
    rim.intensity=rimBase+(celebrate?.68*(1-podiumAge/1.35):0)
    for(let i=0;i<48;i++){
      const r=leaders[Math.floor(i/8)]
      const phase=(time*1.7+i*.137)%1
      const p=coursePoint(sport,r?position(r,t):0,r?laneX(r):0)
      matrix.position.set(p.x+Math.sin(i*2.4)*phase*.95,p.y+.12+Math.sin(phase*Math.PI)*(swim?1.2:.48),p.z+phase*(bike?4.4:2.8))
      matrix.rotation.set(0,0,0)
      const density=r&&t>0&&t<1?(active&&Math.abs(position(r,t)-gate)<.099?(1-phase)*.9:swim&&i%3===0?(1-phase)*.58:0):0
      if(celebrate){
        const fan=Math.sin(i*2.399), depth=Math.cos(i*2.399)
        const spread=podiumAge*(1.4+i%5*.31)
        matrix.position.set(podiumX[3-revealed]+fan*spread,
          2.15+podiumHeight[3-revealed]+podiumAge*2.6-podiumAge**2*2.1+i%5*.13,-world+4+depth*spread)
        matrix.scale.set(.58,.37,.58).multiplyScalar(1-podiumAge/1.35)
      }else matrix.scale.set(density*(swim?1.5:1),density*(bike?.26:swim?.42:.64),density*(bike?4.2:swim?2.4:1))
      matrix.updateMatrix();effects.setMatrixAt(i,matrix.matrix)
    }
    effects.instanceMatrix.needsUpdate=true
    const focus=leaders[0]
    const leaderPosition=focus?Math.min(.99,position(focus,t)):0
    const subject=event&&eventPoses.get(event.runnerId)
    const eventBlend=event&&shot==='event'?T.MathUtils.smoothstep(t,event.appears,event.at)
      *(1-T.MathUtils.smoothstep(t,event.at,event.ends)):0
    const subjectPosition=subject?.distance??leaderPosition
    const p=T.MathUtils.lerp(leaderPosition,Math.max(leaderPosition-.07,subjectPosition),eventBlend*.72)
    const {x,y,z}=coursePoint(sport,p)
    const chaseGap=T.MathUtils.clamp((p-(chasePosition??p))*world,0,12)
    if(podium){goal.set(0,3.25,-world+14.6);target.set(0,1.13,-world+4)}
    else{
      const opening=1-T.MathUtils.smoothstep(t,0,.14)
      const cut=beat?T.MathUtils.smoothstep(t,beat.at-.045,beat.at)
        *(1-T.MathUtils.smoothstep(t,beat.at,raceBeats[sport][beat.index].end)):eventBlend
      const sprint=T.MathUtils.smoothstep(t,finishShotAt,.91)
      const approach=T.MathUtils.smoothstep(p,.86,.94)
      const distance=15+opening*3+cut*4-sprint*2
      const ahead=coursePoint(sport,p+distance/world)
      const side=5+cut*(swim?3.2:4.5)+sprint
      const height=T.MathUtils.lerp(5.3+opening*1.8+cut*2.1+chaseGap*.13,4.7,approach)
      goal.set(ahead.x+side,ahead.y+height,ahead.z)
      target.set(x+2+(subject?T.MathUtils.clamp(subject.x-x,-8,8)*eventBlend*.62:0),y+.75,z+2.1+chaseGap*.46)
      const launch=1-T.MathUtils.smoothstep(t,0,.18)
      goal.x=T.MathUtils.lerp(goal.x,0,launch)
      goal.y+=launch*launchWidth*.37
      goal.z=T.MathUtils.lerp(goal.z,launchZ(p)-launchWidth*.66,launch)
      target.z+=launchZ(p)-z
      target.x*=1-launch
      if(shot==='photo'&&leaders.length>=4){
        const third=leaders[2],fourth=leaders[3]
        const midpoint=(position(third,t)+position(fourth,t))/2
        const lane=(laneX(third)+laneX(fourth))/2
        const finish=coursePoint(sport,1)
        const farLane=Math.abs(laneX(third)-laneX(fourth))
        const rail=T.MathUtils.smoothstep(t,.888,.953)
        const center=T.MathUtils.lerp(midpoint,1,T.MathUtils.smoothstep(t,.95,.978)*.64)
        const finishView=coursePoint(sport,center)
        goal.lerp(photoGoal.set(finish.x+14+farLane*.22,finish.y+6+farLane*.12,finish.z-13-farLane*.28),rail)
        target.lerp(photoTarget.set(finishView.x+lane*.40-1,finishView.y+1.05,finishView.z),rail)
      }
      if(scene.fog instanceof T.Fog){
        scene.fog.near=62+launch*launchWidth*.62
        scene.fog.far=168+launch*launchWidth
      }
    }
    const ease=cameraReady?1-Math.exp(-dt*4.2):1
    cameraReady=true
    look.lerp(target,ease);camera.position.lerp(goal,ease);camera.lookAt(look)
    renderer.render(scene,camera)
  }
  return {setup,frame,capture(target:HTMLCanvasElement){
    const source=renderer.domElement
    target.width=Math.min(source.width,1920)
    target.height=Math.round(source.height*target.width/source.width)
    const context=target.getContext('2d')
    if(!context)return false
    renderer.render(scene,camera)
    context.drawImage(source,0,0,target.width,target.height)
    return true
  }, destroy(){
    dispose(course);dispose(players)
    for(const sky of skies.values())sky.dispose()
    stageReflection?.dispose()
    renderer.dispose();renderer.domElement.remove()
  }}
}
