/* Geometria em mm: X = largura, Y = altura, Z = profundidade (frente positiva).
   O mesmo cálculo alimenta o desenho, as verificações e a lista de materiais. */
(function (root) {
  'use strict';
  function calculate(config) {
    const p = config.parameters || {}, errors = [], notes = [];
    const required=('BOX_NETWORK_WIDTH BOX_NETWORK_HEIGHT BOX_NETWORK_DEPTH BOX_POWER_WIDTH BOX_POWER_HEIGHT BOX_POWER_DEPTH BOX_GAP WALL_THICKNESS PANEL_MARGIN PANEL_BACK_GAP SWITCH_POE_WIDTH SWITCH_POE_HEIGHT SWITCH_POE_DEPTH SWITCH_WIDTH SWITCH_HEIGHT SWITCH_DEPTH ONU_WIDTH ONU_HEIGHT ONU_DEPTH UPS_WIDTH UPS_HEIGHT UPS_DEPTH BATTERY_WIDTH BATTERY_HEIGHT BATTERY_DEPTH BATTERY_COUNT EQUIPMENT_GAP CHANNEL_WIDTH SIDE_SERVICE_WIDTH BOTTOM_SERVICE_HEIGHT CONNECTOR_CLEARANCE MAINTENANCE_FRONT AIR_CLEARANCE EXPANSION_PERCENT FIBER_BEND_RADIUS ROOF_OVERHANG ROOF_AIR_GAP FAN_SIZE VENT_HEIGHT CONDUIT_RADIUS PDU_WIDTH PDU_HEIGHT PDU_DEPTH PROTECTION_WIDTH PROTECTION_HEIGHT PROTECTION_DEPTH DISTRIBUTION_WIDTH DISTRIBUTION_HEIGHT DISTRIBUTION_DEPTH SWITCH_PORTS POE_PORTS').split(' ');
    for (const key of required) if (!(key in p)) errors.push(`${key}: parâmetro obrigatório ausente.`);
    for (const [key, value] of Object.entries(p)) {
      if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0)
        errors.push(`${key}: informe um número maior que zero.`);
      else if (value > 10000) errors.push(`${key}: o protótipo aceita medidas de até 10.000 mm.`);
    }
    for (const key of ['BATTERY_COUNT', 'SWITCH_PORTS', 'POE_PORTS']) {
      if (!Number.isInteger(p[key]) || p[key] > (key === 'BATTERY_COUNT' ? 4 : 48))
        errors.push(`${key}: quantidade inteira, limitada a ${key === 'BATTERY_COUNT' ? 4 : 48}.`);
    }
    if (p.EXPANSION_PERCENT < 20 || p.EXPANSION_PERCENT > 30) errors.push('A reserva de expansão deve ficar entre 20% e 30%.');
    if (errors.length) return { errors, notes, boxes: [], devices: [] };
    const boxes = ['NETWORK', 'POWER'].map((key, i) => {
      const w = p[`BOX_${key}_WIDTH`], h = p[`BOX_${key}_HEIGHT`], d = p[`BOX_${key}_DEPTH`];
      const sideService = i ? (p.POWER_SIDE_SERVICE_WIDTH || p.SIDE_SERVICE_WIDTH) : p.SIDE_SERVICE_WIDTH;
      const usableW = w - 2 * (p.PANEL_MARGIN + p.CHANNEL_WIDTH + sideService);
      const usableH = h - 2 * p.PANEL_MARGIN;
      const reserveH = usableH * p.EXPANSION_PERCENT / 100;
      return { key, id: i ? 'power' : 'network', name: i ? 'Energia' : 'Telecom', w, h, d,
        x: i ? p.BOX_GAP / 2 + w / 2 : -p.BOX_GAP / 2 - w / 2,
        panelZ: -d / 2 + p.WALL_THICKNESS + p.PANEL_BACK_GAP,
        usableW, usableH, reserveH, reserveBottom: h - p.PANEL_MARGIN - reserveH };
    });
    const devices = [];
    const add = (box, id, name, prefix, x, bottom, desc, color) => {
      const w = p[prefix + '_WIDTH'], h = p[prefix + '_HEIGHT'], d = p[prefix + '_DEPTH'];
      const item = {box: box.id, id, name, prefix, w, h, d, x, y: bottom + h / 2,
        z: box.panelZ + 8 + d / 2, desc, color};
      devices.push(item); return item;
    };
    const n = boxes[0], e = boxes[1];
    const nHeights = p.ONU_HEIGHT + p.SWITCH_HEIGHT + p.SWITCH_POE_HEIGHT;
    const available = n.reserveBottom - p.EQUIPMENT_GAP - p.BOTTOM_SERVICE_HEIGHT;
    const stepGap = p.EQUIPMENT_GAP;
    if (available < nHeights + 2*stepGap) errors.push('Telecom: altura insuficiente para equipamentos, folgas e expansão. Aumente a altura da caixa.');
    let bottom = p.BOTTOM_SERVICE_HEIGHT;
    add(n, 'onu', 'ONU', 'ONU', 0, bottom, 'Suporte individual removível. Reserva óptica à esquerda; raio da fibra a confirmar.', '#73a6ac');
    bottom += p.ONU_HEIGHT + stepGap;
    add(n, 'switch', 'Switch de rede', 'SWITCH', 0, bottom, 'Bandeja independente. Portas orientadas para a frente e chicote identificado.', '#627b91');
    bottom += p.SWITCH_HEIGHT + stepGap;
    add(n, 'poe', 'Switch PoE', 'SWITCH_POE', 0, bottom, 'Hipótese de maior dissipação. Posição final depende do fluxo de ar do equipamento real.', '#39546c');
    add(n, 'pdu', 'Régua Telecom', 'PDU', n.w/2-p.PANEL_MARGIN-p.CHANNEL_WIDTH-p.PDU_WIDTH/2-6,
      p.PANEL_MARGIN, 'Alimentação em rota lateral dedicada. Tomadas, fontes e tensão a confirmar.', '#86694d');
    const batterySpan = p.BATTERY_COUNT * p.BATTERY_WIDTH + (p.BATTERY_COUNT-1)*p.EQUIPMENT_GAP;
    const powerSpan = batterySpan + p.EQUIPMENT_GAP + p.UPS_WIDTH;
    if (powerSpan+8 > e.usableW) errors.push('Energia: bateria(s) e nobreak não cabem lado a lado na largura central útil. Amplie a caixa ou reveja os blocos.');
    for (let i = 0; i < p.BATTERY_COUNT; i++) add(e, 'battery'+i,
      p.BATTERY_COUNT === 1 ? 'Bateria' : `Bateria ${i+1}`, 'BATTERY', -powerSpan/2+p.BATTERY_WIDTH/2+i*(p.BATTERY_WIDTH+p.EQUIPMENT_GAP),
      p.PANEL_MARGIN+12, 'Berço fixado à estrutura. Química, massa e exigências de ventilação pendentes.', '#54635e');
    const upsBottom = p.PANEL_MARGIN+12;
    add(e, 'ups', 'Nobreak', 'UPS', powerSpan/2-p.UPS_WIDTH/2, upsBottom,
      'Suporte reforçado independente. Compatibilidade com bateria externa e potência a confirmar.', '#506573');
    add(e, 'distribution', 'Distribuição', 'DISTRIBUTION', e.w/2-p.PANEL_MARGIN-p.CHANNEL_WIDTH-p.DISTRIBUTION_WIDTH/2-8,
      upsBottom+p.UPS_HEIGHT/2-p.DISTRIBUTION_HEIGHT/2, 'Bloco protegido contra contato. Circuitos e conexões ainda não dimensionados.', '#8a765e');
    add(e, 'protection', 'Proteções / DIN', 'PROTECTION', 0, upsBottom+Math.max(p.UPS_HEIGHT,p.BATTERY_HEIGHT)+p.EQUIPMENT_GAP,
      'Reserva para seccionamento, proteção contra sobrecorrente e surtos. Esquema elétrico a validar.', '#bc8b50');
    for (const [id,position] of Object.entries(config.placements || {})) {
      const item=devices.find(d=>d.id===id);
      if(!item){errors.push(`Posição de equipamento inexistente: ${id}.`);continue;}
      if(!position || ['x','y','z'].some(k=>typeof position[k]!=='number'||!Number.isFinite(position[k]))) {
        errors.push(`${item.name}: posição inválida.`);continue;
      }
      Object.assign(item,{x:position.x,y:position.y,z:position.z});
    }
    for (const b of boxes) {
      if (b.usableW <= 0 || b.usableH <= 0) errors.push(`${b.name}: margens e canaletas consomem o painel útil.`);
      if (p.WALL_THICKNESS*2 >= Math.min(b.w,b.h,b.d) || p.PANEL_MARGIN < p.WALL_THICKNESS+8)
        errors.push(`${b.name}: espessura e margem incompatíveis com a caixa.`);
      if (p.FAN_SIZE+16 > b.d-2*p.WALL_THICKNESS || p.FAN_SIZE+12 > p.VENT_HEIGHT)
        errors.push(`${b.name}: abertura de ventilação insuficiente para o módulo de ventoinha.`);
      if (p.VENT_HEIGHT*2+4*p.PANEL_MARGIN > b.h) errors.push(`${b.name}: aberturas inferior e superior se sobrepõem.`);
      for (const item of devices.filter(v => v.box === b.id)) {
        const sideItem = ['pdu','distribution'].includes(item.id);
        if (!sideItem && Math.abs(item.x)+(item.w+8)/2 > b.usableW/2)
          errors.push(`${item.name}: largura excede a região central útil de ${Math.round(b.usableW)} mm.`);
        if (Math.abs(item.x)+item.w/2 > b.w/2-p.PANEL_MARGIN-p.CHANNEL_WIDTH)
          errors.push(`${item.name}: invade a canaleta lateral.`);
        if (item.y-item.h/2 < p.PANEL_MARGIN || item.y+item.h/2+p.AIR_CLEARANCE > b.reserveBottom)
          errors.push(`${item.name}: invade margem, folga de ar ou reserva de expansão.`);
        if (item.z+item.d/2+p.CONNECTOR_CLEARANCE > b.d/2-p.WALL_THICKNESS)
          errors.push(`${item.name}: profundidade insuficiente para o equipamento e seus conectores.`);
        if (item.z-item.d/2 < b.panelZ+8) errors.push(`${item.name}: invade o painel traseiro.`);
      }
      const ds = devices.filter(v => v.box === b.id);
      for (let i=0;i<ds.length;i++) for (let j=i+1;j<ds.length;j++) {
        const a=ds[i], c=ds[j];
        if (['x','y','z'].every((axis,k)=>Math.abs(a[axis]-c[axis]) < ([a.w,a.h,a.d][k]+[c.w,c.h,c.d][k])/2))
          errors.push(`${b.name}: ${a.name} e ${c.name} se sobrepõem.`);
      }
    }
    if (p.BOX_GAP < 2*p.ROOF_OVERHANG+30) errors.push('A distância entre caixas precisa acomodar os beirais e uma folga de 30 mm.');
    if (p.SIDE_SERVICE_WIDTH < p.FIBER_BEND_RADIUS*2+8)
      errors.push('A faixa lateral deve acomodar o diâmetro da reserva de fibra mais 8 mm.');
    if (p.CONDUIT_RADIUS*2+12 > p.PANEL_MARGIN+p.CHANNEL_WIDTH+p.SIDE_SERVICE_WIDTH)
      errors.push('Conduíte muito grande para a passagem inferior prevista.');
    if (p.AIR_CLEARANCE > p.EQUIPMENT_GAP) errors.push('A folga entre equipamentos deve ser pelo menos igual à folga de ar.');
    notes.push('Geometria conceitual: sem cálculo estrutural, elétrico, térmico ou certificação IP.');
    notes.push(`Reserva: ${p.EXPANSION_PERCENT}% da área central útil de cada painel; cabos e manutenção têm zonas próprias.`);
    notes.push(`Acesso frontal externo previsto: ${p.MAINTENANCE_FRONT} mm, estimado. Confirmar com portas e retirada dos equipamentos reais.`);
    return {boxes, devices, errors: [...new Set(errors)], notes};
  }
  function bom(config, layout) {
    const p=config.parameters;
    return [
      ['Caixa com porta, vedação e fecho', '2 un.', 'Telecom e Energia; material e proteção ambiental a definir'],
      ['Cobertura com beiral', '2 un.', 'Geometria ilustrativa; fixação e escoamento a validar'],
      ['Painel interno removível', '2 un.', 'Dimensões derivadas das caixas; furação a definir'],
      ['Suporte / bandeja de equipamento', '4 un.', 'ONU, dois switches e nobreak; carga a validar'],
      ['Berço de bateria', `${p.BATTERY_COUNT} un.`, 'Retenção mecânica e isolamento dos terminais'],
      ['Trilho DIN', '1 trecho', 'Comprimento e componentes de proteção a confirmar'],
      ['Canaleta lateral', '4 trechos', `${Math.round(layout.boxes.reduce((s,b)=>s+2*(b.h-2*p.PANEL_MARGIN),0))} mm representados; cortes e divisórias a detalhar`],
      ['Organizador / reserva óptica', '1 conjunto', 'Raio ilustrativo; confirmar tipo de fibra e cabo'],
      ['Régua Telecom / bloco de distribuição', '1 + 1 un.', 'Padrão de tomada, tensão e corrente a definir'],
      ['Módulo de ventilação protegido', '4 un.', '2 entradas e 2 saídas; capuz, defletor, tela e filtro'],
      ['Ventoinha substituível', '2 un. previstas', 'Hipótese visual; vazão, tensão e necessidade a validar'],
      ['Sensor de temperatura', '2 un. previstos', 'Monitoramento de cada caixa; controlador a definir'],
      ['Prensa-cabos / terminações', '7 posições', '3 dados/fibra, 1 entrada elétrica, 2 interligação, 1 PE; quantidade final a revisar'],
      ['Conduíte de interligação', '1 trecho', 'Trajeto inferior protegido; tipo, diâmetro e conectores a confirmar'],
      ['Proteção / seccionamento / surtos', '1 conjunto', 'Correntes, coordenação e esquema a validar por profissional habilitado'],
      ['Equipotencialização / aterramento', '2 pontos + condutores', 'Bitolas e conexões a dimensionar; partes metálicas aplicáveis'],
      ['Fixação, abraçadeiras e identificação', '1 lote', 'Quantidades finais após detalhamento'],
      ['Equipamentos ativos e autonomia', `${4+p.BATTERY_COUNT} un.`, 'ONU, dois switches, nobreak e bateria(s); sem marcas']
    ];
  }
  const api={calculate,bom};
  if(typeof module !== 'undefined' && module.exports) module.exports=api;
  root.ModularLayout=api;
})(typeof window !== 'undefined' ? window : globalThis);
