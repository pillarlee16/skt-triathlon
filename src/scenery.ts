import * as T from 'three'

export function skyGradient(zenith:number,horizon:number){
  const canvas=document.createElement('canvas')
  canvas.width=4;canvas.height=256
  const ctx=canvas.getContext('2d')!
  const color=(value:number)=>'#'+value.toString(16).padStart(6,'0')
  const gradient=ctx.createLinearGradient(0,0,0,canvas.height)
  gradient.addColorStop(0,color(zenith))
  gradient.addColorStop(.56,color(horizon))
  gradient.addColorStop(1,color(horizon))
  ctx.fillStyle=gradient
  ctx.fillRect(0,0,canvas.width,canvas.height)
  const texture=new T.CanvasTexture(canvas)
  texture.colorSpace=T.SRGBColorSpace
  texture.generateMipmaps=false
  texture.minFilter=T.LinearFilter
  return texture
}

// A broad light and a thinner edge light give the medal finishes something to reflect.
export function podiumEnvironment(renderer:T.WebGLRenderer){
  const width=128,height=64
  const pixels=new Float32Array(width*height*4)
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const u=(x+.5)/width,v=(y+.5)/height
    const main=2.8*Math.exp(-(((u-.32)/.15)**6+((v-.67)/.047)**2))
    const rim=1.3*Math.exp(-(((u-.74)/.067)**4+((v-.74)/.14)**4))
    const wall=.17+.18*v
    const offset=(y*width+x)*4
    pixels.set([wall+main+rim*.72,wall+main*.89+rim*.88,wall+main*.72+rim,1],offset)
  }
  const source=new T.DataTexture(pixels,width,height,T.RGBAFormat,T.FloatType)
  source.mapping=T.EquirectangularReflectionMapping
  source.needsUpdate=true
  const generator=new T.PMREMGenerator(renderer)
  const target=generator.fromEquirectangular(source)
  source.dispose()
  generator.dispose()
  return target
}

export function paintedPanel(width:number,height:number,draw:(ctx:CanvasRenderingContext2D)=>void,art?:HTMLImageElement){
  const canvas=document.createElement('canvas')
  canvas.width=1024;canvas.height=Math.round(canvas.width*height/width)
  const ctx=canvas.getContext('2d')!
  const texture=new T.CanvasTexture(canvas)
  texture.colorSpace=T.SRGBColorSpace
  draw(ctx)
  if(art){
    const paint=()=>{
      if(!art.naturalWidth)return
      ctx.save()
      ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height)
      const scale=Math.min(canvas.width/art.naturalWidth,canvas.height/art.naturalHeight)
      const w=art.naturalWidth*scale,h=art.naturalHeight*scale
      ctx.drawImage(art,(canvas.width-w)/2,(canvas.height-h)/2,w,h)
      ctx.restore()
      texture.needsUpdate=true
    }
    if(art.complete)paint()
    else art.addEventListener('load',paint,{once:true})
  }
  return new T.Mesh(new T.PlaneGeometry(width,height),new T.MeshBasicMaterial({map:texture,toneMapped:false}))
}

export function panelLettering(ctx:CanvasRenderingContext2D,text:string,color:string,size:number,y:number){
  ctx.fillStyle=color;ctx.font='900 '+size+'px system-ui, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle'
  ctx.fillText(text,ctx.canvas.width/2,y,ctx.canvas.width*.9)
}

export function swimmingWake(){
  const positions:number[]=[]
  const indices:number[]=[]
  const steps=9
  for(const side of [-1,1]){
    const start=positions.length/3
    for(let i=0;i<=steps;i++){
      const distance=i/steps
      const z=distance*1.52
      const edge=.08+distance*.92
      const width=Math.sin(distance*Math.PI)**.55*.26
      positions.push(side*edge,0,z,side*(edge-width),0,z)
      if(i){
        const end=start+i*2
        indices.push(end-2,end-1,end,end-1,end+1,end)
      }
    }
  }
  const geometry=new T.BufferGeometry()
  geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3))
  geometry.setIndex(indices)
  return geometry
}

