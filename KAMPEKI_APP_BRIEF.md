# Kampeki Finance — Project Brief

## Visão Geral

Aplicação web fullstack em **Node.js** para lançamento e visualização de custos e folha de pagamento do Kampeki. O **Google Sheets** funciona como banco de dados. Toda a lógica de negócio, validações e regras ficam na aplicação — o Sheets é apenas a camada de persistência.

---

## Stack

- **Backend:** Node.js + Express
- **Frontend:** React (Vite)
- **Banco de dados:** Google Sheets via Google Sheets API v4
- **Autenticação:** JWT (email + senha definidos no `.env`)
- **Credenciais Google:** Service Account via `.env` (`GOOGLE_CREDENTIALS_JSON`)

---

## Variáveis de Ambiente (`.env`)

```dotenv
PORT=3001
NODE_ENV=development

JWT_SECRET=string_aleatoria_longa
JWT_EXPIRES_IN=7d

ADMIN_EMAIL=admin@kampeki.local
ADMIN_PASSWORD=admin@2026

GOOGLE_SHEET_ID=ID_DA_PLANILHA_AQUI
GOOGLE_CREDENTIALS_JSON={"type":"service_account", ...}
```

---

## Estrutura do Projeto

```
kampeki-finance/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── google.js          # inicializa Google Sheets API
│   │   ├── middleware/
│   │   │   └── auth.js            # valida JWT
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── fornecedor.js
│   │   │   ├── tag.js
│   │   │   ├── itens.js
│   │   │   └── custos.js
│   │   │   └── folha.js
│   │   ├── services/
│   │   │   ├── sheets.js          # leitura/escrita genérica no Sheets
│   │   │   ├── fornecedor.js
│   │   │   ├── tag.js
│   │   │   ├── itens.js
│   │   │   ├── custos.js
│   │   │   └── folha.js
│   │   ├── utils/
│   │   │   ├── uuid.js            # geração de UUID v4
│   │   │   ├── date.js            # helpers de data
│   │   │   └── switch-categoria.js # mapeamento subcategoria → categoria
│   │   └── app.js
│   ├── .env
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── api/                   # chamadas ao backend
│   │   ├── components/
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Fornecedor.jsx
│   │   │   ├── Tag.jsx
│   │   │   ├── Itens.jsx
│   │   │   ├── Custos.jsx
│   │   │   ├── Folha.jsx
│   │   │   └── dash/
│   │   │       ├── DashCustos.jsx
│   │   │       ├── DashFolha.jsx
│   │   │       └── DashPeriodo.jsx
│   │   ├── App.jsx
│   │   └── main.jsx
│   └── package.json
```

---

## Google Sheets — Estrutura das Abas

A planilha já existe no Drive com a estrutura abaixo. Na primeira execução, a aplicação valida se cada aba existe. Se não existir, cria com os cabeçalhos corretos.

### Aba: `FORNECEDOR`
| UUID | NOME_FORNECEDOR |

### Aba: `TAG`
| UUID | TAG |

### Aba: `ITENS`
| UUID | DESCRICAO_ITEM | SUB_CATEGORIA | CATEGORIA |

> `CATEGORIA` é derivada de `SUB_CATEGORIA` via mapeamento interno (ver seção Regras de Negócio).

### Aba: `CUSTOS`
| UUID | DATA_NOTA | NUM_NOTA | MES_ANO | MES_NUM | ANO | DIA_MES_ANO | FORNECEDOR | ITEM | SUB_CATEGORIA | CATEGORIA | QTD | VALOR_UNIT | VALOR_TOTAL |

### Aba: `FOLHA`
| UUID | MES_ANO | MES_NUM | ANO | TAG | ITEM_FOLHA | VALOR | OBSERVACAO |

---

## Inicialização da Planilha

Ao iniciar o backend, executar `initSheets()`:

1. Autenticar com a Service Account
2. Para cada aba (`FORNECEDOR`, `TAG`, `ITENS`, `CUSTOS`, `FOLHA`):
   - Verificar se existe pelo nome
   - Se não existir → criar a aba e inserir a linha de cabeçalho
3. Se todas existem → apenas continuar (não modificar dados existentes)

---

## Autenticação

- Endpoint `POST /api/auth/login` recebe `{ email, password }`
- Valida contra `ADMIN_EMAIL` e `ADMIN_PASSWORD` do `.env`
- Retorna JWT com expiração definida em `JWT_EXPIRES_IN`
- Todas as rotas da API (exceto `/api/auth/login`) exigem header `Authorization: Bearer <token>`
- Frontend armazena o token em `localStorage` e redireciona para login se expirado

---

## Regras de Negócio

### Mapeamento SUB_CATEGORIA → CATEGORIA

```js
const categoriaMap = {
  // CMV
  "ALIMENTOS EM GERAL": "CMV",
  "HORTIFRUTI": "CMV",
  "BEBIDAS": "CMV",
  "DESTILADOS": "CMV",
  "CERVEJA": "CMV",
  "DOCES": "CMV",
  "PRODUTO ORIENTAL": "CMV",
  "VINHOS E ESPUMANTES": "CMV",
  "CAMARÃO": "CMV",
  "PEIXES": "CMV",
  "POLVO": "CMV",
  "OSTRA": "CMV",
  "SALMÃO": "CMV",
  "ATUM": "CMV",
  "BLUEFIN": "CMV",
  "WAGYU": "CMV",
  "GELO": "CMV",
  "EMBALAGENS": "CMV",
  "CARNE VERMELHA": "CMV",
  // FOLHA CANOAS
  "INSUMOS FUNCIONÁRIOS": "FOLHA CANOAS",
  "CARNE FUNCIONÁRIO": "FOLHA CANOAS",
  "UNIFORME": "FOLHA CANOAS",
  "FGTS": "FOLHA CANOAS",
  "FOLHA CANOAS": "FOLHA CANOAS",
  // FOLHA POA
  "FOLHA POA": "FOLHA POA",
  // FOLHA TELE
  "FOLHA TELE": "FOLHA TELE",
  // DESPESA ADMINISTRATIVA
  "MATERIAL DE OPERAÇÃO": "DESPESA ADMINISTRATIVA",
  "MATERIAL LIMPEZA": "DESPESA ADMINISTRATIVA",
  "PRODUTO DE LIMPEZA": "DESPESA ADMINISTRATIVA",
  "MATERIAL DE MANUTENÇÃO": "DESPESA ADMINISTRATIVA",
  "MANUTENÇÃO": "DESPESA ADMINISTRATIVA",
  "MATERIAL ESCRITÓRIO": "DESPESA ADMINISTRATIVA",
  "UTENSILIOS": "DESPESA ADMINISTRATIVA",
  "MARKETING": "DESPESA ADMINISTRATIVA",
  "MATERIAL DE MARKETING": "DESPESA ADMINISTRATIVA",
  "SISTEMA": "DESPESA ADMINISTRATIVA",
  "INTERNET": "DESPESA ADMINISTRATIVA",
  "ALUGUEL CANOAS": "DESPESA ADMINISTRATIVA",
  "ALUGUEL POA": "DESPESA ADMINISTRATIVA",
  "GAS": "DESPESA ADMINISTRATIVA",
  "GAS NATURAL": "DESPESA ADMINISTRATIVA",
  "LUZ POA": "DESPESA ADMINISTRATIVA",
  "TAXAS": "DESPESA ADMINISTRATIVA",
  "TAXAS POA": "DESPESA ADMINISTRATIVA",
  "ADVOGADO": "DESPESA ADMINISTRATIVA",
  "SEGURANÇA": "DESPESA ADMINISTRATIVA",
  "FRETE": "DESPESA ADMINISTRATIVA",
  "ATIVO IMOBILIZADO": "DESPESA ADMINISTRATIVA",
  "LOUÇAS": "DESPESA ADMINISTRATIVA",
  "MOTOBOY CASA": "DESPESA ADMINISTRATIVA",
  "MOTOBOY OCTO": "DESPESA ADMINISTRATIVA",
  // OUTROS
  "DISTRIBUIÇÃO DE LUCRO": "DISTRIBUIÇÃO DE LUCRO",
  "IMPOSTOS": "IMPOSTOS",
};
```

### Fornecedor
- `NOME_FORNECEDOR` não pode se repetir (case-insensitive)
- UUID gerado pela aplicação no momento do cadastro

### Tag
- `TAG` não pode se repetir (case-insensitive)
- UUID gerado pela aplicação

### Itens
- `DESCRICAO_ITEM` não pode se repetir (case-insensitive)
- `CATEGORIA` é preenchida automaticamente pela aplicação a partir do mapeamento acima — nunca enviada pelo frontend
- UUID gerado pela aplicação

### Lançamento de Custo
Campos obrigatórios: `DATA_NOTA`, `NUM_NOTA`, `FORNECEDOR`, `ITEM`, `QTD`, `VALOR_UNIT`

A aplicação deve:
1. Receber `DATA_NOTA` no formato `DD/MM/YYYY`
2. Derivar automaticamente:
   - `MES_ANO` → `MM/YYYY`
   - `MES_NUM` → número do mês (1–12)
   - `ANO` → ano com 4 dígitos
   - `DIA_MES_ANO` → `DD/MM/YYYY` (string)
3. Buscar `SUB_CATEGORIA` e `CATEGORIA` a partir do item selecionado (aba ITENS)
4. Calcular `VALOR_TOTAL = QTD * VALOR_UNIT` (apresentar ao usuário antes de salvar)
5. Se `CATEGORIA` for `FOLHA CANOAS`, `FOLHA POA` ou `FOLHA TELE` → exigir seleção de `TAG`
6. UUID gerado pela aplicação

### Lançamento de Folha
Campos obrigatórios: `MES_ANO`, `TAG`, `ITEM_FOLHA`, `VALOR`

- `MES_NUM` e `ANO` derivados de `MES_ANO` pela aplicação
- `TAG` deve existir na aba TAG
- UUID gerado pela aplicação

### Edição e Exclusão
- Permitidas para todos os registros de todas as abas
- Ao editar um registro no Sheets, localizar pelo UUID e atualizar a linha inteira
- Ao excluir, remover a linha pelo UUID

---

## Módulos de Lançamento (Frontend)

### Fornecedor
- Campo: Nome do fornecedor
- Validação: não pode repetir (consulta a aba antes de salvar)
- Listagem com opção de editar e excluir

### Tag
- Campo: Nome da tag
- Validação: não pode repetir
- Listagem com opção de editar e excluir

### Itens (junto com Subcategoria/Categoria)
- Campos: Descrição do item, Subcategoria (select com todas as subcategorias do mapeamento)
- Categoria exibida automaticamente ao selecionar subcategoria (somente leitura)
- Listagem com opção de editar e excluir

### Custos
- Campos: Data (date picker), Nº Nota, Fornecedor (select), Item (select), Qtd, Valor Unitário
- Valor Total calculado e exibido em tempo real (Qtd × Valor Unit)
- Se a categoria do item selecionado for FOLHA → exibir campo Tag (select obrigatório)
- Confirmação antes de salvar mostrando o resumo do lançamento
- Listagem com filtros por mês/ano, categoria, fornecedor
- Opção de editar e excluir

### Folha
- Campos: Mês/Ano (month picker), Tag (select), Item Folha (texto livre), Valor, Observação
- Listagem com filtros por mês/ano e tag
- Opção de editar e excluir

---

## Dashboards (Frontend)

### Dash Custos
- Filtros: Mês, Ano, intervalo livre de período
- Visões:
  - Total geral no período
  - Total por categoria
  - Total por subcategoria
  - Tabela item a item com valor, % do total e variação em relação ao período anterior
  - Comparativo mês a mês (gráfico de linha ou barras)
  - Top N itens por valor (N configurável)
  - Alerta visual para itens com crescimento acima de threshold configurável (%)

### Dash Folha
- Filtros: Mês, Ano, intervalo livre de período, Tag
- Visões:
  - Subtotal por Tag
  - Subtotal por Item
  - Cruzamento Tag × Item (tabela)
  - Evolução mensal da folha total
  - Participação percentual de cada Tag no total

### Análise por Período — Custos
- Seleção de dois períodos para comparação (ex: Jan–Mar 2025 vs Jan–Mar 2026)
- Comparativo por item, subcategoria e categoria
- Variação absoluta e percentual entre os períodos

### Análise por Período — Folha
- Mesma lógica do anterior, mas restrita à aba FOLHA
- Comparativo por item, subcategoria (via tag) e categoria

---

## Observações Técnicas

- Todas as leituras do Sheets devem ignorar a linha 2 (linha de notas/instrução) e considerar dados a partir da linha 3
- Cache leve no backend para listas de Fornecedor, Tag e Itens (invalidar ao inserir/editar/excluir)
- Threshold de alerta de crescimento deve ser configurável via variável de ambiente ou painel simples de configurações
- UUID gerado com `crypto.randomUUID()` (nativo do Node.js 14.17+)
- Datas sempre trafegam como string `DD/MM/YYYY` entre frontend e backend; a conversão para objeto Date ocorre apenas internamente quando necessário

---

## Atualizações — 15/06/2026

### Aba `CUSTOS` — coluna `TAG` adicionada
A aba `CUSTOS` agora inclui a coluna `TAG` ao final (definição em `backend/src/services/sheets.js`):

```
CUSTOS: | UUID | DATA_NOTA | NUM_NOTA | MES_ANO | MES_NUM | ANO | DIA_MES_ANO | FORNECEDOR | ITEM | SUB_CATEGORIA | CATEGORIA | QTD | VALOR_UNIT | VALOR_TOTAL | TAG |
```

Decisão de modelagem: **a TAG é atributo do lançamento, não do item**. Fica vazia quando a categoria não é folha; nos lançamentos de folha é preenchida (no formulário, obrigatória; na importação, deixada em branco para tagear depois).

### Cadastros — busca e filtros
- **Itens:** filtros combináveis acima da tabela — input de texto (nome do item) + select de categoria + select de subcategoria (a subcategoria se restringe à categoria escolhida). Os três operam em conjunto, com botão "Limpar filtros" e contador `X de Y`.
- **Fornecedor:** campo de busca livre (input de texto) que filtra a lista em tempo real (`SimpleCrudPage` ganhou a prop `searchable`; Tag permanece sem busca).

### Importação de planilha — "Baixar modelo"
Todo `ImportModal` pode oferecer um botão **"⬇ Baixar modelo"** que gera um `.xlsx` só com os cabeçalhos corretos (props `templateColumns` / `templateName`). Modelos:
- Fornecedores → `LISTA FORNECEDOR`
- Itens → `ITENS`, `SUB CATEGORIA`, `CATEGORIA`
- Custos → `DATA`, `N° NOTA`, `LISTA FORNECEDOR`, `ITENS`, `SUB CATEGORIA`, `CATEGORIA`, `UN`, `VALOR`

Leitura de arquivos passa a usar `XLSX.read(buf, { cellDates: true })` (datas viram `Date`, simplificando o parse).

### Importação de Custos antigos
Novo fluxo na página **Custos** (botão "Importar planilha"). Parser no frontend (`parseCustos`) só extrai/normaliza; **toda a inteligência fica no backend** (`custos.importarLote`, rota `POST /custos/import`):

