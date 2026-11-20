# Painel administrativo de acessos

## Projeto

Projeto Supabase: qgrzyxwbrufhtkrealep, região São Paulo, organização pessoal do proprietário, plano gratuito. Login em /studio-206ae66dd9012c3410c5d381/ no portfólio.

O proprietário deve criar sua senha diretamente no formulário privado do Supabase. Depois da criação, autorizar somente o UUID desse usuário em portfolio_private.site_admins por uma operação administrativa no banco. Nenhuma senha pertence ao repositório. O login utiliza somente e-mail e senha; o proprietário solicitou a remoção da etapa de autenticador.

## Controles

O cadastro público foi desativado e confirmado pelo endpoint de configuração do Auth. Logins anônimos permanecem desativados. A senha mínima é de 16 caracteres, com mudança segura e exigência da senha atual. Tentativas de login e verificação de tokens foram limitadas a 5 por 5 minutos por IP. A verificação por aplicativo autenticador foi removida a pedido do proprietário.

As tabelas ficam no schema portfolio_private, com RLS ativo e sem permissões diretas a clientes. A ausência de políticas permissivas é intencional. Funções públicas SECURITY INVOKER chamam operações internas restritas, com search_path vazio. Toda leitura exige um administrador autorizado, claim aal1 ou aal2 e sessão ainda existente e válida em auth.sessions. Nenhuma decisão usa user_metadata editável.

O coletor aceita POST da origem do portfólio com a chave pública do projeto. Essa chave identifica a integração; não é um segredo nem uma barreira suficiente contra clientes fora do navegador. Escritas têm limites por IP e globalmente. Não há leitura pública. service_role fica exclusivamente no ambiente do servidor.

O IP vem de CF-Connecting-IP na borda gerenciada. Corpo e X-Forwarded-For arbitrário são ignorados. Testes funcionais confirmaram que IPs TEST-NET falsificados não foram gravados. A tentativa de alterar CF-Connecting-IP recebeu 403 do gateway. Registros temporários dos testes foram removidos antes da ativação. A implantação não inclui diagnóstico público devolvendo cabeçalhos nem IPs reais.

O job portfolio-visit-retention limpa registros diariamente às 06:00 UTC (03:00 em Fortaleza). A primeira visita de cada minuto também limpa registros expirados. Consultas abrangem até 30 dias. A coleta dispensa cookies adicionais e fingerprinting, respeita Global Privacy Control e registra IP, horário e localização aproximada. IP não identifica uma pessoa: NATs, proxies e VPNs podem compartilhá-lo.

## Compilação e verificação

Em backend/tooling: npm ci, npm test e npm run build. O build gera studio-206ae66dd9012c3410c5d381/app.js com versões fixadas no lockfile. Configurar somente URL e publishable key em backend/public-config.js antes de recompilar. Senhas e chaves secretas nunca entram no código cliente.

Os testes em PostgreSQL WebAssembly cobrem negação anônima, outras contas, login por senha, sessões revogadas, acesso direto às tabelas, escalonamento de privilégios, limites de escrita, paginação e retenção. Verificações no projeto hospedado confirmaram grants, rejeição de leitura sem login e coleta sem aceitar IPs fornecidos pelo cliente.

Tokens do painel ficam somente em memória. CSP permite scripts locais e conexão ao projeto específico. A interface recusa execução dentro de frames; GitHub Pages não permite configurar frame-ancestors como cabeçalho HTTP, portanto essa recusa não substitui o cabeçalho completamente.

Nenhum sistema pode ser declarado sem vulnerabilidades. A validação final depende do primeiro acesso real do proprietário. Mantenha dependências, contas e segredos atualizados; limites e disponibilidade seguem o plano gratuito do provedor.

O caminho do painel usa um identificador aleatório e não tem link na navegação pública. /admin/ foi removido sem redirecionamento. O repositório é público: o endereço pode ser descoberto pelo código, portanto não constitui segredo nem substitui autenticação e autorização.

## Estimativa de localização

O painel usa visit-report, que valida o JWT no Auth e exige a consulta autorizada antes de enriquecer IPs. Somente os IPs dessa página de registros são enviados por HTTPS ao endpoint gratuito ipwho.is (IPWHOIS.io). A consulta solicita apenas cidade, estado/região e país em pt-BR: não solicita GPS, coordenadas, endereço, nome ou e-mail. Nenhuma lista de IPs fornecida pelo cliente é aceita. Os acessos públicos continuam sendo gravados independentemente da disponibilidade do serviço de localização.

O cache privado reutiliza resultados por 7 dias, tenta falhas novamente após 6 horas e limita novas consultas a 500 por dia UTC, abaixo da franquia publicada de 1.000/dia. Há até 5 consultas simultâneas e timeout de 2,5 segundos por consulta; nenhuma assinatura foi criada. A disponibilidade e a precisão dependem do provedor gratuito. Campos ausentes aparecem como Não disponível.

As tabelas de cache e quota têm RLS, sem acesso direto de clientes; somente funções internas de serviço podem alterá-las. A limpeza diária remove IPs do cache quando já não há visitas válidas em 30 dias. A interface e o rodapé público informam a estimativa e o uso do provedor. Baseado na documentação oficial https://ipwhois.io/documentation e política https://ipwhois.io/privacy .

