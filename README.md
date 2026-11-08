# PC Hunter — Garimpo Inteligente de Computadores

> **Garimpe seu próximo PC pelo menor preço possível.** Busca em tempo real (Brave Search API + APIs/JSON das lojas) em lojas, marketplaces e classificados: PCs completos por orçamento, PC + monitor, monitores e peças — novos, usados, seminovos e recondicionados. Relatório de integrações e testes: **[docs/RELATORIO-INTEGRACOES.md](docs/RELATORIO-INTEGRACOES.md)**.

O PC Hunter coleta ofertas **reais** de PCs gamer e monitores com entrega para o Brasil e analisa se elas **valem a pena**. Ele não procura só o menor preço: calcula o custo final, estima o desempenho em jogos, avalia a qualidade das peças, confere a reputação da loja e dá uma **nota de 0 a 100** para cada oferta.

> Regra do projeto: **nada é inventado.** Preço, estoque, prazo e especificações vêm só das fontes. Quando a fonte não informa um dado, ele aparece como *"não verificado"* e a nota fica limitada.

## Status das integrações (testado em 06/11/2026)

Detalhes de cada conector (o que foi verificado, mapeamento de campos, credenciais) em **[docs/CONECTORES.md](docs/CONECTORES.md)**.

| Prioridade | Fonte | Tipo | Status real |
|---|---|---|---|
| 1 | OLX Brasil | Classificados | ❌ Sem integração autorizada: o portal da OLX só tem APIs de publicação/leads/chat; o site bloqueia acesso automatizado (403) |
| 2 | Mercado Livre | API oficial | ⚠️ Implementado e testado com o formato da API; **requer token** (403 sem ele) |
| 3 | Facebook Marketplace | Classificados | ❌ Sem integração autorizada (sem API de busca; robots restritivo) |
| 4 | Amazon Brasil | PA-API 5 | ⚠️ Implementado; requer credenciais de Associado |
| 5 | Enjoei | Classificados | ❌ Sem integração autorizada (robots proíbe `/busca`) |
| 6 | Shopee | API de afiliados | ⚠️ Implementado; requer credenciais |
| — | KaBuM! + marketplace | JSON público | ✅ **Funcionando**: cerca de 2.160 anúncios (PCs, monitores, kits), incluindo usados e recondicionados |
| — | AliExpress | API de afiliados | ⚠️ Implementado; requer credenciais |
| — | Feeds (lojas/classificados autorizados) | Feed | ✅ Parser testado; nenhum feed configurado |
| — | Pichau, Terabyte, Magalu, GK, Patoloco | — | ❌ Bloqueiam coleta automatizada; sem API pública |
| — | ViaCEP + BrasilAPI, Banco Central (PTAX) | Auxiliares | ✅ Funcionando |

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

## Entrega e Garimpo com entrega

- **Filtros de entrega:** *Somente com entrega disponível* (só envio confirmado para o seu CEP; envio só local de outra UF fica de fora), *Entrega ou retirada presencial* e *Somente retirada presencial*. Envio que a fonte não confirma aparece como **não confirmado** e nunca é tratado como envio.
- **Modalidade de cada anúncio:** envio nacional, envio só local, internacional, só retirada, sem envio ou não confirmado, mais o programa de envio (ex.: Mercado Envios Full) e a proteção ao comprador da plataforma.
- **GARIMPO EXTREMO COM ENTREGA (/buscar/garimpo-entrega):** PCs até R$ 500, R$ 700 e R$ 1.000, monitores até R$ 200 e kits de hardware até R$ 400, pelo custo total (produto + frete + taxas conhecidos), sem preço mínimo. Exige envio confirmado e risco diferente de alto. Hoje (só KaBuM! ativa): 24 PCs até R$ 1.000, 6 monitores até R$ 200, 12 kits até R$ 400; nenhum PC abaixo de R$ 700.
- **Kits de hardware (/buscar/kit):** processador + placa-mãe (± memória/SSD), comparados com kits da mesma composição.
- **Segurança:** preço baixo nunca aumenta a confiança. Descontos extremos reduzem a confiabilidade, e todo anúncio traz a recomendação de pagar e combinar o envio pela plataforma (sem PIX por fora nem depósito antecipado). A confiabilidade só cai por sinais de risco; problemas de qualidade ficam no custo-benefício.

## Garimpo: estado, preço de mercado, risco e três notas