1. **Mês/ano** derivados de `DATA_NOTA` → preenche `MES_ANO`, `MES_NUM`, `ANO`, `DIA_MES_ANO`.
2. **Fornecedor** inexistente (case-insensitive) é **criado** na aba `FORNECEDOR`.
3. **Item:** se existe, usa `SUB_CATEGORIA`/`CATEGORIA` **do sistema** (ignora as do arquivo); se não existe, **cadastra** (categoria derivada da subcategoria pelo mapa, fallback para a do arquivo) e então usa.
4. **`VALOR_TOTAL` recalculado** = `UN × VALOR` (a coluna `TOTAL` do arquivo é **ignorada**).
5. **TAG em branco** nos itens de folha (a tagear depois).
6. Toda linha válida vira registro completo; linhas com dado faltando são reportadas em `errosLista` sem derrubar a importação.

Robustez: bases (`FORNECEDOR`/`ITENS`) lidas **uma vez** e novos cadastros deduplicados em memória (suporta massas grandes — validado com 1096 linhas); datas tratam `Date`/serial Excel/strings (`DD/MM/YYYY`, `D/M/YY`, ISO) com arredondamento ao dia para matar o artefato de precisão do xlsx; números aceitam formato pt-BR e en e símbolo `R$`. O resumo da importação mostra também "Fornecedores criados" e "Itens criados".

> **Atenção:** a importação **não** deduplica contra custos já existentes — rodar o mesmo arquivo duas vezes duplica os lançamentos (cada um com UUID próprio). Adequado para carga histórica única.

### Política de `VALOR_TOTAL` (recálculo vs. arquivo)
`VALOR_TOTAL` é **sempre** `round(UN × VALOR, 2)`, conforme a regra de negócio — nunca a coluna `TOTAL` do arquivo de origem. Em uma carga real, isso gerou divergência esperada entre a soma do dashboard (correta, sobre o valor gravado) e a soma manual da coluna `TOTAL` do arquivo: parte por **erros de digitação na origem** (que o recálculo corrige) e parte por **arredondamento de centavos** em itens de quantidade fracionada. O dashboard reflete fielmente o que está gravado; não é bug.

### CRUD de Custos — filtro por nota e edição em massa
Duas inteligências adicionadas à listagem de Custos:

1. **Filtro livre por nota fiscal** — input de texto que filtra a lista por `NUM_NOTA` (busca por trecho, case-insensitive), combinável com os filtros de mês/ano, categoria e fornecedor já existentes.

2. **Edição em massa** — coluna de checkbox por linha + checkbox no cabeçalho que **seleciona todos os filtrados** (respeita os filtros ativos; a seleção persiste por UUID mesmo trocando filtros). Com ≥1 selecionado, aparece a barra "Editar em massa", que abre um modal para escolher **um campo** e **um valor** replicados a todos os selecionados:
   - **Tag** (select das tags cadastradas; opção "(limpar tag)" para esvaziar) — caso de uso principal: tagear de uma vez os custos de folha (filtra pela categoria → seleciona todos → aplica).
   - **Fornecedor** (select dos fornecedores cadastrados).

   Backend: `POST /custos/bulk` `{ uuids, campo, valor }` → `custos.atualizarEmMassa`, que valida o valor (TAG cadastrada / FORNECEDOR existente) e grava **uma única coluna** em todas as linhas selecionadas numa só chamada (`sheets.updateColumnForUuids` via `values.batchUpdate`). Campos permitidos hoje: `TAG` e `FORNECEDOR` (lista branca `CAMPOS_MASSA`).

### Dash Custos — drill-down interativo
O Dash Custos virou responsivo a cliques (drill-down), compondo com o filtro de período já existente:

- **Clique numa fatia/legenda da pizza "Total por categoria"** → filtra todo o dashboard para aquela categoria (ex.: CMV). A fatia selecionada fica destacada (borda branca) e as demais esmaecidas; clicar de novo desfaz.
- **Clique numa linha de "Total por subcategoria"** → refina para aquela subcategoria. A lista de subcategorias passa a mostrar só as da categoria selecionada.
- **Total no período, contador de Lançamentos, comparativo mês a mês e a tabela "Top N itens" (incluindo a variação vs. período anterior)** recalculam conforme o drill-down ativo.
- A pizza de categoria continua sempre sobre o período inteiro (permite trocar de categoria a qualquer momento). O **% por subcategoria** é relativo ao total da categoria (`totalBaseCat`), não ao recorte da subcategoria.
- Um **chip "Drill-down ativo"** mostra Categoria/Subcategoria selecionadas, cada uma removível, mais "Limpar drill-down".

Implementação 100% no frontend (`DashCustos.jsx`), via estados `selCategoria`/`selSubcategoria` e camadas derivadas `noPeriodo → baseCat → filtrado`. Sem mudança de backend.

### Dash Custos — legibilidade do tooltip da pizza
O tooltip da pizza "Total por categoria" estava com texto escuro sobre fundo escuro (sumia no hover). Ajustado para fundo mais claro (`#222732`), borda mais visível (`#3a4150`, `borderRadius: 6`) e texto claro (`itemStyle`/`labelStyle` em `#f1f3f5`).

> Pendência (opcional): padronizar o mesmo contraste nos demais tooltips do dashboard — o do gráfico "Comparativo mês a mês" ainda usa o fundo escuro antigo (`#181b22`).

---

## Atualizações — 20/06/2026

> Esta seção registra **mudanças de decisão** em relação ao que estava documentado acima. Onde uma regra anterior foi revista, o histórico fica explícito (**Antes → Agora**) de propósito, para não se perder o motivo da virada.

### `VALOR_TOTAL` — política revista (antes ignorava o arquivo, agora respeita)

**Antes (15/06/2026, seção "Política de `VALOR_TOTAL`"):** o total era **sempre** `round(UN × VALOR, 2)`; a coluna `TOTAL` do arquivo de importação era **sempre ignorada**, e no formulário o total era um KPI somente-leitura.

**Por que mudou:** conversando com quem vai gerir o app, ficou claro que (1) no lançamento manual existem casos legítimos de **ajuste manual** do total (arredondamentos combinados, acordos com fornecedor, etc.) e (2) na importação, quando a planilha de origem **já traz** um total, ele deve ser respeitado em vez de recalculado.

**Agora:**
- **Formulário (manual):** o total continua calculado por padrão (`QTD × VALOR_UNIT`, em tempo real), mas há um botão **"✏ editar total"** que destrava o campo para edição manual; enquanto destravado, o valor digitado é mantido (não recalcula sozinho ao mexer em Qtd/V.Unit) e um botão **"↺ recalcular"** volta ao automático. Ao reabrir um custo cujo total gravado difere de `QTD × V.Unit`, o form abre **já em modo manual**, preservando o ajuste.
- **Importação:** se a coluna `TOTAL` vier **preenchida (> 0)**, usa o valor do arquivo; se vier **vazia ou zero**, recalcula `UN × VALOR`.
- **Arredondamento:** em todos os casos, grava `round(total, 2)` — inclusive quando vem do arquivo.
- Regra centralizada no backend em `custos.resolverTotal(qtd, valorUnit, totalInformado)`, usada tanto em `montarLinha` (form) quanto em `importarLote` (import). O parser `parseCustos` passou a extrair a coluna `TOTAL` (→ `VALOR_TOTAL`); o modelo `.xlsx` e o texto de ajuda do import incluem `TOTAL` (opcional).

> Consequência: a observação anterior de que "a divergência entre o dashboard e a soma da coluna `TOTAL` do arquivo é esperada" **deixa de valer para os casos em que o `TOTAL` é informado** — agora, quando informado, dashboard e arquivo batem por construção. A divergência só persiste onde o total é (re)calculado.

### Correção — valores aparecendo zerados no front (Qtd / V.Unit / Total)

**Sintoma:** algumas linhas exibiam `Qtd`, `V. Unit` e `Total` como zero no frontend, embora os dados estivessem corretos na planilha do Drive.

**Causa:** a leitura do Sheets (`sheets.getRows`) usava o default `valueRenderOption = FORMATTED_VALUE`, que devolve o **texto formatado** da célula (locale pt-BR, ex.: `"1.234,56"` / `"R$ …"`). O `format.brl()` no front fazia `Number("1.234,56")` → `NaN` → `|| 0` → **zero**. Só quebrava nas células cuja formatação de exibição usava separador de milhar/moeda; as gravadas "limpas" liam normal.

**Correção:**
- **Backend:** `getRows` passou a ler com `valueRenderOption: 'UNFORMATTED_VALUE'` (números voltam como número) + `dateTimeRenderOption: 'FORMATTED_STRING'` (datas seguem como `DD/MM/YYYY`). Vale para **todas as abas**, pois é a leitura única.
- **Frontend (blindagem):** `brl()`/`pct()` passaram a usar `toNum()` em vez de `Number()` cru; `toNum()` agora distingue separador de milhar vs. decimal (não transforma mais `"1.5"` em `15`).

### Importação de Custos — tratamento de campos ausentes (antes rejeitava, agora completa)

**Antes:** linha sem **data** ou sem **fornecedor** era rejeitada (ia para `errosLista` e não importava). A lista de erros era cortada em **50** itens.

**Agora**, conforme alinhado com o gestor:

1. **Sem data** → o sistema lê as datas das demais linhas e identifica o(s) `MM/YYYY` presentes no arquivo, atribuindo às linhas sem data o **último dia do mês**:
   - **1 mês/ano no arquivo** → aplicado automaticamente (e reportado no resultado: "Datas atribuídas → `DD/MM/YYYY`").
   - **2+ meses/anos** → o import **pergunta ao usuário** qual mês/ano seguir (uma escolha, aplicada a todas as linhas sem data).
   - **Nenhuma data válida no arquivo** → o usuário **digita** o mês/ano manualmente.
   - Implementação: a escolha é feita no front (etapa `CustosDateStep` via prop genérica `renderExtra` do `ImportModal`) e enviada como `fallbackMesAno`; o backend (`importarLote`) calcula o último dia e preenche.
2. **Sem nota** → grava **`"Sem Nota"`** e importa.
3. **Sem fornecedor** → grava **`"Sem Fornecedor"`** e importa, criando-o como **cadastro real** na aba `FORNECEDOR` (guarda-chuva para reclassificar depois). Defaults aplicados **após** o teste de linha totalmente vazia (linha vazia continua ignorada — não vira custo fantasma "Sem Fornecedor / Sem Nota").
4. **Registros idênticos com datas diferentes** (ou idênticos entre si) **sobem todos** — confirmação de comportamento já existente: a importação **não deduplica** custos, cada linha vira um registro com UUID próprio. (Continua valendo o aviso de 15/06: rodar o mesmo arquivo duas vezes duplica.)
5. **Relatório dos não importados** → `errosLista` agora volta **completa (sem corte de 50)** e é exibida na tela ("Ver não importados") com linha + identificação + motivo, para o usuário corrigir e reimportar.

**O que ainda é rejeitado** (após 1–3): item faltando, quantidade ausente/≤ 0, valor unitário ausente/< 0, item novo sem subcategoria, e subcategoria fora do mapa.

### Dash Custos — "Comparativo mês a mês" agora abre o detalhe do mês

**Antes:** o gráfico de barras "Comparativo mês a mês" era apenas visual — não dava para clicar/selecionar um mês e ver os números daquele mês.

**Agora** (em `DashCustos.jsx`, sem mudança de backend):
- **Dropdown "Ver detalhe do mês..."** no cabeçalho do card, listando os meses do período.
- **Barras clicáveis** sincronizadas com o dropdown: a barra do mês selecionado fica destacada (cheia + borda branca) e as demais esmaecem; clicar de novo (ou esvaziar o dropdown / botão "Fechar ✕") desfaz.
- **Painel de detalhe do mês** abaixo do gráfico, com: `MM/YYYY — Total · N lançamentos`, tabela **Por categoria** (valor + % do mês, com badge) e tabela **Itens (maiores)**.
- **Respeita o drill-down e o período ativos**: o detalhe usa a mesma base `filtrado` do gráfico (estado `selMes` + memo `mesDetalhe`). Ex.: com drill-down em CMV, os números do mês vêm só de CMV.
- De quebra, o **tooltip do gráfico** foi padronizado para o mesmo contraste claro dos demais (`#222732`), resolvendo a pendência anotada em 15/06 (fundo escuro `#181b22`).

> Pendência (opcional): replicar o mesmo detalhe-por-mês na evolução mensal do **Dash Folha**, que tem a mesma limitação.

---

## Atualizações — 21/06/2026

### Identidade visual — aplicação do brand Kampeki

O front foi re-skinado conforme o `KAM_BRAND_GUIDELINE_01.pdf` (extraído via PyMuPDF — paleta, tipografia e logos).

**Paleta (materiais digitais):**

| Cor | Hex | Uso no app |
|---|---|---|
| Coral | `#FF8B7C` | acento principal (botões, barras de Custos, logo) |
| Verde institucional | `#18322E` | base de cards / sidebar |
| Cinza claro | `#E6E6E6` | texto |
| Areia | `#D7C4B6` | avisos / badge despesa |
| Teal | `#4F868F` | acento 2 (Folha, seleção) |
| Oliva | `#BFCB7F` | positivo / queda |
| Vinho | `#623232` | botão excluir |
| Preto | `#000000` | — |

- Tema escuro construído sobre o verde institucional. Variáveis centralizadas no `:root` de `styles.css` (`--bg`, `--surface`, `--primary`, `--on-primary`, `--up`/`--down`, etc.). Texto de botão coral usa verde escuro (`--on-primary`).
- **Tipografia:** marca usa **Neue Haas Grotesk Display Pro** (comercial); o app prioriza essa família e cai para **Inter** (carregada via Google Fonts no `index.html`) como fallback livre. Títulos de página em CAIXA ALTA, como no guideline.
- **Logo:** wordmark **KAMPEKI** extraído como vetor limpo do PDF → componente `frontend/src/components/Logo.jsx` (SVG inline com `fill="currentColor"`, herda a cor do CSS). Usado na sidebar e no Login.
- **Favicon:** selo **KMPK** (coral sobre quadrado verde arredondado) em `frontend/public/favicon.svg`, referenciado no `index.html` (+ `theme-color`).
- Paletas de gráfico (`DashCustos`/`DashFolha`) e tooltips/eixos atualizados para as cores da marca. O tooltip do "Comparativo mês a mês" foi padronizado no mesmo processo.
- Assets canônicos: `frontend/public/kampeki-logo.svg`, `frontend/public/favicon.svg`, `frontend/src/components/Logo.jsx`.

### Correção de regra de `VALOR_TOTAL` editável e import com TOTAL (consolidação)

Já documentado na seção de 20/06; reforço aqui porque é a base do comportamento atual: total editável manualmente no formulário (botão "editar total") e import respeitando a coluna `TOTAL` quando preenchida (> 0), senão `UN × VALOR`, sempre `round(…, 2)`.

### Unificação Custos ↔ Folha (a folha é sempre lançada como Custo)

**Contexto / decisão de modelo:** **não existe lançamento de folha separado** — a folha é sempre lançada como **Custo** de categoria FOLHA (CANOAS/POA/TELE), com a `TAG`. Antes, as telas de Folha liam **apenas a aba `FOLHA`**, então os custos de folha (mesmo tageados) nunca apareciam no Dash Folha — o que parecia um bug de "tag sem efeito", mas era só o modelo separado.

**Sintoma que originou:** ao tagear custos de folha (edição em massa), a tag era gravada corretamente no custo, mas não refletia em nenhuma tela de Folha.

