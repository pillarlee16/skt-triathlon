import * as T from 'three'
import type {Sport,Person} from './model.ts'
import {position,type Runner} from './playback.ts'

const colors=['#fa355d','#32c4ff','#f4a72d','#a990ff','#70df94','#f8d76e','#ef75bd']
const world=118
export function createTrack(host:HTMLElement) {
  const renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'})
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5))
  renderer.outputColorSpace=T.SRGBColorSpace
  host.append(renderer.domElement)
  const scene=new T.Scene()
  const camera=new T.PerspectiveCamera(43,1,.1,250)
  const course=new T.Group(), players=new T.Group()
  scene.add(course,players,new T.HemisphereLight(0xfffaff,0x575880,2.7))
  const sun=new T.DirectionalLight(0xfff0d0,2.1)
  sun.position.set(-9,18,15);scene.add(sun)
  const matrix=new T.Object3D()
  const body=[[0,0,0],[.43,.02,0],[-.43,.02,0],[.16,-.41,0],[-.16,-.41,0],[0,-.64,-.46],[0,-.64,.48],[0,-.43,0]]
  let runners:Runner[]=[]
  let heads:T.Sprite[]=[]
  let parts:T.InstancedMesh[]=[]
  let obstacles:T.Mesh[]=[]
  let sport:Sport='running'
  let generation=0
  const goal=new T.Vector3(), look=new T.Vector3()
  function dispose(group:T.Group) {
    group.traverse(o=>{
      if(o instanceof T.Mesh)o.geometry.dispose()
      if(o instanceof T.Mesh || o instanceof T.Sprite){
        const material=o.material as T.MeshStandardMaterial
        material.map?.dispose();material.dispose()
      }
    })
    group.clear()
  }
  function box(w:number,h:number,d:number,x:number,y:number,z:number,color:number) {
    const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),new T.MeshStandardMaterial({color,roughness:.82}))
    mesh.position.set(x,y,z);course.add(mesh);return mesh
  }
  function head(person:Person,img:HTMLImageElement|undefined,gen:number) {
    const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128
    const c=canvas.getContext('2d')!
    const texture=new T.CanvasTexture(canvas)
    texture.colorSpace=T.SRGBColorSpace
    const paint=(img?:HTMLImageElement)=>{
      c.clearRect(0,0,128,128);c.save();c.beginPath();c.arc(64,64,59,0,Math.PI*2);c.clip()
      if(img) {
        const edge=Math.min(img.naturalWidth,img.naturalHeight)
        c.drawImage(img,(img.naturalWidth-edge)/2,(img.naturalHeight-edge)/2,edge,edge,0,0,128,128)
      } else {
        c.fillStyle=colors[Number(person.id)%colors.length||0];c.fillRect(0,0,128,128)
        c.fillStyle='#ffd3aa';c.beginPath();c.ellipse(64,66,44,48,0,0,Math.PI*2);c.fill()
        c.fillStyle='#28213d';c.beginPath();c.ellipse(60,39,44,23,-.15,Math.PI,Math.PI*2);c.fill()
        c.beginPath();c.arc(49,63,4,0,7);c.arc(80,63,4,0,7);c.fill()
        c.beginPath();c.ellipse(64,79,11,8,0,0,Math.PI);c.fill()
        c.fillStyle='#fff';c.font='bold 16px system-ui';c.textAlign='center';c.fillText(person.id.slice(-4),64,117)
      }
      c.restore();c.strokeStyle='#fff';c.lineWidth=5;c.beginPath();c.arc(64,64,59,0,Math.PI*2);c.stroke()
      texture.needsUpdate=true
    }
    paint()
    if(img?.naturalWidth)paint(img)
    else img?.addEventListener('load',()=>{if(generation===gen)paint(img)},{once:true})
    const sprite=new T.Sprite(new T.SpriteMaterial({map:texture,alphaTest:.1}))
    sprite.scale.set(1.48,1.48,1);players.add(sprite);return sprite
  }
  const podiumX=[0,-3.7,3.7]
  const podiumHeight=[1.15,.75,.45]
  function setup(kind:Sport,roster:Runner[],photo:(person:Person)=>HTMLImageElement|undefined,podium=false) {
    generation++; sport=kind;runners=roster
    dispose(course);dispose(players);obstacles=[]
    const swim=!podium&&sport==='swimming',bike=!podium&&sport==='cycling'
    scene.background=new T.Color(swim?0x14345f:bike?0x302040:0x25182e)
    scene.fog=new T.FogExp2(scene.background,.012)
    box(200,.5,73,0,-.6,-world/2,swim?0x1a6084:bike?0x315347:0x317455)
    box(22,.5,world+14,0,-.3,-world/2,swim?0x187daf:bike?0x46465a:0xa44b50)
    for(let i=-11;i<=11;i+=2)box(.045,.022,world+8,i,-.03,-world/2,swim?0x77d1ec:0xeaad97)
    for(let i=0;i<12;i++){
      const z=-i*10
      box(23,.04,.052,0,-.01,z,swim?0x489ed0:0xdda18a)
      box(1.5,1.8,7,-14,.7,z,swim?0x205173:0x545170)
      box(1.5,1.8,7,14,.7,z,swim?0x205173:0x545170)
    }
    for(let x=-11;x<11;x++){
      box(1,.05,1,x+.5,.01,-world,x%2?0xf7f5ff:0x28263e)
      box(1,.05,1,x+.5,.01,-world+.98,x%2?0x28263e:0xf7f5ff)
    }
    for(const x of [-11.5,11.5])box(.45,5,.5,x,2.45,-world,0xf43d6e)
    box(23.5,.55,.55,0,4.9,-world,0xf43d6e)
    for(let i=0;i<8;i++)obstacles.push(box(swim?2.7:bike?1.15:1.6,swim?.16:bike?.72:.38,.32,-9+i*2.55,-2,-world*.47,swim?0xb7f4ff:0xfabb53))
    if(podium)podiumX.forEach((x,i)=>box(3.25,podiumHeight[i],2,x,podiumHeight[i]/2,-world+4,[0xd7a443,0x9eaac2,0xae7053][i]))
    const specs:[[number,number,number],boolean][]=[[[.66,.58,.47],false],[[.17,.55,.18],false],[[.17,.55,.18],false],[[.2,.5,.21],false],[[.2,.5,.21],false]]
    if(bike)specs.push([[.26,.035,.22],true],[[.26,.035,.22],true],[[.15,.2,1.05],false])
    parts=specs.map(([size,wheel])=>{
      const geometry=wheel?new T.TorusGeometry(.3,.07,6,12):new T.BoxGeometry(...size)
      const part=new T.InstancedMesh(geometry,new T.MeshStandardMaterial({roughness:.72}),runners.length)
      part.frustumCulled=false;part.instanceMatrix.setUsage(T.DynamicDrawUsage);players.add(part);return part
    })
    runners.forEach((r,i)=>parts.forEach((part,j)=>part.setColorAt(i,new T.Color(j===0||j===7?(r.person.color??colors[r.lane%colors.length]):j>=5?'#212438':j<=2?'#ffd7ad':'#353451'))))
    heads=runners.map(r=>head(r.person,photo(r.person),generation))
    if(podium){camera.position.set(0,3.4,-world+15);look.set(0,.35,-world+4)}
    else {camera.position.set(19,19,19);look.set(0,0,-14)}
  }
  let w=0,h=0
  const laneX=(runner:Runner)=> (runner.lane%15-7)*1.4
  function frame(t:number,time:number,shot:string,leaders:Runner[],starter=false,revealed=0) {
    if(w!==host.clientWidth||h!==host.clientHeight){
      w=host.clientWidth;h=host.clientHeight
      if(w&&h){renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}
    }
    const podium=shot==='podium'
    const swim=!podium&&sport==='swimming',bike=!podium&&sport==='cycling'
    runners.forEach((r,i)=>{
      const leading=position(r,t)
      const phase=time*(swim?8:bike?14:16)+r.lane
      const x=podium?podiumX[r.rank]:laneX(r)+.27*Math.sin(t*13+r.lane)
      const z=podium?-world+4:-world*leading+(Math.floor(r.lane/15)*1.65)*Math.max(0,1-t*5)
      const hurdle=!podium&&sport==='running'&&t>.36&&t<.59?.75*Math.exp(-(((leading-.47)/.021)**2)):0
      const y=podium?.82+podiumHeight[r.rank]+.17*Math.abs(Math.sin(time*3+r.rank)):
        (swim?.28:bike?1.03:.82)+(t>0?.105*Math.abs(Math.sin(phase)):0)+hurdle
      const visible=!podium||r.rank>=3-revealed
      const starterPose=starter && r.lane===0
      parts.forEach((part,j)=>{
        const [dx,dy,dz]=body[j]
        const angle=podium?j===1?-2.4+.35*Math.sin(time*5):0:t>0?Math.sin(phase+(j%2)*Math.PI)*(j<3?1:.7):0
        matrix.position.set(x+dx,y+dy,z+dz+(j>0&&j<5?angle*.17:0))
        matrix.rotation.set(j===0?(swim?1.1:bike?.25:0):j===5||j===6?0:angle, j===5||j===6?Math.PI/2:0,starterPose&&j===1?-2.5:0)
        matrix.scale.setScalar(visible?1:0);matrix.updateMatrix();part.setMatrixAt(i,matrix.matrix)
      })
      heads[i].visible=visible
      heads[i].position.set(x,y+(swim?.63:.93),z-(swim?.46:.04))
    })
    parts.forEach(part=>{part.instanceMatrix.needsUpdate=true})
    obstacles.forEach((o,i)=>{o.position.y=t>.36&&t<.59?(swim?.28+.24*Math.sin(time*8+i):.28):-2})
    const focus=leaders[0]
    const p=focus?position(focus,t):0
    const z=-world*p
    if(podium){goal.set(0,3.4,-world+15);look.set(0,.35,-world+4)}
    else if(shot==='finish'){goal.set(13,5.5,-world-13);look.lerp(new T.Vector3(0,1,-world+3),.08)}
    else if(shot==='leader'||shot==='event'){
      const xs=leaders.map(laneX)
      const min=xs.length?Math.min(...xs):0,max=xs.length?Math.max(...xs):0
      const x=shot==='event'&&focus?laneX(focus):(min+max)/2-2.4
      const distance=shot==='event'?8:Math.max(12,(max-min)*.72+5)
      goal.set(x+(shot==='event'?4:3),shot==='event'?4.5:6,z-distance)
      look.lerp(new T.Vector3(x,1,z+1),.08)
    } else {
      goal.set(18,22,z-20);look.lerp(new T.Vector3(0,0,z+4),.08)
    }
    camera.position.lerp(goal,.075);camera.lookAt(look)
    renderer.render(scene,camera)
  }
  return {setup,frame, destroy(){dispose(course);dispose(players);renderer.dispose();renderer.domElement.remove()}}
}
