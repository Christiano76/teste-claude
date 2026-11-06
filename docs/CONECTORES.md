# Conectores do PC Hunter

Cada fonte é um módulo em `src/lib/connectors/` que implementa a interface `Connector` (`types.ts`). A página **/fontes** mostra, para cada uma: tipo de integração, status real, anúncios ativos (total, usados e com envio confirmado), última atualização, último erro e credenciais necessárias.

**Regra:** uma plataforma só aparece como **Funcionando** quando houve busca real bem-sucedida **e** há anúncios dela na base. Sem meio autorizado de busca, o status é **Sem integração autorizada**, e ela nunca entra nas buscas.

Testes: `tests/connectors.test.ts` (um bloco por conector) e `tests/delivery.test.ts` (regras de entrega e Garimpo com entrega).

| Prioridade | Plataforma | Módulo | Tipo | Status em 06/11/2026 |
|---|---|---|---|---|
| 1 | OLX Brasil | `classificados.ts` | Classificados | ❌ Sem integração autorizada |
| 2 | Mercado Livre | `mercadolivre.ts` | API oficial | ⚠️ Implementado, requer token OAuth |
| 3 | Facebook Marketplace | `classificados.ts` | Classificados | ❌ Sem integração autorizada |
| 4 | Amazon Brasil | `amazon.ts` | API de afiliados (PA-API 5) | ⚠️ Implementado, requer credenciais |
| 5 | Enjoei | `classificados.ts` | Classificados | ❌ Sem integração autorizada |
| 6 | Shopee | `shopee.ts` | API de afiliados | ⚠️ Implementado, requer credenciais |
| — | KaBuM! (+ marketplace) | `kabum.ts` | Catálogo público (JSON) | ✅ Funcionando |
| — | AliExpress | `aliexpress.ts` | API de afiliados | ⚠️ Implementado, requer credenciais |
| — | Feeds (lojas e classificados autorizados) | `feed.ts` | Feed | ✅ Leitura testada; nenhum feed configurado |

---

## OLX Brasil (`classificados.ts` → `olx`)

- **Verificado em 06/11/2026:** o portal oficial `developers.olx.com.br` documenta só **importação/publicação de anúncios** (imóveis, veículos, autopeças, agro), **leads**, **chat** e **destaques**. Não existe endpoint de busca para terceiros. `www.olx.com.br/robots.txt` respondeu **403 (Cloudflare)** para acesso automatizado.
- **Não contornamos** essa proteção. Garantia OLX, Entrega Fácil, envio para outras cidades, entrega local × nacional e a categoria elegível para entrega só podem ser lidos com dados autorizados.
- **Como ativar:** com parceria ou exportação autorizada, use um feed de classificados (veja *Feeds*) com `shipping_available`, `shipping_scope` (`nacional`/`local`), `shipping_program` (ex.: `Entrega Fácil`), `protection` (ex.: `Garantia OLX`), `pickup`, `seller_type` e `location`. O PC Hunter aplica todas as regras de entrega a esses campos.

## Mercado Livre (`mercadolivre.ts`)

- **API oficial:** `GET /sites/MLB/search` e `GET /items/{id}/shipping_options?zip_code=CEP`.
- **Verificado em 06/11/2026:** sem token, todas as chamadas (inclusive `/sites/MLB`) respondem **403 forbidden**. Status: **Requer credenciais**.
- **Credenciais:** `ML_ACCESS_TOKEN`, ou `ML_CLIENT_ID` + `ML_CLIENT_SECRET` (+ `ML_REFRESH_TOKEN` para renovar o token automaticamente).
- **Mapeamento (testado com o formato da API):**
  - estado: `condition` (`new`/`used`/`refurbished`) mais o texto do anúncio. Buscas com "usado"/"seminovo" aplicam `condition=used`;
  - envio: `shipping.mode` igual a `me1`/`me2`/`custom` = **envio confirmado**; `not_specified` = **não confirmado** (combinar com o vendedor);
  - `logistic_type=fulfillment` = **Mercado Envios Full**; `shipping.local_pick_up` = retirada presencial;
  - proteção: Compra Garantida (quando paga pela plataforma);
  - frete e prazo **para o CEP do usuário** via `shipping_options`, com cache de 12 h. Esse valor entra no custo total.
- O conector existe e está testado com o formato da API, mas **nunca foi testado ao vivo** (sem token).

## Facebook Marketplace (`classificados.ts` → `facebook`)

