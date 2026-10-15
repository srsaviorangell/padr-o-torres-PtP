/* Conexões funcionais editáveis. Coordenadas recalculadas a partir das posições. */
(function(root){
  'use strict';
  const types={data:{name:'Ethernet',color:'#418cb7'},fiber:{name:'Fibra',color:'#cc922b'},power:{name:'Alimentação',color:'#d65b35'},battery:{name:'Circuito da bateria',color:'#8e5245'}};
  function catalog(config,layout){
    const ports=[],p=config.parameters;
    const add=(id,name,type,role,b,point)=>ports.push({id,name,type,role,box:b.id,point:[point[0]+b.x,point[1],point[2]]});
    for(const d of layout.devices){
      const b=layout.boxes.find(b=>b.id===d.box),z=d.z+d.d/2+3;
      const port=(key,name,type,role,x=0,y=0)=>add(d.id+':'+key,d.name+' · '+name,type,role,b,[d.x+x,d.y+y,z]);
      if(d.id==='onu'){port('fiber','Fibra','fiber','in',-d.w*.22,-d.h*.2);port('lan','LAN','data','peer',d.w*.25,-d.h*.2);port('power','Alimentação / fonte','power','in',d.w*.45,d.h*.1);}
      if(d.id==='switch'||d.id==='poe'){
        const count=p[d.id==='poe'?'POE_PORTS':'SWITCH_PORTS'],cols=Math.min(count,24),rows=Math.ceil(count/cols),pw=Math.min(15,d.w*.85/cols-1),ph=Math.min(10,d.h*.45/rows-1);
        for(let i=0;i<count;i++)port('port'+(i+1),'Porta '+(i+1),'data','peer',(i%cols-(cols-1)/2)*(pw+2),-d.h*.23+Math.floor(i/cols)*(ph+1));
        port('power','Alimentação / fonte','power','in',d.w*.45,d.h*.2);
      }
      if(d.id==='pdu'){port('in','Entrada','power','in',0,-d.h/2);for(let i=1;i<=5;i++)port('out'+i,'Saída '+i,'power','out',0,(i-3)*d.h/6);}
      if(d.id==='ups'){port('in','Entrada de alimentação','power','in',-d.w*.25,d.h*.2);port('out','Saída de alimentação','power','out',d.w*.25,d.h*.2);port('battery','Circuito próprio da bateria','battery','in',-d.w*.25,-d.h*.35);}
      if(d.id.startsWith('battery'))port('dc','Circuito DC (par ilustrativo)','battery','out',d.w*.25,d.h*.4);
      if(d.id==='protection'||d.id==='distribution'){port('in','Entrada','power','in',-d.w*.25,0);port('out','Saída','power','out',d.w*.25,0);}
    }
    const n=layout.boxes.find(b=>b.id==='network'),e=layout.boxes.find(b=>b.id==='power');
    add('entry:fiber','Entrada inferior · Fibra','fiber','out',n,[-n.w*.34,-22,n.d*.18]);
    add('entry:ethernet','Saída inferior · Ethernet externo','data','peer',n,[-n.w*.15,-22,n.d*.18]);
    add('entry:ac','Entrada inferior · Alimentação','power','out',e,[0,-22,e.d*.18]);
    return ports;
  }
  function validate(config,layout){
    if(!Array.isArray(config.connections))return ['A lista de conexões deve ser uma lista válida.'];
    if(config.connections.length>64)return ['O protótipo aceita até 64 conexões.'];
    const ports=catalog(config,layout),errors=[],used=new Set(),ids=new Set();
    for(const c of config.connections){
      if(!c||typeof c.id!=='string'||!c.id||ids.has(c.id)){errors.push('Cada ligação precisa de um identificador único.');continue;}ids.add(c.id);
      const from=ports.find(x=>x.id===c.from),to=ports.find(x=>x.id===c.to);
      if(!from||!to){errors.push(`${c.name||c.id}: porta inexistente. Revise as ligações após mudar quantidades.`);continue;}
      if(!types[c.type]||from.type!==c.type||to.type!==c.type)errors.push(`${c.name||c.id}: tipo de cabo incompatível com as portas.`);
      if(from.role==='in'||to.role==='out'||c.from===c.to)errors.push(`${c.name||c.id}: escolha uma origem e um destino compatíveis.`);
      for(const id of [c.from,c.to]){if(used.has(id))errors.push(`${c.name||c.id}: uma porta já está ocupada por outra ligação.`);used.add(id);}
      if(!Number.isFinite(c.offsetX)||!Number.isFinite(c.offsetZ)||Math.abs(c.offsetX)>1000||c.offsetZ<0||c.offsetZ>500)errors.push(`${c.name||c.id}: desvio deve ficar entre -1.000 e 1.000 mm e avanço entre 0 e 500 mm.`);
      if(from.box===to.box&&c.type!=='fiber'){
        const b=layout.boxes.find(b=>b.id===from.box),lane=(from.point[0]+to.point[0])/2+c.offsetX;
        if(lane<b.x-b.w/2+10||lane>b.x+b.w/2-10)errors.push(`${c.name||c.id}: desvio lateral deixa o cabo fora da caixa.`);
        if(Math.max(from.point[2],to.point[2])+c.offsetZ>b.d/2-5)errors.push(`${c.name||c.id}: avanço deixa o cabo além da frente da caixa.`);
      }
    }
    return [...new Set(errors)];
  }
  function route(c,config,layout){
    const ports=catalog(config,layout),a=ports.find(x=>x.id===c.from),b=ports.find(x=>x.id===c.to),p=config.parameters;
    if(!a||!b)return [];
    const A=a.point,B=b.point;
    if(a.box!==b.box){
      const ba=layout.boxes.find(x=>x.id===a.box),bb=layout.boxes.find(x=>x.id===b.box);
      const gland=box=>[box.x+(box.id==='network'?1:-1)*(box.w/2-p.PANEL_MARGIN-p.CHANNEL_WIDTH/2),-15,box.d*.18];
      const ga=gland(ba),gb=gland(bb);
      const sideA=ba.x+ba.w/2-p.PANEL_MARGIN-p.CHANNEL_WIDTH/2,sideB=bb.x+bb.w/2-p.PANEL_MARGIN-p.CHANNEL_WIDTH/2;
      return [A,[sideA,A[1],Math.max(A[2],ga[2])],[sideA,30,ga[2]],[ga[0],30,ga[2]],ga,[ga[0],-75,ga[2]],[(ga[0]+gb[0])/2,-105,(ga[2]+gb[2])/2],[gb[0],-75,gb[2]],gb,[gb[0],30,gb[2]],[sideB,30,gb[2]],[sideB,B[1],Math.max(B[2],gb[2])],B];
    }
    if(c.type==='fiber'){
      const box=layout.boxes.find(b=>b.id===a.box),x=box.x-box.w/2+p.PANEL_MARGIN+p.CHANNEL_WIDTH+p.SIDE_SERVICE_WIDTH/2;
      const y=p.BOTTOM_SERVICE_HEIGHT+p.ONU_HEIGHT+p.FIBER_BEND_RADIUS+35,z=box.panelZ+35;
      const pts=[A,[x-p.FIBER_BEND_RADIUS,40,z]];
      for(let i=0;i<=32;i++){const angle=Math.PI+i*Math.PI*2/32;pts.push([x+Math.cos(angle)*p.FIBER_BEND_RADIUS,y+Math.sin(angle)*p.FIBER_BEND_RADIUS,z]);}
      pts.push([x-p.FIBER_BEND_RADIUS,y-p.FIBER_BEND_RADIUS-10,z],B);return pts;
    }
    const lane=(A[0]+B[0])/2+c.offsetX,z=Math.max(A[2],B[2])+c.offsetZ;
    const ay=Math.max(A[1],30),by=Math.max(B[1],30);
    return [A,[A[0],ay,A[2]],[A[0],ay,z],[lane,ay,z],[lane,(ay+by)/2,z],[lane,by,z],[B[0],by,z],[B[0],by,B[2]],B];
  }
  const api={catalog,validate,route,types};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.CableModel=api;
})(typeof window!=='undefined'?window:globalThis);