**Solução (unificação na leitura, no backend):** `folha.listar()` passou a retornar a **união** de duas fontes, cada linha marcada com `_origem`:
1. Lançamentos manuais da aba `FOLHA` → `_origem: 'folha'`.
2. **Custos de categoria FOLHA** mapeados para o formato folha (`TAG`, `ITEM_FOLHA = ITEM`, `VALOR = VALOR_TOTAL`, mês/ano, `CATEGORIA`) → `_origem: 'custo'`.

A detecção usa `exigeTag(CATEGORIA)` (categorias `FOLHA CANOAS/POA/TELE` do `switch-categoria.js`). Sem duplicar dados nem sincronizar: a folha continua vivendo nos custos; a Folha apenas **lê**.

**Efeito (todos consomem `folhaApi.listar()`):**
- **Dash Folha** e **Análise por Período — Folha** passam a contar os custos de folha (por Tag, por Item, evolução mensal, participação).
- **Página Folha (listagem)** mostra os custos de folha com coluna **Origem** (badge "Custo"/"Manual"); linhas de origem "Custo" ficam **somente-leitura** ("editar em Custos") para não tentar editar/excluir na aba errada.
- Custos de folha **sem tag** entram no Total, mas só aparecem em "por Tag" depois de tageados (incentivo a tagear).

> Observação: o cadastro manual de Folha ("+ Novo lançamento") continua existindo como válvula de ajuste (cria entradas `_origem: 'folha'`). Pode ser removido futuramente, já que a folha é sempre custo.

### Correção — valores zerados no front (reforço)

A leitura do Sheets em `sheets.getRows` usa `valueRenderOption: 'UNFORMATTED_VALUE'` + `dateTimeRenderOption: 'FORMATTED_STRING'`, e os parsers do front (`format.brl`/`toNum`) foram blindados — corrigindo células que apareciam zeradas por formatação pt-BR. (Detalhe completo na seção de 20/06.)

### Layout responsivo

O front passou a se adaptar a diferentes proporções de tela (era desktop-fixo):
- **Sidebar vira um drawer deslizante** em telas ≤ 820px: surge uma **barra de topo** (`.topbar`) com o logo + botão **☰**; o menu abre por cima com backdrop e fecha ao navegar ou clicar fora (estado `menuOpen` no `Layout.jsx`).
- **Grades degradam em etapas** (em vez de um corte único): `grid-4` → 2 colunas em ≤1100px; `grid-3` → 2 em ≤960px; tudo → 1 coluna em ≤680px.
- **Toolbars, filtros e abas** quebram em linha (`flex-wrap`); em ≤520px os campos de filtro perdem a largura fixa e fluem; paddings/cards reduzidos. Tabelas largas rolam horizontalmente (`.table-wrap`).

### Filtro de mês global nos dashboards (Custos e Folha)

No **Comparativo mês a mês** (Dash Custos) e na **Evolução mensal** (Dash Folha), além do dropdown, **clicar numa barra de mês filtra TODO o dashboard** — não só o gráfico:
- **Dash Custos:** o mês recorta Total, Lançamentos, pizza por Categoria, Total por Subcategoria e Top N itens. A variação "vs anterior" passa a comparar com o **mês anterior**.
- **Dash Folha:** o mês recorta Total, Lançamentos, Participação/Subtotal por Tag, Subtotal por Item e o Cruzamento Tag × Item.
- Em ambos, o **gráfico mensal continua mostrando todos os meses** (respeitando os demais drill-downs/filtros), com a barra ativa destacada; há **chip removível** do mês e os KPIs trocam para "Total no mês"/"Mês". Se o mês sai do período (ao mudar o filtro de período), o recorte se limpa sozinho. Implementação 100% frontend (estado `selMes`), sem mudança de backend.

> O painel de detalhe inline do mês (versão anterior) foi removido do Dash Custos, pois agora o dashboard inteiro reflete o mês selecionado.

### Análise por Período — gráficos + seletores A/B uniformes

- Cada comparação (Categoria/Subcategoria/Item nos Custos; Tag/Item Folha na Folha) ganhou um **gráfico de barras horizontais agrupadas Período A × Período B** (top 8 por Período B), com a **tabela detalhada** (todas as chaves + Δ absoluto/percentual) logo abaixo — antes eram só tabelas. Período A = teal (`#4f868f`), Período B = coral (`#ff8b7c`).
- **Correção visual:** os seletores **De/Até** dos cartões Período A e Período B ficavam com larguras diferentes (o botão "Limpar" condicional empurrava os campos). Padronizado via `.periodo-card .field { flex: 0 1 170px; }` — agora A e B ficam idênticos.

---

## Changelog técnico consolidado — sessão 20–21/06/2026 (por arquivo)

Detalhamento arquivo a arquivo de tudo o que foi alterado nesta sessão, para referência rápida.

### Backend

| Arquivo | O que mudou |
|---|---|
| `src/services/sheets.js` | `getRows` agora lê com `valueRenderOption: 'UNFORMATTED_VALUE'` + `dateTimeRenderOption: 'FORMATTED_STRING'` (números voltam como número; datas seguem string `DD/MM/YYYY`). Corrige os valores zerados no front. Vale para todas as abas. |
| `src/services/custos.js` | Novo helper `resolverTotal(qtd, valorUnit, totalInformado)` (total informado > 0 prevalece; senão `UN × VALOR`; sempre `round(…,2)`). `montarLinha` aceita `VALOR_TOTAL` do payload. `importarLote(rows, { fallbackMesAno })`: aplica último dia do mês às linhas sem data; default `"Sem Nota"`/`"Sem Fornecedor"` (após o teste de linha vazia); `errosLista` completa (sem corte de 50); conta `datasAtribuidas`/`dataFallback`. Docstring atualizada. |
| `src/utils/date.js` | Novo `ultimoDiaDoMes("MM/YYYY") → "DD/MM/YYYY"` (trata bissexto). |
| `src/routes/custos.js` | `POST /custos/import` repassa `fallbackMesAno` do body ao serviço. |
| `src/services/folha.js` | `listar()` retorna a **união** da aba `FOLHA` (`_origem:'folha'`) com os **custos de categoria FOLHA** mapeados para o formato folha (`_origem:'custo'`, via novo `custoParaFolha`). Importa `exigeTag` de `switch-categoria.js`. |

### Frontend

| Arquivo | O que mudou |
|---|---|
| `src/utils/format.js` | `brl()`/`pct()` passaram a usar `toNum()` (antes `Number()` cru). `toNum()` reescrito para distinguir separador de milhar × decimal (não quebra mais `"1.5"`). |
| `src/utils/importParse.js` | `parseCustos` extrai a coluna `TOTAL` → `VALOR_TOTAL` e adiciona "Total (arq.)" na prévia. |
| `src/api/resources.js` | `custosApi.importar(rows, extra = {})` → envia `{ rows, ...extra }` (ex.: `fallbackMesAno`). |
| `src/components/ImportModal.jsx` | Nova prop `renderExtra({ parsed, extra, setExtra, setExtraValid })` (etapa extra entre prévia e botão); passa `extra` ao `onImport(rows, extra)`; bloqueia o botão se a etapa for inválida; `mesclar` sem corte de 50. |
| `src/components/ImportResult.jsx` | Mostra "Datas atribuídas → DD/MM/YYYY" e a lista completa de não importados ("Ver não importados"). |
| `src/pages/Custos.jsx` | Campo **Valor total** editável com botão "✏ editar total" / "↺ recalcular" (estado `totalManual`); payload envia `VALOR_TOTAL` só quando manual; reabre em modo manual se o gravado divergir. Componente `CustosDateStep` (resolve linhas sem data: 1 mês → auto; 2+ → escolher; 0 → manual). `renderExtra`/`onImport(extra)` no `ImportModal`; hint e modelo `.xlsx` incluem `TOTAL`. |
| `src/pages/dash/DashCustos.jsx` | Paleta de gráfico da marca; barra coral; tooltip/eixos no verde. Mês selecionado (`selMes`) virou **filtro global** (pizza, subcategorias, total, lançamentos, Top N); o gráfico mensal mostra todos os meses (barra ativa destacada); variação "vs anterior" usa o mês anterior quando há mês; chip removível; auto-limpa fora do período. Painel de detalhe inline removido. |
| `src/pages/dash/DashFolha.jsx` | Paleta de gráfico da marca; barra teal; tooltip/eixos no verde. Mesmo **filtro global de mês** (`selMes`) afetando por Tag/Item, cruzamento, totais; gráfico mensal com dropdown + barras clicáveis + chip. |
| `src/pages/dash/DashPeriodo.jsx` | Reescrito: cada comparação (Categoria/Subcategoria/Item; Tag/Item Folha) tem **gráfico de barras horizontais A × B (top 8)** + tabela detalhada (`ComparativoSecao`), KPIs `TotaisAB`, e seletores A/B padronizados (`periodo-card`). |
| `src/pages/Folha.jsx` | Coluna **Origem** (badge "Custo"/"Manual"); linhas de origem "Custo" ficam somente-leitura ("editar em Custos"). |
| `src/components/Layout.jsx` | Barra de topo (`.topbar`) + sidebar como **drawer** mobile (estado `menuOpen`, backdrop, fecha ao navegar); usa `<Logo>`. |
| `src/pages/Login.jsx` | Usa `<Logo>` no lugar do texto. |
| `src/components/Logo.jsx` | **Novo** — wordmark KAMPEKI em SVG inline (`currentColor`). |
| `src/styles.css` | `:root` reescrito com a paleta da marca (tema escuro sobre verde); botões/badges/up-down/erro; fonte Inter + títulos em caixa alta; bloco **responsivo** (drawer ≤820px, grades graduais, toolbars/abas que quebram, ajustes ≤520px); `.periodo-card` (seletores A/B iguais). |
| `index.html` | Favicon SVG, `theme-color`, Google Fonts (Inter). |

### Assets gerados (extraídos do `KAM_BRAND_GUIDELINE_01.pdf` via PyMuPDF)

- `frontend/public/kampeki-logo.svg` — wordmark (verde institucional).
- `frontend/public/favicon.svg` — selo KMPK coral sobre quadrado verde arredondado.
- `frontend/src/components/Logo.jsx` — wordmark recolorível.

### Validação

- Backend: `node --check` nos arquivos alterados (OK).
- Frontend: `vite build` a cada etapa (OK — 856 módulos; único aviso é o de tamanho de chunk, pré-existente).
- Execução real do app **não** foi possível nesta sessão por falta do `.env` (credenciais da Service Account). Os roteiros de verificação manual estão descritos em cada subseção acima.

### Pendências em aberto

- Remover (opcional) o cadastro manual de Folha ("+ Novo lançamento"), já que a folha é sempre lançada como Custo.
- Replicar o detalhe-por-mês na evolução do Dash Folha (hoje o filtro global de mês já cobre boa parte disso).
- Adicionar os arquivos da fonte **Neue Haas Grotesk Display Pro** via `@font-face` quando houver licença (o stack já a prioriza antes do Inter).

---

## Atualizações — 21/06/2026 (parte 2)

### Importação de Custos via .ZIP de NF-e (módulo novo)

O gestor baixa do portal um `.zip` com várias NF-e (XML, modelo 55). Novo fluxo na página **Custos** (botão **"Importar NF-e (.zip)"**) que descompacta no navegador, interpreta cada XML e gera lançamentos de Custo — **um por item (`<det>`) da nota**. Validado contra um lote real de **374 notas / 996 itens** (todas com emitente, data e número presentes).

**Mapeamento NF-e → Custo** (cada `<det>` vira uma linha):

| Campo Custo | Origem no XML |
|---|---|
| `DATA_NOTA` | `ide/dhEmi` → `DD/MM/YYYY` |
| `NUM_NOTA` | `ide/nNF` |
| `FORNECEDOR` | `emit/xNome` (casado/criado por **nome**) |
| `ITEM` | `det/prod/xProd` |
| `QTD` | `det/prod/qCom` |
| `VALOR_UNIT` | `det/prod/vUnCom` → `round(…, 2)` |
| `VALOR_TOTAL` | `det/prod/vProd` → `round(…, 2)` (respeita total informado > 0) |
| `CHAVE_NFE` | `infNFe/@Id` (44 díg.) — nova coluna, usada só pela dedup |

Unidade (`uCom`) é **ignorada**.

**Decisões de modelagem (alinhadas ponto a ponto):**

1. **Onde processa:** o `.zip` é descompactado e os XMLs lidos **no frontend** (JSZip + DOMParser nativo); as notas normalizadas vão em JSON para o backend, que aplica toda a inteligência. Mantém o padrão do import de planilha.
2. **Dedup por nota (chave de acesso):** `CUSTOS` ganhou a coluna **`CHAVE_NFE`** (no fim). Se a chave já existe em `CUSTOS`, a **nota inteira é pulada** (re-rodar o mesmo `.zip` não duplica). Diferente de comparar "todos os campos iguais", isso **preserva itens repetidos legítimos** dentro de uma mesma nota (havia notas com linhas idênticas que a regra de campos-iguais apagaria). A coluna é **opcional**: o formulário manual e o import de planilha **não a exibem nem gravam** (fica vazia) — só o import de NF-e a preenche.
3. **Itens sem classificação entram mesmo assim:** se o item não existe (ou existe sem subcategoria/categoria), o custo **é importado** com `SUB_CATEGORIA`/`CATEGORIA` em branco e o item fica cadastrado em `ITENS` no estado **"a classificar"**. Nunca rejeita por falta de classificação. `VALOR_UNIT`/`VALOR_TOTAL` sempre com 2 casas.

**Classificação dos itens "incorretos" (UX na própria tela de Custos):**
- Quando há itens sem categoria/subcategoria, aparece na toolbar de Custos um **ícone de alerta "⚠ N item(ns) a classificar"** (some quando zera).
- Clicar abre o **`ClassificarItensModal`**: lista os pendentes, com `select` de **subcategoria** (categoria derivada exibida ao lado) e opção **"➕ Nova subcategoria"** (nome + categoria fixa).
- Ao classificar um item, o backend grava a classificação em `ITENS` e faz **back-fill** de `SUB_CATEGORIA`/`CATEGORIA` em **todos os custos daquele item** que estavam em branco.

**Subcategorias em runtime — nova aba `SUBCATEGORIA`:**
- O mapa fixo `categoriaMap` (código) passou a ser **estendido** por uma aba `SUBCATEGORIA (UUID | SUB_CATEGORIA | CATEGORIA)`. `categoriaDe()` consulta o mapa fixo **+** o mapa dinâmico (carregado no boot e recarregado ao criar subcategoria), continuando síncrono.
- Subcategoria nova aponta para uma das **categorias fixas** (CMV, FOLHA CANOAS/POA/TELE, DESPESA ADMINISTRATIVA, DISTRIBUIÇÃO DE LUCRO, IMPOSTOS).

### Changelog técnico — sessão 21/06/2026 (parte 2)

**Backend**

