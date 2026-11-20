# Painel administrativo de acessos

## Projeto

Projeto Supabase: qgrzyxwbrufhtkrealep, região São Paulo, organização pessoal do proprietário, plano gratuito. Login em /studio-206ae66dd9012c3410c5d381/ no portfólio.

O proprietário deve criar sua senha diretamente no formulário privado do Supabase. Depois da criação, autorizar somente o UUID desse usuário em portfolio_private.site_admins por uma operação administrativa no banco. Nenhuma senha pertence ao repositório. O login utiliza somente e-mail e senha; o proprietário solicitou a remoção da etapa de autenticador.

## Controles

O cadastro público foi desativado e confirmado pelo endpoint de configuração do Auth. Logins anônimos permanecem desativados. A senha mínima é de 16 caracteres, com mudança segura e exigência da senha atual. Tentativas de login e verificação de tokens foram limitadas a 5 por 5 minutos por IP. A verificação por aplicativo autenticador foi removida a pedido do proprietário.

As tabelas ficam no schema portfolio_private, com RLS ativo e sem permissões diretas a clientes. A ausência de políticas permissivas é intencional. Funções públicas SECURITY INVOKER chamam operações internas restritas, com search_path vazio. Toda leitura exige um administrador autorizado, claim aal1 ou aal2 e sessão ainda existente e válida em auth.sessions. Nenhuma decisão usa user_metadata editável.

O coletor aceita POST da origem do portfólio com a chave pública do projeto. Essa chave identifica a integração; não é um segredo nem uma barreira suficiente contra clientes fora do navegador. Escritas têm limites por IP e globalmente. Não há leitura pública. service_role fica exclusivamente no ambiente do servidor.

O IP vem de CF-Connecting-IP na borda gerenciada. Corpo e X-Forwarded-For arbitrário são ignorados. Testes funcionais confirmaram que IPs TEST-NET falsificados não foram gravados. A tentativa de alterar CF-Connecting-IP recebeu 403 do gateway. Registros temporários dos testes foram removidos antes da ativação. A implantação não inclui diagnóstico público devolvendo cabeçalhos nem IPs reais.

O job portfolio-visit-retention limpa registros diariamente às 06:00 UTC (03:00 em Fortaleza). A primeira visita de cada minuto também limpa registros expirados. Consultas abrangem até 30 dias. A coleta dispensa cookies adicionais e fingerprinting, respeita Global Privacy Control e registra somente IP e horário. IP não identifica uma pessoa: NATs, proxies e VPNs podem compartilhá-lo.

## Compilação e verificação

Em backend/tooling: npm ci, npm test e npm run build. O build gera studio-206ae66dd9012c3410c5d381/app.js com versões fixadas no lockfile. Configurar somente URL e publishable key em backend/public-config.js antes de recompilar. Senhas e chaves secretas nunca entram no código cliente.

Os testes em PostgreSQL WebAssembly cobrem negação anônima, outras contas, login por senha, sessões revogadas, acesso direto às tabelas, escalonamento de privilégios, limites de escrita, paginação e retenção. Verificações no projeto hospedado confirmaram grants, rejeição de leitura sem login e coleta sem aceitar IPs fornecidos pelo cliente.

Tokens do painel ficam somente em memória. CSP permite scripts locais e conexão ao projeto específico. A interface recusa execução dentro de frames; GitHub Pages não permite configurar frame-ancestors como cabeçalho HTTP, portanto essa recusa não substitui o cabeçalho completamente.

Nenhum sistema pode ser declarado sem vulnerabilidades. A validação final depende do primeiro acesso real do proprietário. Mantenha dependências, contas e segredos atualizados; limites e disponibilidade seguem o plano gratuito do provedor.

O caminho do painel usa um identificador aleatório e não tem link na navegação pública. /admin/ foi removido sem redirecionamento. O repositório é público: o endereço pode ser descoberto pelo código, portanto não constitui segredo nem substitui autenticação e autorização.