- **Estado de conservação** (6 classes): Novo, Seminovo, Usado, Recondicionado, Mostruário, Não informado. Vem do dado estruturado da fonte (ex.: *open box* da KaBuM!) e do texto do anúncio. A coleta agendada também busca usados, seminovos e recondicionados (o marketplace da KaBuM! tem anúncios reais desse tipo).
- **Preço médio de mercado:** mediana de anúncios **novos comparáveis**, descartando os 25% mais caros (anúncios fora do preço praticado). Para PCs, é preciso desempenho em jogos equivalente (±12%, depois ±25%), processador de classe parecida e o mesmo formato (com/sem monitor). Para monitores, mesma resolução, frequência próxima e mesmo painel. O valor é ajustado pelo estado: um usado é comparado ao preço justo de um usado (novo 100%, mostruário 88%, recondicionado 80%, seminovo 75%, usado 68%). Sem comparáveis suficientes, usa a curva de mercado, e o desconto fica marcado como estimativa de baixa confiança.
- **Três notas independentes (0–100):** **Custo-benefício** (todos os critérios técnicos e de entrega, sem a reputação), **Desconto real** (35 pontos no preço médio; cada 10% abaixo soma 13) e **Confiabilidade** (loja/vendedor, pessoa física ou profissional, dados que faltam, sinais de golpe, foto repetida entre vendedores, item usado sem garantia, estoque).
- **Nota geral** = 45% custo-benefício + 25% desconto + 30% confiabilidade. Fica limitada a 35 em **alto risco** e a 55 com **informações insuficientes**.
- **Risco:** Baixo risco aparente · Atenção · Alto risco · Informações insuficientes, sempre com os motivos. Sinais avaliados: preço extremo, palavras de golpe, pedido de pagamento ou contato fora da plataforma, especificações inconsistentes, vendedor mal avaliado, foto reaproveitada, dados ausentes. **Nenhum anúncio é apresentado como seguro.**
- **GARIMPO EXTREMO:** só anúncios ≥20% abaixo da média de comparáveis (com amostra suficiente), sem alto risco, com dados suficientes e, para PCs, com desempenho real para jogos (máquina obsoleta barata não entra). Ordena pelo maior desconto real.
- **Filtros extras:** estado, UF do vendedor, profissional × pessoa física, retirada presencial. **Ordenação:** menor preço, maior desconto real, melhor custo-benefício.
- **Radar (/radar):** anúncios novos, quedas de preço e anúncios removidos ou esgotados, alimentado pela coleta agendada.

## Algoritmo de pontuação técnica (base do custo-benefício)

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

## Versão publicada (retrato estático)

https://claude.ai/artifact/Wx3XNCcTvreH3Co6ocW1j7 é um retrato da coleta real de 06/11/2026 (1.468 ofertas), com busca, filtros, Garimpo Extremo, radar, análise e favoritos no navegador. Para gerá-lo de novo:

```bash
npm run refresh -- 4
npx tsx scripts/export-snapshot.ts snapshot
python3 scripts/snapshot-images.py && python3 scripts/snapshot-shrink.py   # miniaturas em WebP
# publique snapshot/index.html com snapshot/data.json e snapshot/img.json
```

## Configuração da Brave Search API

1. Crie uma chave em https://api-dashboard.search.brave.com.
2. Coloque em `.env.local` (local) ou nas variáveis de ambiente da Vercel: `BRAVE_SEARCH_API_KEY=...`. **Nunca** em código, no frontend ou no GitHub (`.env*` está no `.gitignore`).
3. Opcional: `BRAVE_CACHE_HOURS` (padrão 12), `BRAVE_RPS` (padrão 5), `DEFAULT_CEP` (padrão 71572811).

Sem a chave, o sistema continua funcionando só com as fontes diretas (KaBuM!), e a página de fontes mostra a Brave como "requer credenciais".

## Como rodar

```bash
npm install
cp .env.example .env.local        # ajuste DATABASE_URL
npm run db:migrate                # cria as tabelas e cadastra as lojas
npm run refresh -- 3              # primeira coleta (3 páginas por consulta)
npm run dev                       # http://localhost:3000
npm test                          # 80 testes
npm run build && npm start
```

Atrás de um proxy HTTP corporativo, rode com `NODE_USE_ENV_PROXY=1` (Node ≥ 22.21) para o `fetch` respeitar `HTTPS_PROXY`.

### Deploy (Vercel + Supabase)

1. Crie um projeto no Supabase e copie a connection string (pooler) para `DATABASE_URL`, com `DATABASE_SSL=true`.
2. Rode `npm run db:migrate` apontando para o Supabase. As tabelas de usuário ficam com RLS ativado e sem políticas: só o backend acessa.
3. Na Vercel (Project → Settings → Environment Variables), configure as variáveis de `.env.example`: `DATABASE_URL`, `DATABASE_SSL=true`, `BRAVE_SEARCH_API_KEY`, `CRON_SECRET`, `DEFAULT_CEP`. O `vercel.json` agenda `/api/cron/refresh` a cada 3 h. Cada execução respeita o limite de tempo da função (`maxDuration = 300`; planos com limite menor usam o que o plano permite). Para coletas maiores, rode `npm run refresh` em outro agendador (GitHub Actions, VPS).

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