| Arquivo | O que mudou |
|---|---|
| `src/services/sheets.js` | `CUSTOS` ganhou `CHAVE_NFE` (16ª coluna); nova aba `SUBCATEGORIA`. `initSheets` agora **sincroniza o cabeçalho (linha 1) de todas as abas** com `TABS` — assim colunas/abas novas ganham rótulo numa planilha já existente, sem tocar nos dados. |
| `src/utils/switch-categoria.js` | `categoriaDe()` consulta mapa fixo **+** `dynamicMap`. Novos: `categoriasFixas`, `setSubcategoriasDinamicas()`, `listarSubcategorias()`. |
| `src/services/subcategoria.js` | **Novo** — `carregar()` (alimenta o mapa dinâmico no boot), `listar()`, `categorias()`, `criar({SUB_CATEGORIA,CATEGORIA})` (valida e grava na aba). |
| `src/services/custos.js` | Novos `importarLoteXml(notas)` (dedup por chave, cria fornecedor/item, importa item "a classificar", 2 casas), `itensAClassificar()`, `classificarItem({ITEM_UUID,SUB_CATEGORIA})` (atualiza item + back-fill nos custos). |
| `src/routes/custos.js` | `POST /custos/import-xml`, `GET /custos/itens-a-classificar`, `POST /custos/classificar`. |
| `src/routes/itens.js` | `GET /itens/subcategorias` agora retorna fixas + dinâmicas; novos `GET /itens/categorias` e `POST /itens/subcategorias`. |
| `src/app.js` | Chama `carregarSubcategorias()` após `initSheets()` no boot. |

**Frontend**

| Arquivo | O que mudou |
|---|---|
| `src/api/resources.js` | `custosApi.importarXml/itensAClassificar/classificar`; `itensApi.categorias/criarSubcategoria`. |
| `src/utils/importParse.js` | Novo `parseNfeXml(xml)` (DOMParser → nota normalizada com itens). |
| `src/components/ImportModalXml.jsx` | **Novo** — aceita `.zip`, descompacta com JSZip, lê XMLs, prévia + resultado. |
| `src/components/ClassificarItensModal.jsx` | **Novo** — classifica itens pendentes; cria subcategoria nova. |
| `src/components/ImportResult.jsx` | Suporta o resumo do import de NF-e (notas puladas, itens a classificar) e erros sem `linha` (com `nota`). |
| `src/pages/Custos.jsx` | Botão "Importar NF-e (.zip)", ícone ⚠ "a classificar" (contador), e os dois modais; `carregar()` busca os pendentes. |
| `package.json` (frontend) | Dep nova: **`jszip`**. |

### Validação
- Backend: `node --check` OK em todos os arquivos alterados.
- Frontend: `vite build` OK (861 módulos; único aviso é o de tamanho de chunk, pré-existente).
- Extração dos XMLs validada com script sobre o `.zip` real (374 notas / 996 itens; 0 sem emitente/data/número). Execução real do app **não** foi possível por falta do `.env` (credenciais da Service Account), como nas sessões anteriores.

### Pendências em aberto (módulo NF-e)
- A importação não casa item por NCM/cEAN — só por descrição (`xProd`). Itens com descrições diferentes para o mesmo produto geram cadastros distintos a classificar.
- A coluna `CHAVE_NFE` não é exibida na listagem/edição de Custos (proposital); se um dia quiser auditar a nota de origem, ela está gravada.

---

## Atualizações — 30/06/2026

> Sessão focada em três frentes: **exclusão em massa de Custos**, **melhorias na classificação de itens** e **centralização da gestão de itens/subcategorias na página Itens**. Inclui uma correção de modelo (itens "órfãos" persistindo na fila de classificação).

### Custos — exclusão em massa de lançamentos

Na listagem de Custos, a barra de seleção (que já tinha "Editar em massa") ganhou **"Excluir selecionados"** (botão vermelho), com `ConfirmDialog` informando a quantidade e avisando que é irreversível.

- **Backend:** `POST /custos/bulk-delete` `{ uuids }` → `custos.removerEmMassa`, que apaga todos os UUIDs **numa única chamada** à API. A primitiva `sheets.deleteRowsByUuid(tab, uuids)` lê os registros uma vez, **agrupa as linhas em intervalos contíguos** e aplica os `deleteDimension` **de baixo para cima** (índices maiores primeiro), para que cada exclusão não invalide os índices das próximas. Não apaga linha a linha (isso quebraria a reindexação da planilha).

### Correção — itens "a classificar" persistindo após excluir custos (órfãos)

**Sintoma:** após excluir custos em massa de itens que estavam na fila "a classificar", os itens **continuavam aparecendo** no contador/modal de classificação.

**Causa:** a fila "a classificar" é derivada da aba `ITENS` (itens sem subcategoria/categoria), **não** dos custos. Excluir os custos não removia o item de `ITENS` — ele virava um **órfão** (item sem nenhum custo) e seguia na fila.

**Agora:**
- **`custos.itensAClassificar`** passou a retornar também a **contagem de custos pendentes por item** (`custos`) e a **filtrar apenas itens com ≥1 custo pendente** — itens sem custo não têm o que classificar e somem da fila imediatamente.
- **Excluir custo (individual e em massa)** chama `limparItensOrfaos()`, que remove de `ITENS` os itens **sem classificação que ficaram sem nenhum custo**. Itens **já classificados nunca são tocados** (curados pelo usuário). A exclusão em massa retorna também `itensRemovidos`.

### Tela de classificar itens (`ClassificarItensModal`) — melhorada

Antes era uma lista crua, item a item. Agora:
- **Busca por descrição** no topo, com contador `X de Y`.
- **Coluna "Custos"** mostrando quantos lançamentos pendentes cada item tem (ajuda a priorizar).
- **Seleção em massa:** checkbox por linha + "marcar todos os visíveis". Com itens marcados, surge uma barra para escolher **uma subcategoria e aplicá-la a todos de uma vez** (caso típico: vários itens da mesma subcategoria), com retorno de quantos itens/custos foram atualizados.
- **Classificação individual** (select + botão por linha) continua disponível.
- Backend: `POST /custos/classificar-lote` `{ ITEM_UUIDS, SUB_CATEGORIA }` → `custos.classificarItensEmLote`, que aplica a mesma subcategoria a vários itens e faz o **back-fill** nos custos sem classificação de todos eles, reusando `updateColumnForUuids` (uma chamada por coluna; lê ITENS/CUSTOS uma vez só).

### Modais largos (`modal-lg`)

O `Modal` ganhou prop opcional `className`. Nova variante **`.modal-lg`** (`max-width: 960px`) para telas com tabela. Além disso, **todo** `.modal` agora tem `max-height: 90vh; overflow-y: auto` — modais altos rolam dentro da viewport em vez de estourar. Aplicado ao `ClassificarItensModal` e ao novo `SubcategoriasModal` (resolve a reclamação de barras de rolagem apertadas: sem rolagem horizontal e a tabela usa `55vh`).

### Itens — central de classificação e gestão de subcategorias

A página **Itens** virou o lugar central para corrigir classificação e gerir subcategorias (antes isso só existia "escondido" dentro do fluxo de Custos). Dois novos botões na toolbar:

1. **"⚠ N item(ns) a classificar"** (aparece só quando há pendências) → abre o **mesmo `ClassificarItensModal`** (reaproveitado), com back-fill nos custos.
2. **"Subcategorias"** → abre o novo **`SubcategoriasModal`** (gestão completa):
   - **Lista** todas as subcategorias com **categoria**, **tipo** (Fixa do sistema / Personalizada) e **uso** (quantos itens e custos usam cada uma), com busca.
   - **Criar** subcategoria nova (nome + categoria fixa) no topo do modal.
   - **Excluir** as **personalizadas** — o botão fica desabilitado quando há uso, e o backend **bloqueia** a exclusão de subcategoria **em uso** (`em uso: N itens, M custos — reclassifique antes`) ou **fixa**. Garante que não fiquem itens/custos órfãos.

> Regra de negócio preservada: continua **só sendo possível criar subcategorias** (apontando para uma das categorias fixas — CMV, FOLHA CANOAS/POA/TELE, DESPESA ADMINISTRATIVA, DISTRIBUIÇÃO DE LUCRO, IMPOSTOS); **categorias não são criáveis**.

### Changelog técnico — sessão 30/06/2026 (por arquivo)

**Backend**

| Arquivo | O que mudou |
|---|---|
| `src/services/sheets.js` | Novo `deleteRowsByUuid(tab, uuids)` — exclusão em massa em uma chamada (agrupa linhas contíguas em intervalos e aplica `deleteDimension` de baixo para cima). |
| `src/services/custos.js` | Novos `removerEmMassa({ uuids })`, `classificarItensEmLote({ ITEM_UUIDS, SUB_CATEGORIA })` e `limparItensOrfaos()` (chamado em `remover` e `removerEmMassa`). `itensAClassificar` agora inclui a contagem `custos` e filtra itens com ≥1 custo pendente. |
| `src/services/subcategoria.js` | Novos `listarGestao()` (lista combinada + flag `fixa` + uso em itens/custos) e `remover({ SUB_CATEGORIA })` (trava em fixas e em subcategorias em uso). |
| `src/routes/custos.js` | Novas rotas `POST /custos/bulk-delete` e `POST /custos/classificar-lote`. |
| `src/routes/itens.js` | Novas rotas `GET /itens/subcategorias-gestao` e `POST /itens/subcategorias/remover`. |

**Frontend**

| Arquivo | O que mudou |
|---|---|
| `src/api/resources.js` | `custosApi`: `removerEmMassa`, `classificarLote`. `itensApi`: `subcategoriasGestao`, `removerSubcategoria`. |
| `src/components/Modal.jsx` | Aceita prop `className` (variar tamanho). |
| `src/components/ClassificarItensModal.jsx` | Reescrito: busca, coluna de custos, seleção + classificação em massa, `modal-lg`, tabela `55vh`. |
| `src/components/SubcategoriasModal.jsx` | **Novo** — gestão de subcategorias (lista fixa/personalizada + uso, criar, excluir personalizada com trava de uso). |
| `src/pages/Custos.jsx` | Botão "Excluir selecionados" + `ConfirmDialog` + handler `excluirEmMassa`. |
| `src/pages/Itens.jsx` | Carrega a contagem de pendentes; botões "Subcategorias" e "⚠ N a classificar"; renderiza `ClassificarItensModal` e `SubcategoriasModal`. |
| `src/styles.css` | `.modal` ganhou `max-height: 90vh; overflow-y: auto`; nova variante `.modal.modal-lg { max-width: 960px; }`. |

### Validação

- Backend: `node --check` OK em todos os arquivos alterados.
- Frontend: `vite build` OK (861 módulos; único aviso é o de tamanho de chunk, pré-existente).
- **Execução real contra a planilha** (diferente das sessões anteriores, que não tinham `.env`): rodado um roteiro E2E com **dados descartáveis** contra a base real — **19/20 verificações OK** (a 1 restante foi falha de asserção do próprio script — checava status HTTP 200 numa resposta que corretamente retorna erro; a trava de "subcategoria em uso" funcionou). Cobertura: criar/gerir/excluir subcategoria, trava de uso (em uso e fixa), import NF-e fake → classificação em massa com back-fill, exclusão em massa, limpeza de órfão, e preservação de itens já classificados. Baseline 100% restaurado ao final (2695 itens / 27 pendentes).

### Pendências em aberto
- O cadastro manual de Folha ("+ Novo lançamento") continua existindo (folha é sempre custo) — remoção opcional, já anotada em sessões anteriores.
- Itens órfãos pré-existentes (sem classe e sem custo, criados antes desta correção) só são limpos quando ocorre a próxima exclusão de custo; o filtro de `itensAClassificar` já os esconde da fila enquanto isso.

---

## Atualizações — 30/06/2026 (parte 2)

> Ajustes de usabilidade: drill-down por Tag no Dash Folha, mais largura/visibilidade na listagem de Custos e campo de subcategoria pesquisável por digitação. Tudo no frontend, sem mudança de backend.

### Dash Folha — drill-down por Tag na pizza (dropdown + clique)

Antes, no Dash Folha, só a **"Evolução mensal"** tinha dropdown (e clique para filtro global de mês). Agora a pizza **"Participação por Tag"** também é interativa, espelhando a pizza de categorias do Dash Custos:

- **Dropdown "Filtrar por tag..."** no cabeçalho do card + **clique na fatia/legenda** selecionam uma tag (`selTag`).
- A tag selecionada **destaca a fatia** (borda branca; demais esmaecidas) e **recorta** os KPIs (Total no período/mês, Lançamentos), o **Subtotal por Item** e o **Cruzamento Tag × Item**.
- A **pizza e a tabela "Subtotal por Tag" continuam sobre todas as tags** (base `baseMes`), com o **%** relativo ao total de todas as tags (`totalBaseMes`) — permite trocar de tag a qualquer momento. A tabela "Subtotal por Tag" ficou **clicável** (linha destacada quando selecionada).
- **Chip removível** "Tag: … ✕" na barra de filtros ativos (junto do chip de mês). O drill se **auto-limpa** se a tag sair da base (mudança de período/mês/filtro).
- Camadas derivadas: `base → baseMes (mês) → baseTag (tag)`. Implementação 100% frontend (`DashFolha.jsx`, estado `selTag`).

### Custos — mais largura e botão "Excluir" sempre visível

- A área de conteúdo (`.main`) passou de **`max-width: 1400px` → `1760px`**, aproveitando melhor telas largas (vale para todas as páginas).
- A **coluna de ações da tabela de Custos ficou fixada à direita** (`position: sticky; right: 0`): mesmo com rolagem horizontal em telas menores, **Editar/Excluir nunca somem**. Nova classe `.sticky-actions` (com sombra de profundidade e fundo acompanhando hover/seleção), aplicada à `<table>` da listagem de Custos.

### Classificar itens — subcategoria pesquisável por digitação

Na tela de classificar itens (`ClassificarItensModal`), os `<select>` de subcategoria (na **classificação individual por linha** e na **classificação em massa**) viraram um combo **`input` + `datalist`**: dá para **escolher na lista ou digitar para filtrar** rápido.

- Resolução **case-insensitive** para o valor canônico (`resolveSub`): o texto digitado é casado contra a lista; o botão "Classificar" só habilita quando casa com uma subcategoria válida (evita gravar subcategoria inexistente). A categoria derivada é exibida ao lado, como antes.
- Um único `<datalist id="subcats-classif-dl">` compartilhado por todos os campos.

### Changelog técnico — 30/06/2026 (parte 2)

| Arquivo | O que mudou |
|---|---|
| `src/pages/dash/DashFolha.jsx` | Estado `selTag` + `toggleTag`; `baseTag` (drill de tag) alimenta KPIs/Item/Cruzamento; pizza "Participação por Tag" com dropdown + clique + destaque; tabela "Subtotal por Tag" clicável; chip de tag; `%` da tag sobre `totalBaseMes`; auto-limpa o drill fora da base. |
| `src/components/ClassificarItensModal.jsx` | `<select>` de subcategoria (linha e massa) → `input` + `datalist` (`subcats-classif-dl`); `subByName` case-insensitive + helper `resolveSub`; botões habilitam só com subcategoria válida. |
| `src/pages/Custos.jsx` | `<table>` da listagem com classe `sticky-actions`. |
| `src/styles.css` | `.main` `max-width` 1400 → 1760; nova classe `.sticky-actions` (coluna de ações fixa à direita, com hover/seleção). |

### Validação
- Frontend: `vite build` OK (861 módulos; único aviso é o de tamanho de chunk, pré-existente). Sem mudança de backend.

---

## Atualizações — 30/06/2026 (parte 3)

> Reforma do formulário de lançamento de Custo (cascata pesquisável + criação de item inline), filtro por item na listagem, e a evolução do modelo de **TAG no item de folha** (herança automática nos custos). Também: subtotal e listagem completa de tags no cruzamento do Dash Folha.

### Lançamento de Custo — cascata Categoria → Subcategoria → Item (pesquisável)

O `<select>` único de item (com ~2.700 itens) foi substituído por uma **cascata pesquisável por digitação** (combos `input` + `datalist`, resolução case-insensitive):

