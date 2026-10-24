(() => {
  const paymentLabel=(method,fulfillment)=>({pix:fulfillment==='retirada'?'Pix no ato da retirada':'Pix no ato da entrega',cartao:fulfillment==='retirada'?'Cart\u00e3o no ato da retirada':'Cart\u00e3o no ato da entrega',dinheiro:fulfillment==='retirada'?'Dinheiro no ato da retirada':'Dinheiro no ato da entrega'}[method] || 'N\u00e3o informado');
  const $=selector=>document.querySelector(selector);
  const money=value=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value/100);
  const date=value=>new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Recife',dateStyle:'short',timeStyle:'short'}).format(new Date(value));
  const day=value=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Recife',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
  const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const labels={novo:'Recebido',confirmado:'Confirmado',preparando:'Em preparo',saiu:'Saiu para entrega',pronto:'Pronto para retirada',concluido:'Concluído',cancelado:'Cancelado'};
  let orders=[],catalog,selected,setup=false,connected=false,fetching=false;
  async function api(url,options={}) {
    const response=await fetch(url,{...options,headers:{'Content-Type':'application/json',...options.headers}});
    if(response.status===401)showLogin();
    const result=await window.MDLHttp.readJson(response);
    if(!response.ok){if(response.status===401)showLogin();if(result.code==='CONFIGURATION_REQUIRED' && Array.isArray(result.missing))throw Error('O backend est? sem configura??o: '+result.missing.join(', ')+'. Salve essas vari?veis no projeto Mestrebackend do Vercel e fa?a um novo deploy.');throw Error(result.error || 'Não foi possível concluir.');}
    return result;
  }
  const message=text=>{$('#admin-message').textContent=text;};
  function showLogin(){connected=false;$('#admin-content').hidden=true;$('#login-section').hidden=false;$('#logout').hidden=true;$('#order-detail').close();if(!setup){$('#login-title').textContent='Entrar no painel';$('#login-description').textContent='Use a senha da lanchonete para gerenciar os pedidos.';$('#admin-password').autocomplete='current-password';$('#login-button').textContent='Entrar';}}
  async function enter(){
    catalog=await api('/api/catalog');connected=true;$('#admin-content').hidden=false;$('#login-section').hidden=true;$('#logout').hidden=false;$('#admin-password').value='';message('');renderProducts();await loadOrders();
  }
  function renderOrders(){
    const filter=$('#order-filter').value,search=$('#order-search').value.toLowerCase().trim();
    const list=orders.filter(order=>(filter==='all'||(filter==='active'?!['concluido','cancelado'].includes(order.status):order.status===filter))&&`${order.code} ${order.customer}`.toLowerCase().includes(search));
    $('#count-new').textContent=orders.filter(order=>order.status==='novo').length;
    $('#count-active').textContent=orders.filter(order=>['confirmado','preparando','saiu','pronto'].includes(order.status)).length;
    $('#count-done').textContent=orders.filter(order=>order.status==='concluido' && day(order.updatedAt)===day(Date.now())).length;
    $('#orders-list').innerHTML=list.map(order=>`<article class="admin-order"><div><h3>#${order.code}</h3><small>${date(order.createdAt)}</small></div><div><strong>${escape(order.customer)}</strong><small>${order.items.reduce((sum,item)=>sum+item.qty,0)} itens · ${order.fulfillment==='entrega'?'Entrega':'Retirada'}</small><span class="order-status status-${order.status}">${labels[order.status]}</span></div><strong>${money(order.totalCents)}</strong><button class="btn btn-ghost" data-order="${order.id}">Ver pedido</button></article>`).join('')||'<div class="empty-orders"><h2>Nenhum pedido por aqui</h2><p>Os pedidos recebidos pela loja aparecerão nesta área.</p></div>';
  }
  async function loadOrders(){
    if(!connected || fetching)return;
    fetching=true;
    try{
      const result=await api('/api/admin/orders');
      const changed=JSON.stringify(result.orders)!==JSON.stringify(orders);
      window.MDLAlerts?.ingest(result.orders);
      orders=result.orders;
      if(changed || !$('#orders-list').innerHTML)renderOrders();
      if(selected && $('#order-detail').open && changed){selected=orders.find(item=>item.id===selected.id);renderDetail();}
      $('#sync-status').textContent=`Última atualização às ${new Intl.DateTimeFormat('pt-BR',{timeStyle:'short'}).format(new Date())}`;
    }catch(error){$('#sync-status').textContent='Sem conexão. Tentando novamente…';message(error.message);}
    finally{fetching=false;}
  }
  function renderStoreStatus(){
    $('#store-state-label').textContent=catalog.acceptingOrders?'Loja aberta':'Loja fechada';
    $('#toggle-store').textContent=catalog.acceptingOrders?'Fechar loja':'Abrir loja';
    $('#accepting-orders').checked=catalog.acceptingOrders;
  }
  $('#toggle-store').addEventListener('click',async()=>{
    const button=$('#toggle-store');button.disabled=true;
    try{Object.assign(catalog,await api('/api/admin/store-status',{method:'PATCH',body:JSON.stringify({acceptingOrders:!catalog.acceptingOrders})}));renderStoreStatus();message(catalog.acceptingOrders?'Loja aberta para receber pedidos.':'Loja fechada para novos pedidos.');}catch(error){message(error.message);}finally{button.disabled=false;}
  });
  function renderProducts(){
    renderStoreStatus();
    $('#accepting-orders').checked=catalog.acceptingOrders;
    $('#delivery-fee').value=catalog.deliveryFeeCents===null?'':(catalog.deliveryFeeCents/100).toFixed(2);
    $('#minimum-order').value=catalog.minimumSubtotalCents===null?'':(catalog.minimumSubtotalCents/100).toFixed(2);
    $('#admin-products').innerHTML=catalog.cardapio.flatMap(group=>group.itens.map(item=>`<form class="product-editor" data-product="${item.id}"><div><h3>${escape(item.nome)}</h3><p class="muted">${escape(group.nome)}</p>${item.pedidoPendente?'<p class="muted">Op??es do combo a confirmar.</p>':''}</div><label class="field">Preço (R$)<input name="price" aria-label="Preço de ${escape(item.nome)}" type="number" min="0" max="10000" step="0.01" inputmode="decimal" value="${item.preco===null?'':item.preco.toFixed(2)}"></label><label class="checkbox-field"><input name="active" type="checkbox" ${item.ativo?'checked':''}> Disponível</label><button class="btn btn-ghost" type="submit">Salvar</button></form>`)).join('');
  }
  function renderDetail(){
    if(!selected)return;
    $('#detail-title').textContent=`Pedido #${selected.code}`;
    $('#detail-content').innerHTML=`<p><span class="order-status status-${selected.status}">${labels[selected.status]}</span> <span class="muted">${date(selected.createdAt)}</span></p><ul class="detail-list">${selected.items.map(item=>`<li><span>${item.qty} × ${escape(item.name)}</span><strong>${money(item.qty*item.unitPriceCents)}</strong></li>`).join('')}</ul><div class="detail-total"><span>Produtos</span><span>${money(selected.subtotalCents)}</span></div><div class="detail-total"><span>Entrega</span><span>${money(selected.deliveryFeeCents)}</span></div><div class="detail-total"><strong>Total</strong><strong>${money(selected.totalCents)}</strong></div><div class="detail-customer"><p><strong>${escape(selected.customer)}</strong></p><p>WhatsApp: <a href="tel:${selected.phone}">${escape(selected.phone)}</a></p><p>${selected.fulfillment==='entrega'?`Entrega: ${escape(selected.address)}`:'Retirada na lanchonete'}</p>${selected.notes?`<p>Observações: ${escape(selected.notes)}</p>`:''}<p><strong>Pagamento:</strong> ${paymentLabel(selected.paymentMethod,selected.fulfillment)}</p><p>${selected.paymentMethod==='dinheiro'?(selected.needsChange===true?'Troco para '+money(selected.changeForCents)+'; levar '+money(selected.changeForCents-selected.totalCents)+'.':selected.needsChange===false?'Não precisa de troco.':'Troco não informado.'):'Troco: não se aplica.'}</p></div><ol class="detail-history">${selected.history.map(item=>`<li>${labels[item.status]} · ${date(item.at)}</li>`).join('')}</ol>`;
    if(selected.fulfillment==='entrega' && selected.addressValidation?.level!=='street') {
      const notice=document.createElement('p');notice.className='order-notice';notice.textContent=selected.addressValidation?.reviewedAt?'Rua conferida pela equipe.':'O CEP confirma a cidade, mas a rua ainda precisa de confer?ncia com o cliente.';$('#detail-content').append(notice);
      if(selected.status==='novo') { const label=document.createElement('label');label.className='checkbox-field';const input=document.createElement('input');input.type='checkbox';input.id='address-review';label.append(input,document.createTextNode('Conferi a rua e os dados de entrega com o cliente.'));$('#detail-content').append(label); }
    }
    const next={novo:['confirmado','Confirmar pedido'],confirmado:['preparando','Iniciar preparo'],preparando:selected.fulfillment==='entrega'?['saiu','Saiu para entrega']:['pronto','Pronto para retirada'],saiu:['concluido','Marcar como entregue'],pronto:['concluido','Marcar como retirado']}[selected.status];
    $('#detail-actions').innerHTML=(next?`<button type="button" class="btn btn-gold" data-status="${next[0]}">${next[1]}</button>`:'')+`<a class="btn btn-ghost" href="imprimir.html#${selected.id}" target="_blank" rel="noopener">Imprimir pedido</a>`+(['novo','confirmado','preparando'].includes(selected.status)?'<button type="button" class="btn btn-danger" data-status="cancelado">Cancelar pedido</button>':'');
  }
  $('#login-form').addEventListener('submit',async event=>{
    event.preventDefault();window.MDLAlerts?.enable();const button=$('#login-button');button.disabled=true;
    try{await api(setup?'/api/admin/setup':'/api/admin/login',{method:'POST',body:JSON.stringify({password:$('#admin-password').value})});setup=false;await enter();}catch(error){message(error.message);}finally{button.disabled=false;}
  });
  $('#logout').addEventListener('click',async()=>{try{await api('/api/admin/logout',{method:'POST',body:'{}'});window.location.assign('index.html');}catch(error){message(error.message);}});
  $('#refresh-orders').addEventListener('click',loadOrders);
  function syncOrderTabs(){
    const cancelled=$('#order-filter').value==='cancelado';
    $('#admin-current-orders').className='tab'+(!cancelled?' active':'');$('#admin-current-orders').setAttribute('aria-pressed',String(!cancelled));
    $('#admin-cancelled-orders').className='tab'+(cancelled?' active':'');$('#admin-cancelled-orders').setAttribute('aria-pressed',String(cancelled));
  }
  $('#admin-current-orders').addEventListener('click',()=>{$('#order-filter').value='active';syncOrderTabs();renderOrders();});
  $('#admin-cancelled-orders').addEventListener('click',()=>{$('#order-filter').value='cancelado';syncOrderTabs();renderOrders();});
  $('#order-filter').addEventListener('change',()=>{syncOrderTabs();renderOrders();});$('#order-search').addEventListener('input',renderOrders);
  document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>{
    document.querySelectorAll('[data-view]').forEach(item=>{item.classList.toggle('active',item===button);item.setAttribute('aria-pressed',String(item===button));});$('#orders-section').hidden=button.dataset.view!=='orders';$('#catalog-section').hidden=button.dataset.view!=='catalog';message('');
  }));
  $('#settings-form').addEventListener('submit',async event=>{
    event.preventDefault();const button=event.submitter;button.disabled=true;
    try{const value=$('#delivery-fee').value,minimum=$('#minimum-order').value;const result=await api('/api/admin/settings',{method:'PATCH',body:JSON.stringify({deliveryFeeCents:value===''?null:Math.round(Number(value)*100),minimumSubtotalCents:minimum===''?null:Math.round(Number(minimum)*100),acceptingOrders:$('#accepting-orders').checked})});Object.assign(catalog,result);renderStoreStatus();message('Configuração salva.');}catch(error){message(error.message);}finally{button.disabled=false;}
  });
  $('#admin-products').addEventListener('submit',async event=>{
    event.preventDefault();const form=event.target,button=event.submitter;button.disabled=true;
    try{const price=form.elements.price.value;await api(`/api/admin/products/${form.dataset.product}`,{method:'PATCH',body:JSON.stringify({priceCents:price===''?null:Math.round(Number(price)*100),active:form.elements.active.checked})});message('Produto atualizado.');}catch(error){message(error.message);}finally{button.disabled=false;}
  });
  $('#orders-list').addEventListener('click',event=>{const button=event.target.closest('[data-order]');if(!button)return;selected=orders.find(item=>item.id===button.dataset.order);$('#detail-message').textContent='';renderDetail();$('#order-detail').showModal();document.body.classList.add('has-modal');});
  $('#detail-close').addEventListener('click',()=>$('#order-detail').close());
  $('#order-detail').addEventListener('close',()=>document.body.classList.remove('has-modal'));
  $('#detail-actions').addEventListener('click',async event=>{
    const button=event.target.closest('[data-status]');if(!button || button.disabled)return;
    if(button.dataset.status==='cancelado'&&!window.confirm('Cancelar este pedido? O cliente verá o cancelamento.'))return;
    const printWindow=button.dataset.status==='confirmado'?window.open('about:blank','_blank'):null;
    if(printWindow)printWindow.document.title='Preparando comprovante';
    button.disabled=true;
    try{selected=await api(`/api/admin/orders/${selected.id}`,{method:'PATCH',body:JSON.stringify({status:button.dataset.status,version:selected.version,addressReviewed:$("#address-review")?.checked===true})});if(button.dataset.status==='confirmado'){if(printWindow)printWindow.location.replace('imprimir.html?auto=1#'+selected.id);else $('#detail-message').textContent='Pedido confirmado. Permita pop-ups ou use Imprimir pedido para abrir o comprovante.';}renderDetail();await loadOrders();}catch(error){if(printWindow)printWindow.close();$('#detail-message').textContent=error.message;button.disabled=false;}
  });
  async function start(){try{const session=await api('/api/admin/session');setup=session.needsSetup;if(session.authenticated){await api('/api/admin/logout',{method:'POST',body:'{}'});}showLogin();if(setup){$('#login-title').textContent='Crie o acesso da lanchonete';$('#login-description').textContent='Defina uma senha com pelo menos 12 caracteres. Guarde-a para os próximos acessos.';$('#admin-password').minLength=12;$('#admin-password').autocomplete='new-password';$('#login-button').textContent='Criar acesso';}}catch{message('Não foi possível conectar ao servidor da loja.');}}
  start();setInterval(loadOrders,5000);document.addEventListener('visibilitychange',loadOrders);
})();