## Aparelho e sinais de VPN/proxy

O coletor classifica somente tipo de aparelho, sistema operacional e família do navegador a partir do User-Agent recebido. O texto original, versões completas e modelos não são armazenados. Esses valores podem ser omitidos ou falsificados e não identificam uma pessoa ou um aparelho específico. Visitas antigas permanecem sem esses dados.

visit-report compara os IPs já autorizados com listas públicas de VPNs IPv4/IPv6 da X4BNet, saídas Tor do Tor Project e IPs de saída de proxies da monosans/proxy-list. Nenhum IP do visitante é enviado a esses mantenedores: apenas os arquivos públicos são baixados. Não usa a lista genérica de datacenters como se fosse prova de VPN. Dados e fontes podem ter falsos positivos ou cobertura incompleta.

Listas são mantidas em memória por até uma hora, com tentativa após um minuto em falhas; resultados por IP têm timestamp e cache privado de uma hora. Se uma fonte falhar, seu sinal será nulo, sem converter ausência de consulta em falso. A interface distingue possível VPN/proxy, saída Tor listada, sem indícios nas listas, verificação parcial e não verificado. Não há bloqueio automático de visitas. O cache é apagado com a retenção das visitas em 30 dias. Créditos e licenças: backend/NETWORK-SOURCES.md.

## Editor, métricas de interesse e exportação

A migração portfolio_editor_analytics cria eventos privados vinculados a um acesso, conteúdo publicado e rascunho separados, controle de revisão e o bucket portfolio-media. As operações administrativas e uploads verificam a conta autorizada e a sessão vigente; somente o conteúdo publicado e imagens do bucket público podem ser lidos sem login. Arquivamento remove projetos da resposta pública, preservando o cadastro interno.

O coletor emite um token aleatório por carregamento, usado apenas para escrita de eventos durante duas horas e mantido só em memória. O token não identifica uma pessoa entre visitas e não consta nos relatórios. Eventos têm IDs aleatórios para deduplicação, até 20 itens por envio, 600 eventos por acesso, limite por IP e validação de projetos/seções/canais. O tempo é limitado à duração real no servidor, a 30 segundos por evento e a 2 horas por acesso. A página conta apenas o tempo visível e em foco, pausa após 60 segundos sem interação e respeita Global Privacy Control.

Origens são categorias reconhecidas (Instagram, Google, WhatsApp etc.). URLs completas de referência, termos de busca, consultas, nomes, conteúdo de mensagens, coordenadas, teclas e trajetórias do mouse não são gravados. utm_source desconhecido vira Outro link de campanha. Todos os eventos expiram junto com as visitas em 30 dias. As estatísticas antigas continuam disponíveis; não se inventam eventos ou tempo para acessos anteriores.

Preferências permite excluir os próximos acessos neste navegador por uma chave local sem identificador. Não é retroativo nem compartilhado com outros dispositivos. O gerador de links usa utm_source para manter a origem em aplicativos que ocultam referência. CSVs são gerados no navegador, com proteção contra fórmulas e exportação de acessos por paginação. Volumes acima de 10.000 acessos pedem um período menor, sem baixar um arquivo truncado.

O editor permite projetos, ordem, visibilidade, destaques audiovisuais, capas, descrições, textos de apresentação e contatos públicos. E-mail público não altera o login. Salvar rascunho não publica; Publicar faz uma troca atômica e usa revisão para evitar sobrescrever outro acesso. Links aceitam apenas HTTPS; conteúdo é inserido como texto, nunca HTML. Projetos editoriais/verticais continuam fora dos destaques. Imagens são convertidas para WebP (até 2200 pixels), sem metadados da foto; o bucket limita arquivos a 4 MiB e tipos JPEG/PNG/WebP. Não há sobrescrita ou exclusão de objetos pelo cliente. A RLS permite upload somente na pasta do administrador com sessão válida. Capas do bucket são públicas pelo link mesmo enquanto o cadastro está em rascunho.

O ambiente de execução local ficou indisponível durante esta atualização. A implementação passou a usar módulos ESM locais, incluindo o SDK Supabase 2.119.2 já compilado e verificado anteriormente, preservado em backend/vendor com sua licença. O app.js do painel é um ponto de entrada pequeno; o código está em backend/tooling. Não são carregados scripts de CDN. A sintaxe e a lógica pura foram verificadas em V8, e os testes de integração do banco foram executados em transação com rollback, sem deixar visitas ou conteúdo de teste. Testes reproduzíveis: backend/tooling/test-full-panel.mjs e backend/tests/analytics-cms-integration.sql. Não houve validação visual em navegador nesta atualização.

## Revisão de autorização da localização
A atualização de visit-report foi bloqueada pela revisão automática por falta de autorização explícita do destino IPWHOIS.io para receber IPs. A versão nova de visit-report NÃO importa nem executa consultas de localização externas: lê apenas o cache já existente. A checagem de rede baixa arquivos públicos sem incluir IPs dos visitantes. Novas consultas de cidade/estado/país ficam pendentes dessa autorização; sem resultado salvo, a interface mostra Não disponível. Os arquivos geo.ts antigos são mantidos apenas como fonte histórica, sem inclusão no deployment novo.
