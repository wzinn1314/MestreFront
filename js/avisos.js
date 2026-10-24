(() => {
  let audio, enabled=false, latest=[];
  const seen=new Set();
  function armSound(){
    enabled=true;
    try{const Audio=window.AudioContext || window.webkitAudioContext;if(!Audio)return false;audio ||= new Audio();audio.resume().catch(()=>{document.querySelector('#alerts-state').textContent='O navegador bloqueou o som. Clique em Ativar som e notificações para tentar novamente.';});enabled=true;return true;}catch{return false;}
  }
  function beep(){
    if(!audio)return;
    // Three double rings, like a telephone, over approximately six seconds.
    try{
      for(let ring=0;ring<3;ring++)for(let pulse=0;pulse<2;pulse++){
        const start=audio.currentTime+ring*2.2+pulse*.65;
        for(const frequency of [440,480]){
          const oscillator=audio.createOscillator(),gain=audio.createGain();
          oscillator.type='sine';oscillator.frequency.value=frequency;
          oscillator.connect(gain);gain.connect(audio.destination);
          gain.gain.setValueAtTime(0,start);
          gain.gain.linearRampToValueAtTime(.4,start+.015);
          gain.gain.setValueAtTime(.4,start+.46);
          gain.gain.exponentialRampToValueAtTime(.001,start+.52);
          oscillator.start(start);oscillator.stop(start+.54);
          oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
        }
      }
    }catch{}
  }
  function claim(id){
    try{const key='mdl-notified-orders',ids=JSON.parse(localStorage.getItem(key)||'[]');if(ids.includes(id))return false;localStorage.setItem(key,JSON.stringify([...ids.slice(-199),id]));}catch{}
    return true;
  }
  function ingest(orders){
    latest=orders;
    const pending=orders.filter(order=>order.status==='novo');
    document.querySelector('#new-order-notice').textContent=pending.length?pending.length+' pedido(s) aguardando confirmação: '+pending.map(order=>'#'+order.code).join(', ')+'. Confira os pedidos em espera.':'';
    if(!enabled)return;
    for(const order of pending){
      if(!seen.has(order.id)){seen.add(order.id);if(claim('sound:'+order.id))beep();}
      if(window.Notification?.permission==='granted' && claim('notification:'+order.id)){
        try{const notice=new window.Notification('Novo pedido - Mestre dos Lanches',{body:'Pedido #'+order.code+' aguardando confirmação.',tag:'pedido-'+order.id,icon:'assets/logo.svg'});notice.onclick=()=>{window.focus();notice.close();};}catch{}
      }
    }
  }
  async function enable(){
    const sound=armSound();
    let permission=window.Notification?.permission;
    if(permission==='default')try{permission=await window.Notification.requestPermission();}catch{}
    document.querySelector('#alerts-state').textContent=(sound?'Som ativado. ':'Som indisponível neste navegador. ')+(permission==='granted'?'Notificações ativadas.':'Avisos visuais no painel; permita notificações nas configurações do navegador para avisos do sistema.');
    if(sound)beep();
    ingest(latest);
  }
  document.querySelector('#enable-alerts').addEventListener('click',enable);
  window.MDLAlerts={armSound,ingest,enable};
})();