export function poolItems(){
  const shark=new T.Group(),duck=new T.Group()
  const shape=(group:T.Group,geometry:T.BufferGeometry,color:number,x:number,y:number,z:number)=>{
    const mesh=new T.Mesh(geometry,new T.MeshStandardMaterial({color,roughness:.38}))
    mesh.position.set(x,y,z);group.add(mesh);return mesh
  }
  const orb=(group:T.Group,color:number,x:number,y:number,z:number,w:number,h:number,d:number)=>
    shape(group,new T.SphereGeometry(1,18,12).scale(w,h,d),color,x,y,z)
  const fin=(x:number,y:number,z:number,w:number,h:number,d:number,turn=0)=>{
    const profile=new T.Shape()
    profile.moveTo(-.5,0);profile.quadraticCurveTo(-.38,.38,.27,1)
    profile.quadraticCurveTo(.36,1,.34,.79);profile.lineTo(.5,0);profile.closePath()
    const geometry=new T.ExtrudeGeometry(profile,{depth:.13,bevelSize:.04,bevelThickness:.05,bevelSegments:2,steps:1})
    const mesh=shape(shark,geometry.scale(w,h,d),0x438fb7,x,y,z)
    mesh.rotation.z=turn
  }
  orb(shark,0x488ebd,0,.40,0,1.65,.72,.74)
  orb(shark,0xeaf9ff,-.49,.13,0,1.08,.38,.65)
  fin(.34,.85,0,1.46,1.28,1);fin(1.61,.35,0,.90,1.10,1,.20)
  fin(.33,.33,.45,1.05,.77,1,-1.00)
  for(const side of [-1,1]){
    orb(shark,0xfefefe,-.95,.68,side*.54,.23,.25,.12)
    orb(shark,0x172b43,-1.02,.69,side*.62,.13,.15,.08)
    orb(shark,0xf7a6a0,-1.23,.40,side*.57,.17,.09,.069)
    for(let i=0;i<3;i++){
      orb(shark,0x32739d,-.26+i*.13,.46,side*(.72-i*.006),.034,.112-i*.015,.029)
        .rotation.z=-.29
    }
  }
  const ring=shape(duck,new T.TorusGeometry(1.08,.31,14,36),0xffd23b,0,.31,0)
  ring.material.roughness=.28
  ring.rotation.x=-Math.PI/2
  shape(duck,new T.TorusGeometry(1.385,.021,6,36),0xfde37a,0,.34,0).rotation.x=-Math.PI/2
  shape(duck,new T.TorusGeometry(.84,.017,6,36),0xffed9b,0,.50,0).rotation.x=-Math.PI/2
  orb(duck,0xffdf46,-.86,.98,0,.55,.65,.52)
  orb(duck,0xff8b26,-1.33,.86,0,.37,.18,.34)
  orb(duck,0xffe778,.93,.49,0,.39,.39,.43).rotation.z=.4
  orb(duck,0xe8a737,.90,.52,.58,.072,.037,.07)
  for(const side of [-1,1]){
    orb(duck,0x342c45,-1.04,1.13,side*.43,.085,.112,.061)
    orb(duck,0xffffff,-1.07,1.17,side*.47,.03,.034,.023)
  }
  return [shark,duck] as const
}

