# PC Hunter — buscador inteligente de PCs gamer e monitores

O PC Hunter coleta ofertas **reais** de PCs gamer e monitores com entrega para o Brasil e analisa se elas **valem a pena**. Ele não procura só o menor preço: calcula o custo final, estima o desempenho em jogos, avalia a qualidade das peças, confere a reputação da loja e dá uma **nota de 0 a 100** para cada oferta.

> Regra do projeto: **nada é inventado.** Preço, estoque, prazo e especificações vêm só das fontes. Quando a fonte não informa um dado, ele aparece como *"não verificado"* e a nota fica limitada.

## Status das integrações (testado em 06/11/2026)

| Fonte | Tipo | Status | O que falta |
|---|---|---|---|
| **KaBuM!** | JSON público do catálogo (`servicespub.prod.api.aws.grupokabum.com.br`) | ✅ **Funcionando** — cerca de 1.500 ofertas reais coletadas, com ficha técnica, garantia, estoque e ofertas relâmpago | Nada. Não expõe frete por CEP, então mostramos só a flag de frete grátis. |
| **Mercado Livre** | API oficial | ⚠️ Implementado, **não testado**: a busca retorna `403 forbidden` sem token (verificado) | `ML_ACCESS_TOKEN` ou `ML_CLIENT_ID`/`ML_CLIENT_SECRET`. Com token, também cota **frete e prazo por CEP**. |
| **Amazon Brasil** | PA-API 5 (assinatura AWS SigV4) | ⚠️ Implementado, **não testado** | Conta de Associado com acesso à PA-API. A Amazon está migrando associados para uma nova API; se a PA-API for descontinuada na sua conta, o conector precisa ser adaptado. |
| **AliExpress** | Affiliate API | ⚠️ Implementado, **não testado** | `ALIEXPRESS_APP_KEY`/`SECRET`. Impostos de importação são estimados à parte. |
| **Shopee** | Affiliate Open API (GraphQL) | ⚠️ Implementado, **não testado** | `SHOPEE_AFFILIATE_APP_ID`/`SECRET` |
| **Feeds de produtos** | Google Merchant XML / CSV / JSON | ✅ Parser testado com fixtures | Um feed real (`PRODUCT_FEEDS`), por exemplo de programas de afiliados (Awin, Lomadee, Rakuten…). É o caminho para Pichau, Terabyte, Magalu e outras lojas. |
| Pichau, TerabyteShop, Magazine Luiza, GK Infostore | — | ❌ Bloqueados: `HTTP 403` de anti-bot nos testes | Não contornamos proteções anti-bot (termos de uso). Use feed de afiliado. |
| Patoloco | — | ❌ Não testado: redireciona para `patoloco.com.br`, que não estava liberado na rede do teste | Sem API pública conhecida. Use feed, se a loja oferecer. |
| ViaCEP + BrasilAPI | CEP → UF/cidade | ✅ Funcionando | — |
| Banco Central (PTAX) | Cotação do dólar | ✅ Funcionando | — |
| Resend | E-mail de alertas | ⚠️ Implementado, **não testado** | `RESEND_API_KEY`. Sem ela, os alertas aparecem só na página **Alertas**. |

A página **/fontes** do app mostra esse status ao vivo, com o resultado da última coleta de cada conector.

## Funcionalidades

