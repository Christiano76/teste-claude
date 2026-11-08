# Relatório de integrações e testes — 08/11/2026

Todos os números abaixo vêm de execuções reais feitas neste dia, com o CEP de entrega **71572811 (Brasília/DF)**.

## Como a busca funciona (arquitetura)

1. **Descoberta de anúncios** — `src/lib/discovery/`
   - `brave.ts`: cliente da Brave Search API. Fica só no servidor, tem cache no banco (`search_cache`, 12 h), limite de requisições por segundo, nova tentativa em caso de 429 e erros tipados.
   - `platforms.ts`: para cada plataforma, como reconhecer a página de **um anúncio** (e descartar listagens e buscas), extrair o ID, limpar o título e a localização.
   - `connectors.ts`: um conector por plataforma, com operador `site:`, nomes alternativos, orçamento e região (OLX por estado e estados vizinhos), mais a **descoberta aberta** de lojas pequenas (consultas com `-site:` excluindo os marketplaces já cobertos).
2. **Extração autorizada** — `src/lib/connectors/`: APIs e JSON públicos (KaBuM!), APIs oficiais (Mercado Livre, eBay, Amazon, Shopee, AliExpress), que exigem credenciais, e feeds.
3. **Normalização** — `src/lib/hardware/` (`specs.ts`, `parts.ts`, `cpus.ts`, `gpus.ts`): categoria (PC, monitor, kit, peça), especificações e estado de conservação. Notebooks, PCs "sem processador" e peças **nunca** contam como PC completo.
4. **Verificação** — cada oferta registra `verification`: `api` quando preço e estoque foram confirmados na fonte, `indice-busca` quando o preço é o indexado pelo buscador (não confirmado). Frete desconhecido aparece como "Frete não verificado".
5. **Desempenho** — `hardware/performance.ts`: índices relativos de cerca de 200 processadores e 120 placas de vídeo, e a adequação por uso (estudos, programação, jogos leves, competitivos e exigentes). É **estimativa**, nunca FPS.
6. **Classificação** — `scoring/`: preço médio de mercado por comparáveis, desconto real, confiabilidade e risco. A ordenação padrão coloca primeiro a entrega verificável (confirmada ou na sua região) e depois o menor custo total.

Durante a busca, a tela mostra o progresso fonte a fonte (`POST /api/collect`) e, em seguida, a análise (`GET /api/search`). Se uma fonte falha, as demais continuam.

## Status real de cada fonte

| Fonte | Como | Status | Observação |
|---|---|---|---|
| **KaBuM!** (+ marketplace) | JSON público do catálogo | ✅ **Funcionando** | Preço e estoque **confirmados**; envio nacional. 34 de 34 links testados abriram (HTTP 200). |
| **OLX** | Brave (`site:{uf}.olx.com.br` + UFs vizinhas) | ✅ **Funcionando (preço não confirmado)** | Anúncios reais de pessoas físicas em DF, GO e MG, com localização. A OLX bloqueia acesso automatizado (Cloudflare 403), então os links precisam ser abertos no seu navegador. |
| **Mercado Livre** | Brave (`site:produto.mercadolivre.com.br`) | ✅ **Funcionando (preço não confirmado)** | Mesma limitação de abertura automatizada (403). A **API oficial** (frete por CEP) segue exigindo token. |
| **Amazon** | Brave (`/dp/`) | ✅ Funcionando (poucos resultados) | PA-API exige conta de Associado. |
| **Shopee** | Brave (`-i.<loja>.<item>`) | ⚠️ Poucos resultados | O índice raramente traz o preço; esses anúncios vão para "encontrados sem preço". |
| **TerabyteShop, Pichau, Carrefour, GK Infostore** | Brave | ✅ Funcionando (preço não confirmado) | Páginas de produto com preço estruturado. |
| **Magazine Luiza, Casas Bahia** | Brave | ⚠️ Poucos resultados | O índice traz sobretudo páginas de categoria, que são descartadas. |
| **Enjoei** | Brave | ⚠️ 0 anúncios com preço nos testes | O índice traz páginas de busca (descartadas). |
| **eBay** | Brave + Browse API | ⚠️ 1 anúncio via Brave | A Browse API (entrega para o Brasil confirmada) exige `EBAY_CLIENT_ID`/`SECRET`. |
| **Patoloco** | Brave | ⚠️ 0 nos testes | Poucas páginas de produto indexadas para os termos usados. |
| **Descoberta de lojas** | Brave (consultas abertas) | ✅ Funcionando | Lojas novas encontradas: microlivre, suprinform, topneteletronicos, refurban, armazemdeusados, extrabit, dhshop, helpsetinfo e outras. A maioria sem preço estruturado, então entram como "anúncio encontrado". |
| **Facebook Marketplace** | — | ❌ Sem acesso autorizado | Não há API de busca, e o login impede a indexação. |
| ViaCEP / BrasilAPI, Banco Central (PTAX) | APIs públicas | ✅ Funcionando | CEP 71572811 → Brasília/DF. |

