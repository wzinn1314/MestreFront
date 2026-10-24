(async () => {
  const paymentLabel=(method,fulfillment)=>({pix:fulfillment==='retirada'?'Pix no ato da retirada':'Pix no ato da entrega',cartao:fulfillment==='retirada'?'Cart\u00e3o no ato da retirada':'Cart\u00e3o no ato da entrega',dinheiro:fulfillment==='retirada'?'Dinheiro no ato da retirada':'Dinheiro no ato da entrega'}[method] || 'N\u00e3o informado');
  const $=selector=>document.querySelector(selector);
  const money=value=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value/100);
  const labels={novo:'RECEBIDO',confirmado:'CONFIRMADO',preparando:'EM PREPARO',saiu:'SAIU PARA ENTREGA',pronto:'PRONTO PARA RETIRADA',concluido:'CONCLUÍDO',cancelado:'CANCELADO'};
  let loaded=false;
  function setWidth(value){const paper=value==='80'?'80':'58';document.body.dataset.paper=paper;$('#paper-width').value=paper;try{localStorage.setItem('mdl-receipt-width',paper);}catch{/* A escolha continua válida nesta página. */}}
  try{setWidth(localStorage.getItem('mdl-receipt-width'));}catch{setWidth('58');}
  $('#paper-width').addEventListener('change',event=>setWidth(event.target.value));
  $('#print-order').addEventListener('click',()=>{if(!loaded)return;try{window.print();}catch{$('#print-message').textContent='Não foi possível abrir a impressão. Verifique a impressora instalada no computador.';}});
  const id=location.hash.slice(1);
  if(!/^[a-f0-9-]{36}$/.test(id)){$('#print-message').textContent='Abra um pedido no painel e escolha Imprimir pedido.';return;}
  try{
    const response=await fetch(`/api/admin/orders/${id}`,{cache:'no-store'});
    const order=await window.MDLHttp.readJson(response);
    if(!response.ok)throw Error(response.status===401?'Entre como empresa no painel para imprimir este pedido.':order.error || 'Não foi possível carregar o pedido.');
    document.title=`Pedido ${order.code} - Mestre dos Lanches`;
    $('#receipt-code').textContent=`PEDIDO #${order.code}`;
    $('#receipt-date').textContent=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Recife',dateStyle:'short',timeStyle:'short'}).format(new Date(order.createdAt));
    $('#receipt-status').textContent=labels[order.status];
    $('#receipt-name').textContent=order.customer;
    $('#receipt-phone').textContent=`WhatsApp: ${order.phone}`;
    $('#receipt-fulfillment').textContent=order.fulfillment==='entrega'?'ENTREGA':'RETIRADA NA LANCHONETE';
    $('#receipt-address').textContent=order.fulfillment==='entrega'?order.address:'Rua José Adalberto, 194 - Santa Margarida';
    $('#receipt-items').replaceChildren(...order.items.map(item=>{
      const line=document.createElement('div'),description=document.createElement('div'),name=document.createElement('strong'),unit=document.createElement('small'),total=document.createElement('strong');
      line.className='receipt-item';name.textContent=`${item.qty} x ${item.name}`;unit.textContent=`Unid.: ${money(item.unitPriceCents)}`;total.textContent=money(item.qty*item.unitPriceCents);description.append(name,unit);line.append(description,total);return line;
    }));
    $('#receipt-notes-section').hidden=!order.notes;
    $('#receipt-notes').textContent=order.notes;
    $('#receipt-subtotal').textContent=money(order.subtotalCents);
    $('#receipt-delivery').textContent=order.deliveryFeeCents===0?'Grátis':money(order.deliveryFeeCents);
    $('#receipt-total').textContent=money(order.totalCents);
    $('#receipt-payment').textContent=paymentLabel(order.paymentMethod,order.fulfillment);
    $('#receipt-change').textContent=order.paymentMethod==='dinheiro'?(order.needsChange===true?'Troco para '+money(order.changeForCents)+' | Levar '+money(order.changeForCents-order.totalCents)+' de troco.':order.needsChange===false?'Não precisa de troco.':'Troco não informado.'):'Troco: não se aplica.';
    $('#receipt').hidden=false;$('#print-order').disabled=false;loaded=true;
    let alreadyPrinted=false;
    try{alreadyPrinted=JSON.parse(localStorage.getItem('mdl-auto-printed') || '[]').includes(order.id);}catch{}
    if(new URLSearchParams(location.search || '').get('auto')==='1' && !alreadyPrinted && (order.status==='confirmado' || order.history?.some(item=>item.status==='confirmado'))){
      if(document.fonts?.ready)await document.fonts.ready;
      await Promise.all([...document.images || []].map(img=>img.complete?Promise.resolve():new Promise(resolve=>{img.onload=resolve;img.onerror=resolve;})));
      try{const ids=JSON.parse(localStorage.getItem('mdl-auto-printed') || '[]');localStorage.setItem('mdl-auto-printed',JSON.stringify([...ids.slice(-199),order.id]));}catch{}
      window.history?.replaceState(null,'','imprimir.html#'+order.id);
      window.print();
    }
    $('#print-message').textContent='Confira o pedido e use Imprimir pedido. A impressora Bluetooth deve estar pareada e instalada no computador.';
  }catch(error){$('#print-message').textContent=error.message==='Failed to fetch'?'Não foi possível conectar à loja. Atualize a página para tentar novamente.':error.message;}
})();
