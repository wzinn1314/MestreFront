(() => {
  const key='mdl-order-history';
  const valid=record=>record && /^[a-f0-9-]{36}$/.test(record.id) && /^[\w-]{43}$/.test(record.token);
  function read(){
    let records=[];
    try{
      const stored=JSON.parse(localStorage.getItem(key)||'[]');
      if(Array.isArray(stored))records=stored.filter(valid);
    }catch{ /* Um registro inválido não impede novos pedidos. */ }
    try{const previous=JSON.parse(localStorage.getItem('mdl-last-order')||'null');if(valid(previous) && !records.some(record=>record.id===previous.id))records.unshift(previous);}catch{/* Preserva os demais registros. */}
    return [...new Map(records.map(record=>[record.id,record])).values()].slice(0,20).map(record=>({id:record.id,token:record.token,...(typeof record.code==='string'?{code:record.code}:{}),...(typeof record.createdAt==='string' && Number.isFinite(Date.parse(record.createdAt))?{createdAt:record.createdAt}:{})}));
  }
  function save(record){
    if(!valid(record))return false;
    const existing=read(),old=existing.find(item=>item.id===record.id);
    const saved={...old,id:record.id,token:record.token};
    if(typeof record.code==='string')saved.code=record.code;
    if(typeof record.createdAt==='string')saved.createdAt=record.createdAt;
    try{
      localStorage.setItem(key,JSON.stringify([saved,...existing.filter(item=>item.id!==record.id)].slice(0,20)));
      localStorage.setItem('mdl-last-order',JSON.stringify(saved));return true;
    }catch{return false;}
  }
  window.MDLOrderHistory={read,save,valid};
})();
