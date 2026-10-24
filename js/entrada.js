(() => {
  const form=document.querySelector('#client-entry-form');
  const input=document.querySelector('#entry-name');
  const message=document.querySelector('#entry-error');
  try { input.value=sessionStorage.getItem('mdl-customer-name') || ''; } catch { /* A entrada informa se não conseguir guardar a sessão. */ }
  try { input.value=localStorage.getItem('mdl-customer-name') || input.value; } catch {}
  if(location.hash==='#cliente' || new URLSearchParams(location.search).get('entrada')==='cliente')input.focus();
  input.addEventListener('input',()=>{input.setCustomValidity('');message.textContent='';});
  form.addEventListener('submit',event=>{
    event.preventDefault();
    const name=input.value.trim().replace(/\s+/g,' ');
    input.setCustomValidity(name.length>=2 && name.length<=80 ? '' : 'Informe seu nome com pelo menos 2 caracteres.');
    if(!form.reportValidity())return;
    let stored=false;
    try { sessionStorage.setItem('mdl-customer-name',name);stored=true; } catch {}
    try { localStorage.setItem('mdl-customer-name',name);stored=true; } catch {}
    if(!stored) { message.textContent='Não foi possível guardar seu acesso neste navegador. Tente novamente em uma aba comum.';return; }
    window.location.assign('pedidos.html');
  });
})();