- **Categoria → Subcategoria → Item**, cada um filtrando o próximo. A subcategoria fica restrita à categoria; escolher a subcategoria também confirma/preenche a categoria.
- **Busca por item** funciona sempre, respeitando o filtro mais específico já escolhido: **subcategoria → categoria → todos**. Uma linha de ajuda mostra o escopo e a contagem. Ao **selecionar um item**, ele **preenche automaticamente** categoria/subcategoria (e a Tag, se o item tiver — ver abaixo).
- **Criação de item inline:** quando o texto digitado não casa com nenhum item da subcategoria, aparece **"➕ Criar item 'XYZ' em [SUBCATEGORIA]"**, que cria o item na hora (categoria derivada) e o seleciona — sem sair do formulário.
- **Fornecedor** também virou combo pesquisável. O "exige Tag" (folha) passou a derivar da **categoria escolhida**.

### Custos — filtro por item na listagem

A toolbar de filtros da listagem de Custos ganhou o campo **"Item"** (busca por trecho, case-insensitive), combinável com Mês/Ano, Categoria, Fornecedor e Nº Nota.

### TAG no item de folha (nova coluna em ITENS) + herança automática

Evolução do modelo: além de a TAG ser atributo do **lançamento**, agora o **item de folha** (FOLHA CANOAS/POA/TELE) pode ter uma **TAG própria** (opcional). A aba `ITENS` ganhou a coluna **`TAG`** (o `initSheets` sincroniza o cabeçalho na planilha existente).

**Regra central: o custo sempre respeita a TAG do item.**
- **Custo novo (form):** ao selecionar um item com tag, o custo **herda a tag** do item (o form auto-preenche; o backend também usa `item.TAG` como fallback quando o payload não traz tag).
- **Importação (planilha e NF-e):** o custo **herda `item.TAG`** quando o item já tem tag.
- **Ao salvar o item (criar/editar) com tag:** a tag é **aplicada automaticamente a todos os custos daquele item** (sobrescreve onde estiver diferente/vazia) — escopo barato (1 leitura + 1 escrita de CUSTOS). O modal informa quantos custos foram atualizados. **Trocar a tag do item** re-sincroniza os custos. (Não limpa custos ao **remover** a tag do item, para não deixar folha sem tag.)
- **Botão "↻ Reprocessar tags (geral)"** na página Itens: sincroniza **todos** os itens com tag de uma vez — caminho **mais pesado**, deixado como sincronização pontual (ex.: após carga histórica). No dia a dia não é necessário, pois salvar o item já resolve.
- Itens **não-folha ignoram** qualquer tag (fica vazia). Na página Itens: campo Tag só aparece para itens de folha; nova **coluna Tag** na tabela.

> Decisão de UX: em vez de um "flag de reprocessar" manual, o reprocessamento por item é **automático ao salvar** (o custo sempre segue o item), o que é bem mais barato que o reprocessar global.

### Dash Folha — Cruzamento Tag × Categoria

- A coluna do último relatório passou de **Item** para **Categoria** (FOLHA CANOAS/POA/TELE; lançamentos sem categoria caem em "(sem categoria)").
- **Linha de Subtotal** no rodapé: soma de cada coluna (categoria) e, no cruzamento com "Total", o **total geral**.
- **Todas as tags cadastradas sempre aparecem** como linhas (mesmo sem lançamento), com **R$ 0,00** nas células sem valor (antes mostrava "—" e omitia tags sem dados).

### Changelog técnico — 30/06/2026 (parte 3)

**Backend**

| Arquivo | O que mudou |
|---|---|
| `src/services/sheets.js` | `TABS.ITENS` ganhou a coluna `TAG` (5ª). |
| `src/services/itens.js` | `listar` inclui `TAG`; `resolverTagItem` (tag só p/ folha, opcional, validada); `criar`/`atualizar` gravam/validam TAG e chamam `aplicarTagAosCustosDoItem` (auto-aplica a tag aos custos do item, retorna `custosAtualizados`); novo `reprocessarTagsNosCustos` (sincronização geral). |
| `src/services/custos.js` | `montarLinha` usa `item.TAG` como fallback da tag; `importarLote` e `importarLoteXml` herdam `item.TAG` no custo. |
| `src/routes/itens.js` | Nova rota `POST /itens/reprocessar-tags`. |

**Frontend**

| Arquivo | O que mudou |
|---|---|
| `src/pages/Custos.jsx` | Formulário em cascata Categoria→Subcategoria→Item (combos `datalist`), busca de item por escopo, criação de item inline, fornecedor pesquisável, tag herdada do item; filtro "Item" na listagem. |
| `src/pages/Itens.jsx` | Campo Tag (folha) no form + coluna Tag; auto-aplica ao salvar (mensagem de custos atualizados); botão "↻ Reprocessar tags (geral)"; carrega `tags`. |
| `src/pages/dash/DashFolha.jsx` | Cruzamento Tag × Categoria: rodapé de Subtotal + Total geral; lista **todas** as tags cadastradas com R$ 0,00 nas vazias. |
| `src/api/resources.js` | `itensApi.reprocessarTags`. |

### Validação
- Backend: `node --check` OK. Frontend: `vite build` OK.
- **E2E contra a planilha real** (dados descartáveis, baseline restaurado):
  - Bloco TAG/reprocessar (11/11): item folha com tag, listagem com TAG, item não-folha ignora tag, custo herda tag do item, import de folha em branco + reprocessar aplica a tag.
  - Bloco auto-aplicar (11/11): salvar item com tag aplica aos custos **sem** reprocessar global; import herda tag de item já tagueado; trocar a tag do item atualiza os custos.

---

## Nova Feature — Importação de Custo via NFS-e (PDF) — 30/06/2026

> Implementa o `FEATURE_IMPORT_NFSE_PDF.md`. **Terceiro caminho** de lançamento de Custo (além do form manual e do import de NF-e XML `.zip`): importação de **NFS-e de serviço** (DANFSe v1.0, PDF com texto selecionável) → **1 nota = 1 item = 1 custo, sempre `QTD = 1`**. Um PDF por vez.

### Fluxo
Página **Custos** → botão **"Importar NFS-e (PDF)"** → seleciona 1 PDF → o frontend extrai os campos (pdfjs-dist, sem OCR) e abre uma **tela de conferência editável** (Data/Competência, Nº Nota, Fornecedor, Item, Valor com Qtd=1) indicando se Fornecedor/Item são **novos ou existentes** → confirma → grava o Custo. Se a `CHAVE_NFE` já existir, mostra aviso e **bloqueia** (dedup).

### Mapeamento (PDF → CUSTOS), validado nos 2 exemplos (Canoas e Porto Alegre)
| PDF (DANFSe) | CUSTOS | Regra |
|---|---|---|
| Competência da NFS-e | `DATA_NOTA` | `DD/MM/YYYY`; deriva MES_ANO/MES_NUM/ANO/DIA_MES_ANO. |
| Número da NFS-e | `NUM_NOTA` | direto. |
| Nome/Nome Empresarial (bloco **EMITENTE**) | `FORNECEDOR` | 1ª ocorrência após "EMITENTE DA NFS-e" (a 2ª é o TOMADOR = Kampeki). Remove CPF/CNPJ colado no fim (`/\s*\d{9,}\s*$/`). Casa/cria por nome. |
| Código de Tributação Nacional | `ITEM` | junta as linhas até "Código de Tributação Municipal" e remove o prefixo `NN.NN.NN - ` (`/^\d{2}\.\d{2}\.\d{2}\s*-\s*/`). Descrição longa pode vir truncada com `...` na própria origem. |
| Valor Líquido da NFS-e | `VALOR_UNIT` = `VALOR_TOTAL` | mesmo valor (2 casas); `QTD = 1`. |
| Chave de Acesso da NFS-e | `CHAVE_NFE` | reaproveita a coluna do import de NF-e XML como chave de dedup (NFS-e tem 50 díg.; coluna é texto livre). |

`SUB_CATEGORIA`/`CATEGORIA`/`TAG` seguem a regra já existente: item novo entra **"a classificar"** (aparece no `ClassificarItensModal`/contador ⚠); item existente herda a classificação e a **TAG** do sistema.

### Arquitetura (extração no front, negócio no back — mesmo padrão do NF-e XML)

**Frontend**
| Arquivo | O que mudou |
|---|---|
| `package.json` | Nova dependência **`pdfjs-dist`** (^4). |
| `src/utils/parseNfsePdf.js` | **Novo** — extrai o texto do PDF (`pdfjs-dist`, worker via `?url`) e localiza cada campo por âncora de rótulo; aplica as limpezas de ITEM/FORNECEDOR; retorna `{ chaveNfse, numNota, dataNota, fornecedor, item, valor, avisos[] }`. |
| `src/components/ImportNfsePdfModal.jsx` | **Novo** — upload + tela de conferência editável, indicadores "novo/existente" p/ fornecedor e item, aviso+bloqueio de chave já importada, resumo ao salvar. |
| `src/pages/Custos.jsx` | Botão "Importar NFS-e (PDF)" + render do modal (passa `fornecedores`/`itens`/`custos`). |
| `src/api/resources.js` | `custosApi.importarNfse(payload)`. |

**Backend**
| Arquivo | O que mudou |
|---|---|
| `src/services/custos.js` | Novo `importarNfse({ chaveNfse, numNota, dataNota, fornecedor, item, valor })` — dedup por `CHAVE_NFE` (erro `code: 'CHAVE_DUPLICADA'`), cria fornecedor/item (item novo "a classificar"), QTD=1, `VALOR_UNIT=VALOR_TOTAL`, herda TAG do item, grava com `CHAVE_NFE`. |
| `src/routes/custos.js` | Nova rota `POST /custos/import-nfse` (chave duplicada → **HTTP 409**). |

### Validação
- Extração validada com um script Node usando o **próprio `pdfjs-dist`** sobre os 2 PDFs reais: **12/12 campos corretos** (chave, número, data, fornecedor limpo, item sem código, valor) — Canoas e Porto Alegre.
- Backend `node --check` OK; frontend `vite build` OK (worker do pdfjs empacotado).
- **E2E do endpoint contra a planilha real** (dados de teste, baseline restaurado) — **9/9**: cria fornecedor+item("a classificar"), `QTD=1`, `VALOR_UNIT=VALOR_TOTAL`, data/mês derivados, **reimport da mesma chave → 409 bloqueado**, itens órfãos limpos ao excluir os custos.
- Pendente de teste manual: o click-through da UI no navegador (upload real do PDF pelo `<input file>` + modal). A extração `pdfjs-dist` foi validada com a mesma lib fora do browser; o build empacota o worker corretamente.

### Fora de escopo (como no doc da feature)
Importação em lote de vários PDFs, OCR (foto/print), casamento de fornecedor por CNPJ/CPF, e tabela LC 116 para descrições truncadas. O backend já nasce por-nota (`importarNfse` recebe 1 objeto), então lote depois é iterar a mesma função.

---

## Novas Features — Saída (backup mensal) e Exportar Relatório em PDF — 30/06/2026

> Duas saídas de dados, **100% frontend** (sem mudança de backend). Reaproveitam `custosApi.listar()` e os dados já computados nos dashboards.

### 1. Saída — Backup mensal (planilha .xlsx)

Nova aba no **menu lateral** (seção "Saída") → página **`/saida`**. O usuário escolhe o **Mês/Ano** e baixa uma planilha `.xlsx` com **todos os custos daquele mês** (backup fiel da aba CUSTOS).

- Geração no navegador com **SheetJS (`xlsx`)** — a dependência já existia (usada no "Baixar modelo").
- Colunas: DATA, Nº NOTA, MÊS/ANO, FORNECEDOR, ITEM, SUBCATEGORIA, CATEGORIA, TAG, QTD, VALOR UNIT, VALOR TOTAL, CHAVE NFE, UUID. Linha de **TOTAL** ao final. Arquivo: `backup-custos-MM-YYYY.xlsx`.
- A página mostra uma prévia (lançamentos + total) do mês selecionado antes de baixar. Como a folha é lançada como custo de categoria FOLHA, o backup do mês já inclui os custos de folha.
- Arquivos: `src/pages/Saida.jsx` (**novo**), rota em `App.jsx`, link em `Layout.jsx` (nova seção "Saída").

### 2. Exportar Relatório de Custos em PDF

No **Dash Custos**, botão **"⬇ Exportar PDF"** (ao lado do título) gera um PDF do relatório **conforme os filtros ativos** (período, mês selecionado e drill-down de categoria/subcategoria) — pronto para enviar a alguém.

- Geração com **`jspdf` + `jspdf-autotable`** (novas dependências). Conteúdo: cabeçalho com a marca (verde institucional) e data de geração; linha de **Período/Filtros** aplicados; **KPIs** (Total e Nº de lançamentos); **gráficos** (ver abaixo); tabelas **Total por categoria**, **Total por subcategoria** (respeitando o drill) e **Top N itens** (valor, % e variação); rodapé com paginação. Arquivo: `relatorio-custos-AAAA-MM-DD.pdf`.
- **Gráficos no PDF (desenhados para o relatório):** em vez de capturar os gráficos escuros da tela (que ficavam ruins no papel branco), o PDF **desenha os próprios gráficos em vetor** (primitivas do jsPDF), com **tema claro e cores da marca**, nítidos e alinhados ao layout do relatório:
  - **Custos por mês** — barras verticais (coral) com rótulos de mês e valores compactos (`brlCompact`); rótulos alternam quando há muitos meses.
  - **Custos por categoria** — **barras horizontais** (mais legíveis num relatório que pizza), com nome, barra proporcional (paleta da marca), valor e %.
- Recebe os dados **já computados** pelo `DashCustos` (`porMes`, `porCategoria`, ...) — o PDF reflete os filtros/drill ativos, sem recalcular e sem depender de captura de tela.
- Arquivos: `src/utils/exportPdf.js` (**novo** — `exportarRelatorioCustos(...)` com os desenhos `barrasMes`/`barrasCategoria`), botão + handler `exportarPdf()` em `src/pages/dash/DashCustos.jsx`. O Dash Folha pode ganhar o mesmo botão depois (util reutilizável).

### Validação
- Frontend: `vite build` OK (empacota `xlsx`, `jspdf`, `jspdf-autotable`; aviso de tamanho de chunk pré-existente).
- Geração de PDF validada por smoke test em Node: os dois gráficos vetoriais (barras por mês + barras horizontais por categoria) + tabelas (autoTable) → PDF válido, sem erros.
- Backend: inalterado.

### Correção — escala compacta dos gráficos (milhão/bilhão)

Os eixos/rótulos dos gráficos só formatavam até **milhar** (`R$${(v/1000).toFixed(0)}k`), então valores em **milhão** apareciam feios (ex.: `1.500.000` → "1.500k"). Novo helper **`brlCompact(value)`** em `src/utils/format.js` trata **k / mi / bi** (`R$ 12k`, `R$ 1,5mi`, `R$ 1,2bi`) e foi aplicado em **todos os gráficos**: eixos do **Dash Custos**, **Dash Folha** e **Análise por Período** (`tickFormatter`), e os rótulos de valor do **PDF** (`exportPdf.js`). `vite build` OK.

---

## Atualizações — 02/07/2026

> Duas frentes: **Exportar PDF** replicado no Dash Folha e no Dash por Período (antes só existia no Dash Custos), e uma **barra informativa de uso de células** da planilha no lançamento de Custos.

### Exportar Relatório em PDF — Dash Folha e Análise por Período

