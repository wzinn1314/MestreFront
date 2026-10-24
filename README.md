# Mestredoslanches

Frontend do Mestre dos Lanches: entrada do cliente, cardápio, sacola, checkout, acompanhamento dos pedidos e interface do painel da empresa.

Os arquivos HTML, CSS, JavaScript e as imagens ficam na raiz deste repositório. Não há etapa de compilação.

## Integração

As telas utilizam a API `/api/` do servidor da loja. Este repositório contém somente o frontend: não inclui backend, banco de dados, senha da empresa nem configuração privada.

Para receber pedidos, autenticar a empresa e atualizar os status, a hospedagem deve encaminhar `/api/` para o backend. Publicar apenas estes arquivos estáticos não disponibiliza essas funções.

## Dados do navegador

Nome, contato, endereço, sacola e histórico de acompanhamento são armazenados no navegador do cliente. As informações e os preços dos pedidos são validados no servidor.