export function rollingWave(){
  const width=23,columns=72,rows=22
  const geometry=new T.PlaneGeometry(width,4.4,columns,rows).rotateX(-Math.PI/2)
  const vertices=geometry.attributes.position
  const colors=new Float32Array(vertices.count*3)
  geometry.setAttribute('color',new T.BufferAttribute(colors,3))
  const mesh=new T.Mesh(geometry,new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,roughness:.33,metalness:.06}))
  const waveClock={value:0}
  mesh.material.onBeforeCompile=shader=>{
    shader.uniforms.waveClock=waveClock
    shader.vertexShader='varying vec2 waveUv;\n'+shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nwaveUv=uv;')
    shader.fragmentShader='uniform float waveClock; varying vec2 waveUv;\n'+shader.fragmentShader.replace(
      '#include <color_fragment>',`#include <color_fragment>
        float across=waveUv.x*23.0;
        float down=1.0-waveUv.y;
        float streak=sin(across*5.8+sin(across*2.9+waveClock*2.0)+down*12.0);
        float threads=pow(.5+.5*streak,6.0);
        float flank=smoothstep(.08,.26,down)*(1.0-smoothstep(.32,.57,down));
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.17,.76,.77),threads*flank*.39);
        float lipCenter=.359+.026*sin(across*2.1+waveClock*1.9)+.013*cos(across*6.1-waveClock*4.0);
        float lipWidth=.014+.022*pow(.5+.5*sin(across*3.2-waveClock*2.5),2.0);
        float lip=1.0-smoothstep(lipWidth,lipWidth+.027,abs(down-lipCenter));
        float broken=smoothstep(-.76,-.26,sin(across*2.7+waveClock*2.2)+.18*sin(across*12.7));
        float ends=smoothstep(0.0,.07,waveUv.x)*(1.0-smoothstep(.93,1.0,waveUv.x));
        float lace=pow(.5+.5*sin(across*16.0+down*94.0+waveClock*4.0),3.0);
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.88,1.0,.98),lip*broken*ends*(.62+lace*.36));
      `).replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
        totalEmissiveRadiance+=vec3(.10,.19,.20)*lip*broken*ends*(.38+lace*.62);
      `)
  }
  mesh.frustumCulled=false
  const spray=new T.InstancedMesh(new T.SphereGeometry(.08,6,4),new T.MeshBasicMaterial({color:0xdefffc}),31)
  const froth=new T.InstancedMesh(new T.SphereGeometry(1,9,5),
    new T.MeshStandardMaterial({color:0xf0fffb,roughness:.65}),96)
  spray.frustumCulled=false
  froth.frustumCulled=false
  spray.instanceMatrix.setUsage(T.DynamicDrawUsage)
  froth.instanceMatrix.setUsage(T.DynamicDrawUsage)
  mesh.add(spray,froth)
  const droplet=new T.Object3D()
  const base=new T.Color(0x1599bd),face=new T.Color(0x32ccd4),foam=new T.Color(0xedffff),color=new T.Color()
  const swell=(x:number,q:number,edge:number,time:number)=>{
    const peak=.435+.031*Math.sin(x*.74+time*4)
    const rise=Math.exp(-(((q-peak)/.166)**2))
    const shoulder=.18*Math.exp(-(((q-.64)/.21)**2))
    return (rise+shoulder)*edge*(1.38+.26*Math.sin(x*.67+time*6)+.095*Math.sin(x*2.0-time*4.4))
  }
  const update=(time:number,strength:number)=>{
    waveClock.value=time
    for(let i=0;i<vertices.count;i++){
      const x=vertices.getX(i),u=(i% (columns+1))/columns,q=Math.floor(i/(columns+1))/rows
      const shift=.40*Math.sin(x*.45+time*4)+.19*Math.cos(x*1.2-time*5)
      const crest=Math.exp(-(((q-.43)/.20)**2))
      const edge=Math.sin(u*Math.PI)**.42*Math.sin(q*Math.PI)**.55
      const height=swell(x,q,edge,time)
      vertices.setY(i,.018+strength*height)
      vertices.setZ(i,(q-.5)*4.4+edge*shift-strength*crest*.74)
      color.copy(base).lerp(face,crest*.85)
      color.lerp(foam,Math.max(0,(crest-.77)*2.8)*(.62+.28*Math.sin(x*5+q*86-time*5)))
      color.multiplyScalar(.94+.06*Math.cos(x*18+q*96))
      colors[i*3]=color.r;colors[i*3+1]=color.g;colors[i*3+2]=color.b
    }
    vertices.needsUpdate=true;geometry.attributes.color.needsUpdate=true;geometry.computeVertexNormals()
    for(let i=0;i<spray.count;i++){
      const u=(i+.5)/spray.count,x=(u-.5)*width
      const age=(time*1.9+i*.3819)%1
      const crestY=Math.sin(u*Math.PI)**.42*(1.42+.27*Math.sin(x*.67+time*6))*.95
      droplet.position.set(x,strength*(crestY+Math.sin(age*Math.PI)*.43),
        -.31+Math.sin(x*.45+time*4)*.40-strength*.74+age*.73)
      droplet.scale.setScalar(strength*(1-age)*(.68+i%4*.30))
      droplet.updateMatrix();spray.setMatrixAt(i,droplet.matrix)
    }
    spray.instanceMatrix.needsUpdate=true
    for(let i=0;i<froth.count;i++){
      const u=(i+.5)/froth.count,x=(u-.5)*width
      const q=.362+.032*Math.sin(i*2.4+time*5)
      const crest=Math.exp(-(((q-.43)/.20)**2))
      const edge=Math.sin(u*Math.PI)**.42*Math.sin(q*Math.PI)**.55
      const shift=.40*Math.sin(x*.45+time*4)+.19*Math.cos(x*1.2-time*5)
      const y=.018+strength*swell(x,q,edge,time)
      const z=(q-.5)*4.4+edge*shift-strength*crest*.74
      const patch=.30+.70*Math.max(0,Math.cos(x*1.85-time*2))
      const size=strength*edge*patch
      droplet.position.set(x,y+.09,z)
      droplet.scale.set(size*(.37+i%3*.071),size*(.10+i%4*.041),size*.32)
      droplet.updateMatrix();froth.setMatrixAt(i,droplet.matrix)
    }
    froth.instanceMatrix.needsUpdate=true
  }
  return {mesh,update}
}

export const speedBumpHeight=(along:number)=>Math.abs(along)<1?.145*(1+Math.cos(Math.PI*along)):0

export function speedBump(){
  const group=new T.Group()
  const shape=new T.Shape().moveTo(-1,0)
  for(let i=1;i<=24;i++){
    const along=i/12-1
    shape.lineTo(along,speedBumpHeight(along))
  }
  shape.closePath()
  const geometry=new T.ExtrudeGeometry(shape,{depth:.77,bevelEnabled:false,curveSegments:8}).rotateY(-Math.PI/2)
  const rubber=new T.MeshStandardMaterial({roughness:.78})
  rubber.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec2 bumpPoint;\n'+shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nbumpPoint=position.xz;')
    shader.fragmentShader='varying vec2 bumpPoint;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec2 grainCell=floor(bumpPoint*32.0);
      float noise=fract(sin(dot(grainCell,vec2(12.97,78.23)))*37518.2);
      float shoulders=smoothstep(.47,.98,abs(bumpPoint.y));
      float abrasion=smoothstep(.50,.91,noise)*(.15+shoulders*.34);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.15,.16,.18),abrasion);
      diffuseColor.rgb*=1.0+.065*sin(bumpPoint.y*64.0);
      float edge=smoothstep(.29,.383,abs(bumpPoint.x+.385));
      diffuseColor.rgb*=1.0-edge*.22;
    `)
  }
  const mesh=new T.InstancedMesh(geometry,rubber,30)
  const matrix=new T.Matrix4()
  for(let i=0;i<30;i++){
    mesh.setMatrixAt(i,matrix.makeTranslation(11.55-i*.77,0,0))
    mesh.setColorAt(i,new T.Color(i%2?0xffce42:0x2a3040))
  }
  group.add(mesh)
  const reflectors=new T.InstancedMesh(new T.BoxGeometry(),
    new T.MeshStandardMaterial({roughness:.43}),16)
  const pose=new T.Object3D(),tint=new T.Color()
  let marker=0
  for(const side of [-1,1])for(const distance of [-1.18,1.18])for(const offset of [.04,.35]){
    const x=side*(11.03+offset)
    for(const cap of [false,true]){
      pose.position.set(x,cap?.075:.050,distance)
      pose.rotation.y=side*.1
      pose.scale.set(cap?.18:.25,cap?.033:.08,cap?.19:.26)
      pose.updateMatrix();reflectors.setMatrixAt(marker,pose.matrix)
      reflectors.setColorAt(marker++,tint.setHex(cap?0xffd56c:0x544359))
    }
  }
  group.add(reflectors)
  return group
}