Consumo da Brave: cerca de 30 a 45 consultas na primeira busca de um modo; as repetições em até 12 h saem do cache, sem custo.

## Testes obrigatórios

| # | Teste | Resultado |
|---|---|---|
| 1 | **PC até R$ 500** | 5 anúncios reais, todos da OLX (DF, GO, MG), de R$ 200 a R$ 499. Nenhuma loja tem PC completo com preço confirmado abaixo de R$ 700. Preço não confirmado e frete não verificado. 2 em "alto risco" (um cita contato fora da plataforma; outro custa 82% menos que comparáveis). |
| 2 | **PC gamer até R$ 1.000** | 51 resultados: 26 com preço confirmado (KaBuM!, a partir de R$ 754,39, ThinkCentre i5 recondicionado) e 25 via buscador. 1 anúncio com defeito ocultado. Estados: 4 usados, 3 seminovos, 2 recondicionados, 20 novos, 22 não informados. |
| 3 | **PC + monitor até R$ 1.500** | 132 conjuntos (kits com monitor e combinações separadas), todos dentro do orçamento. 12 anúncios com defeito ocultados. |
| 4 | **Monitor até R$ 400** | 73 resultados: 27 confirmados (a partir de R$ 148,49) e 46 via buscador. 14 usados identificados. |
| 5 | **Abertura dos links** | KaBuM!: 34/34 abrem (200). OLX e Mercado Livre: 403 para acesso automatizado (Cloudflare), inclusive com Chromium; não contornamos o bloqueio. Os links vêm do índice da Brave, e os botões "Ver oferta" abrem o anúncio original em nova aba. |
| 6 | **Identificação de usados** | Classificação por título e trecho do anúncio: "Usado", "Seminovo", "Recondicionado", "Mostruário". Anúncios de classificados sem estado declarado ficam como "Não informado" (comparados como usados no preço de mercado, e o sistema avisa). |
| 7 | **Celular** | Testado com perfil de iPhone 13: sem rolagem horizontal (largura 390), filtros em gaveta, sem erros no console. Tema escuro (padrão) e claro testados. |
| 8 | **Chave secreta** | Ausente dos arquivos versionados, do histórico do git, do build do navegador (`.next/static`), do build do servidor, das respostas da API e do retrato publicado. Existe só em `.env.local` (ignorado). |
| 9 | **Fontes que funcionam** | Veja a tabela acima. |

## Limitações (transparência)

- **Preço "não confirmado"**: anúncios encontrados via Brave mostram o preço que a página tinha quando foi indexada (data exibida). O anúncio pode ter mudado ou sido vendido.
- **Frete**: só é confirmado na KaBuM! (envio nacional e frete grátis quando informado). Nas demais fontes aparece "Frete não verificado". Para OLX e outros classificados da sua região, o card avisa "anúncio na sua região: combine entrega ou retirada pela plataforma".
- **Defeitos**: anúncios que descrevem defeito ("não liga", "para peças", "com defeito"…) são ocultados e contados.
- **Golpes**: o sistema nunca acusa um vendedor; mostra sinais de risco com motivos e recomenda pagar sempre pela plataforma.