- **Três buscas:** PC Gamer, PC + Monitor (kits **e** combinações compradas separadamente, com a comparação "kit ou separado?") e Monitor.
- **Extração de especificações** do título e da ficha técnica: CPU (modelo, soquete, geração), GPU (modelo e VRAM), RAM (tamanho e tipo), armazenamento (NVMe/SSD/HD), fonte (potência e 80 Plus), chipset e, nos monitores, tamanho, resolução, Hz, painel, tempo de resposta, sincronização, HDR e conexões.
- **Desempenho estimado** com tabelas de referência de cerca de 120 GPUs e 200 CPUs (índice relativo: RTX 4060 + Ryzen 5 5600 = 100). Detecta gargalo de CPU, RAM insuficiente e "PC gamer" com GT 210 ou vídeo integrado.
- **Nota 0–100** (detalhes abaixo), com a explicação de cada componente na página da oferta.
- **Custo final:** preço à vista + frete (quando verificado) + Imposto de Importação e ICMS estimados para produtos internacionais (regras do Remessa Conforme, dólar PTAX).
- **CEP:** resolve UF/cidade e, nas fontes que permitem (Mercado Livre), cota frete e prazo para o CEP. O cache dura 12 h.
- **Anúncios suspeitos:** preço muito abaixo do mercado, palavras como réplica, defeito ou "leia a descrição", desconto extremo, vendedor mal avaliado, plataforma obsoleta vendida como gamer.
- **Deduplicação:** a mesma configuração na mesma loja/vendedor aparece uma vez só. A mesma configuração em outras ofertas aparece em "também disponível".
- **Histórico de preços:** um registro a cada mudança de preço (ou a cada 6 h). O app mostra o gráfico, a posição do preço atual (mínimo, abaixo da média, acima da média) e detecta **promoção falsa** (preço "de" nunca praticado, ou aumento seguido de "desconto").
- **Favoritos** (com a variação desde que você salvou) e **alertas de preço** (para a oferta ou para a mesma configuração em qualquer loja), com aviso no app e por e-mail (opcional).
- **Mineração contínua:** cron que faz coleta profunda, enriquece fichas técnicas, desativa ofertas que sumiram e verifica alertas. A busca do usuário também coleta sob demanda, com cache.
- **Descoberta de lojas:** vendedores e lojas novos que chegam pelas fontes (marketplaces, feeds) entram na tabela `stores` com reputação "desconhecida".

## Algoritmo de pontuação

Pesos (PC / Monitor):

| Componente | PC | Monitor | Como é calculado |
|---|---|---|---|
| Custo-benefício | 30 | 32 | Preço que o mercado cobra por esse desempenho/qualidade ÷ custo final. A curva de mercado é **ajustada com os dados coletados** (regressão log-log robusta); com menos de 25 pontos, usa uma curva de referência. |
| Desempenho | 14 | — | Índice efetivo (GPU × aproveitamento da CPU × fator de RAM), em escala logarítmica |
| Qualidade das peças / do monitor | 12 | 25 | Fonte (certificação e dimensionamento), SSD/NVMe, DDR3, CPU obsoleta, GPU integrada… / resolução, Hz, painel, tempo de resposta, sync, HDR, densidade de pixels |
| Equilíbrio CPU/GPU/RAM | 7 | — | Gargalo estimado |
| Loja | 10 | 12 | Reputação base da loja; em marketplace, combinada com as avaliações do vendedor |
| Garantia | 6 | 9 | Meses informados (sem informação = garantia legal de 90 dias do CDC) |
| Estoque | 5 | 7 | Confirmado / poucas unidades / não confirmado |
| Entrega e frete | 10 | 15 | Prazo **verificado** (≤2 dias = 100) e custo do frete. Sem prazo informado: 50 (nacional) ou 20 (internacional). |
| Upgrade | 6 | — | Soquete (AM5 > LGA1851 > AM4 > LGA1700…), folga da fonte, DDR5, chipset |

Limites aplicados: anúncio suspeito → no máximo 39; GPU não identificada → no máximo 59; fonte subdimensionada → no máximo 55; indisponível → no máximo 30. Desconto falso tira 5 pontos; preço no mínimo histórico soma 3.
Faixas: **90–100** Excelente oportunidade · **75–89** Muito bom · **60–74** Razoável · **< 60** Pouco recomendado.

As reputações base das lojas (`src/lib/stores/seed.ts`) são uma **base curada inicial**, não notas oficiais. Ajuste-as com a sua própria verificação.

## Arquitetura