O botão **"⬇ Exportar PDF"** que existia só no **Dash Custos** foi estendido ao **Dash Folha** e à **Análise por Período** (abas Custos e Folha), reaproveitando o mesmo padrão: **gráficos vetoriais desenhados para o relatório** (tema claro, cores da marca), sem captura da tela escura, e refletindo **os filtros/drill-down ativos** no momento (exporta o que está na tela).

**`src/utils/exportPdf.js`** ganhou:
- `barrasMes(doc, ..., color = CORAL)` — o gráfico de barras por mês passou a aceitar cor (coral nos Custos, **teal** na Folha).
- Helpers compartilhados `rodape(doc, M)` (paginação em todas as páginas) e `ensureSpace(doc, y, need, M)` (quebra de página quando o próximo bloco não cabe) — extraídos do fluxo de Custos e reusados nos novos relatórios.
- `barrasAB(doc, x, y, w, rows, topN)` — **barras horizontais agrupadas Período A (teal) × B (coral)** com legenda e rótulos compactos, para a Análise por Período.
- **`exportarRelatorioFolha({...})`** — cabeçalho com a marca + data, Período/Filtros, KPIs (Total e Nº de lançamentos), gráfico **Folha por mês** (barras teal), **Participação por Tag** (barras horizontais), tabela **Subtotal por Item** (top N) e o **Cruzamento Tag × Categoria** (autoTable com linha de Subtotal/Total geral). Arquivo: `relatorio-folha-AAAA-MM-DD.pdf`.
- **`exportarRelatorioPeriodo({ tipo, periodoALabel, periodoBLabel, totalA, totalB, secoes })`** — genérico para Custos e Folha; KPIs A/B + variação e, por seção, o **gráfico A×B (top 8)** seguido da **tabela detalhada** (todas as chaves + Δ absoluto/percentual). Arquivo: `analise-periodo-{custos|folha}-AAAA-MM-DD.pdf`.

**Wiring (frontend):**
- `src/pages/dash/DashFolha.jsx` — botão no cabeçalho + handler `exportarPdf()` (usa `porMes`/`porTag`/`porItem`/`cruzamento` já computados; rótulos refletem o filtro de tag, o mês e o drill de tag ativos).
- `src/pages/dash/DashPeriodo.jsx` — botão por aba (componente `AnaliseHeader`); as comparações (`comparar(...)`) viraram `useMemo` reaproveitados por tela + PDF; novo helper `periodLabel({de, ate})` para rotular os períodos A/B.

### Custos — barra informativa de uso de células (limite de 10M do Google Sheets)

No **canto superior esquerdo** do lançamento de **Custos** (logo abaixo do título), uma **barra de progresso informativa** mostra quão perto a planilha está do **limite de 10 milhões de células** do Google Sheets. **É apenas informativo — não bloqueia nada.**

- **Cores (traffic-light):** **verde até 60%**, **laranja de 60% a 90%**, **vermelho a partir de 90%**.
- **Métrica (decisão de modelagem):** conta a **grade** de células — `Σ (rowCount × colCount)` de todas as abas — que é **exatamente o que o Google mede contra o limite de 10M** (inclui células vazias dentro da grade e o buffer de linhas do `appendRows`). Preferido a "só células com dado" de propósito: como alerta de proximidade do teto, precisa refletir o que o Google conta, senão a barra mostraria um número otimista e o limite seria atingido de surpresa. O tooltip/sublinha deixam claro que é "vs. limite do Google Sheets".

**Backend**
| Arquivo | O que mudou |
|---|---|
| `src/services/sheets.js` | Novo `getCellUsage()` — 1 chamada de metadados (`fields: sheets(properties(title,gridProperties(rowCount,columnCount)))`); retorna `{ used, limit, sheets: [...] }`. Limite = `SHEETS_CELL_LIMIT` do `.env` ou `10_000_000`. |
| `src/app.js` | Nova rota `GET /api/meta/cell-usage` (protegida por JWT). |

**Frontend**
| Arquivo | O que mudou |
|---|---|
| `src/api/resources.js` | Novo `getCellUsage()` (`GET /meta/cell-usage`). |
| `src/components/CellUsageBar.jsx` | **Novo** — busca o uso no mount, renderiza a barra com a cor por faixa; se a chamada falhar, **some** (informativo, não atrapalha a página). |
| `src/pages/Custos.jsx` | Renderiza `<CellUsageBar />` entre o título e a toolbar. |
| `src/styles.css` | Classes `.cell-usage`, `.cell-usage-head/-track/-fill/-sub`. |

### Validação
- Backend: `node --check` OK em `sheets.js` e `app.js`.
- Frontend: `vite build` OK (1253 módulos; único aviso é o de tamanho de chunk, pré-existente).
- Execução real do app **não** foi possível nesta sessão por falta do `.env` (credenciais da Service Account). Pendente de teste manual no navegador: baixar os PDFs de Folha e de Período, e ver a barra de uso de células com os números reais da planilha.

---

## Atualizações — 02/07/2026 (parte 2) — Instalador Windows (app desktop Electron)

> Objetivo: entregar a um **usuário Beta** um instalador `.exe` que ele instala e roda na própria máquina Windows, **sem precisar instalar Node** nem configurar nada. Conexão fixa embutida, controle de versão por build, e caminho de atualização (sobrescreve e roda a versão nova). Investigação e decisões alinhadas ponto a ponto antes de implementar.

### Decisões de arquitetura (alinhadas)

- **Empacotamento: Electron + `electron-builder` (NSIS) + `electron-updater`.** O app sobe o backend Express embutido em `127.0.0.1` numa **porta livre** e abre uma janela apontando pra ele; o próprio Express serve o build do frontend + as rotas `/api` (mesma origem, então o `/api` relativo do `client.js` funciona sem mudança). Node vem dentro do Electron — o usuário não instala nada.
- **Distribuição do update: handoff manual por agora.** Você gera um `.exe` novo e envia; o instalador **sobrescreve** a versão anterior. O `electron-updater` já está **cabeado e dormente**: quando quiser auto-update, basta definir `UPDATE_FEED_URL` (provider `generic`, um host HTTP estático) no `build/.env` — sem retrabalho de código.
- **Config fixa "vai junto no build":** as credenciais (Service Account, `JWT_SECRET`, admin, `GOOGLE_SHEET_ID`) ficam em `desktop/build/.env` (não versionado), empacotado como `extraResources` → `resources/.env`. O Electron carrega esse `.env` para `process.env` antes de subir o backend.
- **⚠ Ponto sensível registrado:** o `.env` empacotado vai **plaintext** para o disco do cliente — qualquer um com o app instalado consegue extrair a chave da Service Account, o segredo JWT e a senha admin. **Aceitável para 1 Beta de confiança**, tratando a chave como **descartável** (SA com acesso só a essa planilha; rotacionar/revogar após o Beta; nunca comitar credenciais). O "conserto de verdade" ao passar de 1 usuário é **hospedar o backend central** (cliente vira thin client; nenhum segredo é distribuído) — recomendado como evolução.

### Mudanças no código

**Backend**
| Arquivo | O que mudou |
|---|---|
| `backend/src/app.js` | Refatorado para **exportar `startServer({ port, staticDir })`** (o Electron controla start/porta; `port: 0` = porta livre em `127.0.0.1`), mantendo o modo standalone (`node src/app.js` ainda sobe sozinho via checagem `invokedDirectly`). Passou a **servir `frontend/dist` estático + fallback SPA** quando há build disponível (via `FRONTEND_DIST` ou caminho relativo). Novo endpoint **público `GET /api/version`** (`{ version }`, de `APP_VERSION` injetado pelo Electron ou do `package.json`). |

**Frontend**
| Arquivo | O que mudou |
|---|---|
| `src/components/VersionBadge.jsx` | **Novo** — selo fixo no **canto inferior direito**, em **todas as telas (inclusive login)**, mostrando `v<versão>`. Lê `/api/version` (público). |
| `src/main.jsx` | Renderiza `<VersionBadge />` junto do `<App />`. |
| `src/styles.css` | Classe `.version-badge` (fixed, bottom-right, pill discreta). |

**Camada desktop (nova pasta `desktop/`)**
| Arquivo | O que é |
|---|---|
| `desktop/main.js` | Processo principal do Electron (CJS). Carrega o `.env` empacotado, sobe o backend (import dinâmico do ESM por caminho absoluto), abre a janela; instância única; links externos no navegador; `setupAutoUpdate()` só age se `UPDATE_FEED_URL` estiver definida. |
| `desktop/package.json` | Deps do Electron + config do `electron-builder`. **`version` = fonte única da versão.** `extraResources`: `backend` (com node_modules, menos `.env`), `frontend/dist` → `frontend-dist`, `build/.env` → `.env`. Alvo `win/nsis` (por-usuário, sem admin, atalho). Scripts `start`, `icon`, `build:frontend`, `pack`, `dist`. |
| `desktop/build/.env.example` | Modelo da config fixa (copiar p/ `build/.env` e preencher). |
| `desktop/build-icon.js` | Gera `build/icon.ico` (multi-resolução 16→256) a partir de `frontend/public/favicon.svg` usando `sharp` + `png-to-ico`. O `.ico` é versionado; regenerar só se mudar a logo (`npm i -D sharp png-to-ico && npm run icon`). |
| `desktop/build/icon.ico` | Ícone da marca (selo KMPK) usado no `.exe`/instalador/janela. |
| `desktop/.gitignore` | Ignora `node_modules/`, `dist/` e **`build/.env`** (segredo). |
| `desktop/README-INSTALADOR.md` | Passo a passo: pré-requisitos, definir versão, `npm run dist`, onde fica o `.exe`, e como ligar o auto-update depois. |

### Fluxo de build/versão/entrega

1. **Versão:** editar `desktop/package.json` → campo `version` (SemVer). É o número do rodapé do app e o que o updater compara quando ligado.
2. **Build:** dentro de `desktop/` → `npm run dist` (faz `vite build` do frontend → empacota backend+frontend+`.env` → gera o NSIS).
3. **Saída:** `desktop/dist/KampekiFinance-Setup-<versao>.exe` (entregue ao cliente), mais `latest.yml` + `.blockmap` (usados só no auto-update) e `win-unpacked/` (teste sem instalar).
4. **Atualizar cliente (manual):** subir a `version` → `npm run dist` → enviar o novo `.exe` (sobrescreve).

### Validação
- Backend: `node --check` OK (`app.js`). Frontend: `vite build` OK (1253 módulos; aviso de chunk pré-existente).
- Desktop: `node --check main.js` OK; `package.json` válido; **`build/icon.ico` gerado** (370 KB, multi-resolução) a partir do favicon.
- **1º build real gerado pelo usuário** com `electron-builder 24.13.3` / `electron 31.7.7`: `KampekiFinance-Setup-1.0.0.exe` criado com sucesso (inicialmente com o ícone padrão do Electron; **corrigido nesta sessão** apontando `win.icon` → `build/icon.ico`).
- Pendente: instalar o `.exe` numa máquina limpa e validar o app conectando à planilha (depende do `desktop/build/.env` com credenciais reais).

### Pendências em aberto (instalador)
- Ligar o **auto-update** quando houver host HTTP definido (`UPDATE_FEED_URL` no `build/.env`) e publicar `.exe` + `latest.yml` + `.blockmap` a cada release.
- Ao passar de 1 usuário, **migrar para backend hospedado** para não distribuir credenciais.
- **Rotacionar/revogar** a chave da Service Account embutida após o Beta.
- Assinatura de código (code signing) opcional — sem ela, o Windows SmartScreen exibe aviso na 1ª execução.

---

## Atualizações — 02/07/2026 (parte 3) — 1º teste em máquina do cliente + trava de credenciais

> O instalador foi levado a **outro computador** e o app abriu normalmente, mas o **login não entrava**. Diagnóstico, correção e uma trava para não repetir.

### Bug — login não autentica no app instalado

**Sintoma:** app instala e abre, mas `admin@financesheet.local` / senha real → "Credenciais inválidas".

**Causa (confirmada inspecionando `dist/win-unpacked/resources/.env`):** o instalador foi **gerado enquanto o `desktop/build/.env` ainda tinha os valores de exemplo** (`ADMIN_EMAIL=admin@kampeki.local`, `ADMIN_PASSWORD=defina_uma_senha`). As credenciais reais foram preenchidas **depois**, mas o `.exe` não foi regerado. O login compara contra o `.env` empacotado (`routes/auth.js`), então só as credenciais de exemplo "funcionariam" naquele build — não as reais.

**Correção:** com o `build/.env` já contendo as credenciais reais (admin real + `JWT_SECRET` + `GOOGLE_SHEET_ID` + `GOOGLE_CREDENTIALS_JSON` com `private_key`), **regerar o instalador** e reinstalar. Versão subida para **1.0.1** (aparece no selo do rodapé — confirma visualmente que o build novo está rodando).

### Trava nova — `check-env` (barra placeholders antes de empacotar)

Para o erro não se repetir, um **pré-build** valida o `.env` e **falha o build** se algo estiver faltando/placeholder — antes era possível empacotar silenciosamente um `.env` de exemplo.

| Arquivo | O que é |
|---|---|
| `desktop/check-env.js` | **Novo** — lê `build/.env` (via dotenv) e aborta (exit 1) se: arquivo ausente; `ADMIN_EMAIL` vazio/`admin@kampeki.local`; `ADMIN_PASSWORD` vazio/`defina_uma_senha`; `JWT_SECRET` placeholder; `GOOGLE_SHEET_ID` vazio/placeholder; `GOOGLE_CREDENTIALS_JSON` ausente/JSON inválido/sem `private_key`+`client_email`. Sucesso imprime o email de login que vai no build. |
| `desktop/package.json` | Script `dist` agora roda `node check-env.js` **antes** do `vite build`/`electron-builder`; novo script avulso `check-env`. Versão → `1.0.1`. |

### Entrega ao cliente — qual arquivo enviar

**Apenas 1 arquivo:** `desktop/dist/KampekiFinance-Setup-<versao>.exe` (autocontido — Node + backend + frontend + `.env` embutidos; ~300 MB, enviar por Drive/WeTransfer). **Não** enviar `latest.yml`, `.blockmap`, `builder-*.yml/.yaml` (só auto-update/diagnóstico) nem `win-unpacked/` (teste local). No cliente: fechar o app → rodar o Setup (sobrescreve) → login com as credenciais reais → conferir a versão no rodapé.

### Validação
- `check-env` roda OK contra o `build/.env` atual (credenciais reais; login `admin@financesheet.local`).
- Build **1.0.1** gerado com sucesso (`KampekiFinance-Setup-1.0.1.exe`). Pendente: reinstalar no PC do cliente e confirmar o login real + o `v1.0.1` no rodapé.

---

## Atualizações — 06/07/2026 — versão 1.1.0

> Sessão de ajustes pedidos pelo gestor para a **v1.1.0**: buscas na tela de Custos, correção de bug no reprocessamento de tags (com **mudança de regra**), remoção da categoria IMPOSTOS, responsividade em Full HD @125%, controle de zoom embutido e um novo gráfico de composição por grupo no Dash Custos. Versão do `desktop/package.json` subida para **1.1.0**.

