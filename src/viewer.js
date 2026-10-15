(function () {
  'use strict';
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const clone=x=>JSON.parse(JSON.stringify(x));
  let config=clone(window.INITIAL_CONFIG), layout=ModularLayout.calculate(config);
  let world, assemblies=[], pickables=[], selected=null, selectedEdges=null, labels=[],wireGroup,wireMeshes=[];
  const state={mode:'inside',view:'iso',focus:'all',theta:.35,phi:1.32,zoom:1,explode:.65};
  const detail={panel:3,standoff:8,shelf:3,lip:12,deviceEdge:1,portW:15,portH:10,
    cable:2.3,fiber:1.7,hinge:8,gasket:5,cap:5,roof:5,ventDepth:30,screen:2,
    gland:10,glandLength:22,ductDepth:25,sensor:18,foot:20,rail:18};
  const colors={shell:'#c8d1d3',edge:'#89989c',panel:'#dbe2e0',dark:'#3c4c55',orange:'#d65b35',blue:'#418cb7',fiber:'#cc922b',green:'#679889'};
  const canvas=$('#cv'), stage=$('#stage');
  let renderer;
  try {renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,preserveDrawingBuffer:true});}
  catch(e){$('#fatal').hidden=false;$('#fatal').textContent='O visualizador precisa de WebGL. Abra este arquivo no Chrome ou Edge com aceleração gráfica disponível.';return;}
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
  renderer.outputEncoding=THREE.sRGBEncoding;
  const scene=new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff,0x687b80,1));
  const key=new THREE.DirectionalLight(0xffffff,.95);key.position.set(-900,1800,1600);scene.add(key);
  const fill=new THREE.DirectionalLight(0xc4ddf0,.45);fill.position.set(1200,500,-800);scene.add(fill);
  const camera=new THREE.OrthographicCamera(-1000,1000,700,-700,1,16000);
  const target=new THREE.Vector3();
  let frameWidth=1600,frameHeight=1100,frameCenter=new THREE.Vector3();
  const ray=new THREE.Raycaster(), pointer=new THREE.Vector2();
  function material(color,options={}) {const m=new THREE.MeshStandardMaterial({color,roughness:.72,metalness:.12,...options});m.color.convertSRGBToLinear();return m;}
  function box(parent,w,h,d,x,y,z,color,options={}) {
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material(color,options));m.position.set(x,y,z);parent.add(m);return m;
  }
  function edge(m,color=colors.edge) {const g=new THREE.EdgesGeometry(m.geometry);const e=new THREE.LineSegments(g,new THREE.LineBasicMaterial({color,transparent:true,opacity:.5}));m.add(e);return e;}
  function cylinder(parent,r,h,x,y,z,color,axis='y') {
    const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,24),material(color));
    if(axis==='z')m.rotation.x=Math.PI/2;if(axis==='x')m.rotation.z=Math.PI/2;m.position.set(x,y,z);parent.add(m);return m;
  }
  function textPlane(parent,text,w,h,x,y,z,{bg='#eef2ee',ink='#253840',size=28}={}) {
    const c=document.createElement('canvas');c.width=1024;c.height=Math.max(100,Math.round(1024*h/w));
    const ctx=c.getContext('2d');ctx.fillStyle=bg;ctx.fillRect(0,0,c.width,c.height);
    ctx.fillStyle=ink;ctx.font=`600 ${Math.min(size*c.width/350,c.height*.45)}px Segoe UI`;ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(text,c.width/2,c.height/2,c.width*.9);
    const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:t,side:THREE.DoubleSide}));mesh.position.set(x,y,z);parent.add(mesh);return mesh;
  }
  function path(parent,points,color,r=detail.cable) {
    const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)),false,'catmullrom',.2);
    const m=new THREE.Mesh(new THREE.TubeGeometry(curve,64,r,8,false),material(color));parent.add(m);return m;
  }
  function line(parent,points,color) {
    const m=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p))),new THREE.LineBasicMaterial({color}));parent.add(m);return m;
  }
  function labelModule(b,parent) {
    const el=document.createElement('div');el.className='module-label';
    el.append(document.createTextNode(`${b.id==='network'?'01':'02'} / ${b.name.toUpperCase()}`));
    const small=document.createElement('small');small.textContent=`${b.w} × ${b.h} × ${b.d} mm · ≈ ${(b.h/44.45).toFixed(2).replace('.',',')} U externos`;el.append(small);$('#labels').append(el);
    labels.push({el,parent,pos:new THREE.Vector3(0,b.h+config.parameters.ROOF_AIR_GAP+45,0)});
  }
  function createDevice(item,a) {
    const g=new THREE.Group();a.equipment.add(g);g.position.set(item.x,item.y,item.z);g.userData.device=item.id;
    const body=box(g,item.w,item.h,item.d,0,0,0,item.color);edge(body);body.userData.device=item.id;pickables.push(body);
    // Cada suporte acompanha seu equipamento na vista explodida por conjuntos.
    if(['onu','switch','poe','ups'].includes(item.id)||item.id.startsWith('battery')) {
      const tray=box(g,item.w+8,detail.shelf,item.d+10,0,-item.h/2-detail.shelf/2,0,'#a7b4b7');edge(tray);
      for(const s of [-1,1]) box(g,detail.shelf,detail.lip,item.d+10,s*(item.w/2+4),-item.h/2+detail.lip/2,0,'#a7b4b7');
      for(const s of [-1,1])box(g,detail.lip,item.h*.5,detail.shelf,s*item.w*.32,-item.h*.25,-item.d/2-detail.shelf/2,'#a7b4b7');
    }
    if(item.id==='protection') {
      box(g,item.w+detail.rail,detail.rail,detail.panel,0,0,-item.d/2-detail.standoff,colors.dark);
      for(let i=0;i<4;i++) box(g,item.w*.16,item.h*.65,detail.cap,(i-1.5)*item.w*.22,-item.h*.05,item.d/2+detail.cap/2,'#f4f3e9');
      textPlane(g,'PROTEÇÕES',item.w*.9,item.h*.23,0,item.h*.31,item.d/2+detail.cap+1,{size:21});
    } else if(item.id==='switch'||item.id==='poe') {
      textPlane(g,item.id==='poe'?'SWITCH PoE':'SWITCH DE REDE',item.w*.9,item.h*.4,0,item.h*.25,item.d/2+1,{bg:item.color,ink:'#ffffff',size:22});
      const count=config.parameters[item.id==='poe'?'POE_PORTS':'SWITCH_PORTS'];
      const cols=Math.min(count,24),rows=Math.ceil(count/cols),pw=Math.min(detail.portW,item.w*.85/cols-1),ph=Math.min(detail.portH,item.h*.45/rows-1);
      for(let i=0;i<count;i++){const col=i%cols,row=Math.floor(i/cols);box(g,pw,ph,2,(col-(cols-1)/2)*(pw+2),-item.h*.23+row*(ph+1),item.d/2+1,'#15272f');}
    } else if(item.id==='pdu') {
      for(let i=0;i<5;i++) {const y=(i-2)*item.h/6;cylinder(g,item.w*.27,3,0,y,item.d/2+1,'#e6e8de','z');}
    } else {
      const name=item.id.startsWith('battery')?'BATERIA':item.name.toUpperCase();
      textPlane(g,name,item.w*.88,Math.min(item.h*.4,42),0,item.h*.08,item.d/2+1,{bg:item.color,ink:'#ffffff',size:28});
      if(item.id==='ups') {box(g,item.w*.45,item.h*.12,2,0,item.h*.31,item.d/2+1,'#172e38');textPlane(g,'ESTUDO',item.w*.34,item.h*.07,0,item.h*.31,item.d/2+3,{bg:'#172e38',ink:'#8bb9b8',size:20});}
      if(item.id==='onu')box(g,detail.portW,detail.portH,2,-item.w*.22,-item.h*.2,item.d/2+1,'#1b4248');
      if(item.id.startsWith('battery')) {
        for(const s of [-1,1])cylinder(g,detail.gasket,detail.gasket*2,s*item.w*.33,item.h/2+detail.gasket,-item.d*.2,s<0?'#953727':'#25343d');
        textPlane(g,'QUÍMICA A DEFINIR',item.w*.82,item.h*.12,0,-item.h*.25,item.d/2+1,{bg:item.color,ink:'#dce3dc',size:18});
      }
    }
    a.deviceGroups[item.id]=g;
  }
  function makeVent(a,centerY,isExhaust) {
    const {b}=a,p=config.parameters,s=b.id==='network'?-1:1;
    const v=new THREE.Group();a.structure.add(v);v.position.set(s*b.w/2,centerY,0);
    const vh=p.VENT_HEIGHT,vd=Math.min(b.d*.55,p.FAN_SIZE+40);
    // Capuz: teto inclinado, abas, defletor e tela; abertura voltada para baixo.
    box(v,detail.ventDepth,vh,detail.screen,s*detail.ventDepth/2,0,vd/2,colors.shell);
    box(v,detail.ventDepth,vh,detail.screen,s*detail.ventDepth/2,0,-vd/2,colors.shell);
    const cap=box(v,detail.ventDepth+8,detail.cap,vd+8,s*detail.ventDepth/2,vh/2,0,'#a6b5b9');cap.rotation.z=-s*.1;
    box(v,detail.screen,vh*.75,vd,s*detail.ventDepth, vh*.12,0,colors.shell);
    box(v,detail.screen,vh*.6,vd,s*detail.ventDepth*.45,-vh*.17,0,'#899d9f');
    box(v,detail.screen,vh*.85,vd*.95,-s*3,0,0,'#596b70');
    for(let i=0;i<7;i++) box(v,detail.screen,2,vd*.95,-s*5,(i-3)*vh*.12,0,'#94a5a7');
    if(isExhaust){
      cylinder(v,p.FAN_SIZE/2,8,-s*10,0,0,'#293d46','x');
      cylinder(v,p.FAN_SIZE*.15,10,-s*16,0,0,'#b8c6c8','x');
      for(let k=0;k<4;k++){const blade=box(v,4,p.FAN_SIZE*.62,p.FAN_SIZE*.15,-s*16,0,0,'#657c84');blade.rotation.x=k*Math.PI/2+.4;}
    }
  }
  function makeBox(b) {
    const p=config.parameters,g=new THREE.Group();g.position.x=b.x;world.add(g);
    const a={b,g,structure:new THREE.Group(),cover:new THREE.Group(),shell:new THREE.Group(),panel:new THREE.Group(),equipment:new THREE.Group(),door:new THREE.Group(),cables:new THREE.Group(),flow:new THREE.Group(),service:new THREE.Group(),deviceGroups:{}};
    for(const name of ['structure','cover','shell','panel','equipment','door','cables','flow','service'])g.add(a[name]);
    const wall=p.WALL_THICKNESS,outer=b.id==='network'?-1:1;
    edge(box(a.structure,b.w,b.h,wall,0,b.h/2,-b.d/2,colors.shell));
    for(const y of [wall/2,b.h-wall/2]) edge(box(a.shell,b.w,wall,b.d,0,y,0,colors.shell));
    // Lateral externa com duas aberturas; a lateral interna permanece contínua.
    edge(box(a.shell,wall,b.h,b.d,-outer*(b.w/2-wall/2),b.h/2,0,colors.shell));
    const ventYs=[p.PANEL_MARGIN+p.VENT_HEIGHT/2,b.h-p.PANEL_MARGIN-p.VENT_HEIGHT/2];
    const ventD=Math.min(b.d*.55,p.FAN_SIZE+40);let prev=0;
    for(const cy of ventYs){const lo=cy-p.VENT_HEIGHT/2,hi=cy+p.VENT_HEIGHT/2;
      if(lo>prev)box(a.shell,wall,lo-prev,b.d,outer*b.w/2,(lo+prev)/2,0,colors.shell);
      for(const s of [-1,1])box(a.shell,wall,p.VENT_HEIGHT,(b.d-ventD)/2,outer*b.w/2,cy,s*(b.d+ventD)/4,colors.shell);
      prev=hi;
    }
    if(prev<b.h)box(a.shell,wall,b.h-prev,b.d,outer*b.w/2,(b.h+prev)/2,0,colors.shell);
    makeVent(a,ventYs[0],false);makeVent(a,ventYs[1],true);
    const roof=box(a.cover,b.w+2*p.ROOF_OVERHANG,detail.roof,b.d+2*p.ROOF_OVERHANG,0,b.h+p.ROOF_AIR_GAP,0,'#536d76');roof.rotation.x=.03;edge(roof,'#465b63');
    for(const s of [-1,1])for(const t of [-1,1])box(a.cover,detail.foot,p.ROOF_AIR_GAP,detail.foot,s*b.w*.35,b.h+p.ROOF_AIR_GAP/2,t*b.d*.3,'#8a9da2');
    edge(box(a.panel,b.w-2*p.PANEL_MARGIN,b.h-2*p.PANEL_MARGIN,detail.panel,0,b.h/2,b.panelZ,colors.panel));
    for(const s of [-1,1]) {
      const x=s*(b.w/2-p.PANEL_MARGIN-p.CHANNEL_WIDTH/2);
      box(a.panel,p.CHANNEL_WIDTH,b.h-2*p.PANEL_MARGIN,detail.ductDepth,x,b.h/2,b.panelZ+detail.ductDepth/2,'#a9b8b9');
      for(let y=p.PANEL_MARGIN+detail.lip;y<b.h-p.PANEL_MARGIN;y+=detail.lip*2)box(a.panel,p.CHANNEL_WIDTH*.7,2,1,x,y,b.panelZ+detail.ductDepth+1,'#6f878d');
    }
    const reserve=box(a.panel,b.usableW,b.reserveH,1,0,b.reserveBottom+b.reserveH/2,b.panelZ+5,'#a2c2ae',{transparent:true,opacity:.28});edge(reserve,'#588a73');
    textPlane(a.panel,`${p.EXPANSION_PERCENT}% · EXPANSÃO`,b.usableW*.85,28,0,b.reserveBottom+b.reserveH/2,b.panelZ+7,{bg:'#d1e1d6',ink:'#507461',size:23});
    // Porta destacável no explodido; vedação e fechamento visíveis na vista externa.
    const dz=b.d/2+wall;
    edge(box(a.door,b.w,b.h,wall,0,b.h/2,dz,'#bdcbd0'));
    for(const s of [-1,1]) {
      box(a.door,detail.gasket,b.h-2*detail.gasket,detail.gasket,s*(b.w/2-detail.gasket),b.h/2,dz-wall-detail.gasket,'#425259');
      box(a.door,b.w-2*detail.gasket,detail.gasket,detail.gasket,0,s<0?detail.gasket:b.h-detail.gasket,dz-wall-detail.gasket,'#425259');
      cylinder(a.door,detail.hinge,detail.hinge*4,outer*b.w/2,b.h*(s<0?.2:.8),dz,'#6e838b');
    }
    box(a.door,detail.hinge,detail.hinge*5,detail.hinge,-outer*(b.w/2-p.PANEL_MARGIN),b.h/2,dz+detail.hinge/2,'#344b56');
    textPlane(a.door,b.name.toUpperCase(),b.w*.5,50,0,b.h*.65,dz+wall,{bg:'#bdcbd0',ink:'#304b56'});
    textPlane(a.door,'CTech · MÓDULO '+(b.id==='network'?'01':'02'),b.w*.55,25,0,b.h*.6,dz+wall,{bg:'#bdcbd0',ink:'#5b737e',size:18});
    const glands=b.id==='network'?[-b.w*.34,-b.w*.15,b.w*.02,b.w/2-p.PANEL_MARGIN-p.CHANNEL_WIDTH/2]:[-b.w/2+p.PANEL_MARGIN+p.CHANNEL_WIDTH/2,0,b.w*.25];
    const entryNames=b.id==='network'?['FIBRA','ETH','RESERVA','ENERGIA']:['INTERLIGAÇÃO','ENTRADA','PE'];
    glands.forEach((x,i)=>{cylinder(a.structure,detail.gland,detail.glandLength,x,-detail.glandLength/2,b.d*.18,'#4e656d');
      textPlane(a.structure,entryNames[i],entryNames[i].length>8?85:60,16,x,-detail.glandLength-15,b.d*.18+12,{bg:'#e8eeeb',ink:'#4a636c',size:21});});
    // Fixações traseiras e ponto de equipotencialização representativos.
    for(const x of [-b.w*.36,b.w*.36])for(const y of [b.h*.15,b.h*.85])box(a.structure,detail.foot,detail.foot*2,detail.foot,x,y,-b.d/2-detail.foot/2,'#8a9da2');
    cylinder(a.panel,detail.gasket,detail.gasket*2,b.w*.35,p.PANEL_MARGIN+20,b.panelZ+detail.gasket,'#b19f4e','z');
    textPlane(a.panel,'PE',22,18,b.w*.35-25,p.PANEL_MARGIN+20,b.panelZ+detail.gasket,{bg:'#dbe2e0',ink:'#50674b',size:24});
    const sensorX=-outer*b.usableW*.4;
    box(a.panel,detail.sensor,detail.sensor,detail.sensor,sensorX,b.reserveBottom-20,b.panelZ+detail.sensor/2,'#6e8d8b');
    textPlane(a.panel,'T°',detail.sensor,detail.sensor,sensorX,b.reserveBottom-20,b.panelZ+detail.sensor+1,{size:22});
    for(const item of layout.devices.filter(d=>d.box===b.id))createDevice(item,a);
    const ax=outer*(b.w/2-p.PANEL_MARGIN-p.CHANNEL_WIDTH-p.SIDE_SERVICE_WIDTH*.3),az=b.d*.25;
    for(let i=0;i<3;i++){const pos=new THREE.Vector3(ax,p.BOTTOM_SERVICE_HEIGHT+i*b.h*.23,az);const arrow=new THREE.ArrowHelper(new THREE.Vector3(0,1,0),pos,b.h*.16,0x56a5ad,22,12);a.flow.add(arrow);}
    const inlet=new THREE.ArrowHelper(new THREE.Vector3(-outer,0,0),new THREE.Vector3(outer*(b.w/2+65),ventYs[0],0),110,0x56a5ad,22,12);a.flow.add(inlet);
    const outlet=new THREE.ArrowHelper(new THREE.Vector3(outer,0,0),new THREE.Vector3(outer*(b.w/2-35),ventYs[1],0),110,0xd07d45,22,12);a.flow.add(outlet);
    const service=box(a.service,b.w,b.h,p.MAINTENANCE_FRONT,0,b.h/2,b.d/2+p.MAINTENANCE_FRONT/2,'#d1b589',{transparent:true,opacity:.06,depthWrite:false});edge(service,'#ab8751');
    textPlane(a.service,`ACESSO ${p.MAINTENANCE_FRONT} mm`,b.w*.7,30,0,25,b.d/2+p.MAINTENANCE_FRONT,{bg:'#e7dfd0',ink:'#7f6847',size:24});
    labelModule(b,g);return a;
  }
  function drawConnections(currentLayout=layout){
    if(wireGroup){world.remove(wireGroup);dispose(wireGroup);}wireGroup=new THREE.Group();world.add(wireGroup);wireMeshes=[];
    const ports=CableModel.catalog(config,currentLayout);
    for(const c of config.connections||[]){
      const from=ports.find(p=>p.id===c.from),to=ports.find(p=>p.id===c.to);if(!from||!to)continue;
      const points=CableModel.route(c,config,currentLayout),mesh=path(wireGroup,points,CableModel.types[c.type].color,c.type==='fiber'?1.7:2.5);
      mesh.userData.connection=c.id;mesh.visible=state.focus==='all'||(from.box===state.focus&&to.box===state.focus);wireMeshes.push(mesh);
      for(const endpoint of [from,to]){const marker=new THREE.Mesh(new THREE.SphereGeometry(4,10,8),material(CableModel.types[c.type].color));marker.position.set(...endpoint.point);marker.visible=mesh.visible;wireGroup.add(marker);}
    }
    wireGroup.visible=$('#show-cables').checked&&state.mode==='inside';
  }
  function dispose(root){const geometries=new Set(),materials=new Set(),textures=new Set();root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{materials.add(m);if(m.map)textures.add(m.map);});});geometries.forEach(g=>g.dispose());textures.forEach(t=>t.dispose());materials.forEach(m=>m.dispose());}
  function rebuild(){
    if(world){scene.remove(world);dispose(world);}wireGroup=null;world=new THREE.Group();scene.add(world);pickables=[];assemblies=[];selected=null;selectedEdges=null;labels=[];$('#labels').replaceChildren();
    assemblies=layout.boxes.map(makeBox);
    const p=config.parameters,n=layout.boxes[0],e=layout.boxes[1];
    const from=[n.x+n.w/2-p.PANEL_MARGIN-p.CHANNEL_WIDTH/2,-15,n.d*.18];
    const to=[e.x-e.w/2+p.PANEL_MARGIN+p.CHANNEL_WIDTH/2,-15,e.d*.18];
    const conduit=path(world,[from,[from[0],-75,from[2]],[(from[0]+to[0])/2,-105,(from[2]+to[2])/2],[to[0],-75,to[2]],to],'#6b7f83',p.CONDUIT_RADIUS);conduit.userData.conduit=true;
    for(let i=0;i<18;i++){const t=(i+.5)/18;const point=conduit.geometry.parameters.path.getPoint(t);const ring=new THREE.Mesh(new THREE.TorusGeometry(p.CONDUIT_RADIUS+1,1,5,12),material('#8c9a9d'));ring.position.copy(point);ring.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),conduit.geometry.parameters.path.getTangent(t));world.add(ring);ring.userData.conduit=true;}
    const grid=new THREE.GridHelper(2800,28,0xbac7c6,0xd5dedd);grid.position.y=-120;grid.material.transparent=true;grid.material.opacity=.35;world.add(grid);grid.userData.grid=true;
    refreshLists();drawConnections();applyMode();showValidation(layout);window.__rackReady=true;document.dispatchEvent(new CustomEvent('project:changed'));
  }
  function applyMode(){
    const p=config.parameters,x=state.mode==='exploded'?state.explode:0;
    for(const a of assemblies){a.g.visible=state.focus==='all'||state.focus===a.b.id;
      a.door.visible=state.mode!=='inside';a.shell.visible=state.mode!=='inside';
      a.cover.visible=state.mode!=='inside'||state.view!=='top';
      a.panel.position.z=x*180;a.equipment.position.z=x*420;a.door.position.z=x*650;
      const outside=a.b.id==='network'?-1:1;
      a.door.position.x=outside*(a.b.w/2+100)*x;
      a.door.rotation.y=outside*Math.min(x/.65,1)*Math.PI/2;
      a.panel.position.x=state.mode==='exploded'?(a.b.id==='network'?-1:1)*x*70:0;
      a.equipment.position.x=a.panel.position.x;
      a.cables.visible=$('#show-cables').checked&&state.mode==='inside';
      a.flow.visible=$('#show-flow').checked&&state.mode!=='closed';
      a.service.visible=$('#show-service').checked&&state.mode!=='exploded';
    }
    world.children.forEach(o=>{if(o.userData.conduit)o.visible=state.focus==='all'&&state.mode!=='exploded';});
    if(wireGroup){wireGroup.visible=$('#show-cables').checked&&state.mode==='inside';const ports=CableModel.catalog(config,layout);for(const mesh of wireMeshes){const c=config.connections.find(c=>c.id===mesh.userData.connection),a=ports.find(p=>p.id===c.from),b=ports.find(p=>p.id===c.to);mesh.visible=state.focus==='all'||(a.box===state.focus&&b.box===state.focus);}wireGroup.children.filter(x=>!x.userData.connection).forEach(x=>x.visible=state.focus==='all'||(state.focus==='network'?x.position.x<0:x.position.x>0));}
    $('.explode-control').hidden=state.mode!=='exploded';
    $$('#show-cables,#show-service').forEach(el=>el.disabled=state.mode==='exploded');
    $$('#show-flow').forEach(el=>el.disabled=state.mode==='closed');
    const b=layout.boxes.filter(b=>state.focus==='all'||b.id===state.focus);
    const low=Math.min(...b.map(b=>b.x-b.w/2-p.ROOF_OVERHANG)),high=Math.max(...b.map(b=>b.x+b.w/2+p.ROOF_OVERHANG));
    const maxH=Math.max(...b.map(b=>b.h)),maxD=Math.max(...b.map(b=>b.d));
    frameCenter.set((low+high)/2,maxH/2, state.mode==='exploded'?x*280:0);
    frameWidth=(high-low)+160;frameHeight=maxH+280;
    if(state.view==='side')frameWidth=maxD+240+(state.mode==='exploded'?x*650:0)+($('#show-service').checked&&state.mode!=='exploded'?p.MAINTENANCE_FRONT:0);
    if(state.view==='top'){frameHeight=maxD+250+(state.mode==='exploded'?x*650:0);frameCenter.y=maxH/2;}
    if(state.mode==='exploded'){frameWidth+=x*1000;frameHeight+=x*180;}
    if($('#show-service').checked&&state.mode!=='exploded'){frameHeight+=p.MAINTENANCE_FRONT*.35;frameWidth+=p.MAINTENANCE_FRONT*.3;}
    updateCamera();updateViewText();render();
  }
  function updateCamera(){
    const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h,false);
    const aspect=w/h,halfH=Math.max(frameHeight/2,frameWidth/(2*aspect))*state.zoom;
    camera.left=-halfH*aspect;camera.right=halfH*aspect;camera.top=halfH;camera.bottom=-halfH;camera.updateProjectionMatrix();
    target.copy(frameCenter);
    camera.position.set(target.x+5000*Math.sin(state.phi)*Math.sin(state.theta),target.y+5000*Math.cos(state.phi),target.z+5000*Math.sin(state.phi)*Math.cos(state.theta));camera.lookAt(target);
  }
  function render(){renderer.render(scene,camera);const w=stage.clientWidth,h=stage.clientHeight;
    for(const l of labels){const pos=l.parent.localToWorld(l.pos.clone()).project(camera);l.el.hidden=!$('#show-labels').checked||!l.parent.visible||state.view==='top'||state.view==='side';l.el.style.left=(pos.x*.5+.5)*w+'px';l.el.style.top=(-pos.y*.5+.5)*h+'px';}
  }
  function updateViewText(){const names={iso:'VISTA 3/4',front:'VISTA FRONTAL',side:'VISTA LATERAL',top:'SUPERIOR · SEM COBERTURA',rear:'VISTA TRASEIRA',free:'VISTA LIVRE'},modes={inside:'INTERIOR',closed:'CAIXAS FECHADAS',exploded:'EXPLODIDO'};$('#view-name').textContent=(state.view==='top'&&state.mode!=='inside'?'VISTA SUPERIOR':names[state.view])+' · '+modes[state.mode];}
  function setView(view){state.view=view;state.zoom=1;[state.theta,state.phi]=({iso:[.35,1.32],front:[0,Math.PI/2],side:[Math.PI/2,Math.PI/2],top:[0,.001],rear:[Math.PI,Math.PI/2]})[view];$$('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));applyMode();}
  function select(id){selected=id;
    selectCable(null);
    if(selectedEdges){selectedEdges.parent.remove(selectedEdges);dispose(selectedEdges);selectedEdges=null;}
    const d=layout.devices.find(d=>d.id===id);if(!d)return;
    const a=assemblies.find(a=>a.b.id===d.box),g=a.deviceGroups[id];
    selectedEdges=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(d.w+5,d.h+5,d.d+5)),new THREE.LineBasicMaterial({color:0xf04d23}));g.add(selectedEdges);
    const info=$('#selection');info.replaceChildren();const label=document.createElement('span');label.className='small-label';label.textContent=a.b.name.toUpperCase()+' / SUPORTE INDIVIDUAL';
    const title=document.createElement('h3');title.textContent=d.name;const dims=document.createElement('p');dims.className='dimensions';dims.textContent=`${d.w} × ${d.h} × ${d.d} mm · L × A × P`;
    const meters=document.createElement('p');meters.className='dimensions-secondary';meters.textContent=[d.w,d.h,d.d].map(v=>(v/1000).toFixed(3).replace('.',',')).join(' × ')+' m · altura ≈ '+(d.h/44.45).toFixed(2).replace('.',',')+' U';
    const desc=document.createElement('p');desc.textContent=d.desc;info.append(label,title,dims,meters,desc);
    $$('[data-device]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.device===id)));render();
    document.dispatchEvent(new CustomEvent('project:selected',{detail:id}));
  }
  function selectCable(id){for(const mesh of wireMeshes){const active=!id||mesh.userData.connection===id;mesh.material.transparent=!active;mesh.material.opacity=active?1:.18;mesh.material.depthWrite=active;}render();}
  function refreshLists(){
    $('#device-list').replaceChildren();$('#dimension-summary').replaceChildren();$('#measurement-cards').replaceChildren();
    for(const b of layout.boxes){const title=document.createElement('div');title.className='list-title';title.textContent=`${b.id==='network'?'01':'02'} / ${b.name.toUpperCase()}`;$('#device-list').append(title);
      const ds=layout.devices.filter(d=>d.box===b.id).sort((a,b)=>b.y-a.y);
      for(const d of ds){const button=document.createElement('button');button.className='device-row';button.dataset.device=d.id;button.setAttribute('aria-pressed','false');
        const sw=document.createElement('span');sw.className='swatch';sw.style.background=d.color;const name=document.createElement('span');name.textContent=d.name;const dims=document.createElement('small');dims.textContent=`${d.w}×${d.h}×${d.d}`;button.append(sw,name,dims);button.onclick=()=>select(d.id);$('#device-list').append(button);}
      const dim=document.createElement('div');dim.textContent=`${b.name}: ${b.w} × ${b.h} × ${b.d} mm`;$('#dimension-summary').append(dim);
      const card=document.createElement('div');card.className='measure-card';const part=document.createElement('div'),name=document.createElement('strong'),mm=document.createElement('small'),met=document.createElement('small'),right=document.createElement('div'),u=document.createElement('b'),ul=document.createElement('small');name.textContent='Caixa '+b.name;mm.textContent=`${b.w} × ${b.h} × ${b.d} mm`;met.textContent=[b.w,b.h,b.d].map(v=>(v/1000).toFixed(2).replace('.',',')).join(' × ')+' m';u.textContent='≈ '+(b.h/44.45).toFixed(2).replace('.',',')+' U';ul.textContent='altura externa';part.append(name,mm,met);right.append(u,ul);card.append(part,right);$('#measurement-cards').append(card);
    }
    $('#reserve-stat').textContent=config.parameters.EXPANSION_PERCENT+'%';
    $('#selection').innerHTML='<span class="small-label">INSPECIONAR</span><h3>Explore os componentes</h3><p>Selecione um equipamento na lista ou no modelo para ver dimensões e critérios de montagem.</p>';
    $('#bom-body').replaceChildren();for(const row of ModularLayout.bom(config,layout)){const tr=document.createElement('tr');for(const val of row){const td=document.createElement('td');td.textContent=val;tr.append(td);}$('#bom-body').append(tr);}
    $('#assumptions').replaceChildren();for(const val of config.assumptions){const li=document.createElement('li');li.textContent=val;$('#assumptions').append(li);}
  }
  const groupDefs=[
    ['Caixa Telecom',['BOX_NETWORK_WIDTH','BOX_NETWORK_HEIGHT','BOX_NETWORK_DEPTH']],
    ['Caixa Energia',['BOX_POWER_WIDTH','BOX_POWER_HEIGHT','BOX_POWER_DEPTH','BOX_GAP']],
    ['Switch PoE',['SWITCH_POE_WIDTH','SWITCH_POE_HEIGHT','SWITCH_POE_DEPTH','POE_PORTS']],
    ['Switch de rede',['SWITCH_WIDTH','SWITCH_HEIGHT','SWITCH_DEPTH','SWITCH_PORTS']],
    ['ONU',['ONU_WIDTH','ONU_HEIGHT','ONU_DEPTH']],
    ['Nobreak',['UPS_WIDTH','UPS_HEIGHT','UPS_DEPTH']],
    ['Bateria',['BATTERY_WIDTH','BATTERY_HEIGHT','BATTERY_DEPTH','BATTERY_COUNT']],
    ['Folgas e organização',['EQUIPMENT_GAP','CONNECTOR_CLEARANCE','MAINTENANCE_FRONT','AIR_CLEARANCE','EXPANSION_PERCENT','CHANNEL_WIDTH','SIDE_SERVICE_WIDTH','POWER_SIDE_SERVICE_WIDTH','BOTTOM_SERVICE_HEIGHT','FIBER_BEND_RADIUS']],
    ['Estrutura e ambiente',['WALL_THICKNESS','PANEL_MARGIN','PANEL_BACK_GAP','ROOF_OVERHANG','ROOF_AIR_GAP','FAN_SIZE','VENT_HEIGHT','CONDUIT_RADIUS']],
    ['Régua e proteções',['PDU_WIDTH','PDU_HEIGHT','PDU_DEPTH','PROTECTION_WIDTH','PROTECTION_HEIGHT','PROTECTION_DEPTH','DISTRIBUTION_WIDTH','DISTRIBUTION_HEIGHT','DISTRIBUTION_DEPTH']]
  ];
  const names={BOX_GAP:'Distância entre caixas',BATTERY_COUNT:'Quantidade',POE_PORTS:'Portas PoE',SWITCH_PORTS:'Portas de rede',EQUIPMENT_GAP:'Folga mínima entre blocos',CONNECTOR_CLEARANCE:'Folga dos conectores',MAINTENANCE_FRONT:'Acesso frontal externo',AIR_CLEARANCE:'Folga mínima de ar',EXPANSION_PERCENT:'Reserva de expansão (%)',CHANNEL_WIDTH:'Largura das canaletas',SIDE_SERVICE_WIDTH:'Faixa lateral de serviço',BOTTOM_SERVICE_HEIGHT:'Entrada inferior Telecom',FIBER_BEND_RADIUS:'Raio ilustrativo da fibra',WALL_THICKNESS:'Espessura ilustrativa',PANEL_MARGIN:'Margem do painel',PANEL_BACK_GAP:'Afastamento do painel',ROOF_OVERHANG:'Beiral',ROOF_AIR_GAP:'Afastamento da cobertura',FAN_SIZE:'Lado da ventoinha',VENT_HEIGHT:'Altura da abertura',CONDUIT_RADIUS:'Raio do conduíte'};
  function fieldName(k){if(k==='POWER_SIDE_SERVICE_WIDTH')return 'Faixa lateral Energia';if(names[k])return names[k];const n=k.endsWith('WIDTH')?'Largura':k.endsWith('HEIGHT')?'Altura':'Profundidade';return k.startsWith('PDU_')?'Régua · '+n:k.startsWith('PROTECTION_')?'Proteção · '+n:k.startsWith('DISTRIBUTION_')?'Distribuição · '+n:n;}
  function buildForm(){$('#parameter-fields').replaceChildren();groupDefs.forEach(([name,keys],idx)=>{const section=document.createElement('details');section.open=idx<2;const summary=document.createElement('summary');summary.textContent=name;section.append(summary);for(const key of keys){const label=document.createElement('label');label.className='field';const span=document.createElement('span');span.textContent=fieldName(key);const input=document.createElement('input');input.type='number';input.name=key;input.value=config.parameters[key];input.min=key==='EXPANSION_PERCENT'?20:1;input.step=key.endsWith('PORTS')||key==='BATTERY_COUNT'?1:.5;input.required=true;input.setAttribute('aria-label',key);if(key==='EXPANSION_PERCENT')input.max=30;label.title=key;label.append(span,input);section.append(label);}$('#parameter-fields').append(section);});}
  function showValidation(result,custom){const el=$('#validation');el.replaceChildren();el.className=result.errors.length?'error':'';const head=document.createElement('div');head.className='valid-title';head.textContent=result.errors.length?'Medidas não aplicadas':custom||'✓ Espaço dos blocos verificado';el.append(head);const p=document.createElement('p');p.style.margin='4px 0 0';p.textContent=result.errors.length?'O modelo mantém a última configuração válida.':'Sem sobreposição entre os blocos. Suportes, cargas e condições reais precisam de validação.';el.append(p);if(result.errors.length){const ul=document.createElement('ul');for(const error of result.errors){const li=document.createElement('li');li.textContent=error;ul.append(li);}el.append(ul);}}
  function applyConfig(candidate){
    const initial=window.INITIAL_CONFIG;
    if(!candidate||!candidate.parameters||Object.keys(initial.parameters).some(k=>!(k in candidate.parameters))) {showValidation({errors:['Configuração incompleta: faltam parâmetros obrigatórios.']});return false;}
    const normalized={project:clone(initial.project),assumptions:clone(initial.assumptions),parameters:{},placements:clone(candidate.placements||{}),connections:clone(candidate.connections||[])};
    for(const k of Object.keys(initial.parameters))normalized.parameters[k]=candidate.parameters[k];
    const result=ModularLayout.calculate(normalized);if(!result.errors.length)result.errors.push(...CableModel.validate(normalized,result));if(result.errors.length){showValidation(result);return false;}
    config=normalized;layout=result;rebuild();buildForm();return true;
  }
  function download(name,blob){const a=document.createElement('a');const url=URL.createObjectURL(blob);a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  $$('[data-mode]').forEach(b=>b.onclick=()=>{state.mode=b.dataset.mode;$$('[data-mode]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));applyMode();});
  $$('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));
  $('#focus-box').onchange=e=>{state.focus=e.target.value;state.zoom=1;applyMode();};
  $$('.layers input[type=checkbox]').forEach(el=>el.onchange=applyMode);
  $('#explode-range').oninput=e=>{state.explode=Number(e.target.value)/100;applyMode();};
  $$('[data-tab]').forEach(b=>b.onclick=()=>{$$('[data-tab]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));$('#equipment-panel').hidden=b.dataset.tab!=='equipment';$('#parameters-panel').hidden=b.dataset.tab!=='parameters';$('#editor-panel').hidden=b.dataset.tab!=='editor';if(b.dataset.tab!=='editor')selectCable(null);});
  $$('[data-doc]').forEach(b=>b.onclick=()=>{$$('[data-doc]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));$$('.doc-pane').forEach(x=>x.hidden=x.id!==b.dataset.doc);});
  $('#parameter-form').onsubmit=e=>{e.preventDefault();const next=clone(config);new FormData(e.target).forEach((v,k)=>next.parameters[k]=Number(v));applyConfig(next);};
  $('#reset-config').onclick=()=>applyConfig(clone(window.INITIAL_CONFIG));
  $('#export-config').onclick=()=>download('config-caixas-ctech.json',new Blob([JSON.stringify(config,null,2)],{type:'application/json'}));
  $('#import-config').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{applyConfig(JSON.parse(await file.text()));}catch(err){showValidation({errors:['Arquivo JSON inválido. Selecione uma configuração exportada pelo projeto.']});}e.target.value='';};
  $('#export-image').onclick=()=>{
    render();const out=document.createElement('canvas');out.width=1600;out.height=1100;const c=out.getContext('2d');c.fillStyle='#edf1ef';c.fillRect(0,0,1600,1100);
    c.fillStyle='#243a43';c.font='600 30px Segoe UI';c.fillText('CTech | Estações modulares',55,55);c.fillStyle='#63757b';c.font='18px Segoe UI';c.fillText($('#view-name').textContent,55,88);
    const scale=Math.min(1490/canvas.width,890/canvas.height),dw=canvas.width*scale,dh=canvas.height*scale;c.drawImage(canvas,(1600-dw)/2,120+(890-dh)/2,dw,dh);
    c.font='17px Segoe UI';c.fillText('Conceito 02 · Equipamentos genéricos · Sem certificação IP ou dimensionamento executivo',55,1060);
    out.toBlob(blob=>download('ctech-'+state.view+'-'+state.mode+'.png',blob),'image/png');
  };
  function hitAt(e,objects){const r=canvas.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);return ray.intersectObjects(objects).find(h=>{let o=h.object;while(o){if(!o.visible)return false;o=o.parent;}return true;});}
  let drag=null;
  canvas.addEventListener('pointerdown',e=>{
    drag={x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moved:false};canvas.setPointerCapture(e.pointerId);
    if($('#drag-devices').checked&&state.mode==='inside'&&state.view==='front'){
      const hit=hitAt(e,pickables);if(hit){const id=hit.object.userData.device,d=layout.devices.find(d=>d.id===id);drag.device=id;drag.original={x:d.x,y:d.y,z:d.z};drag.next={...drag.original};select(id);}
    }
  });
  canvas.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.moved=drag.moved||Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)>4;drag.x=e.clientX;drag.y=e.clientY;
    if(drag.device&&drag.moved){const next={x:Math.round(drag.original.x+(e.clientX-drag.startX)*(camera.right-camera.left)/stage.clientWidth),y:Math.round(drag.original.y-(e.clientY-drag.startY)*(camera.top-camera.bottom)/stage.clientHeight),z:drag.original.z};drag.next=next;const d=layout.devices.find(d=>d.id===drag.device),a=assemblies.find(a=>a.b.id===d.box);a.deviceGroups[d.id].position.set(next.x,next.y,next.z);const preview=clone(layout);Object.assign(preview.devices.find(d=>d.id===drag.device),next);drawConnections(preview);render();return;}
    if(drag.moved){state.theta-=dx*.006;state.phi=Math.max(.02,Math.min(Math.PI-.02,state.phi+dy*.006));state.view='free';$$('[data-view]').forEach(b=>b.setAttribute('aria-pressed','false'));updateCamera();updateViewText();render();}});
  canvas.addEventListener('pointerup',e=>{
    if(drag&&drag.device&&drag.moved){const id=drag.device,next=clone(config);next.placements[id]=drag.next;const okay=applyConfig(next);if(!okay){const issues=ModularLayout.calculate(next);if(!issues.errors.length)issues.errors=CableModel.validate(next,issues);rebuild();showValidation(issues);}select(id);}
    else if(drag&&!drag.moved){const hit=hitAt(e,[...pickables,...wireMeshes]);if(hit&&state.mode!=='closed'){if(hit.object.userData.device)select(hit.object.userData.device);else document.dispatchEvent(new CustomEvent('project:connection',{detail:hit.object.userData.connection}));}}
    drag=null;
  });
  canvas.addEventListener('pointercancel',()=>{drag=null;rebuild();});
  canvas.addEventListener('wheel',e=>{e.preventDefault();state.zoom=Math.min(2.5,Math.max(.4,state.zoom*Math.exp(e.deltaY*.001)));updateCamera();render();},{passive:false});
  canvas.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-'].includes(e.key))return;e.preventDefault();if(e.key==='ArrowLeft')state.theta-=.1;if(e.key==='ArrowRight')state.theta+=.1;if(e.key==='ArrowUp')state.phi=Math.max(.02,state.phi-.1);if(e.key==='ArrowDown')state.phi=Math.min(Math.PI-.02,state.phi+.1);if(e.key==='+'||e.key==='=')state.zoom=Math.max(.4,state.zoom*.9);if(e.key==='-')state.zoom=Math.min(2.5,state.zoom*1.1);state.view='free';updateCamera();updateViewText();render();});
  new ResizeObserver(()=>{updateCamera();render();}).observe(stage);
  window.ProjectAPI={getConfig:()=>clone(config),getLayout:()=>clone(layout),applyConfig,setView,getState:()=>clone(state),render,select,selectCable,download,showValidation,
    getPorts:()=>CableModel.catalog(config,layout),getRoutes:()=>config.connections.map(c=>({id:c.id,points:CableModel.route(c,config,layout)})),
    screenPoint:id=>{const d=layout.devices.find(d=>d.id===id),b=layout.boxes.find(b=>b.id===d.box),v=new THREE.Vector3(b.x+d.x,d.y,d.z+d.d/2).project(camera),r=canvas.getBoundingClientRect();return {x:r.left+(v.x*.5+.5)*r.width,y:r.top+(-v.y*.5+.5)*r.height};}};
  buildForm();rebuild();
})();