- **Verificado em 06/11/2026:** a Meta não oferece API de busca do Marketplace para terceiros. O `robots.txt` exige autorização para agentes automatizados.
- Anúncios de retirada presencial **não** são tratados como envio, e nenhuma disponibilidade de entrega é presumida.
- **Como ativar:** só com autorização formal da Meta.

## Amazon Brasil (`amazon.ts`)

- PA-API 5 (`SearchItems`) com assinatura AWS SigV4.
- **Credenciais:** `AMAZON_PAAPI_ACCESS_KEY`, `AMAZON_PAAPI_SECRET_KEY`, `AMAZON_PAAPI_PARTNER_TAG` (conta de Associado aprovada).
- Envio confirmado (nacional) e proteção pela Garantia de A a Z. "Enviado pela Amazon" é identificado.
- Não testado ao vivo. A Amazon vem migrando associados para uma nova API; se a PA-API for descontinuada para a sua conta, este conector precisa ser adaptado.

## Enjoei (`classificados.ts` → `enjoei`)

- **Verificado em 06/11/2026:** não há API pública, e o `robots.txt` contém `Disallow: /busca` (bloqueia as páginas e os parâmetros de busca).
- **Como ativar:** parceria ou feed autorizado.

## Shopee (`shopee.ts`)

- Open API de Afiliados (GraphQL `productOfferV2`), com assinatura SHA256.
- **Credenciais:** `SHOPEE_AFFILIATE_APP_ID`, `SHOPEE_AFFILIATE_SECRET`.
- Envio pela plataforma e Garantia Shopee. Não testado ao vivo.

## KaBuM! (`kabum.ts`)

- JSON público do catálogo usado pelo próprio site, coletado com intervalo mínimo entre requisições.
- **Funcionando:** cerca de 2.160 anúncios ativos (PCs, monitores e kits de hardware), incluindo vendedores do marketplace com **usados, seminovos e recondicionados**.
- Envio nacional confirmado (loja online) e proteção do CDC (arrependimento em 7 dias). Mostra frete grátis quando aplicável. **Não expõe frete por CEP, prazo nem retirada**, que aparecem como "não informado".
- Vendedor PJ × pessoa física (`seller_sale_pj`), UF do vendedor e mostruário (*open box*).

## AliExpress (`aliexpress.ts`)

- Affiliate API (`aliexpress.affiliate.product.query`). Envio internacional; impostos de importação estimados (Remessa Conforme + ICMS).
- **Credenciais:** `ALIEXPRESS_APP_KEY`, `ALIEXPRESS_APP_SECRET`.

## Feeds (`feed.ts`)

- Lê Google Merchant (XML), CSV e JSON. `PRODUCT_FEEDS='[{"store":"OLX (feed autorizado)","url":"https://…","kind":"classificados"}]'`.
- Campos de classificados: `shipping_available` (`sim`/`não`/vazio), `shipping_scope` (`nacional`/`local`/`internacional`), `shipping_program`, `pickup`, `protection`, `seller_type` (`pessoa-fisica`/`profissional`), `seller_name`, `location` (UF).
- **Envio nunca é presumido:** sem `shipping_available` (ou preço de frete), o anúncio fica com envio **não confirmado**.

---

## Regras de entrega (válidas para todas as fontes)

- **Somente com entrega:** só anúncios com envio **confirmado para o CEP do usuário**. Envio só local de outra UF fica de fora; envio não confirmado fica de fora.
- **Entrega ou retirada presencial:** envio confirmado **ou** retirada.
- **Somente retirada presencial:** só anúncios com retirada informada pela fonte.
- Sem CEP informado, não dá para confirmar envio local. A tela de garimpo pede o CEP.

## GARIMPO EXTREMO COM ENTREGA

Faixas pelo **custo total** (produto + frete + taxas conhecidos):

| Faixa | Regra |
|---|---|
| PC completo até R$ 500 / R$ 700 / R$ 1.000 | categoria PC |
| Monitor até R$ 200 | categoria monitor |
| Kit de hardware até R$ 400 | processador + placa-mãe (± memória) |

Exige envio confirmado para o comprador, disponibilidade e risco diferente de **alto**. Não há preço mínimo. Cada anúncio continua com preço médio de mercado, desconto real e as três notas. **Preço baixo nunca aumenta a confiabilidade:** descontos extremos reduzem a nota de confiança, e o PC Hunter sempre recomenda pagar e combinar o envio pela plataforma, sem PIX por fora nem depósito antecipado.
