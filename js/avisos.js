(() => {
  let audio, enabled=false, latest=[];
  const seen=new Set();
  function armSound(){
    enabled=true;
    try{const Audio=window.AudioContext || window.webkitAudioContext;if(!Audio)return false;audio ||= new Audio();audio.resume().catch(()=>{document.querySelector('#alerts-state').textContent='O navegador bloqueou o som. Clique em Ativar som e notificações para tentar novamente.';});enabled=true;return true;}catch{return false;}
  }
  function beep(){
    if(window.speechSynthesis && window.SpeechSynthesisUtterance){
      try{
        const speech=window.speechSynthesis;
        // Keep the call clear when several orders arrive together.
        if(speech.speaking || speech.pending)return;
        const call=new window.SpeechSynthesisUtterance('Delivery! ... Delivery! ... Delivery!');
        call.lang='pt-BR';call.volume=1;call.rate=.95;call.pitch=1;
        const voices=speech.getVoices();
        const portuguese=voices.filter(voice=>voice.lang.toLowerCase().startsWith('pt'));
        const score=voice=>(voice.lang.toLowerCase()==='pt-br'?100:0)+(/natural|neural|online/i.test(voice.name)?40:0)+(/google/i.test(voice.name)?20:0);
        const voice=portuguese.sort((a,b)=>score(b)-score(a))[0];
        if(voice)call.voice=voice;
        call.onerror=()=>playFallback();
        speech.speak(call);
        return;
      }catch{}
    }
    playFallback();
  }
  function playFallback(){
    if(!audio)return;
    // Urgent delivery call: a bright, sustained eight-note phrase repeated four times.
    try{
      const melody=[880,1174.66,1396.91,1174.66,880,1174.66,1567.98,1396.91];
      for(let repeat=0;repeat<4;repeat++)for(let note=0;note<melody.length;note++){
        const start=audio.currentTime+repeat*2.1+note*.21;
        const oscillator=audio.createOscillator(),gain=audio.createGain();
        oscillator.type='square';oscillator.frequency.value=melody[note];
        oscillator.connect(gain);gain.connect(audio.destination);
        gain.gain.setValueAtTime(0,start);
        gain.gain.linearRampToValueAtTime(.85,start+.008);
        gain.gain.setValueAtTime(.85,start+.16);
        gain.gain.exponentialRampToValueAtTime(.001,start+.195);
        oscillator.start(start);oscillator.stop(start+.2);
        oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
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