### Custos — coluna e busca de Subcategoria + busca por Tag
Na **listagem de Custos**:
- Nova **coluna "Subcategoria"** (entre Categoria e Tag).
- Novo filtro **Subcategoria** (combo `input` + `datalist`, **busca por trecho** case-insensitive; as opções se restringem à categoria escolhida).
- Novo filtro **Tag** (select das tags presentes nos custos).
- Ambos combinam com os filtros já existentes (Mês/Ano, Categoria, Fornecedor, Nº Nota, Item). Ao trocar a Categoria, a Subcategoria selecionada é resetada.

### Categoria IMPOSTOS removida
Removido o mapeamento `'IMPOSTOS': 'IMPOSTOS'` de `switch-categoria.js`. A categoria deixa de ser oferecida em qualquer classificação (não entra mais em `categoriasFixas`, nem nos selects de subcategoria/gestão). Dados históricos que já tenham `CATEGORIA = IMPOSTOS` **continuam sendo exibidos** (a leitura não altera o gravado) e caem no grupo **"Outros"** do novo gráfico do dashboard. As frases que listavam as categorias nos manuais HTML foram atualizadas.

### Reprocessamento de tags — bug corrigido + regra revista (o item manda)
**Antes:** `reprocessarTagsNosCustos` (e o salvar do item) **só aplicavam** tag; **nunca removiam**. Ao tirar a tag de um item, os custos ficavam com a tag antiga — foi o bug reportado.

**Agora (decisão alinhada com o gestor — "a tag é do item e o custo segue o item"):** o **item é a fonte da verdade** e o custo **sempre** espelha a tag do item, incluindo a **remoção**:
- **Salvar item** (`itens.criar`/`atualizar`): `aplicarTagAosCustosDoItem` sincroniza os custos daquele item para a tag atual — aplica quando há tag e **limpa** quando a tag foi removida. Retorna `tagRemovida` para a UI (mensagem "Tag removida de N custo(s)…" vs. "Tag X aplicada…").
- **"↻ Reprocessar tags (geral)"** (`reprocessarTagsNosCustos`): para cada custo cujo ITEM existe no cadastro, a tag alvo é a TAG do item (folha com tag) **ou vazia** (folha sem tag / item não-folha); custos que divergem são atualizados (aplicando **ou** limpando). Custos de itens **desconhecidos** (sem correspondência em ITENS) não são tocados. Retorna `custosAplicados`/`custosLimpos`.
- **Consequência (registrada de propósito):** tags gravadas **direto no custo** por *edição em massa*, quando o item **não tem tag própria**, são **limpas** no reprocesso global — comportamento desejado sob a nova regra. A edição em massa de Tag continua existindo como atalho, mas o item prevalece no reprocesso.

### Itens — filtro por Tag
A página **Itens** ganhou o filtro **Tag** (select), combinável com Nome/Categoria/Subcategoria; "Limpar filtros" também zera a tag.

### Responsividade — Full HD (1920×1080) com escala 125%
Em ~1536px de viewport a tela de Custos ficava espremida (muitos filtros). Novo breakpoint `@media (max-width: 1400px)`: a toolbar deixa de empurrar os campos para a direita (`.spacer` some) e distribui os filtros em grade uniforme (`flex: 1 1 160px`, `max-width: 220px`), com padding do `.main` levemente reduzido.

### Zoom embutido na ferramenta
Novo controle de **zoom** na sidebar (−/%/+, clique no % restaura 100%), aplicado via **CSS `zoom` no elemento raiz** (Chromium/Electron) e **persistido em `localStorage`** (`kampeki_zoom`, faixa 60–150%). Disponível em todas as telas; aplicado cedo no `main.jsx` (`aplicarZoomSalvo`) para não dar "flash" no login. Permite compensar a escala do sistema sem depender do zoom do SO.

### Dash Custos — gráfico "Composição por grupo" (abaixo do Comparativo mês a mês)
Novo card com **barras empilhadas por mês** em 3 grupos de gestão + **resumo lateral** (valor por grupo e **Total**):
- **CMV** = CMV
- **Despesas** = DESPESA ADMINISTRATIVA + DISTRIBUIÇÃO DE LUCRO
- **Folha** = FOLHA CANOAS + FOLHA POA + FOLHA TELE
- **Outros** (só aparece se houver valor fora dos 3 grupos, ex.: dados antigos de IMPOSTOS) — mantém o Total honesto.
- **Respeita o drill-down**: usa a mesma base `baseDrill` do comparativo (período + categoria + subcategoria); o **resumo lateral** respeita também o **mês selecionado** (como os KPIs). 100% frontend, sem mudança de backend.

### Changelog técnico — 06/07/2026 (por arquivo)

**Backend**
| Arquivo | O que mudou |
|---|---|
| `src/utils/switch-categoria.js` | Removido `'IMPOSTOS': 'IMPOSTOS'` do `categoriaMap`. |
| `src/services/itens.js` | `aplicarTagAosCustosDoItem` agora **sincroniza** (aplica **e limpa**) e retorna `{ atualizados, limpou }`; `criar`/`atualizar` propagam `tagRemovida`. `reprocessarTagsNosCustos` reescrito: item = fonte da verdade (aplica/limpa por item, ignora itens desconhecidos), retorna `custosAplicados`/`custosLimpos`. |

**Frontend**
| Arquivo | O que mudou |
|---|---|
| `src/pages/Custos.jsx` | Filtros Subcategoria (datalist, busca por trecho, restrita à categoria) e Tag (select); reset de subcategoria ao trocar categoria; nova coluna Subcategoria na tabela (colSpan 11→12). |
| `src/pages/Itens.jsx` | Filtro por Tag (`fTag`); mensagens de reprocessar/salvar diferenciam "tag aplicada" × "tag removida". |
| `src/pages/dash/DashCustos.jsx` | `GRUPOS`/`grupoDe`; memos `porGrupoMes` (empilhado por mês) e `resumoGrupos` (respeita `selMes`); novo card "Composição por grupo" com barras empilhadas + resumo lateral. |
| `src/components/ZoomControl.jsx` | **Novo** — controle de zoom (CSS `zoom` no root, persistido em `localStorage`); exporta `aplicarZoomSalvo`. |
| `src/components/Layout.jsx` | Renderiza `<ZoomControl />` na sidebar (acima de "Sair"). |
| `src/main.jsx` | Chama `aplicarZoomSalvo()` antes de renderizar. |
| `src/styles.css` | Estilos `.grupo-*` (composição por grupo), `.zoom-*` (controle de zoom) e breakpoint `@media (max-width:1400px)` para a toolbar de filtros em Full HD @125%. |
| `desktop/package.json` | `version` 1.0.1 → **1.1.0**. |
| `Guia_Interativo_*.html`, `Manual_do_Usuario_*.html` | Frase das categorias sem IMPOSTOS. |

### Validação
- Backend: `node --check` OK (`switch-categoria.js`, `itens.js`, `custos.js`).
- Frontend: `vite build` OK (1255 módulos; único aviso é o de tamanho de chunk, pré-existente).
- **Não** foi feita execução com escrita contra a planilha real nesta sessão (evitar tocar dados de produção). **Pendente de teste manual**, com atenção especial:
  - **Reprocessar tags** agora **remove** tag de custos quando o item não tem tag — validar num item de teste antes de rodar o "geral" na base real (pode limpar tags aplicadas por edição em massa de itens sem tag própria).
  - Conferir escrita: tirar a tag de um item de folha → salvar → os custos daquele item devem ficar sem tag na planilha; e o inverso (aplicar) deve gravar a tag.
  - Ver o novo gráfico e o resumo batendo com os KPIs sob drill-down/mês.

### Pendências em aberto
- Gerar o instalador **1.1.0** (`npm run dist` em `desktop/`) e validar no PC do cliente (login + `v1.1.0` no rodapé) — herda a pendência da v1.0.1.
- Migração de dados históricos de `IMPOSTOS` (se o gestor quiser reclassificá-los) — hoje aparecem em "Outros".

### Refinamentos do Dash Custos (mesma sessão, após feedback)
Ajustes no card "Composição por grupo" e no "Comparativo mês a mês":
- **"Outros" transparente:** o resumo lateral agora **lista as categorias** que compõem o "Outros" ("Inclui: …"), para o gestor validar na tela. "Outros" = custos **sem categoria** (itens **"a classificar"**, categoria em branco) + categorias fora dos 3 grupos (ex.: `IMPOSTOS` histórico). Confirmado: **não** é um item específico, é a soma do não-classificado/fora-dos-grupos.
- **Composição por grupo segue o mês:** ao filtrar um mês no Comparativo (`selMes`), o gráfico de grupo **recorta naquele mês** (mostra só a barra do mês) além do drill de categoria/subcategoria — base única `baseGrupo` (= `baseDrill` + mês). O resumo lateral usa a mesma base.
- **Clique no mês em qualquer ponto da coluna:** o "Comparativo mês a mês" passou a usar o `onClick` do `BarChart` (`activePayload`), então clicar em **qualquer ponto da coluna do mês** seleciona/filtra — não precisa acertar a barra (resolvia o aperto em meses com pouco valor). Removido o `onClick` da `<Bar>` para não disparar o toggle duas vezes.
- Arquivos: `src/pages/dash/DashCustos.jsx` (memos `baseGrupo`/`porGrupoMes`/`resumoGrupos`/`outrosCategorias`; `BarChart onClick`), `src/styles.css` (`.grupo-resumo-nota`). `vite build` OK.

### Composição por grupo — drill-down por mês + PDF adaptável (2ª rodada de feedback)

Segunda leva de ajustes no Dash Custos, pedida logo em seguida:

1. **Gráfico "Composição por grupo" com drill-down igual ao Comparativo mês a mês:** revertido o recorte para um único mês; o gráfico volta a mostrar **todos os meses** do período (empilhado por grupo), com o mês selecionado **destacado** (demais esmaecidos via `fillOpacity` por `<Cell>`) e **clicável em qualquer ponto da coluna** (`BarChart onClick` → `toggleMes`) — filtra todo o dashboard. Passou a haver duas bases: `porGrupoMes` (gráfico, todos os meses, de `baseDrill`) e `baseGrupo`/`resumoGrupos` (resumo lateral, recorte de mês ativo). `temOutrosChart` (qualquer mês) controla a série "Outros" no gráfico; `temOutros` (recorte) controla a linha no resumo.

2. **PDF ganhou a seção "Composição por grupo":** nova `barrasGrupo(doc, …)` em `exportPdf.js` — barras horizontais com **ordem e cores fixas** por grupo (CMV coral, Despesas teal, Folha oliva, Outros areia), valor + % e **linha de Total**. `exportarRelatorioCustos` recebe `porGrupo` e desenha a seção logo após "Custos por mês".

3. **PDF adaptável ao filtro/drill (regra confirmada):** ao exportar, o PDF reflete **exatamente o recorte ativo**; sem filtro, sai o dashboard inteiro como na tela. Implementado em `DashCustos.exportarPdf()`:
   - **Mês selecionado** → `porMes`/composição saem só daquele mês (`porMesExport = porMes.filter(key === selMes)`);
   - **Categoria drillada** → "Custos por categoria" sai só dela (`porCategoriaExport = porCategoria.filter(key === selCategoria)`);
   - `porGrupo` vem de `resumoGrupos` (já respeita mês + drill); subcategoria/itens/KPIs já vinham de `baseCat`/`filtrado` (drillados). O rótulo "Filtros:" no cabeçalho do PDF já lista Mês/Categoria/Subcategoria ativos.

- Arquivos: `src/pages/dash/DashCustos.jsx` (`porGrupoMes` all-months + `Cell` opacity + `BarChart onClick`; `exportarPdf` adaptável + `porGrupo`), `src/utils/exportPdf.js` (`barrasGrupo` + `porGrupo` em `exportarRelatorioCustos`). `vite build` OK.

---

## Registro da conversa — sessão 06/07/2026 (v1.1.0)

> A pedido do gestor, o log da sessão que originou a v1.1.0, para não se perder o raciocínio e as decisões.

**1. Pedido inicial (8 frentes para viabilizar a v1.1.0):**
1. Custos: coluna de subcategoria + poder pesquisar por ela;
2. Custos: poder pesquisar por tag;
3. Remover a categoria "Imposto" do código-fonte;
4. Corrigir tela de lançamento de custo espremida em monitor Full HD (1920×1080) com escala 125%;
5. Zoom de aumento/diminuição da tela como padrão da ferramenta;
6. Pesquisar por tag dentro dos Itens;
7. Bug: ao reprocessar tags, itens dos quais a tag foi removida continuaram com a tag no custo — validar se a ferramenta funciona;
8. Dash Custos: abaixo do "Comparativo mês a mês", um gráfico com CMV (sozinho), Despesas (Adm + Distribuição de Lucro) e Folha (POA + Canoas + Tele), funcionando com drill-down e com um resumo no canto (CMV/Despesas/Folha + Total).
   - Ênfase: "Faça tudo com bastante cuidado e cuide sempre a performance e a garantia que o dado está sendo escrito na planilha."

**2. Pergunta de esclarecimento (risco de perda de dado) e resposta:** sobre o item 7, como existe o fluxo de "editar em massa → tag" que grava a tag direto no custo (item pode ficar sem tag), perguntei o que os custos devem fazer quando um item de folha fica sem tag. **Resposta do gestor: Opção 1 — "o item manda em tudo"** ("a tag tem que ser aplicada sobre o item e o custo deve seguir como a tag está"). Ou seja, o custo **sempre** espelha a tag do item, inclusive limpando quando a tag é removida — aceitando que tags aplicadas por edição em massa a itens sem tag própria sejam limpas no reprocesso global.

**3. Entrega da 1ª leva:** implementados os 8 itens (detalhes na seção "Atualizações — 06/07/2026 — versão 1.1.0"). Reforço da política de dado: **não** foi feita escrita contra a planilha de produção; validação por `node --check` + `vite build` + revisão. Recomendado testar o "Reprocessar tags (geral)" num item de teste antes de rodar na base real (agora ele remove tags).

**4. Dúvidas do gestor sobre o Dash (e respostas):**
- *O que é "Outros" e qual item é?* → Não é um item específico: é a soma do que não é CMV/Despesas/Folha — principalmente **custos sem categoria (itens "a classificar")** e categorias antigas (ex.: IMPOSTOS). Para validar, o resumo passou a **listar** as categorias que compõem o "Outros" ("Inclui: …").
- *Os "Outros" são itens não categorizados?* → Sim, majoritariamente (categoria/subcategoria em branco).
- *Quando eu clicar no drill-down do "Comparativo mês a mês", quero que o "Composição por grupo" também filtre.* → Feito (o gráfico de grupo passou a seguir o mês/drill).
- *No "Comparativo mês a mês", ter que clicar exatamente no pilar é ruim em meses com pouco dado; o clique deveria ser no espaço do mês.* → Feito: clique em qualquer ponto da coluna do mês (via `BarChart onClick`).

**5. Ajustes finais pedidos (2ª leva):**
1. "Composição por grupo" com drill-down igual ao "Comparativo mês a mês" (sempre com o mês para filtrar);
2. Corrigir o relatório exportado para ter a visão de "Composição por grupo";
3. **PDF adaptável:** com filtro/drill aplicado, gráficos e listas do PDF saem só como filtrado; sem filtro, saem como estão na tela;
4. Registrar toda a conversa neste `KAMPEKI_APP_BRIEF.md` (esta seção).
   - Tudo implementado (ver "Composição por grupo — drill-down por mês + PDF adaptável"). `vite build` OK.

**Estado ao fim da sessão:** v1.1.0 no `desktop/package.json`; frontend compila; backend `node --check` OK. Pendente de teste manual no app real (com atenção ao reprocessamento de tags que agora remove) e geração/validação do instalador 1.1.0.

