(function(){
  'use strict';
  const $=s=>document.querySelector(s),api=window.ProjectAPI;if(!api)return;
  const clone=x=>JSON.parse(JSON.stringify(x));let currentDevice='onu',currentCable='onu-switch',fresh=false;
  function options(select,items,value){select.replaceChildren();for(const item of items){const option=document.createElement('option');option.value=item.id;option.textContent=item.name;select.append(option);}if(items.some(i=>i.id===value))select.value=value;}
  function deviceFields(){const d=api.getLayout().devices.find(d=>d.id===currentDevice);if(!d)return;$('#edit-device').value=d.id;for(const axis of ['x','y','z'])$('#pos-'+axis).value=d[axis];}
  function portFields(from,to){const type=$('#cable-type').value,ports=api.getPorts().filter(p=>p.type===type);options($('#cable-from'),ports.filter(p=>p.role!=='in'),from);options($('#cable-to'),ports.filter(p=>p.role!=='out'),to);routeFields();}
  function routeFields(){const ports=api.getPorts(),from=ports.find(p=>p.id===$('#cable-from').value),to=ports.find(p=>p.id===$('#cable-to').value);const guided=$('#cable-type').value==='fiber'||(from&&to&&from.box!==to.box);$('#cable-offset-x').disabled=guided;$('#cable-offset-z').disabled=guided;$('#route-note').textContent=guided?'Rota guiada: fibra pela reserva óptica; interligação entre caixas pelo conduíte.':'Desvio lateral muda o caminho do cabo. Avanço afasta a curva dos equipamentos. As pontas acompanham as portas.';}
  function cableFields(){const c=api.getConfig().connections.find(c=>c.id===currentCable);if(!c){fresh=true;$('#remove-cable').disabled=true;portFields();return;}fresh=false;$('#remove-cable').disabled=false;$('#edit-cable').value=c.id;$('#cable-type').value=c.type;portFields(c.from,c.to);$('#cable-offset-x').value=c.offsetX;$('#cable-offset-z').value=c.offsetZ;}
  function refresh(){const config=api.getConfig(),ds=api.getLayout().devices;if(!ds.some(d=>d.id===currentDevice))currentDevice=ds[0]?.id;options($('#edit-device'),ds,currentDevice);deviceFields();if(!config.connections.some(c=>c.id===currentCable))currentCable=config.connections[0]?.id;options($('#edit-cable'),config.connections,currentCable);cableFields();}
  $('#edit-device').onchange=e=>{currentDevice=e.target.value;api.select(currentDevice);deviceFields();};
  $('#drag-devices').onchange=e=>{if(e.target.checked){document.querySelector('[data-mode="inside"]').click();api.setView('front');}document.querySelector('#cv').style.cursor=e.target.checked?'move':'grab';};
  $('#apply-position').onclick=()=>{const cfg=api.getConfig();cfg.placements[currentDevice]=Object.fromEntries(['x','y','z'].map(a=>[a,Number($('#pos-'+a).value)]));const id=currentDevice;if(api.applyConfig(cfg)){currentDevice=id;deviceFields();api.select(id);}};
  $('#reset-position').onclick=()=>{const cfg=api.getConfig();delete cfg.placements[currentDevice];const id=currentDevice;if(api.applyConfig(cfg)){currentDevice=id;deviceFields();api.select(id);}};
  $('#edit-cable').onchange=e=>{currentCable=e.target.value;cableFields();api.selectCable(currentCable);};
  $('#cable-type').onchange=()=>portFields();$('#cable-from').onchange=routeFields;$('#cable-to').onchange=routeFields;
  $('#new-cable').onclick=()=>{fresh=true;currentCable=null;const blank=document.createElement('option');blank.value='';blank.textContent='Nova ligação';$('#edit-cable').append(blank);$('#edit-cable').value='';$('#remove-cable').disabled=true;$('#cable-offset-x').value=0;$('#cable-offset-z').value=30;portFields();};
  $('#apply-cable').onclick=()=>{
    const cfg=api.getConfig(),ports=api.getPorts(),from=$('#cable-from').value,to=$('#cable-to').value;
    const a=ports.find(p=>p.id===from),b=ports.find(p=>p.id===to);
    if(!a||!b){api.showValidation({errors:['Escolha a origem e o destino do cabo.']});return;}
    const id=fresh?'cable-'+Date.now():currentCable,c={id,name:a.name+' → '+b.name,type:$('#cable-type').value,from,to,offsetX:Number($('#cable-offset-x').value),offsetZ:Number($('#cable-offset-z').value)};
    if(fresh)cfg.connections.push(c);else cfg.connections=cfg.connections.map(x=>x.id===id?c:x);
    if(api.applyConfig(cfg)){currentCable=id;fresh=false;refresh();}
  };
  $('#remove-cable').onclick=()=>{const cfg=api.getConfig();cfg.connections=cfg.connections.filter(c=>c.id!==currentCable);api.applyConfig(cfg);};
  $('#save-project').onclick=()=>api.download('organizacao-ctech.json',new Blob([JSON.stringify(api.getConfig(),null,2)],{type:'application/json'}));
  $('#load-project').onchange=async e=>{try{const f=e.target.files[0];if(f)api.applyConfig(JSON.parse(await f.text()));}catch(err){api.showValidation({errors:['Não foi possível ler a organização. Use um JSON exportado por este projeto.']});}e.target.value='';};
  $('#save-editable-html').onclick=()=>{
    const doc=document.documentElement.cloneNode(true);
    doc.querySelector('#initial-config').textContent='window.INITIAL_CONFIG='+JSON.stringify(api.getConfig()).replace(/</g,'\\u003c')+';';
    doc.querySelector('#labels').replaceChildren();doc.querySelector('#drag-devices').removeAttribute('checked');
    for(const tab of doc.querySelectorAll('[data-tab]'))tab.setAttribute('aria-pressed',String(tab.dataset.tab==='equipment'));
    for(const name of ['equipment','parameters','editor'])doc.querySelector('#'+name+'-panel').hidden=name!=='equipment';
    for(const mode of doc.querySelectorAll('[data-mode]'))mode.setAttribute('aria-pressed',String(mode.dataset.mode==='inside'));
    for(const view of doc.querySelectorAll('[data-view]'))view.setAttribute('aria-pressed',String(view.dataset.view==='iso'));
    for(const el of doc.querySelectorAll('.layers input'))el.disabled=false;
    api.download('ctech-organizacao-editavel.html',new Blob(['<!doctype html>\n'+doc.outerHTML],{type:'text/html;charset=utf-8'}));
  };
  document.addEventListener('project:changed',refresh);
  document.addEventListener('project:selected',e=>{currentDevice=e.detail;deviceFields();});
  document.addEventListener('project:connection',e=>{currentCable=e.detail;cableFields();document.querySelector('[data-tab="editor"]').click();api.selectCable(currentCable);});
  window.EditorAPI={refresh};refresh();
})();
