(() => {
  async function readJson(response) {
    const hostname=window.location?.hostname;
    const published=hostname && !['localhost','127.0.0.1','[::1]'].includes(hostname);
    const type=response.headers?.get('content-type') || '';
    if(response.status===401) {
      try { const result=await response.json();if(result && typeof result==='object' && !Array.isArray(result))return result; } catch { /* Sessão expirada pode chegar sem corpo. */ }
      throw Object.assign(new Error('Sua sessão expirou. Entre como empresa novamente.'),{status:401});
    }
    if([404,405].includes(response.status) || (type && !type.includes('application/json'))) {
      if(!type.includes('application/json'))throw Object.assign(new Error(published?'O site não conseguiu acessar a API da loja. A publicação do frontend precisa encaminhar /api para o backend.':'Não foi possível acessar o servidor da loja por este endereço. Abra o sistema em http://localhost:3000/.'),{status:response.status,code:'WRONG_SERVER'});
    }
    try {
      const result=await response.json();
      if(!result || typeof result!=='object' || Array.isArray(result))throw Error('Formato inválido');
      return result;
    } catch {
      throw Object.assign(new Error(published?'A resposta da loja chegou vazia ou incompleta. Tente novamente em instantes.':'A resposta da loja chegou vazia ou incompleta. Tente novamente. Se continuar, abra http://localhost:3000/.'),{status:response.status,code:'INCOMPLETE_RESPONSE'});
    }
  }
  window.MDLHttp={readJson};
})();
