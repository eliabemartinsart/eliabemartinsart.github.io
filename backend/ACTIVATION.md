# Painel de acessos — preparado, ainda não ativado

O site continua publicado sem rastreamento adicional. O painel e o coletor só devem ser ativados após conectar a conta Supabase e verificar os controles abaixo. Nenhuma senha nem chave de serviço pertence ao repositório.

## Provisionamento

Compilação reproduzível: em `backend/tooling`, executar `npm ci`, `npm test` e `npm run build`. O build gera `admin/app.js` a partir das fontes e versões fixadas no lockfile. A implantação final deve incluir esse arquivo gerado, após preencher somente as configurações públicas do projeto. Os testes usam PostgreSQL em WebAssembly; eles não substituem os testes do Supabase hospedado.

1. Selecionar ou criar um projeto dedicado do proprietário no Supabase. Confirmar plano e eventual cobrança antes de criar recursos pagos.
2. Aplicar a migração. O schema `portfolio_private` não deve estar entre os schemas expostos pelo Data API. Não conceder grants adicionais a `anon` ou `authenticated`.
3. Desativar cadastro público e login anônimo. Configurar senha mínima de 16 caracteres, JWT de 600 segundos e TOTP. Manter os limites de tentativas do provedor ativos; revisar e testar respostas 429 antes da ativação. CAPTCHA é uma camada adicional disponível no provedor, mas não está configurado neste pacote.
4. Provisionar o usuário administrador por um fluxo privado. O proprietário deve definir sua senha sem enviá-la ao chat. Inserir SOMENTE o UUID desse usuário em `portfolio_private.site_admins`. Confirmar que outras contas e sessões sem segundo fator não acessam os relatórios.
5. Preencher `admin/config.js` exclusivamente com URL e publishable key; reconstruir `admin/app.js`. A chave `service_role` permanece somente nos segredos do coletor.
6. Publicar `collect-visit` com a verificação JWT de gateway desativada: ele é um coletor anônimo de escrita, sem rota de leitura. Sua escrita usa uma função SQL restrita à credencial do servidor. Validar tamanho máximo de corpo e proteção volumétrica do gateway na implantação.
7. Verificar no gateway hospedado qual cabeçalho de IP é substituído ou completado pelo proxy confiável. Testar requests normais e com cabeçalhos falsificados. Somente então configurar `VERIFIED_CLIENT_IP_HEADER` e `VERIFIED_CLIENT_IP_POSITION`. Não ativar com base em um `X-Forwarded-For` arbitrário fornecido pelo cliente. O coletor devolve 503 enquanto isso não estiver configurado.
8. Agendar `select public.purge_site_visits()` diariamente via pg_cron. O coletor também limpa registros antigos na primeira visita de cada minuto, mas isso não substitui a limpeza diária em dias sem tráfego.
9. Validar HTTPS, negação de leitura anônima, negação a usuário não autorizado, exigência de MFA no próprio banco, limites de tentativas e logout. Adicionar aviso conciso no site informando coleta de IP/horário por até 30 dias para estatísticas, sem cookies adicionais.
10. Somente após os testes reais, publicar `/admin/` e chamar `recordVisit()` uma vez por carregamento da página pública. Não contar a própria página administrativa.

## Escopo e limites

O relatório mostra somente horário e IP; não identifica pessoas. NATs, VPNs e proxies podem compartilhar ou alterar IPs. Bloqueadores de rastreamento podem impedir a coleta. O registro não é uma medição exata de visitantes humanos únicos nem recupera acessos anteriores à ativação.

O login utiliza Supabase Auth, com tokens somente em memória, cadastro fechado e MFA obrigatório no banco para leitura. A UI não constitui a barreira de segurança. As tabelas privadas não têm permissões diretas para usuários públicos ou autenticados. O endpoint de leitura consulta a lista privada de administradores e exige a claim autenticada `aal2` em cada chamada.

O GitHub Pages não permite configurar cabeçalhos HTTP arbitrários como `frame-ancestors`. A página inclui CSP em meta para limitar scripts e conexões, mas controle de enquadramento deve ser configurado em um host/proxy que suporte cabeçalhos antes de classificar o endurecimento HTTP como completo.

Nenhum sistema pode ser declarado sem vulnerabilidades. Estes controles exigem validação após o provisionamento e manutenção das dependências.
