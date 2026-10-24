(() => {
  const $=selector=>document.querySelector(selector);
  const saved=window.MDLOrderHistory;
  const money=value=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value/100);
  const date=value=>new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Recife',dateStyle:'short',timeStyle:'short'}).format(new Date(value));
  const paymentLabel=(method,fulfillment)=>({pix:fulfillment==='retirada'?'Pix no ato da retirada':'Pix no ato da entrega',cartao:`Cartão no ato da ${fulfillment==='retirada'?'retirada':'entrega'}`,dinheiro:`Dinheiro no ato da ${fulfillment==='retirada'?'retirada':'entrega'}`}[method]||'Não informado');
  const labels={novo:'Em espera',confirmado:'Confirmado, aguardando preparo',preparando:'Em produção',saiu:'Saiu para entrega',pronto:'Pronto para retirada',concluido:'Pedido concluído',cancelado:'Pedido cancelado'};
  const descriptions={novo:'Seu pedido ainda não foi aceito. Aguarde a confirmação da lanchonete para saber se ele será preparado.',confirmado:'A lanchonete confirmou seu pedido. Em breve ele entrará em produção.',preparando:'A equipe está preparando os itens do seu pedido.',saiu:'Seu pedido já está a caminho do endereço informado.',pronto:'Seu pedido está pronto. Você já pode retirá-lo na lanchonete.',concluido:'Obrigado por pedir no Mestre dos Lanches!',cancelado:'A lanchonete cancelou este pedido. Ele não seguirá para entrega ou retirada. Entre em contato para saber o motivo.'};
  let tracking,busy=false,finished=false,loadedId;
  function fromHash(){try{const [id,token]=location.hash.slice(1).split('/').map(decodeURIComponent);const record={id,token};return saved.valid(record)?record:null;}catch{return null;}}
  tracking=location.hash?fromHash():saved.read()[0];
  const summaries=new Map();let listBusy=false,lastListRefresh=0,orderFilter='pedidos';
  const matchesFilter=record=>orderFilter==='cancelados'?summaries.get(record.id)?.status==='cancelado':summaries.get(record.id)?.status!=='cancelado';
  function renderCards(){
    const all=saved.read(),records=all.filter(matchesFilter);$('#customer-orders-section').hidden=!all.length;$('#customer-order-empty').hidden=!!records.length;
    $('#customer-order-list').replaceChildren(...records.map(record=>{
      const order=summaries.get(record.id),button=document.createElement('button'),info=document.createElement('span'),title=document.createElement('strong'),detail=document.createElement('small'),state=document.createElement('span');
      button.type='button';button.className='customer-order-card';button.setAttribute('data-customer-order',record.id);button.setAttribute('aria-pressed',String(record.id===tracking?.id));
      title.textContent='Pedido #'+(order?.code || record.code || record.id.slice(0,8).toUpperCase());
      detail.textContent=order?date(order.createdAt)+' | '+money(order.totalCents):record.createdAt?date(record.createdAt):'Selecione para acompanhar';
      state.className='customer-order-state';state.textContent=order?labels[order.status]:'Consultar andamento';info.append(title,detail);button.append(info,state);return button;
    }));
  }
  function filterOrders(value){
    orderFilter=value;
    $('#show-my-orders').setAttribute('aria-pressed',String(value==='pedidos'));$('#show-my-orders').className='tab'+(value==='pedidos'?' active':'');
    $('#show-cancelled-orders').setAttribute('aria-pressed',String(value==='cancelados'));$('#show-cancelled-orders').className='tab'+(value==='cancelados'?' active':'');
    const records=saved.read().filter(matchesFilter);renderCards();
    $('#tracking-picker').hidden=true;
    if(records.length)select(records.find(item=>item.id===tracking?.id)||records[0]);else{$('#tracking-content').hidden=true;$('#tracking-message').textContent='';}
  }
  $('#show-my-orders').addEventListener('click',()=>filterOrders('pedidos'));
  $('#show-cancelled-orders').addEventListener('click',()=>filterOrders('cancelados'));
  async function refreshOthers(){
    if(listBusy || document.hidden || Date.now()-lastListRefresh<15000)return;
    listBusy=true;lastListRefresh=Date.now();
    try{await Promise.all(saved.read().filter(record=>record.id!==tracking?.id && !['concluido','cancelado'].includes(summaries.get(record.id)?.status)).map(async record=>{
      try{const response=await fetch('/api/orders/'+record.id,{headers:{Authorization:'Bearer '+record.token},cache:'no-store'});if(!response.ok)return;const order=await window.MDLHttp.readJson(response);if(order.id===record.id && labels[order.status])summaries.set(record.id,order);}catch{}
    }));renderCards();}finally{listBusy=false;}
  }
  $('#customer-order-list').addEventListener('click',event=>{const button=event.target.closest('[data-customer-order]');if(!button)return;const record=saved.read().find(item=>item.id===button.getAttribute('data-customer-order'));if(record)select(record);});
  function renderPicker(){
    renderCards();
    const records=saved.read().filter(matchesFilter);$('#tracking-picker').hidden=records.length<2;
    $('#tracking-select').replaceChildren(...records.map(record=>{const option=document.createElement('option');option.value=record.id;option.textContent=`Pedido #${record.code || record.id.slice(0,8).toUpperCase()}${record.createdAt?` · ${date(record.createdAt)}`:''}`;option.selected=record.id===tracking?.id;return option;}));
  }
  function renderSteps(order){
    const pickup=order.fulfillment==='retirada';
    const names=['Em espera','Aceito','Em produção',pickup?'Pronto para retirada':'Saiu para entrega',pickup?'Retirado':'Entregue'];
    const current={novo:0,confirmado:1,preparando:2,saiu:3,pronto:3,concluido:4}[order.status];
    $('#tracking-steps').hidden=order.status==='cancelado';
    $('#tracking-steps').replaceChildren(...names.map((name,index)=>{const item=document.createElement('li'),number=document.createElement('span'),label=document.createElement('strong');item.className=index<current?'complete':index===current?'current':'';if(index===current)item.setAttribute('aria-current','step');number.textContent=index<current?'✓':String(index+1);number.setAttribute('aria-hidden','true');label.textContent=name;item.append(number,label);return item;}));
  }
  async function refresh(){
    if(busy||finished||document.hidden)return;
    if(!tracking){$('#tracking-message').textContent=location.hash?'O link do pedido está incompleto. Confira o endereço que você recebeu.':'';$('#tracking-empty').hidden=false;return;}
    busy=true;const requested=tracking;
    try{
      const response=await fetch(`/api/orders/${encodeURIComponent(requested.id)}`,{headers:{Authorization:`Bearer ${requested.token}`},cache:'no-store'});
      const order=await window.MDLHttp.readJson(response);
      if(requested.id!==tracking?.id)return;
      if(!response.ok){if(response.status===404)finished=true;throw Error(order.error || 'Não foi possível consultar o pedido.');}
      if(order.id!==requested.id||!Array.isArray(order.items)||!Array.isArray(order.history)||!labels[order.status])throw Error('A resposta do pedido chegou incompleta. Tente atualizar novamente.');
      summaries.set(order.id,order);
      saved.save({...requested,code:order.code,createdAt:order.createdAt});renderPicker();loadedId=requested.id;
      $('#tracking-empty').hidden=true;$('#tracking-content').hidden=!matchesFilter(requested);$('#tracking-message').textContent='';$('#tracking-code').textContent=`Pedido #${order.code}`;$('#tracking-status').textContent=labels[order.status];$('#tracking-description').textContent=descriptions[order.status];$('#tracking-updated').textContent=`Última mudança: ${date(order.updatedAt)}`;
      renderSteps(order);
      $('#tracking-history').replaceChildren(...order.history.map(item=>{const li=document.createElement('li'),strong=document.createElement('strong'),small=document.createElement('small');strong.textContent=labels[item.status]||item.status;small.textContent=date(item.at);li.append(strong,small);return li;}));
      $('#tracking-items').replaceChildren(...order.items.map(item=>{const li=document.createElement('li'),name=document.createElement('span'),price=document.createElement('strong');name.textContent=`${item.qty} × ${item.name}`;price.textContent=money(item.qty*item.unitPriceCents);li.append(name,price);return li;}));
      $('#tracking-subtotal').textContent=money(order.subtotalCents);$('#tracking-fee').textContent=order.deliveryFeeCents===0?'Grátis':money(order.deliveryFeeCents);$('#tracking-total').textContent=money(order.totalCents);$('#tracking-fulfillment').textContent=order.fulfillment==='entrega'?'Entrega no endereço informado no pedido.':'Retirada: Rua José Adalberto, 194 — Santa Margarida, Salgueiro.';$('#tracking-payment').textContent='Pagamento: '+paymentLabel(order.paymentMethod,order.fulfillment)+(order.paymentMethod==='dinheiro'?(order.needsChange?' | Troco para '+money(order.changeForCents):' | Sem troco'):'');
      finished=['concluido','cancelado'].includes(order.status);
    }catch(error){if(requested.id===tracking?.id)$('#tracking-message').textContent=error.message==='Failed to fetch'?'Sem conexão. Seu pedido continua salvo; vamos tentar atualizar novamente.':error.message;}
    finally{busy=false;if(requested.id!==tracking?.id)refresh();}
  }
  function select(record){tracking=record;finished=false;loadedId=null;$('#tracking-content').hidden=true;$('#tracking-message').textContent='Buscando seu pedido…';try{window.history.replaceState(null,'',location.pathname || 'acompanhar.html');}catch{/* O acompanhamento continua em memória. */}refresh();}
  $('#tracking-select').addEventListener('change',event=>{const record=saved.read().find(record=>record.id===event.target.value);if(record)select(record);});
  $('#tracking-refresh').addEventListener('click',()=>{finished=false;refresh();});
  window.addEventListener('hashchange',()=>{const record=fromHash();if(record)select(record);});
  renderPicker();refreshOthers();refresh();setInterval(()=>{refreshOthers();refresh();},5000);document.addEventListener('visibilitychange',refresh);
})();