### Correção — sidebar sumindo + rolagem horizontal no app empacotado (escala 125%)

**Sintoma (relatado após a v1.1.0, no app do build):** ao usar o monitor a **125%**, a **sidebar sumia** e a tela ficava **só com barras de rolagem**.

**Causa:** overflow horizontal da página. A área principal (`.main`, um flex item) estava **sem `min-width: 0`**, então um filho largo — a tabela de Custos, que passou a ter mais colunas (Subcategoria) — impedia o flex de encolher e **estourava a largura da janela**. Como a **sidebar é `position: sticky`**, ao rolar horizontalmente ela **escorregava para fora** da tela. A 125% a janela tem menos largura em CSS px (1920/1.25 = 1536, ou menos se não maximizada), então o estouro passou a acontecer com facilidade.

**Correção:**
- **`.main { min-width: 0 }`** (CSS) — o flex volta a respeitar a largura da janela; a tabela larga rola **dentro do próprio `.table-wrap`** (que já tem `overflow-x: auto`) em vez de estourar a página. A sidebar fica fixa. Vale para dev e build. (Descartada uma trava `overflow-x: hidden` no `.app-shell` porque forçaria `overflow-y: auto` e poderia quebrar o `position: sticky` da sidebar.)
- **`desktop/main.js`** — a janela abre **maximizada** (`show:false` → `maximize()` → `show()`), dando a largura máxima útil sob a escala 125% (sidebar visível, menos aperto). `opts.width/height` seguem valendo ao restaurar a janela.

Validação: `vite build` OK; `node --check desktop/main.js` OK. **Precisa gerar o instalador novo** (`npm run dist` em `desktop/`) para a correção chegar no app do cliente.

---

## Atualizações — 07/07/2026 — combobox de busca (`SearchableSelect`) nos filtros/campos de Custos

> Sessão focada em **usabilidade de busca**: substituir os `<select>`/`<datalist>` nativos por um combobox de busca próprio, consistente visualmente com a marca e que filtra bem mesmo com listas grandes. Sem mudança de backend. Versão do `desktop/package.json` **não** foi alterada (segue **1.1.1**).

### Contexto / problema
No formulário e nos filtros de Custos, os campos usavam duas coisas: `<select>` nativo (não dá pra digitar/filtrar) e `<input list>` + `<datalist>` nativo (dá pra digitar, mas com **duas limitações**): (1) com **listas grandes** — o caso de **Fornecedor** (centenas/milhares) — o `<datalist>` do Chromium **trunca e para de filtrar de forma útil**; e (2) o **popup do datalist é renderizado pelo SO/Chromium** (fundo azulado, setinha ▼), **ignorando o CSS do projeto** — destoava do tema verde. A Subcategoria "parecia" funcionar só porque tem poucas dezenas de opções.

### Solução — componente `SearchableSelect`
Novo `frontend/src/components/SearchableSelect.jsx`: um combobox que **renderiza a própria lista filtrada** (não depende do `<datalist>`), então filtra igual com qualquer tamanho de lista e segue o CSS do app.

- **Filtra ao digitar**, ignorando **acento e maiúscula/minúscula** (`normalize('NFD')` + strip de diacríticos).
- **Abre com a lista inteira** (flag `touched`): enquanto o usuário não digita, mostra todas as opções mantendo o valor atual visível no campo — a abertura fica **igual** esteja o campo vazio (Fornecedor) ou já preenchido (Subcategoria). Antes, campos com valor pré-filtravam a lista pelo próprio valor e abriam mostrando **só o item selecionado** (em coral), o que dava a impressão de "cores/comportamento diferentes".
- **Mostra todas as opções** que casam com a busca (a lista rola dentro do dropdown — `max-height: 260px` + `overflow-y: auto`). *(Nasceu com cap de 50 itens + aviso "+N resultado(s) — refine a busca"; o cap foi removido a pedido do gestor — ver nota abaixo.)*
- **Navegação por teclado** (↑ ↓ Enter Esc), clique para selecionar, fecha ao clicar fora. **Aceita texto livre** (o `onChange` devolve o que foi digitado/selecionado — fornecedor novo continua podendo ser criado no backend).
- Estilo `.ss-*` no `styles.css` usando as variáveis da marca (`--surface`, `--surface-2`, `--border`, `--primary`); o item que corresponde ao valor atual fica em coral (`.ss-opt-sel`), o item sob o cursor em `--surface-2` (`.ss-opt-hl`).

### Onde foi aplicado
**Toolbar de filtros de Custos (todos uniformes agora):** Mês/Ano, Categoria, Subcategoria, Fornecedor e Tag viraram `SearchableSelect`. **Nº Nota** e **Item** seguem como `<input>` de texto livre (já eram busca por digitação, sem lista de opções). Os **predicados de filtro** desses campos passaram a casar **por trecho** (`includes`, case-insensitive) em vez de igualdade exata — digitar parcial já filtra a listagem sem precisar selecionar o valor exato. A lista de opções de **Subcategoria** acompanha a **Categoria** digitada (também por `includes`).

**Formulário de lançamento de Custo:** **Fornecedor** e **Subcategoria** viraram `SearchableSelect` (a Subcategoria mantém a cascata — reusa a função `setSubcategoria`, que resolve a subcategoria, preenche a categoria e zera o item). O campo **Tag** (que só aparece para categorias de folha) foi de `<select>` para `<input>` + `<datalist>` com **resolução case-insensitive** (`tagResolvida`): a validação bloqueia salvar tag inexistente e grava a tag na **grafia canônica** cadastrada.

### Estado atual dos campos (para referência)
| Local | Campo | Componente |
|---|---|---|
| Toolbar (filtro) | Mês/Ano, Categoria, Subcategoria, Fornecedor, Tag | `SearchableSelect` |
| Toolbar (filtro) | Nº Nota, Item | `<input>` texto livre |
| Formulário | Fornecedor, Subcategoria | `SearchableSelect` |
| Formulário | Categoria, Item | `<input list>` + `<datalist>` nativo (ainda **não** migrados) |
| Formulário | Tag (folha) | `<input list>` + `<datalist>` + `tagResolvida` |

> Pendência (opcional, alinhar com o gestor): migrar **Categoria** e **Item** do formulário para o `SearchableSelect` também, deixando 100% uniforme. O Item tem ~2.700 opções e hoje depende do `<datalist>` nativo (mesma limitação de lista grande do Fornecedor), então é o principal candidato.

### Changelog técnico — 07/07/2026 (por arquivo, tudo frontend)
| Arquivo | O que mudou |
|---|---|
| `src/components/SearchableSelect.jsx` | **Novo** — combobox de busca (input + lista filtrada própria); busca sem acento/caixa; abre com lista cheia (flag `touched`); cap de 50 + "+N"; teclado; texto livre. |
| `src/pages/Custos.jsx` | Toolbar: Mês/Ano, Categoria, Subcategoria, Fornecedor e Tag → `SearchableSelect`; predicados desses filtros por `includes` (case-insensitive); memo `subcategorias` segue a categoria por `includes`; novos memos `fornecedorNomes`/`subcatNomes`. Formulário: Fornecedor e Subcategoria → `SearchableSelect`; Tag → `<datalist>` + `tagResolvida` (validação + grafia canônica). |
| `src/styles.css` | Novas classes `.ss-wrap`/`.ss-list`/`.ss-opt`/`.ss-opt-hl`/`.ss-opt-sel`/`.ss-empty`/`.ss-more` (dropdown no tema da marca). |

### Validação
- Frontend: `vite build` OK a cada etapa (última: ~10–16s; único aviso é o de tamanho de chunk, pré-existente).
- Lógica de filtragem do `SearchableSelect` testada em Node com lista de 2.003 opções: busca por trecho sem acento/caixa correta (`peix`→Peixaria, `acou`→Açougue, `pao`→PÃO) e cap de 50 com contador de excedentes.
- Backend inalterado. **Pendente de teste manual no navegador** (`npm run dev` em `frontend/`) e de gerar o build/instalador para chegar ao app do cliente.

### Ajuste (mesma sessão) — remover o limite de 50 itens da lista
Feedback do gestor: em listas grandes (Fornecedor, Subcategoria) aparecia "+11 resultado(s) — refine a busca" e ele queria **ver todos os itens** de uma vez. Ajuste: o `maxVisible` do `SearchableSelect` passou de **50** para **`Infinity`** (valor padrão) — a lista agora mostra **todas** as opções que casam com a busca e **rola** dentro do dropdown; o aviso "+N resultado(s)" deixou de aparecer (não há mais corte). Vale para todos os campos que usam o combo. `vite build` OK.

> Nota de performance: para uma lista muito grande (ex.: se o **Item**, ~2.700 opções, for migrado para o combo no futuro), renderizar tudo ao abrir pode gerar leve lentidão — candidato a virar lista **virtualizada** sem mudar a aparência. Fornecedor/Subcategoria/Categoria/Tag são tranquilos.

---

## Atualizações — 09/07/2026 — Importação de NFS-e (PDF) em lote (vários PDFs)

> A pedido da cliente/gestor, o import de **NFS-e (PDF)** deixou de ser "um PDF por vez" e passou a aceitar **vários PDFs de uma vez**, com tela de conferência em lista (aceitar todas de uma vez **ou** ajustar item a item), link para abrir cada PDF em outra aba e a tabela compactada para caber sem rolagem horizontal. Sem alteração de versão do `desktop/package.json`.

### Seleção múltipla + tela de conferência em lista
O modal **"Importar NFS-e (PDF)"** (`ImportNfsePdfModal.jsx`, reescrito) agora:
- Aceita **`multiple`** no seletor de arquivo; lê os PDFs **um a um** no navegador (mesmo `parseNfsePdf`, pdfjs-dist) com **indicador de progresso** ("Lendo PDF 3 de 10…"). Arquivos que falham na leitura são reportados sem derrubar o lote.
- A conferência virou uma **lista compacta** (uma linha por PDF): Data · Nº · Fornecedor · Item · Valor · **Situação** · **Arquivo** · remover (✕).
  - **Clicar na linha expande** um formulário editável daquela nota (mesmos campos de antes: Data/competência, Nº, Fornecedor, Item, Valor com Qtd=1) — permite **ajustar item a item**.
  - **Situação** por linha via badges: `✓ pronta`, `⚠ Data/Valor inválido`, `⛔ já importada` (chave já em CUSTOS) ou `⛔ repetida no lote` (mesma chave em dois PDFs do próprio lote); indicadores `➕ novo` de fornecedor/item e `a classificar`.
  - Rodapé com contador **"X de Y válida(s)"** + botão **"Importar todas (N)"** — a cliente pode **aceitar todos os prévios sem ajustar** ou revisar antes.
- Tela final reaproveita o **`ImportResult`** (importadas, puladas, fornecedores/itens criados, a classificar, erros).

### Backend em lote (uma passada só)
- **`src/services/custos.js`** → novo **`importarNfseLote(notas)`**: mesma regra de negócio do unitário (`importarNfse` — QTD=1, `VALOR_UNIT=VALOR_TOTAL`, dedup por `CHAVE_NFE`, herda TAG do item, 2 casas), porém processando o lote **numa passada**: lê FORNECEDOR/ITENS/CUSTOS **uma vez** e faz **um append por aba** (padrão do `importarLoteXml`, bom p/ performance e orçamento de células). **Diferença vs. unitário:** nota com chave já existente — ou **repetida no próprio lote** — é **pulada e reportada** (`notasPuladasLista`), **não** bloqueia o restante (o 409 do unitário não se aplica ao lote). Linhas inválidas (sem item, valor/data inválidos) vão para `errosLista`.
- **`src/routes/custos.js`** → nova rota **`POST /custos/import-nfse-lote`** `{ notas: [...] }`.
- O envio unitário (`importarNfse` / `POST /custos/import-nfse`) **continua existindo** intacto.

### "Abrir o PDF em outra aba" (conferência/validação)
- Cada nota guarda o PDF original como **`blob:` URL** (`URL.createObjectURL`, revogada ao fechar o modal). A coluna **"📄 Arquivo"** (e um link na área expandida) **abre o PDF em outra aba** para conferir a origem em caso de erro/dúvida.
- **`desktop/main.js` (Electron):** o `setWindowOpenHandler` mandava **todo** `target="_blank"` para o navegador externo (`shell.openExternal`) — e um `blob:` **não existe fora do renderer**, então o link quebraria no app empacotado. Agora URLs **`blob:`/`data:`** abrem numa **janela interna** do app com o **visualizador de PDF do Chromium ligado** (`webPreferences.plugins: true`); http(s) segue indo para o navegador externo como antes. Funciona tanto no dev (navegador) quanto no `.exe`.

### Tabela de conferência compacta (sem rolagem horizontal)
- Nova classe **`.nfse-conf`** em `styles.css` (aplicada ao `.table-wrap`): fonte 13→**12px**, cabeçalho 12→**11px**, padding das células 9×12→**4×6px**, inputs/labels/`kpi-value` da linha expandida menores.
- Larguras de coluna apertadas no JSX (Fornecedor 180→130, Item 220→160, Arquivo 160→110, com reticências) para caber nos ~900px úteis do `modal-lg` sem barra horizontal. A **rolagem vertical** com muitos PDFs segue proposital (`.modal` tem `max-height: 90vh; overflow-y: auto`).

### Changelog técnico — 09/07/2026 (por arquivo)

**Backend**
| Arquivo | O que mudou |
|---|---|
| `src/services/custos.js` | Novo `importarNfseLote(notas)` — import de vários PDFs numa passada (dedup por chave inclusive dentro do lote, cria fornecedor/item, item novo "a classificar", QTD=1, herda TAG, 2 casas; retorna `importados`/`notasPuladas`/`aClassificar`/`errosLista`). |
| `src/routes/custos.js` | Nova rota `POST /custos/import-nfse-lote`. |

**Frontend**
| Arquivo | O que mudou |
|---|---|
| `src/components/ImportNfsePdfModal.jsx` | Reescrito: `multiple` + leitura em loop com progresso; conferência em **lista compacta** com expandir/editar por nota, badges de situação, coluna **Arquivo** (abre PDF em outra aba via `blob:` URL revogada no unmount), remover linha, "Importar todas (N)"; resultado via `ImportResult`. |
| `src/api/resources.js` | Novo `custosApi.importarNfseLote(notas)` (`POST /custos/import-nfse-lote`). |
| `src/styles.css` | Nova classe `.nfse-conf` (tabela de conferência compacta). |

**Desktop**
| Arquivo | O que mudou |
|---|---|
| `desktop/main.js` | `setWindowOpenHandler`: URLs `blob:`/`data:` abrem em janela interna (PDF viewer do Chromium, `plugins: true`); http(s) segue para o navegador externo. |

### Validação
- Backend: `node --check` OK (`custos.js`, `routes/custos.js`); `node --check desktop/main.js` OK.
- Frontend: `vite build` OK (1256 módulos; único aviso é o de tamanho de chunk, pré-existente).
- **Pendente de teste manual** (não rodado por falta do `.env` com credenciais da Service Account, como nas sessões anteriores):
  - No **navegador** (`npm run dev`): selecionar vários PDFs, conferir a lista/edição, abrir um PDF em outra aba, "Importar todas" e ver o resumo (importadas/puladas/erros).
  - No **app empacotado** (`npm run dist` → instalar): confirmar que o link do PDF abre na **janela interna** do Electron (não é jogado para o navegador externo).
