(async () => {
  const d = window.MDL;
  const $ = (selector) => document.querySelector(selector);
  let customerName = '';
  try { customerName = (sessionStorage.getItem('mdl-customer-name') || '').trim(); } catch { /* A tela inicial permite entrar novamente. */ }
  try { customerName=(localStorage.getItem('mdl-customer-name') || customerName).trim(); } catch {}
  if (customerName.length < 2 || customerName.length > 80) { window.location.replace('index.html?entrada=cliente');return; }
  $('#customer-greeting').textContent = `Olá, ${customerName}!`;
  $('#customer-name').value = customerName;
  const customerFields={'#customer-phone':25,'#delivery-address':120,'#delivery-number':12,'#delivery-neighborhood':80,'#delivery-complement':100};
  try{
    const cached=JSON.parse(localStorage.getItem('mdl-customer-details-v1') || '{}');
    for(const [selector,max] of Object.entries(customerFields))if(typeof cached[selector]==='string')$(selector).value=cached[selector].slice(0,max);
  }catch{}
  function rememberCustomer(){
    const fields={};for(const [selector,max] of Object.entries(customerFields))fields[selector]=$(selector).value.slice(0,max);
    try{localStorage.setItem('mdl-customer-details-v1',JSON.stringify(fields));const name=$('#customer-name').value.trim().replace(/\s+/g,' ');if(name.length>=2 && name.length<=80)localStorage.setItem('mdl-customer-name',name);}catch{}
  }
  $('#checkout-form').addEventListener('input',rememberCustomer);
  $('#checkout-form').addEventListener('change',rememberCustomer);
  let online = false;
  let config = { deliveryFeeCents:null, acceptingOrders:false };
  try {
    const response = await fetch('/api/catalog', {cache:'no-store'});
    if (!response.ok) throw Error('Catálogo indisponível');
    config = await window.MDLHttp.readJson(response);
    d.cardapio = config.cardapio;
    d.operatingConfig = config;
    online = true;
  } catch {
    $('#store-message').textContent = 'Não foi possível conectar à loja. Atualize a página para tentar novamente.';
  }
  if (online && !config.acceptingOrders) $('#store-message').textContent = 'A loja está fechada no momento. Você pode consultar o cardápio.';
  window.MDLTime?.fillStatus?.();
  if (online) $('#delivery-badge').textContent = config.deliveryFeeCents === 0 ? 'Entrega grátis' : config.deliveryFeeCents === null ? 'Entrega ou retirada' : `Entrega ${new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(config.deliveryFeeCents/100)}`;
  if (online && Number.isInteger(config.minimumSubtotalCents)) $('#shop-minimum').textContent = `Pedido mínimo: ${new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(config.minimumSubtotalCents/100)}`;
  const money = (value) => new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' }).format(value);
  const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const products = d.cardapio.flatMap(group => group.itens.filter(item => item.ativo !== false).map((item, index) => ({ ...item, id: item.id || `${group.id}-${index}`, category:group.id, categoryName:group.nome })));
  const byId = new Map(products.map(item => [item.id,item]));
  $('#category-filters').innerHTML='<button type="button" class="tab active" data-category="todos" aria-pressed="true">Tudo</button>'+d.cardapio.filter(group=>products.some(item=>item.category===group.id)).map(group=>`<button type="button" class="tab" data-category="${escape(group.id)}" aria-pressed="false">${escape(group.nome)}</button>`).join('');
  const priceKnown = (item) => Number.isFinite(item.preco) && item.preco >= 0;
  const storageKey = 'mdl-sacola-v1';
  let cart = [];
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
    if (Array.isArray(saved)) {
      const quantities = new Map();
      saved.forEach(line => { if (line && byId.has(line.id) && Number.isInteger(line.qty) && line.qty > 0) quantities.set(line.id,Math.min(99,(quantities.get(line.id)||0)+line.qty)); });
      cart = [...quantities].map(([id,qty]) => ({id,qty}));
    }
  } catch { /* O pedido continua funcionando quando o armazenamento está indisponível. */ }
  let category = 'todos';
  let query = '';
  let feedbackTimer;
  let sending = false;
  let requestKey;
  let lastPayload;
  try { requestKey = sessionStorage.getItem('mdl-pending-request'); lastPayload = sessionStorage.getItem('mdl-pending-payload'); } catch { /* A sessão pode bloquear armazenamento. */ }
  const normalize = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

  function renderCatalog() {
    const filtered = products.filter(item => (category === 'todos' || item.category === category) && normalize(item.nome+' '+item.desc).includes(normalize(query)));
    $('#catalog').innerHTML = d.cardapio.map(group => {
      const items = filtered.filter(item => item.category === group.id);
      if (!items.length) return '';
      return `<section class="catalog-group" aria-labelledby="group-${group.id}"><h2 id="group-${group.id}">${escape(group.nome)}</h2><div class="product-list">${items.map(item => `<article class="product-card">${item.imagem?`<img class="product-photo${item.category==='bebidas'?' product-photo-drink':''}" src="${escape(item.imagem)}" alt="${escape(item.imagemAlt || item.nome)}" width="116" height="116" loading="lazy" decoding="async">`:""}<div class="product-info"><h3>${escape(item.nome)}</h3><p>${escape(item.desc)}</p><strong class="product-price">${priceKnown(item) ? money(item.preco) : Number.isFinite(item.precoInicial) ? 'A partir de '+money(item.precoInicial) : 'Preço a consultar'}</strong>${item.pedidoPendente?'<p class="product-pending">Opções do combo a confirmar com a lanchonete.</p>':''}</div><button class="product-add" type="button" data-add="${item.id}" aria-label="Adicionar ${escape(item.nome)} à sacola" ${item.pedidoPendente?'disabled':''}>${item.pedidoPendente?'A confirmar':'+'}</button></article>`).join('')}</div></section>`;
    }).join('') || '<p class="empty-search">Nenhum item encontrado. Tente outro nome ou categoria.</p>';
    $('#search-count').textContent = `${filtered.length} ${filtered.length === 1 ? 'produto encontrado' : 'produtos encontrados'}`;
  }

  function totals() {
    return { qty:cart.reduce((sum,line) => sum+line.qty,0), complete:cart.every(line => priceKnown(byId.get(line.id))), subtotal:cart.reduce((sum,line) => sum+(priceKnown(byId.get(line.id)) ? byId.get(line.id).preco*line.qty : 0),0) };
  }

  function renderCart() {
    const {qty,complete,subtotal} = totals();
    const minimum=config.minimumSubtotalCents;
    const missing=minimum === null || minimum === undefined ? null : Math.max(0,minimum-Math.round(subtotal*100));
    $('#cart-items').innerHTML = cart.length ? cart.map(line => {
      const item = byId.get(line.id);
      return `<article class="cart-item"><div class="cart-item-top"><div><h3>${escape(item.nome)}</h3><small>${priceKnown(item) ? money(item.preco*line.qty) : 'Preço a consultar'}</small></div><button type="button" class="cart-remove" data-remove="${line.id}" aria-label="Remover ${escape(item.nome)}">Remover</button></div><div class="quantity-control"><button type="button" data-change="${line.id}" data-step="-1" aria-label="Diminuir quantidade de ${escape(item.nome)}">−</button><span aria-label="Quantidade">${line.qty}</span><button type="button" data-change="${line.id}" data-step="1" aria-label="Aumentar quantidade de ${escape(item.nome)}" ${line.qty >= 99 ? 'disabled' : ''}>+</button></div></article>`;
    }).join('') : '<p class="cart-empty">Sua sacola está vazia.<br>Escolha os itens do seu pedido.</p>';
    $('#cart-count').textContent = `${qty} ${qty === 1 ? 'item' : 'itens'}`;
    $('#cart-subtotal').textContent = qty ? (complete ? money(subtotal) : 'A confirmar') : money(0);
    $('#review-order').disabled = !qty || !complete || missing !== 0 || !online || !config.acceptingOrders || config.canOrder === false;
    $('#cart-delivery').textContent = config.deliveryFeeCents === null ? 'A confirmar' : config.deliveryFeeCents === 0 ? 'Grátis' : money(config.deliveryFeeCents/100);
    $('#cart-minimum').textContent = missing === null ? 'Consulte a lanchonete sobre o pedido mínimo.' : !complete ? `Pedido mínimo: ${money(minimum/100)} em produtos.` : missing > 0 ? `Faltam ${money(missing/100)} para atingir o pedido mínimo de ${money(minimum/100)}.` : `Pedido mínimo de ${money(minimum/100)} atingido.`;
    $('#mobile-cart-count').textContent = `${qty} ${qty === 1 ? 'item' : 'itens'}`;
    $('#mobile-cart').hidden = !qty;
    try { localStorage.setItem(storageKey,JSON.stringify(cart)); } catch { /* Mantém a sacola em memória. */ }
  }

  function feedback(message) {
    $('#order-feedback').textContent = message;
    clearTimeout(feedbackTimer);
    feedbackTimer = setTimeout(() => { $('#order-feedback').textContent = ''; },2200);
  }

  $('#catalog').addEventListener('click', event => {
    const button = event.target.closest('[data-add]');
    if (!button) return;
    if(byId.get(button.dataset.add)?.pedidoPendente)return feedback('Consulte a lanchonete sobre as opções deste combo.');
    const line = cart.find(item => item.id === button.dataset.add);
    if (line && line.qty >= 99) return feedback('Limite de 99 unidades por item.');
    if (line) line.qty++; else cart.push({id:button.dataset.add,qty:1});
    renderCart();
    feedback(`${byId.get(button.dataset.add).nome} adicionado à sacola`);
  });
  $('#cart-items').addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    const id = button.dataset.remove || button.dataset.change;
    const line = cart.find(item => item.id === id);
    if (!line) return;
    if (button.dataset.remove) cart = cart.filter(item => item.id !== id);
    else { line.qty = Math.min(99,line.qty+Number(button.dataset.step)); cart = cart.filter(item => item.qty > 0); }
    renderCart();
    const replacement = [...$('#cart-items').querySelectorAll('button')].find(item => item.dataset.change === id && item.dataset.step === button.dataset.step);
    (replacement || $('#review-order')).focus();
  });
  $('#product-search').addEventListener('input',event => { query=event.target.value.trim();renderCatalog(); });
  $('#category-filters').addEventListener('click',event => {
    const button = event.target.closest('[data-category]');
    if (!button) return;
    category = button.dataset.category;
    document.querySelectorAll('[data-category]').forEach(item => { item.classList.toggle('active',item === button);item.setAttribute('aria-pressed',String(item === button)); });
    renderCatalog();
  });
  $('#mobile-cart').addEventListener('click',() => { $('#cart').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});$('#review-order').focus({preventScroll:true}); });

  const modal = $('#checkout-modal');
  $('#delivery-cep').value='56000-000';
  $('#delivery-cep').readOnly=true;
  let confirmedCep='';
  async function lookupCep(){
    const cep='56000000';
    $('#address-message').textContent='Verificando o endereço em Salgueiro…';
    try{
      const response=await fetch(`/api/address/${cep}`),record=await window.MDLHttp.readJson(response);
      if(!response.ok)throw Error(record.error || 'Não foi possível consultar o CEP.');
      confirmedCep=cep;
      $('#delivery-address').readOnly=!!record.street;$('#delivery-neighborhood').readOnly=!!record.neighborhood;
      if(record.street)$('#delivery-address').value=record.street;
      if(record.neighborhood)$('#delivery-neighborhood').value=record.neighborhood;
      $('#address-message').textContent=record.level==='street'?'Rua e cidade localizadas pelo CEP. Confira o número do imóvel.':'CEP geral de Salgueiro confirmado. Preencha rua, número e bairro; a lanchonete precisará conferir a rua.';
      return true;
    }catch(error){confirmedCep='';$('#address-message').textContent=error.message==='Failed to fetch'?'Não foi possível consultar o CEP agora. Tente novamente.':error.message;return false;}
  }
  function updateCashFields(){
    const cash=document.querySelector('[name="payment-method"]:checked')?.value==='dinheiro';
    $('#cash-change-fields').hidden=!cash;$('#cash-change-fields').disabled=!cash;
    const needs=cash && $('#needs-change').value==='sim';
    $('#change-for-field').hidden=!needs;$('#change-for').disabled=!needs;$('#change-for').required=needs;
  }
  document.querySelectorAll('[name="payment-method"]').forEach(input=>input.addEventListener('change',updateCashFields));
  $('#needs-change').addEventListener('change',updateCashFields);
  $('#change-for').addEventListener('input',()=>$('#change-for').setCustomValidity(''));
  function updateCheckout() {
    updateCashFields();
    $('#checkout-dismiss').disabled=sending;
    const delivery = document.querySelector('[name="fulfillment"]:checked').value === 'entrega';
    document.querySelectorAll('[data-payment-timing]').forEach(element=>{element.textContent=delivery?'No ato da entrega':'No ato da retirada';});
    const {complete,subtotal} = totals();
    const fee = delivery ? config.deliveryFeeCents : 0;
    const minimum=config.minimumSubtotalCents;
    const enough=Number.isInteger(minimum) && Math.round(subtotal*100) >= minimum;
    const ready = complete && fee !== null && enough;
    $('#checkout-products-total').textContent = complete ? money(subtotal) : 'A confirmar';
    $('#checkout-delivery-total').textContent = fee === null ? 'A confirmar' : fee === 0 ? 'Grátis' : money(fee/100);
    $('#checkout-total').textContent = complete && fee !== null ? money(subtotal+fee/100) : 'A confirmar';
    $('#checkout-submit').disabled = sending || !ready || !online || !config.acceptingOrders || config.canOrder === false;
    $('#checkout-price-message').hidden = ready;
    $('#checkout-price-message').textContent = !complete ? 'Há produtos com preço ainda não informado pela lanchonete. O envio ficará disponível quando os valores forem confirmados.' : !Number.isInteger(minimum) ? 'Consulte a lanchonete para confirmar o pedido mínimo.' : !enough ? `O pedido mínimo é ${money(minimum/100)}. Adicione mais itens à sacola para continuar.` : 'A taxa de entrega ainda não foi informada. Você pode escolher retirada na lanchonete.';
  }
  $('#checkout-form').addEventListener('submit',async event => {
    event.preventDefault();
    if (sending || $('#checkout-submit').disabled) return;
    const name=$('#customer-name');
    name.setCustomValidity(name.value.trim().length >= 2 ? '' : 'Informe seu nome.');
    const phone=$('#customer-phone');
    phone.setCustomValidity(/^(?:55)?\d{10,11}$/.test(phone.value.replace(/\D/g,'')) ? '' : 'Informe o WhatsApp com DDD.');
    const address=$('#delivery-address');
    const fulfillment=document.querySelector('[name="fulfillment"]:checked').value;
    address.setCustomValidity(fulfillment !== 'entrega' || address.value.trim().length >= 3 ? '' : 'Informe o nome completo da rua.');
    if (!$('#checkout-form').reportValidity()) return;
    if(fulfillment==='entrega' && confirmedCep!=='56000000' && !await lookupCep())return;
    if(sending)return;
    const deliveryAddress=fulfillment==='entrega'?{cep:'56000000',street:address.value.trim(),number:$('#delivery-number').value.trim(),neighborhood:$('#delivery-neighborhood').value.trim(),complement:$('#delivery-complement').value.trim()}:undefined;
    const paymentMethod=document.querySelector('[name="payment-method"]:checked')?.value;
    if (!['pix','cartao','dinheiro'].includes(paymentMethod)) { $('#checkout-error').textContent='Selecione a forma de pagamento.';return; }
    const cash=paymentMethod==='dinheiro',choice=$('#needs-change').value;
    if(cash && !['sim','nao'].includes(choice)){$('#checkout-error').textContent='Informe se precisa de troco.';return;}
    const needsChange=cash && choice==='sim';
    const changeForCents=needsChange?Math.round(Number($('#change-for').value)*100):null;
    const totalCents=Math.round(totals().subtotal*100)+(fulfillment==='entrega'?config.deliveryFeeCents:0);
    if(needsChange && (!$('#change-for').value || !Number.isSafeInteger(changeForCents) || changeForCents<totalCents || changeForCents>1000000)){$('#checkout-error').textContent='Informe um valor para troco igual ou maior que o total.';return;}
    const payload={needsChange,changeForCents,customer:name.value.trim(),phone:phone.value.trim(),deliveryAddress,fulfillment,paymentMethod,notes:$('#order-notes').value.trim(),items:cart.map(line=>({id:line.id,qty:line.qty})),expectedTotalCents:Math.round(totals().subtotal*100)+(fulfillment==='entrega'?config.deliveryFeeCents:0)};
    rememberCustomer();
    const serialized=JSON.stringify(payload);
    if (!requestKey || (lastPayload && lastPayload !== serialized)) requestKey=crypto.randomUUID();
    lastPayload=serialized;
    try { sessionStorage.setItem('mdl-pending-request',requestKey);sessionStorage.setItem('mdl-pending-payload',serialized); } catch { /* A proteção contra duplicação também funciona nesta página. */ }
    sending=true;$('#checkout-close').disabled=true;$('#checkout-submit').textContent='Enviando pedido…';updateCheckout();$('#checkout-error').textContent='';
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),15000);
    try {
      const response=await fetch('/api/orders',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':requestKey},body:serialized,signal:controller.signal});
      const order=await window.MDLHttp.readJson(response);
      if (!response.ok) throw Error(order.error || 'Não foi possível enviar. Tente novamente.');
      const tracking={id:order.id,token:order.trackingToken};
      window.MDLOrderHistory.save({...tracking,code:order.code,createdAt:order.createdAt});
      try { sessionStorage.setItem('mdl-customer-name',payload.customer);localStorage.setItem('mdl-last-order',JSON.stringify(tracking));sessionStorage.removeItem('mdl-pending-request');sessionStorage.removeItem('mdl-pending-payload');localStorage.removeItem(storageKey); } catch { /* O link ainda permite acompanhar o pedido. */ }
      cart=[];renderCart();
      window.location.assign('acompanhar.html');
    } catch(error) { $('#checkout-error').textContent=error.message==='Failed to fetch' || error.name==='AbortError' ? 'Não foi possível confirmar o envio. Tente novamente; a mesma solicitação não será duplicada.' : error.message; }
    finally { clearTimeout(timeout);sending=false;$('#checkout-close').disabled=false;$('#checkout-submit').textContent='Enviar pedido para a lanchonete';updateCheckout(); }
  });
  ['#customer-name','#customer-phone','#delivery-address'].forEach(selector => $(selector).addEventListener('input',event=>event.target.setCustomValidity('')));
  $('#review-order').addEventListener('click',() => {
    $('#checkout-summary').textContent = cart.map(line => `${line.qty} × ${byId.get(line.id).nome}`).join(' · ');
    $('#checkout-error').textContent='';
    updateCheckout();
    modal.showModal();document.body.classList.add('has-modal');
  });
  $('#checkout-close').addEventListener('click',() => modal.close());
  $('#checkout-dismiss').addEventListener('click',()=>{if(!sending)modal.close();});
  modal.addEventListener('click',event => { if (event.target === modal && !sending) modal.close(); });
  modal.addEventListener('cancel',event => { if (sending) event.preventDefault(); });
  modal.addEventListener('close',() => document.body.classList.remove('has-modal'));
  document.querySelectorAll('[name="fulfillment"]').forEach(input => input.addEventListener('change',() => {
    const delivery = document.querySelector('[name="fulfillment"]:checked').value === 'entrega';
    $('#address-field').hidden = !delivery;$('#delivery-address').required = delivery;
    $('#address-field').disabled=!delivery;
    $('#delivery-address').setCustomValidity('');updateCheckout();
  }));
  async function refreshStoreStatus(){
    try{
      const response=await fetch('/api/store-status',{cache:'no-store'});
      if(!response.ok)return;
      const status=await window.MDLHttp.readJson(response);
      if(typeof status.acceptingOrders!=='boolean')return;
      config.acceptingOrders=status.acceptingOrders;config.canOrder=status.acceptingOrders;
      d.operatingConfig=config;window.MDLTime?.fillStatus?.();
      $('#store-message').textContent=status.acceptingOrders?'':'A loja está fechada no momento. Você pode consultar o cardápio.';
      renderCart();updateCheckout();
    }catch{ /* O servidor continua validando a abertura ao receber o pedido. */ }
  }
  setInterval(refreshStoreStatus,10000);
  renderCatalog();renderCart();
})();
