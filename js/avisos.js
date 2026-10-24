(() => {
  let audio, enabled=false, latest=[];
  const seen=new Set();
  function armSound(){
    enabled=true;
    try{const Audio=window.AudioContext || window.webkitAudioContext;if(!Audio)return false;audio ||= new Audio();audio.resume().catch(()=>{document.querySelector('#alerts-state').textContent='O navegador bloqueou o som. Clique em Ativar som e notificações para tentar novamente.';});enabled=true;return true;}catch{return false;}
  }
  function beep(){
    if(!audio)return;
    try{for(let i=0;i<12;i++){const oscillator=audio.createOscillator(),gain=audio.createGain(),start=audio.currentTime+i*.5;oscillator.connect(gain);gain.connect(audio.destination);oscillator.type='triangle';oscillator.frequency.value=i%2?1046:784;gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(.65,start+.03);gain.gain.exponentialRampToValueAtTime(.001,start+.42);oscillator.start(start);oscillator.stop(start+.45);}}catch{}
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