```
src/
  app/                      Next.js 16 (App Router) — páginas + API (route handlers)
    api/search              busca: coleta sob demanda → análise → deduplicação → filtros/ordenação
    api/offers/[id]         análise completa, ficha técnica sob demanda, histórico
    api/favorites|alerts|notifications   dados do usuário (sessão anônima)
    api/sources             status real das integrações
    api/cron/refresh        atualização agendada (protegida por CRON_SECRET)
  components/               UI (tema escuro, Tailwind v4)
  lib/
    connectors/             um módulo por fonte + registry (interface Connector)
    hardware/               tabelas de GPU/CPU, parser de especificações, desempenho
    scoring/                nota 0–100, curva de mercado, reputação, detecção de suspeitos
    pricing/                câmbio PTAX, impostos de importação
    geo/                    CEP
    history/                histórico e detecção de promoção falsa
    search/                 coleta, repositório (Postgres), serviço de busca e combos
    alerts/, user/          favoritos, alertas, notificações, sessão
    db/migrations/          SQL (compatível com Supabase)
scripts/                    migrate.ts, refresh.ts (worker)
tests/                      testes Vitest com títulos reais coletados
```

**Fluxo de uma busca:** `collect()` consulta em paralelo os conectores configurados, reaproveitando coletas da mesma consulta feitas nos últimos 30 min. Depois normaliza, descarta acessórios, extrai especificações e faz upsert com snapshot de preço. Em seguida, consulta o Postgres com os filtros, aplica `analyzeOffer()` (CEP, câmbio, curvas de mercado, histórico, cotações de frete) e por fim `dedupe()` e a ordenação.

**Para adicionar uma fonte:** implemente a interface `Connector` (`src/lib/connectors/types.ts`) e registre-a em `registry.ts`.

## Como rodar

```bash
npm install
cp .env.example .env.local        # ajuste DATABASE_URL
npm run db:migrate                # cria as tabelas e cadastra as lojas
npm run refresh -- 3              # primeira coleta (3 páginas por consulta)
npm run dev                       # http://localhost:3000
npm test                          # 32 testes
npm run build && npm start
```

Atrás de um proxy HTTP corporativo, rode com `NODE_USE_ENV_PROXY=1` (Node ≥ 22.21) para o `fetch` respeitar `HTTPS_PROXY`.

### Deploy (Vercel + Supabase)

1. Crie um projeto no Supabase e copie a connection string (pooler) para `DATABASE_URL`, com `DATABASE_SSL=true`.
2. Rode `npm run db:migrate` apontando para o Supabase. As tabelas de usuário ficam com RLS ativado e sem políticas: só o backend acessa.
3. Na Vercel, configure as variáveis de `.env.example`, incluindo `CRON_SECRET`. O `vercel.json` agenda `/api/cron/refresh` a cada 3 h. Cada execução respeita o limite de tempo da função (`maxDuration = 300`; planos com limite menor usam o que o plano permite). Para coletas maiores, rode `npm run refresh` em outro agendador (GitHub Actions, VPS).

## Segurança e privacidade

- Sessão anônima: um token aleatório fica num cookie httpOnly e o banco guarda **só o hash SHA-256**.
- O único dado pessoal opcional é o e-mail, usado só para alertas. **Nenhum dado de pagamento é coletado ou armazenado**: a compra acontece na loja.
- Entradas validadas com Zod. As consultas SQL são sempre parametrizadas.
- Ofertas indisponíveis ou que não aparecem há mais de 3 dias **não** são exibidas como em estoque. Por padrão só aparece estoque confirmado.
- Coleta educada: intervalo mínimo entre requisições por host, retry com backoff, User-Agent identificado, sem contornar anti-bot.

## Limitações conhecidas

- Com só a KaBuM! ativa, a maior parte das ofertas não tem prazo de entrega nem frete por CEP verificados. Isso aparece como "não verificado" e reduz a nota de entrega. O Mercado Livre resolve isso quando houver token.
- O desempenho é uma estimativa relativa a partir de benchmarks públicos agregados, não FPS medido. As tabelas em `src/lib/hardware/` precisam ser atualizadas a cada nova geração.
- O histórico de preços começa a ser útil depois de alguns dias de coletas agendadas.
- As alíquotas de ICMS sobre importação variam por estado. A estimativa usa 20% (conservador), configurável em `IMPORT_ICMS_RATE`.
