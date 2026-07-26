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

---

## Atualizações — 10/07/2026 — versão 1.3.1

> Sessão de melhorias pedidas pelo gestor para a **v1.3.1** (build anterior entregue foi a 1.2.1): filtros mais ricos no lançamento de Custos e de Itens, tag de folha deixando de ser obrigatória, e edição em massa na página Itens. Versão do `desktop/package.json` subida para **1.3.1**.

### Custos — filtro por Dia (aparece ao escolher Mês/Ano)
Ao aplicar o filtro **Mês/Ano** na listagem de Custos, surge ao lado um filtro **Dia** (`SearchableSelect`) populado **apenas com os dias (DD) que têm custo lançado** naquele mês/ano. Trocar ou limpar o Mês/Ano reseta o dia automaticamente. Implementação 100% frontend (estado `fDia`, memo `diasDisponiveis`, predicado por `DATA_NOTA.split('/')[0]`).

### Custos — opção "(sem tag)" no filtro de Tag
O filtro de **Tag** ganhou a opção especial **"(sem tag)"** no topo (constante `SEM_TAG`), que filtra os custos **sem nenhuma tag** (`!c.TAG`). As demais opções continuam casando por trecho.

### Custos — filtro de Subcategoria multi-seleção (chips)
O filtro de **Subcategoria** passou de seleção única para **multi-seleção**: o `SearchableSelect` vira um "adicionador" (nova prop **`onPick`**, que dispara só na escolha — não a cada tecla) e as subcategorias escolhidas viram **chips removíveis**. O filtro passa a considerar **qualquer uma** das subcategorias marcadas (restritas à categoria escolhida). Estado `fSubcategoria` (string) → `fSubcats` (array); trocar a categoria zera a seleção.

### Custos — Tag deixou de ser obrigatória na folha (frontend + backend)
A tag na folha passou a ser **opcional** (antes era obrigatória e travava o salvamento). A tag continua disponível no formulário (e herda a do item), mas pode ficar em branco; só bloqueia se o usuário **digitar uma tag inexistente**.
- **Backend (`custos.js` `montarLinha`):** removido o `throw 'TAG é obrigatória para categorias de folha'`; mantida a validação de que, **se informada**, a tag precisa existir na aba TAG.
- **Frontend (`Custos.jsx`):** `validarLocal` só bloqueia tag digitada e não-resolvida; label "Tag (obrigatória para folha)" → **"Tag (opcional — folha)"**; payload envia a grafia canônica quando resolve, senão vazio.

### Itens — edição em massa (igual à de Custos)
A página **Itens** ganhou seleção por linha + "selecionar todos os filtrados" + barra **"Editar em massa"**, espelhando a de Custos. Campos editáveis em massa: **Subcategoria** e **Tag (folha)**.
- **Backend:** novo **`itens.atualizarEmMassa({ ITEM_UUIDS, campo, valor })`** (lista branca `CAMPOS_MASSA = { SUB_CATEGORIA, TAG }`). Como **o item é a fonte da verdade**, a mudança **re-sincroniza os custos** dos itens afetados numa passada (lê ITENS/CUSTOS uma vez, `updateColumnForUuids` por coluna):
  - `SUB_CATEGORIA`: valida a subcategoria (deriva a categoria), grava sub/cat nos itens **e em todos os custos** desses itens; se a nova categoria **não for de folha**, limpa a TAG (itens + custos).
  - `TAG`: só vale para itens de **folha** (os não-folha são ignorados e reportados em `itensIgnorados`); grava a tag (ou vazio p/ limpar) nos itens de folha e sincroniza os custos.
  - Rota `POST /itens/bulk`.
- **Frontend (`Itens.jsx`):** checkbox por linha, barra de ações, modal de edição em massa (campo + valor), com mensagem de resultado (itens/custos sincronizados).

### Itens — filtros de Subcategoria (multi) e "(sem tag)" — ajuste seguinte
Logo em seguida, os mesmos dois filtros do Custos foram replicados na página **Itens**:
- **Subcategoria multi-seleção** com chips (reusa `SearchableSelect` + `onPick`; estado `fSub` string → `fSubs` array; restrita à categoria; "Limpar filtros" e troca de categoria zeram).
- Opção **"(sem tag)"** no filtro de Tag (mostra itens com `TAG` vazia — combinável com categoria/subcategoria para achar itens de folha a tagear).

### Changelog técnico — 10/07/2026 (por arquivo)

**Backend**
| Arquivo | O que mudou |
|---|---|
| `src/services/custos.js` | `montarLinha`: tag de folha **opcional** (removido o throw de obrigatoriedade; mantida a checagem de tag existente quando informada). |
| `src/services/itens.js` | Novo `atualizarEmMassa({ ITEM_UUIDS, campo, valor })` (SUB_CATEGORIA/TAG; re-sincroniza os custos dos itens; limpa tag ao virar não-folha) + `CAMPOS_MASSA`. |
| `src/routes/itens.js` | Nova rota `POST /itens/bulk`. |

**Frontend**
| Arquivo | O que mudou |
|---|---|
| `src/components/SearchableSelect.jsx` | Nova prop `onPick(opt)` — dispara só na escolha (clique/Enter), permitindo usar o combo como "adicionador" de multi-seleção. |
| `src/pages/Custos.jsx` | Filtro **Dia** (aparece com Mês/Ano; `diasDisponiveis`); Tag com opção **"(sem tag)"** (`SEM_TAG`/`tagOptions`); **Subcategoria multi** (`fSubcats` + chips, `addSubFiltro`/`removeSubFiltro`); tag de folha **opcional** (validação/label/payload). |
| `src/pages/Itens.jsx` | **Edição em massa** (seleção, barra, modal, `atualizarEmMassa`); filtro **Subcategoria multi** (`fSubs` + chips) e opção **"(sem tag)"** na Tag. |
| `src/api/resources.js` | Novo `itensApi.atualizarEmMassa(body)` (`POST /itens/bulk`). |
| `src/styles.css` | Novas classes `.filtro-chips` / `.filtro-chip` (chips dos filtros multi-seleção). |
| `desktop/package.json` | `version` 1.2.1 → **1.3.1**. |

### Validação
- Backend: `node --check` OK (`custos.js`, `itens.js`, `routes/itens.js`).
- Frontend: `vite build` OK (1256 módulos; único aviso é o de tamanho de chunk, pré-existente).
- **Não** houve escrita contra a planilha real (sem `.env`). **Pendente de teste manual**, com atenção especial à **edição em massa de Itens** (re-sincroniza custos) — testar num item de teste antes de aplicar em massa na base real.

### Pendências em aberto
- Gerar o instalador **1.3.1** (`npm run dist` em `desktop/`, roda `check-env` antes) e validar no PC do cliente (login + `v1.3.1` no rodapé). Herda o fix pendente da sidebar/rolagem @125% e o import de NFS-e em lote, ainda não empacotados num build entregue.

---

## Atualizações — 13/07/2026 — versão 1.3.3

> Sessão de melhorias no fluxo de **classificação de itens** (itens importados sem categoria/subcategoria), pedidas pelo cliente: (1) poder classificar vários itens com subcategorias **diferentes** e confirmar tudo de uma vez, e (2) padronizar o **visual** do campo de subcategoria com o da tela de Custos. Versão do `desktop/package.json` subida para **1.3.3** (build anterior era 1.3.1).

### Classificar itens — "Classificar tudo" (subcategorias variadas por item)

**Antes:** o modal "Classificar itens" tinha dois caminhos — **individual** (botão "Classificar" por linha) e **em massa com a MESMA subcategoria** (marca vários itens e aplica uma subcategoria a todos). Faltava o caso do cliente: ir preenchendo item a item com subcategorias **diferentes** e confirmar tudo no fim — ele era obrigado a clicar "Classificar" linha a linha, o que atrasava o cadastro em massa.

**Agora** (mantendo os dois caminhos anteriores intactos): o cliente preenche o campo de subcategoria de várias linhas — **cada uma podendo ser diferente** — e um botão novo no rodapé **"Classificar tudo (N)"** comita todas de uma vez. O estado por linha (`sel`, ITEM_UUID → subcategoria) **persiste por UUID** enquanto ele busca/filtra, então dá para acumular ao longo de várias buscas. Cada linha com subcategoria válida ganha um indicador **✓ + categoria derivada** (verde) e entra na contagem `N` do botão.

**Backend — performance (foco reforçado pelo gestor):** a classificação variada inteira roda em **2 leituras + 2 escritas**, independente de quantas subcategorias distintas — nada de uma chamada por item. Para isso, nova primitiva genérica `sheets.updateCellsByUuid(tab, updates)` grava várias células (campo/valor por UUID, variando por registro) num **único** `values.batchUpdate`. O serviço `custos.classificarItensLoteVariado({ classificacoes })` valida cada entrada (deriva a categoria da subcategoria pelo mapa fixo + dinâmico), grava os itens e faz o **back-fill** nos custos ainda sem classificação de cada item, com a sub/cat própria daquele item.

### Classificar itens — visual do campo de subcategoria padronizado

**Antes:** os campos de subcategoria do modal usavam `<input list>` + `<datalist>` **nativo** (popup renderizado pelo SO/Chromium — fundo azulado, destoando do tema verde da marca), diferente do filtro de subcategoria da tela de **Lançamento de Custo**, que usa o componente próprio `SearchableSelect`.

**Agora:** os **dois** campos de subcategoria do modal (o de cada **linha** e o da **barra de massa**) usam o mesmo `SearchableSelect` — dropdown no tema da marca, busca sem acento/caixa, idêntico ao de Custos.

**Detalhe técnico (evita corte do dropdown):** o `SearchableSelect` posiciona a lista de forma `absolute`, e dentro da **tabela rolável** do modal (`.table-wrap`/`.modal` com `overflow`) ela seria **cortada**. Foi adicionado um prop **opt-in `fixedMenu`** ao componente: quando ligado, a lista abre com `position: fixed` ancorada ao input (recalculando ao rolar/redimensionar, inclusive rolagem de contêineres internos via listener em modo *capture*), escapando do overflow sem cortar. Como é opt-in, os usos existentes na tela de Custos ficam **inalterados**.

### Changelog técnico — 13/07/2026 (por arquivo)

**Backend**
| Arquivo | O que mudou |
|---|---|
| `src/services/sheets.js` | Nova primitiva `updateCellsByUuid(tab, updates)` — grava várias células (campo/valor por UUID, variando por registro) numa única chamada `values.batchUpdate` (1 leitura p/ mapear UUID→linha + 1 escrita). |
| `src/services/custos.js` | Novo `classificarItensLoteVariado({ classificacoes })` — classifica vários itens com subcategorias diferentes numa passada (valida/deriva categoria, grava itens e back-fill nos custos, tudo em 2 leituras + 2 escritas via `updateCellsByUuid`). Importa a nova primitiva. |
| `src/routes/custos.js` | Nova rota `POST /custos/classificar-lote-variado` `{ classificacoes: [{ ITEM_UUID, SUB_CATEGORIA }] }`. |

**Frontend**
| Arquivo | O que mudou |
|---|---|
| `src/api/resources.js` | Novo `custosApi.classificarLoteVariado(body)` (`POST /custos/classificar-lote-variado`). |
| `src/components/SearchableSelect.jsx` | Novo prop opt-in `fixedMenu` — lista ancorada ao input via `position: fixed`, reposicionando no scroll (capture) e resize; escapa de contêineres com overflow (tabela dentro de modal). Usos existentes inalterados. |
| `src/components/ClassificarItensModal.jsx` | Botão de rodapé **"Classificar tudo (N)"** (memo `preenchidos` + handler `classificarTudo`); indicador ✓/categoria por linha; texto de ajuda com os 3 fluxos. Os dois campos de subcategoria (linha e massa) trocaram `<input list>`+`<datalist>` por `SearchableSelect` com `fixedMenu`; `datalist` antigo removido. |
| `desktop/package.json` | `version` 1.3.1 → **1.3.3**. |

### Validação
- Backend: `node --check` OK (`sheets.js`, `custos.js`, `routes/custos.js`).
- Frontend: `vite build` OK (único aviso é o de tamanho de chunk, pré-existente).
- **Não** houve escrita contra a planilha real (sem `.env`, como nas sessões anteriores). **Pendente de teste manual** no navegador (`npm run dev` em `frontend/`):
  - Preencher subcategorias **diferentes** em 2–3 itens → "Classificar tudo" → conferir a escrita na planilha (itens + back-fill nos custos).
  - Abrir o dropdown de subcategoria numa linha do **meio/fim** da lista e confirmar que aparece por cima da tabela **sem cortar**.

### Pendências em aberto
- Gerar o instalador **1.3.3** (`npm run dist` em `desktop/`, roda `check-env` antes) e validar no PC do cliente (login + `v1.3.3` no rodapé). Continua herdando o fix da sidebar/rolagem @125% e o import de NFS-e em lote, ainda não empacotados num build entregue ao cliente.

---

## Atualizações — 13/07/2026 — versão 1.4.1

> Cinco frentes pedidas pelo cliente, com destaque para a subcategoria virar **editável/excluível de verdade** (a aba `SUBCATEGORIA` passou a ser a fonte da verdade). Versão do `desktop/package.json` subida para **1.4.1**.

### 1 + 2 — Propagação da classificação / criação de subcategoria (refresh)
Diagnóstico confirmado com o gestor: o item importado sem classe **já é** uma linha em `ITENS` (criado vazio na importação) e a fila "a classificar" é derivada de `ITENS`; classificar apenas **atualiza** essa linha. Então "entrar na tabela de item" já ocorre — faltava a **tela refletir**.
- **Item classificado**: as telas Custos/Itens já recarregam ao **fechar** o modal (aparece na listagem com a classificação).
- **Subcategoria criada dentro do "corrigir item"**: era o gap real — o `ClassificarItensModal` gravava no backend mas **não avisava a página-pai**. Novo callback **`onSubcategoriasChanged`** (disparado ao criar subcategoria no modal) faz Custos e Itens recarregarem na hora, então a subcategoria nova passa a aparecer imediatamente no **form de lançamento de item** e na tela **Subcategorias**.

### 3 — Gestão de subcategorias: editar (nome/categoria) + excluir com cascata (inclusive as fixas)
A aba **`SUBCATEGORIA` passou a ser a fonte da verdade** das subcategorias. No 1º boot após esta versão, uma **migração única** semeia na aba todas as subcategorias que antes viviam só no código (`categoriaMap`), controlada por um **marcador** em `SUBCATEGORIA!A2` (linha de notas) — assim a semeadura **não repete** em boots seguintes e **exclusões/renomeações persistem** (sem o marcador, uma fixa excluída ressuscitaria, pois ainda existe no código). `categoriaDe()`/`listarSubcategorias()` passaram a consultar o **dinâmico (aba) primeiro** e o código só como **fallback**.

Na tela **Subcategorias** (página Itens), agora é possível para **qualquer** subcategoria (fixa do sistema ou personalizada):
- **Editar** nome e/ou categoria (edição inline na linha). Ao salvar, o backend **reprocessa em cascata** todos os **itens** e **custos** daquela subcategoria para o novo nome/categoria; se a nova categoria não for de folha, **limpa a TAG** dos afetados. Colisão de nome é bloqueada.
- **Excluir** — em vez de travar quando em uso, **desclassifica**: os itens e custos daquela subcategoria voltam a ficar **sem sub/categoria** (e sem tag) → reaparecem em "a classificar". O `ConfirmDialog` mostra quantos itens/custos serão afetados.
- **Criar** — como antes (aponta para uma categoria fixa; categorias continuam **não** criáveis).

> Nota: a flag "Sistema/Personalizada" ficou apenas **informativa** (não bloqueia mais nada).

### 4 — Editar custo reclassifica o item inteiro (com aviso)
No form de **edição** de um custo, trocar a **categoria/subcategoria** deixou de "resetar o item": agora **mantém o item** e vira uma **reclassificação**. Um aviso aparece no form — *"⚠ Reclassificação: mudar para SUB (CAT) vai alterar o item X e todos os N lançamento(s) dele — não só este"*. Ao salvar, a mudança é aplicada ao **item e a todos os custos dele** (reaproveitando `itens.atualizarEmMassa`, que já sincroniza sub/cat e trata a tag), e só então o custo é gravado — coerente com "o item é a fonte da verdade".

### 5 — Filtro de Mês/Ano multi-seleção (chips)
O filtro **Mês/Ano** da listagem de Custos virou **multi-seleção com chips** (igual ao de Subcategoria): `SearchableSelect` como adicionador (`onPick`) + chips removíveis; o custo entra se o `MES_ANO` estiver **entre** os meses escolhidos — permite avaliar vários meses juntos. O filtro **Dia** só aparece quando há **exatamente 1** mês selecionado (dia entre meses diferentes seria ambíguo).

### 6 — Performance dos campos de busca (virtualização) — trava ao escolher o Item
**Sintoma reportado:** no app desktop, o lançamento manual de custo **travava bastante** ao chegar no campo **Item**.

**Causa:** o campo Item usava `<datalist>` **nativo** renderizando **todas** as opções (podem ser **10 mil+** itens) como `<option>` no DOM — o Chromium/Electron engasga ao montar/filtrar esse popup gigante. O `SearchableSelect` também renderizava **todas** as opções filtradas (sem virtualização) e, se o array de opções fosse recriado a cada tecla, **re-normalizava** dezenas de milhares de strings por keystroke.

**Correção:**
- **`SearchableSelect` virtualizado:** só as ~15–24 linhas visíveis (± overscan) vão ao DOM, com spacers no topo/base preservando a altura total (rolagem coerente) — mantém o "ver todos" que o gestor pediu, sem montar milhares de nós. As opções são **normalizadas uma única vez** (memo por identidade de `options`); filtrar reusa as strings normalizadas (busca por trecho, sem acento/caixa). Navegação por teclado com **scroll-into-view**. Validado em Node com **12k opções**: normalizar 21ms (uma vez), filtrar ~1,2ms/tecla, ~24 nós no DOM (0,2%).
- **Campo Item e Categoria do form** migrados do `<datalist>` nativo para o `SearchableSelect` (com `fixedMenu`, pois o form é um modal). O array de nomes de item (`itemNomes`) é **memoizado** para ter identidade estável entre teclas (senão a normalização de milhares refaria a cada dígito).

**Ajuste seguinte (feedback do cliente — a digitação ainda "engasgava" até achar o item):** a causa remanescente era que **cada tecla** disparava o `onChange` → o `onItemText` do pai roda `resolveItem` (normaliza ~10k itens) e a página Custos inteira re-renderiza e **re-filtra a lista de custos** (`filtrados`), por keystroke. Solução pedida pelo próprio cliente e implementada: **debounce** no `SearchableSelect` — o campo mostra o texto **na hora** (digitação fluida), mas o **filtro e o `onChange`** só disparam quando a pessoa **para de digitar** (prop `debounceMs`, padrão **500ms**). O trabalho pesado passa a rodar **uma vez na pausa**, não a cada tecla. Detalhes: `Enter` com filtro pendente **aplica o filtro na hora** (não seleciona sobre lista desatualizada); escolher/abrir/desmontar cancelam o timer pendente; todos os campos que usam `SearchableSelect` herdam o comportamento.

**Correção — a lista não fechava ao clicar fora (só com Esc):** dentro do form de Custos (um `Modal`), a lista do `SearchableSelect` continuava aberta ao clicar em outro campo/fora, fechando só no `Esc` — dava para ver várias listas abertas ao mesmo tempo. Causa: o fechamento por clique-fora ouvia `mousedown` no `document` em fase de bolha, mas o `Modal` faz `onMouseDown` com **`stopPropagation`** no seu conteúdo, então o evento nunca chegava ao listener. Correção: registrar o listener na **fase de captura** (`addEventListener('mousedown', …, true)`), que roda antes do `stopPropagation` — a lista volta a fechar normalmente ao clicar em qualquer lugar fora dela (só uma aberta por vez), sem afetar a rolagem/seleção dentro da própria lista.

> Recomendação de uso (registrada no próprio componente): sempre passar `options` com **identidade estável** (memoizado no pai). Os demais campos que já usam `SearchableSelect` (Fornecedor, Subcategoria, Tag, Mês) herdam o ganho automaticamente.

### Changelog técnico — 13/07/2026 (por arquivo)

**Backend**
| Arquivo | O que mudou |
|---|---|
| `src/services/sheets.js` | Novos `getCellValue(a1)` / `setCellValue(a1, v)` — leitura/escrita de célula única (marcador de migração fora da área de dados). |
| `src/utils/switch-categoria.js` | `categoriaDe()` e `listarSubcategorias()` passam a usar o mapa **dinâmico (aba) primeiro**, com o `categoriaMap` do código apenas como semente + fallback. |
| `src/services/subcategoria.js` | `carregar()` faz a **migração única** (semeia as fixas na aba, marcador em `A2`). Novo `editar({SUB_CATEGORIA,NOVO_NOME,NOVA_CATEGORIA})` + helper `aplicarCascata()` (rename/move ou desclassificação em ITENS+CUSTOS via `updateCellsByUuid`, limpando TAG quando não-folha). `remover()` reescrito: **desclassifica** itens/custos em vez de bloquear. `criar()` sem o bloqueio de "fixa". `listarGestao()` mantém a flag `fixa` só como informação. |
| `src/routes/itens.js` | Nova rota `POST /itens/subcategorias/editar`. |

**Frontend**
| Arquivo | O que mudou |
|---|---|
| `src/api/resources.js` | Novo `itensApi.editarSubcategoria(body)`. |
| `src/components/SearchableSelect.jsx` | **Virtualização** da lista (só linhas visíveis + spacers), normalização das opções memoizada (uma vez), scroll-into-view no teclado — suporta 10k+ opções sem travar. **Debounce** (`debounceMs`, padrão **500ms**): digitação fluida; filtro/`onChange` só na pausa; `Enter` aplica o filtro pendente. **Fecha ao clicar fora** mesmo dentro de `Modal`: listener de `mousedown` em fase de **captura** (contorna o `stopPropagation` do modal). |
| `src/components/SubcategoriasModal.jsx` | Edição inline (nome + categoria) para qualquer subcategoria; exclusão agora avisa quantos itens/custos voltam para "a classificar"; textos atualizados. |
| `src/components/ClassificarItensModal.jsx` | Novo prop `onSubcategoriasChanged`, disparado ao criar subcategoria (propaga para a página-pai). |
| `src/pages/Itens.jsx` | `onSubcategoriasChanged={carregar}` no `ClassificarItensModal`. |
| `src/pages/Custos.jsx` | **Item 4**: `setCategoria`/`setSubcategoria` cientes de edição (mantêm o item), `reclassificando`/`lancamentosDoItem`, aviso no form e reclassificação (`itens.atualizarEmMassa`) no `confirmarSalvar`. **Item 5**: filtro de Mês multi (`fMesAnos` + chips + `addMesFiltro`/`removeMesFiltro`; `mesUnico`); Dia só com 1 mês. **Item 6 (perf)**: campos **Item** e **Categoria** do form migrados de `<datalist>` para `SearchableSelect` (`fixedMenu`); `itemNomes` memoizado. `onSubcategoriasChanged={carregar}` no modal. |
| `desktop/package.json` | `version` 1.3.3 → **1.4.1**. |

### Validação
- Backend: `node --check` OK (`sheets.js`, `switch-categoria.js`, `subcategoria.js`, `routes/itens.js`).
- Frontend: `vite build` OK (único aviso é o de tamanho de chunk, pré-existente).
- **Performance** (item 6): lógica de filtro + janela virtual do `SearchableSelect` testada em Node com **12k opções** — normalizar 21ms (uma vez), filtrar ~1,2ms/tecla (busca sem acento OK), ~24 nós no DOM por vez (0,2%), altura total preservada.
- **Não** houve execução contra a planilha real (sem `.env`). **Pendente de teste manual**, com atenção especial (mexem em dados em cascata):
  - **Migração**: no 1º boot, conferir que a aba `SUBCATEGORIA` recebe as fixas e o marcador em `A2`; nos boots seguintes não re-semeia.
  - **Editar subcategoria**: renomear/mover e conferir que itens+custos foram reprocessados (e tag limpa quando vira não-folha).
  - **Excluir subcategoria**: itens/custos voltam para "a classificar" (sem sub/cat) e a subcategoria **não** ressuscita ao reiniciar.
  - **Editar custo** com troca de subcategoria: confirmar o aviso e que o item + todos os lançamentos dele foram reclassificados.
  - **Filtro multi-mês**: somar/avaliar vários meses; Dia aparece só com 1 mês.
  - **Performance (item 6)**: no app desktop empacotado, abrir o combo de **Item** no lançamento manual com a base real (~10k) e confirmar que **não trava** ao abrir/digitar/rolar/selecionar.

### Pendências em aberto
- Gerar o instalador **1.4.1** (`npm run dist` em `desktop/`) e validar no PC do cliente (login + `v1.4.1` no rodapé). Segue herdando o fix da sidebar/rolagem @125% e o import de NFS-e em lote, ainda não empacotados num build entregue.
- (Opcional) A flag "Sistema/Personalizada" na gestão de subcategorias ficou só informativa — avaliar se ainda faz sentido exibir agora que tudo é editável.

---

## Atualizações — 14/07/2026 — versão 1.5.1 (em preparação)

> Sessão focada em **dashboards e exportação de relatórios**, mais um ajuste de **login** no app desktop. Trabalho pedido "aos poucos", dash a dash. **Sem mudança de backend** em nenhum ponto (tudo frontend). A versão do `desktop/package.json` **ainda não foi subida** para `1.5.1` — só ao gerar o build.

### Abertura do app (desktop) — login persistente
**Problema:** o token JWT expira em 7 dias e não havia credencial salva, então o gestor redigitava usuário/senha a cada tanto. **Solução:** login persistente com auto-login opcional.
- **`client.js`:** novos `saveCredentials` / `getCredentials` / `clearCredentials` (guardadas neste computador em base64 — **não é criptografia**; coerente com o modelo do app, que já leva o `.env` em texto puro no disco).
- **`Login.jsx`:** checkbox **"Manter-me conectado neste computador"** (marcado por padrão). Ao abrir, se há credencial salva faz **auto-login silencioso** (mostra "Entrando…" e vai direto ao dashboard). Se a senha salva estiver errada (mudou no `.env`), limpa e volta ao form — sem loop.
- **`Layout.jsx`:** o **"Sair"** agora limpa também a credencial salva (logout de verdade).

### Dash Custos — relatório com quebra por mês
Na exportação PDF, **"Composição por grupo"** e **"Custos por categoria"** saíam como um total único do período. Agora, quando o período tem **2+ meses e nenhum mês está selecionado**, ambos saem **separados mês a mês** (tabelas: mês nas linhas; grupos/categorias nas colunas; Subtotal + Total). Com 1 mês (ou mês clicado), mantém o formato de barras do total. Respeita o drill ativo.

### Dash Custos — ver notas de um item
Nova coluna **"Notas"** na tabela "Top N itens" com botão **📄 ver** → abre o **`NotasItemModal`**, listando **todas as notas em que o item aparece** (data, nº, fornecedor, total, chave NF-e) e **todos os itens de cada nota** (item, subcategoria, qtd, V. unit, V. total), com a linha do item destacada. Identidade da nota: `CHAVE_NFE` quando existe; senão fornecedor + nº + data.

### Dash Custos — PDF: alinhamento + "Período anterior"
- **Alinhamento:** o cabeçalho das colunas numéricas do `autoTable` ficava à esquerda enquanto os valores iam à direita. Novo hook **`rightAlignNumCols` (didParseCell)** força alinhamento à direita em **cabeçalho + corpo + rodapé** de todas as tabelas dos relatórios (Custos, Folha e Período). Nos gráficos de barras vetoriais (categoria/grupo), os valores passaram a ser **right-align** numa coluna fixa.
- **Período anterior:** a tabela "Top N itens" no PDF ganhou a coluna **Período anterior** (faltava) + rótulo **`Coluna "Período anterior" refere-se a: MM/YYYY – MM/YYYY`** (a janela anterior de mesmo tamanho).

### Visões avançadas — nova página na sidebar
A análise **"Evolução de preço médio × quantidade"** nasceu como uma seção experimental no Dash Custos (junto de rascunhos de fornecedor/ABC/variações, depois descartados) e, por decisão de estrutura, virou uma **página própria**: **`/dash/avancado` (`DashAvancado.jsx`)**, na seção Dashboards da sidebar, como **hub** que pode crescer (e abraçar Folha no futuro) sem inchar os dashboards operacionais.
- **A visão:** escolhe **Categoria → Subcategoria** (cascata; subcategoria opcional) e vê, mês a mês, o **preço médio ponderado** (Σ valor ÷ Σ quantidade, eixo esquerdo/coral) e a **quantidade pedida** (eixo direito/teal). Usa `QTD`/`VALOR_UNIT`, antes ignorados. Autocontida (seus próprios selects), respeitando só o filtro de período.
- **Caveat na tela:** itens de unidades diferentes dentro do recorte são somados → leia como "preço médio por unidade pedida". O Dash Custos voltou a ficar enxuto (a seção experimental foi removida).

### Dash Folha — 4 ajustes + flag
1. **Tooltip branco:** os tooltips da pizza "Participação por Tag" **e** do gráfico "Evolução mensal" tinham texto escuro sobre fundo escuro (ilegível). Ajustados para **texto branco** (`#f1f3f5`) mantendo o fundo verde.
2. **Cruzamento Tag × Categoria por mês:** botão **👁 Ver por mês** abre o **`CruzamentoMesModal`** (mesma tabela, **uma por mês** do período, cada uma com Subtotal + Total) com **exportação própria em PDF** (`exportarCruzamentoMensalFolha` → `cruzamento-folha-mensal-*.pdf`). Respeita os filtros ativos.
3. **Multi-tag (filtro real):** o filtro de Tag virou **multi-seleção** (adicionador + chips). Deixou de ser um "drill que mantinha tudo visível" e passou a **filtrar na base** — agora **todas** as visões (pizza, Subtotal por Tag/Item, cruzamento, KPIs e **PDF**) refletem só as tags escolhidas. Clicar na fatia/linha adiciona/remove a tag. (Corrige o problema de o PDF/tabela mostrarem todas as tags mesmo com filtro.)
4. **Flag "Ocultar folha sem tag":** checkbox no topo (padrão desligado). Ligado, descarta os lançamentos **sem tag** de **todas** as visões (filtra na base), unificando o comportamento (antes a pizza já ignorava, mas KPIs/cruzamento incluíam).
5. **Correção — linha "(sem tag)" no cruzamento:** o refactor de multi-tag introduziu um `.filter(Boolean)` que removia a folha **sem tag** do cruzamento (subtotal ficava menor que o total real). Restaurada como linha **"(sem tag)"** (no dashboard, no modal por mês e no PDF).

### Dash Análise por Período — filtros + análises novas + relatório
1. **Filtros que afetam gráficos, itens e PDF:** **Custos** ganhou **Categoria (single) + Subcategoria (multi, chips)**; **Folha** ganhou **Categoria/unidade (single) + Tag (multi, chips)**. *(Folha não tem subcategoria nem QTD nos dados — o mapa `custoParaFolha` só carrega TAG/ITEM_FOLHA/VALOR/CATEGORIA.)* Aplicados aos **dois períodos** antes de comparar.
2. **"Quantidade de itens":** **Nº de lançamentos A/B** nos KPIs (`TotaisAB`) e no cabeçalho do PDF.
3. **Limitador Top N itens:** campo na barra de filtros (padrão 15) que limita a tabela do "Comparativo por Item" na tela (nota "Mostrando os N maiores de M") **e no PDF** (título "…(top N)") — resolvendo a tabela gigante/feia de item no relatório.
4. **Contribuição para a variação (bridge):** gráfico em **cascata** (Total A → contribuições ↑ oliva / ↓ vinho → Total B) por **Categoria** (Custos) e **Tag** (Folha). **Só na tela** (removido do PDF a pedido).
5. **Preço médio × quantidade A×B (Custos):** tabela por subcategoria com **Qtd A/B (+Δ)** e **Preço médio A/B (+Δ)** — separa se o gasto mudou por preço ou por volume. Vai ao PDF **com as colunas de Δ** (Δ Qtd e Δ Preço).
6. **Composição por grupo A×B:** Custos = CMV/Despesas/Folha; Folha = unidades (Canoas/POA/Tele) — reusa o gráfico A×B + tabela e entra no PDF como mais uma seção.
7. **PDF do período:** ganhou linha de **Filtros** e de **Lançamentos A/B** no cabeçalho.

### Changelog técnico — 14/07/2026 (por arquivo, tudo frontend)

| Arquivo | O que mudou |
|---|---|
| `src/api/client.js` | Novos `saveCredentials`/`getCredentials`/`clearCredentials` (login salvo em base64 no `localStorage`, chave `kampeki_login`). |
| `src/pages/Login.jsx` | Prefill + checkbox "Manter-me conectado" + auto-login com credenciais salvas (uma vez; limpa se inválidas). |
| `src/components/Layout.jsx` | `sair()` limpa também a credencial salva; novo link **"Visões avançadas"** (`/dash/avancado`) na sidebar. |
| `src/App.jsx` | Rota `/dash/avancado` → `DashAvancado`. |
| `src/pages/dash/DashAvancado.jsx` | **Novo** — página "Visões avançadas": evolução de preço médio ponderado × quantidade por categoria/subcategoria. |
| `src/components/NotasItemModal.jsx` | **Novo** — notas em que um item aparece + itens de cada nota. |
| `src/components/CruzamentoMesModal.jsx` | **Novo** — cruzamento Tag × Categoria quebrado por mês (Folha) + export PDF próprio. |
| `src/pages/dash/DashCustos.jsx` | Export por mês (composição/categoria); coluna/botão "Notas"; `periodoAnteriorLabel`; (seção avançada adicionada e depois removida ao migrar para `DashAvancado`). |
| `src/pages/dash/DashFolha.jsx` | Tooltip branco (pizza + evolução); multi-tag como filtro de base; flag "Ocultar folha sem tag"; botão 👁 "Ver por mês" + modal; cruzamento com "(sem tag)". |
| `src/pages/dash/DashPeriodo.jsx` | Filtros Categoria/Subcategoria(multi)/Tag(multi) + Top N itens; `TotaisAB` com nº de lançamentos; `BridgeChart` (cascata); `precoQtdPorSub` + tabela preço×qtd; composição por grupo/unidade; `ComparativoSecao` com `maxRows`. |
| `src/utils/exportPdf.js` | `rightAlignNumCols` (didParseCell) em todas as tabelas; right-align nos valores de `barrasCategoria`/`barrasGrupo`; `tabelaGrupoMes`/`tabelaCategoriaMes` (custos por mês); coluna "Período anterior"; `exportarCruzamentoMensalFolha` (**novo**); `exportarRelatorioPeriodo` com filtros/contagens/preço×qtd (Δ) e item limitado ao top N (bridge **não** vai ao PDF). |
| `src/styles.css` | `.login-remember` (checkbox do login). |

### Validação
- Frontend: `vite build` OK a cada etapa (1256+ módulos; único aviso é o de tamanho de chunk, pré-existente). Sem referências órfãs (grep após cada refactor).
- Backend: **inalterado** nesta sessão.
- **Pendente de teste manual no navegador** (`npm run dev`), com atenção a: auto-login (marcar/fechar/reabrir); PDFs de Custos (quebra por mês, alinhamento, período anterior), Folha (👁 por mês, multi-tag, flag sem-tag) e Período (filtros multi, Top N, preço×qtd com Δ, bridge só na tela).

### Pendências em aberto
- **Subir `desktop/package.json` → `1.5.1`** e gerar/validar o instalador (herda o fix da sidebar/rolagem @125% e o NFS-e em lote, ainda não empacotados num build entregue).
- Rascunhos descartados nesta sessão (ranking por fornecedor, curva ABC, maiores variações, KPIs de comparação) — podem voltar como "Visões avançadas" se o gestor quiser.
- Reflexo no PDF de análises da página "Visões avançadas" (hoje ela não exporta) — avaliar quando o layout estabilizar.

---

## Atualizações — 16/07/2026 — versão 1.5.2 (em preparação)

> Sessão de **correção de bug**: o "Manter-me conectado" (entregue na 1.5.1) não funcionava no app instalado. A causa não era o login — era a **porta sorteada** a cada abertura. Diagnóstico com evidência, correção validada rodando o app real, e o registro de uma pendência de segurança que a correção expõe. Versão do `desktop/package.json` **ainda não foi subida** para `1.5.2` — só ao gerar o build (mesmo procedimento da 1.5.1).

> **Atualização de estado (fecha pendência anterior):** a v1.5.1 foi **commitada** (`b0405eb`, 15/07), **empacotada** (`KampekiFinance-Setup-1.5.1.exe`, 16/07) e **instalada no cliente** — o que a seção anterior ainda listava como pendente.

### Bug — "Manter-me conectado" não persistia no app instalado

**Sintoma:** cliente instalou a 1.5.1 e relatou que o login salvo não funciona — redigita usuário/senha a cada abertura.

**Causa:** o Electron subia o backend com `startServer({ port: 0 })` → **porta sorteada pelo SO a cada abertura** → a janela carregava `http://127.0.0.1:<porta>`. O `localStorage` do Chromium é **isolado por origem, e a origem inclui a porta** — então cada abertura era uma origem **nova e vazia**. As credenciais (`kampeki_login`), o token (`kampeki_token`) e o **zoom** (`kampeki_zoom`) eram gravados numa origem que nunca mais seria aberta. Nada estava errado no `Login.jsx`/`client.js`.

**Evidência:** o `Local Storage` do app instalado (`%APPDATA%\kampeki-desktop\Local Storage\leveldb`) tinha **16 origens acumuladas**, uma por execução (`127.0.0.1:50578`, `:53325`, `:59939`, … — todas na faixa 49152–65535).

**Por que passou na validação da 1.5.1:** no dev (`npm run dev`) o Vite usa a porta fixa 5173 — origem estável, auto-login funciona. O defeito só existe no app empacotado.

**Correção — porta fixa com fallback:**
- **`desktop/main.js`:** porta escolhida de `[43117, 43118, 43119]`, testada com um probe (`net.createServer`) **antes** de subir o backend — assim uma porta ocupada não custa um `initSheets` (lento) por tentativa; `0` (sorteio do SO) só como último recurso. **43117 fica fora da faixa dinâmica do Windows (49152–65535)** — confirmada com `netsh int ipv4 show dynamicport tcp` —, que é de onde o SO tira portas para outros programas: colisão é improvável **por construção**.
- **`backend/src/app.js`:** `startServer` ganhou `server.once('error', reject)`. Sem isso, um `EADDRINUSE` seria um evento `'error'` **sem ouvinte** = exceção não tratada derrubando o app — ou seja, **o fallback não existiria**. O standalone segue em `PORT || 3001`.

**Degradação suave (importante):** se a 43117 estiver ocupada, o app abre na 43118 e perde o login salvo **apenas daquela sessão** — nunca fica pior que o comportamento atual. Quando a porta libera, volta sozinho para a origem onde o login está.

### Decisão registrada — por que **não** guardar as credenciais num arquivo local

Alternativa levantada pelo gestor: gravar usuário/senha num arquivo e procurá-lo no boot. **Descartada por custar mais e resolver menos:**

- **Custa mais:** a janela roda com `contextIsolation: true` / `nodeIntegration: false` e **não existe preload** — o React não tem acesso a `fs`. Exigiria um `preload.js` novo + `contextBridge` + 3 `ipcMain.handle`, tornar `getCredentials`/`saveCredentials` **assíncronas** no `client.js` (com fallback para `localStorage`, senão quebra o dev no navegador) e refazer o prefill **síncrono** do `Login.jsx` (`useRef(getCredentials()).current` → efeito + estado + loading). ~4 arquivos e um caminho duplo (Electron × navegador) para manter vivo. A porta fixa foram **2 arquivos**.
- **Resolve menos:** o arquivo cobre **só as credenciais**; **token e zoom continuariam zerando** a cada abertura, e qualquer novo uso de `localStorage` quebraria silenciosamente. A porta é a **doença**; o arquivo é curativo num sintoma.
- **Armadilha evitada:** fazer o **backend** guardar o arquivo (fugindo do preload) exigiria um endpoint **público** devolvendo usuário/senha em texto na porta fixa — trocaria um bug de usabilidade por um buraco de segurança.
- **Onde a ideia está certa:** é imune à porta. Fica como **plano B**, aplicável **em cima** do que já foi feito (sem retrabalho), se o cliente relatar que o login sumiu de novo — o que indicaria colisão na 43117.

### Pendência de segurança — CORS aberto + porta previsível (decisão pendente)

Com a porta fixa, o endereço do app vira **previsível**, e o backend está com **`app.use(cors())` liberado com wildcard** (`backend/src/app.js:35`). Na prática, uma página maliciosa aberta no navegador do cliente poderia bater no `POST /api/auth/login` (rota **pública**, sem rate-limit) **e ler a resposta** — tentativa de senha contra o app local. O risco é baixo (exige atacar este alvo específico) e o delta é pequeno (a porta aleatória era obscuridade fraca — dá para varrer 16 mil portas em segundos), **mas é real e fica registrado**.

Correção proposta (1 linha, **não aplicada — aguardando aval do gestor**): restringir/remover o `cors()`. Verificado que é seguro: o front **sempre** chama `/api` na **mesma origem** — no app empacotado o Express serve o build; no dev o proxy do Vite é server-side (`frontend/vite.config.js`). Nenhum dos dois depende de CORS.

### Changelog técnico — 16/07/2026 (por arquivo)

| Arquivo | O que mudou |
|---|---|
| `desktop/main.js` | Novos `PORTAS_PREFERIDAS = [43117, 43118, 43119]`, `portaLivre(porta)` (probe com `net`) e `escolherPorta()` (testa antes de subir o backend; `0` como último recurso). `startBackend` usa a porta escolhida e cai para `0` na corrida rara de a porta ser tomada entre o probe e o listen. Comentário explicando por que a porta precisa ser estável (origem do `localStorage`). |
| `backend/src/app.js` | `startServer` agora **rejeita** em falha de bind (`server.once('error', reject)`, removido no listen bem-sucedido) — sem isso o `EADDRINUSE` era exceção não tratada. Docstring atualizada (o Electron não passa mais `port: 0`). |

### Validação (desta vez rodando o app real — `desktop/build/.env` presente na máquina de dev)

- **Mecanismo** (harness Electron com perfil descartável, mesmo Electron do projeto): mesma porta → credencial volta ✓; **porta diferente → vem vazia** (bug do cliente reproduzido) ✗; voltando à porta original → credencial **ainda lá** ✓. Prova que o dado nunca foi apagado, só ficava inalcançável.
- **App real, 2 aberturas seguidas:** ambas em **43117**, com a planilha carregando (`[initSheets] Todas as abas já existem`).
- **Fallback:** com a 43117 ocupada por outro processo, o app subiu na **43118 sem crash**; liberada a porta, voltou sozinho para a **43117**.
- **Sem regressão no dev:** backend standalone sobe em **3001**; com a 3001 ocupada, a mensagem segue clara (`Error: listen EADDRINUSE: address already in use 127.0.0.1:3001`) e o processo encerra como antes. `npm run dev` (5173 + proxy) inalterado. O **frontend não foi tocado**.
- `node --check` OK em `backend/src/app.js` e `desktop/main.js`.
- Nota de campo: conexões em `TIME_WAIT` na 43117 **não** impedem o bind — reabrir o app em sequência funciona.

### Efeito para o cliente

- Precisa instalar o `.exe` novo (a correção está no build).
- **Digita o login uma vez:** o que estava salvo ficou órfão numa origem antiga e **não é resgatável**. Daí em diante persiste (fechar/abrir → entra sozinho).
- **Zoom** também volta ao padrão uma vez; reajusta e passa a persistir (hoje reseta a cada abertura — ele talvez não tenha reparado).
- **Nada mais muda:** mesma tela, mesmos dados, **nenhuma escrita no Sheets**. Sem aviso de firewall (segue em loopback `127.0.0.1`, como já era).
- As origens antigas acumuladas ficam como lixo inofensivo (alguns KB) no `%APPDATA%`.

### Pendências em aberto
- **Decidir o aperto do CORS** (recomendado) — ver seção acima.
- **Subir `desktop/package.json` → `1.5.2`** e gerar/validar o instalador (hoje ainda em **1.5.1**); confirmar no cliente: login persiste ao fechar/reabrir e **`v1.5.2`** no rodapé.
- Plano B do arquivo de credenciais (preload/IPC) — só se a 43117 colidir na máquina do cliente.

---

## Atualizações — 16/07/2026 — versão 1.5.3 (em preparação)

> Melhorias de **drill-down nas dialogs de detalhe**, pedidas pelo cliente ainda para a linha 1.5: a dialog de item do Dash Custos passa a respeitar os filtros da tela e a mostrar o Fornecedor, e a **Análise por Período** ganha dialogs de detalhe A×B encadeadas, todas exportáveis em PDF. **Sem mudança de backend** (tudo frontend). Versão do `desktop/package.json` **ainda não subida** para `1.5.3` — só ao gerar o build.

### 1. Dash Custos — a dialog de notas do item não respeitava os filtros

**Sintoma:** a dialog aberta pelo "📄 ver" (coluna Notas do "Top N itens") mostrava notas de **qualquer data**, ignorando o filtro de período/mês da tela.

**Causa:** `DashCustos.jsx` passava `custos={custos}` — a **lista completa vinda da API**, sem período, mês nem drill. As demais visões do dashboard usam a base recortada (`filtrado`); só a dialog escapava.

**Correção:** a dialog passou a receber **`custos={filtrado}`** — a mesma base que alimenta a tabela "Top N itens" de onde o botão sai (período → mês → categoria → subcategoria). Ou seja, a dialog reflete exatamente o recorte da tela. Recebe também `periodoLabel`/`filtrosLabel` para exibir (e imprimir no PDF) qual recorte está em vista.

### 2. Dash Custos — Fornecedor na dialog (e a virada de formato)

**Decisão de modelagem (alinhada):** perguntado se a nota deveria aparecer **inteira** (todos os seus itens, como era) ou **só as linhas do filtro**, o gestor escolheu **só as linhas do filtro** — a visão é sobre o **item**, não sobre a nota.

**Consequência (proposital):** o card por nota deixou de fazer sentido (quase sempre teria 1 linha), então a dialog virou uma **tabela plana de lançamentos do item**: `Data · Nº Nota · Fornecedor · Subcategoria · Qtd · V. Unit · V. Total` + linha de **TOTAL**. É nesse formato que o **Fornecedor** (item 2 do pedido) entra como coluna, e cada linha passa a ser autossuficiente — o que também vale para o PDF.

- O **total exibido é o do ITEM no recorte** (não o total das notas) — coerente com a escolha acima; os itens vizinhos da mesma nota não entram.
- A **chave NF-e** (44+ díg.) estouraria a coluna: fica no **tooltip** do Nº da nota, sinalizada por um 🔑.

### 3. Análise por Período — dialogs de detalhe A×B (drill encadeado)

Clicar numa linha das seções **"Composição por grupo"**, **"Comparativo por Categoria"**, **"Comparativo por Subcategoria"** e **"Comparativo por Item"** (aba **Custos**) abre o novo **`DrillPeriodoModal`**, que **desce de nível** a cada clique, com **breadcrumb** para voltar:

```
Grupo ─┐
       ├─→ Subcategorias ─→ Itens ─→ Notas (A e B separados)
Categoria ─┘
```

- **Decisão (alinhada):** drill **encadeado com breadcrumb**, em vez de uma dialog por seção que para no primeiro nível. Atende o "ver as notas de cada um" pedido na subcategoria e, de brinde, dá o mesmo caminho a partir de grupo/categoria.
- **Navegação de volta (ajuste pedido logo em seguida):** o breadcrumb já permitia voltar clicando num nível anterior, mas era discreto demais — parecia só o texto do caminho. Ganhou um botão explícito **"← Voltar"** (volta **um** nível; some no primeiro, onde só resta Fechar), com o breadcrumb ao lado para **pular direto** para qualquer nível do caminho (com `title` "Voltar para …"). Como o CSS do breadcrumb estilizava *todos* os botões filhos (o que achataria o botão novo), a regra foi escopada para `.crumb`.
- **Nível de notas:** para o item em foco, uma tabela **por período** (Período A e Período B, um abaixo do outro), cada uma com `Data · Nº · Fornecedor · Subcategoria · Qtd · V. Unit · V. Total` + TOTAL. Mesmo formato e mesma regra ("só as linhas do item") da dialog do Dash Custos.
- **Respeita sempre os Períodos A e B** (e os filtros de Categoria/Subcategoria da tela): as bases `a`/`b` chegam prontas do dashboard e **todo** nível do caminho é aplicado às duas.
- Cada nível mostra **Total A · Total B · variação** no topo, e a tabela tem **rodapé de TOTAL** — dá para conferir na hora que o detalhamento **fecha** com a linha que foi clicada.
- **Aba Folha:** ficou **fora** (decisão alinhada). A folha não tem nota — `custoParaFolha` carrega só `TAG`/`ITEM_FOLHA`/`VALOR`/`CATEGORIA`, sem `NUM_NOTA`/`FORNECEDOR`/`DATA_NOTA`.

**Detalhe que evitou um bug de reconciliação:** o `groupSum` **descarta chave vazia**, e o grupo **"Outros"** é justamente onde caem os custos **sem categoria/subcategoria** (itens "a classificar"). Um drill ingênuo em "Outros" mostraria uma tabela **que não fecharia** com o valor da linha clicada. Por isso o detalhamento usa o rótulo **`(sem subcategoria)`** (mesma solução que o `precoQtdPorSub` já adotava), e o total bate. *Nota: a tabela "Comparativo por Subcategoria" da página continua omitindo os sem-subcategoria (comportamento do `groupSum`); dentro da dialog eles aparecem, porque ali o total precisa fechar com o pai.*

### 4. PDF de todas as dialogs (botão no topo)

Toda dialog tem **"⬇ Exportar PDF"** no topo, exportando **exatamente o que está na tela** dela:
- **`exportarNotasItem`** (Dash Custos): cabeçalho com item, **período e filtros ativos**, contagem e total; tabela dos lançamentos + TOTAL.
- **`exportarDrillPeriodo`** (Análise por Período), dois modos:
  - **detalhamento** → gráfico **A×B** (reusa `barrasAB`) + tabela com Δ absoluto/percentual e **rodapé de TOTAL**;
  - **notas** → uma tabela de lançamentos **por período** (A e B), cada uma com seu total.
  - Cabeçalho traz o **caminho do breadcrumb** (`CMV › SALMÃO › SALMÃO FRESCO 5KG`), os rótulos de A e B, os filtros e os KPIs A/B/variação.

### Changelog técnico — 16/07/2026 (por arquivo, tudo frontend)

| Arquivo | O que mudou |
|---|---|
| `src/utils/agg.js` | Ganhou `GRUPOS`/`grupoDe` e `comparar` (vindos do `DashPeriodo`, que tinha cópia local) — agora compartilhados com a dialog. *(O `DashCustos` mantém a cópia própria de `GRUPOS`, que carrega as cores dos gráficos.)* |
| `src/utils/notas.js` | **Novo** — `dataOrdenavel`, `linhasDoItem(rows, item)` (normaliza + ordena por data desc; **só as linhas do item**), `somaLinhas`, `qtdFmt`. |
| `src/utils/drillPeriodo.js` | **Novo** — lógica pura do drill fora do componente (para ser testável): `NIVEIS` (predicado + próximo nível + título), `KEY_FN`, `LABEL_COL`, `SEM_SUB`, `valCusto`, `aplicarCaminho(rows, stack)`. |
| `src/components/NotasItemModal.jsx` | Reescrito: tabela plana do item (**com Fornecedor**), TOTAL, chave NF-e no tooltip, cabeçalho com período/filtros e botão **⬇ Exportar PDF** no topo. Base já filtrada via prop. |
| `src/components/DrillPeriodoModal.jsx` | **Novo** — dialog encadeada (breadcrumb, Total A/B/variação, tabela com Δ e rodapé de TOTAL; nível de notas com A e B separados) + PDF no topo. |
| `src/utils/exportPdf.js` | Novos `exportarNotasItem` e `exportarDrillPeriodo` (+ helpers `cabecalhoDialog`, `tabelaNotas`, `tituloSecao`, `semDados`, `slug`, `hoje`). Reusa `rodape`/`ensureSpace`/`barrasAB`/`rightAlignNumCols`. |
| `src/pages/dash/DashCustos.jsx` | Dialog recebe **`filtrado`** (era `custos`) + `periodoLabel`/`filtrosLabel`; novos memos `periodoLabelAtual`/`drillLabel` (o `exportarPdf` passou a reusá-los em vez de recalcular). |
| `src/pages/dash/DashPeriodo.jsx` | Importa `comparar`/`grupoDe` do `agg.js` (cópias locais removidas); `ComparativoSecao` ganhou `onRowClick` (linhas clicáveis + dica no título); estado `drill` e render do `DrillPeriodoModal` nas 4 seções da aba Custos. |
| `src/styles.css` | Novas classes `.drill-crumbs` (breadcrumb da dialog). |

### Validação

- Frontend: `vite build` OK (único aviso é o de tamanho de chunk, pré-existente).
- **Lógica do drill exercitada em Node contra os módulos reais** (`agg.js`/`notas.js`/`drillPeriodo.js`), com base sintética de 2 meses incluindo um custo **sem categoria** — **17/17**:
  - detalhamento de **CMV fecha** com a linha clicada (A e B);
  - detalhamento de **"Outros"** rotula `(sem subcategoria)` e **fecha** (o caso que quebraria);
  - caminho encadeado **grupo → subcategoria → itens** correto, com `novo`/queda no Δ%;
  - nível de notas: A e B separados, totais batendo com a linha do item e **sem vazar o item vizinho da mesma nota**;
  - drill direto por categoria.
- **PDFs gerados e conferidos por extração de texto** (pdfjs-dist sobre os arquivos reais) — **26/26**: os 5 cenários (notas do item, notas vazio, detalhamento A×B, notas A×B, sem dados) geram PDF válido; conferidos coluna **Fornecedor**, período/filtros no cabeçalho, caminho do breadcrumb, KPIs A/B/variação, linha de TOTAL, `novo`, seções Período A/B e o rodapé paginado. Casos vazios **não quebram**.
- Backend: **inalterado**.
- **Pendente de teste manual no navegador** (`npm run dev`): clicar nas linhas das 4 seções, navegar pelo breadcrumb e baixar os PDFs de cada nível.

### Pendências em aberto
- **Subir `desktop/package.json` → `1.5.3`** e gerar/validar o instalador (herda a correção do login persistente da 1.5.2 e o aperto de CORS, se aprovado).
- Aba **Folha** da Análise por Período segue sem drill (sem dados de nota) — se o gestor quiser, dá para fazer Unidade → Tag → Item, parando no item.

---

## Atualizações — 20/07/2026 — versão 1.5.4 (em preparação)

> Sessão de **melhoria das dialogs de notas do Dash Custos**, pedida pelo gestor: uma faixa de resumo no topo e a mesma análise estendida do item único para **todos os itens do recorte**. **Sem mudança de backend** (tudo frontend).

> **Atualização de estado (fecha pendências anteriores):** a v1.5.3 foi **commitada** (`6f23c1f`, 16/07 18:08), teve o `desktop/package.json` **subido para 1.5.3** e foi **empacotada** (`KampekiFinance-Setup-1.5.3.exe`, 16/07 16:54) — o que a seção da 1.5.3 ainda listava como pendente. Segue pendente apenas a **decisão do aperto do CORS**.

### 1. Faixa de resumo nas dialogs de notas

A dialog de notas mostrava só "N lançamento(s) · Total". Ganhou uma **faixa de KPIs** no topo (componente novo `ResumoNotas.jsx`, compartilhado pelas duas dialogs):

| Notas | Subcategoria(s) | Qtd | V. Unit médio | V. Total |
|---|---|---|---|---|

- **Notas × lançamentos:** são números diferentes e **ambos aparecem** (o de notas em destaque, o de lançamentos abaixo). Uma nota que traz 3 itens conta **1 nota / 3 lançamentos**; o mesmo item lançado 2x na mesma nota conta **1 nota / 2 lançamentos**. Identidade da nota: `CHAVE_NFE` quando existe, senão `fornecedor + nº + data` (o mesmo critério desde a 1.5.1).
- **Subcategorias:** com uma, mostra o **nome**; com várias, mostra **quantas** e lista todas no tooltip (o "pode ser N aqui" do pedido — os nomes de todas estourariam a faixa).
- **V. Unit médio é PONDERADO** (`Σ V.Total ÷ Σ QTD`), não a média simples dos `VALOR_UNIT`: é o único que **fecha com o total** (`preço médio × qtd = total`). Mesmo critério do "preço médio ponderado" da página Visões avançadas. Fica `—` quando não há quantidade (sem QTD não existe preço unitário representável, e evita divisão por zero).

### 2. Nova dialog — notas de **todos** os itens do recorte

A análise existia só item a item (botão "📄 ver" da linha). Agora o card **"Top N itens"** tem no cabeçalho **"📄 ver notas de todos os itens"**, que abre a `NotasFiltroModal` com a **mesma faixa de resumo**, agora sobre **todo o recorte ativo** (período → mês → drill de categoria/subcategoria — a mesma base `filtrado` das demais visões).

- **Tabela agrupada por item** (maior total primeiro): `Item · Notas · Qtd · V. Unit médio · V. Total · % do total`, com **TOTAL** no rodapé. Clicar na linha **expande** os lançamentos daquele item (`Data · Nº · Fornecedor · Subcategoria · Qtd · V. Unit · V. Total`), mais "Expandir/Recolher todos".
- **Por que agrupado e não plano:** um recorte amplo tem milhares de linhas; a lista plana seria ilegível. O agrupamento dá o panorama e o detalhe sob demanda.
- **"Notas" do TOTAL é a contagem DISTINTA do recorte, não a soma da coluna** — uma nota com 3 itens conta 1 no total e 1 em cada item, então a soma da coluna é naturalmente maior. Coberto por teste.
- **Caveat na tela:** com 2+ itens, `Qtd` e `V. Unit médio` somam **unidades diferentes** (kg + un + cx) — a dialog exibe o aviso "leia como *por unidade pedida*" (mesmo caveat da Visões avançadas). Na dialog de item único o aviso não aparece (um item, uma unidade).

### 3. Itens "a classificar" não inflam mais a contagem de subcategorias

**Achado durante os testes** (não era do pedido): a normalização das linhas troca `SUB_CATEGORIA` vazia pelo placeholder de exibição `—`, e o resumo contava esse `—` **como se fosse uma subcategoria**. Num recorte com itens a classificar, a faixa diria "3 subcategorias" havendo 2 reais.

**Correção:** o resumo rotula essas linhas como **`(sem subcategoria)`** — a **mesma convenção** que o drill da Análise por Período já adotava (`SEM_SUB` em `drillPeriodo.js`), agora reusada em vez de duplicada. O usuário vê que parte do recorte está a classificar, em vez de um número inflado.

### 4. PDF das duas dialogs

- **`exportarNotasItem`** ganhou a faixa de resumo (mesmos KPIs da tela).
- **`exportarNotasFiltro`** (novo): resumo + tabela por item com TOTAL e, abaixo, os lançamentos **apenas dos itens expandidos** na dialog — mantém a regra "o PDF sai exatamente como a tela" e evita um PDF gigante. Com várias subcategorias, os nomes vão numa linha abaixo da faixa (na tela isso é o tooltip).

### Changelog técnico — 20/07/2026 (por arquivo, tudo frontend)

| Arquivo | O que mudou |
|---|---|
| `src/utils/notas.js` | `normalizarLinhas` extraída (mapeia todas as linhas, com `item`); `linhasDoItem` agora é filtro + normalização. Novos `chaveNota` (identidade da nota), `resumoNotas` (KPIs, preço médio ponderado, `(sem subcategoria)` via `SEM_SUB`) e `agruparPorItem`. |
| `src/components/ResumoNotas.jsx` | **Novo** — faixa de KPIs compartilhada pelas duas dialogs (+ aviso opcional de unidades misturadas). |
| `src/components/NotasFiltroModal.jsx` | **Novo** — notas de todos os itens do recorte: tabela agrupada por item, expansível, com TOTAL e PDF. |
| `src/components/NotasItemModal.jsx` | Faixa de resumo no topo (substitui a linha "N lançamento(s) · Total"); passa `resumo` ao PDF. |
| `src/utils/exportPdf.js` | Novo `tabelaResumoNotas` (faixa no PDF), `exportarNotasItem` com resumo, e **`exportarNotasFiltro`** (novo). |
| `src/pages/dash/DashCustos.jsx` | Botão "📄 ver notas de todos os itens" no cabeçalho do card Top N + estado `verNotasFiltro` + render da dialog nova (base `filtrado`, como a de item). |
| `src/styles.css` | Novas `.resumo-notas`/`.resumo-kpi` (faixa, responsiva em 900px) e `.grp-row`/`.grp-detalhe`/`.grp-inner` (tabela agrupada). |

### Validação

- Frontend: `vite build` OK (único aviso é o de tamanho de chunk, pré-existente).
- **Lógica exercitada em Node contra o módulo real** (`notas.js`), com base sintética que inclui uma nota com 2 itens, o mesmo item 2x na mesma nota, uma nota sem chave NF-e, um item sem quantidade e um item sem subcategoria — **27/27**: contagem notas × lançamentos, identidade da nota (chave e fallback), preço médio ponderado **reconciliando com o total**, `null` em qtd 0, `(sem subcategoria)`, agrupamento ordenado e **fechando** com o total do recorte, soma das notas por item > distintas, e recorte vazio sem quebrar.
- **PDFs gerados de verdade e conferidos por extração de texto** (pdfjs) — **28/28**: faixa de resumo nos dois relatórios, coluna Fornecedor, período/filtros, aviso de unidades, rótulo `(sem subcategoria)`, total geral, e a garantia de que **só o item expandido** é detalhado (o não expandido não vaza). Caso vazio não quebra.
- Backend: **inalterado**.
- **Pendente de teste manual no navegador** (`npm run dev`): abrir as duas dialogs, expandir/recolher itens e baixar os PDFs.

### Pendências em aberto

- **Decidir o aperto do CORS** (herdada da 1.5.2, recomendado) — ver a seção da 1.5.2.
- **Subir `desktop/package.json` → `1.5.4`** e gerar/validar o instalador.
- Avaliar a mesma faixa de resumo nas dialogs de notas da **Análise por Período** (`DrillPeriodoModal`), que hoje mostram só Total A/B — ficaria consistente, mas exige decidir como exibir os KPIs em dois períodos.

---

## Registro da conversa — sessão 16/07/2026 (v1.5.2 + v1.5.3)

> A pedido do gestor, o log da sessão, para não se perder o raciocínio e as decisões (mesmo padrão do registro da v1.1.0). As duas versões nasceram na mesma sessão: a **1.5.2** de um bug reportado pelo cliente, a **1.5.3** de melhorias pedidas em seguida.

**1. Ponto de partida — "veja onde eu parei":** o brief estava **desatualizado em relação ao repositório**. A seção da 1.5.1 ainda listava "subir a versão e gerar o instalador" como pendente, mas a v1.5.1 já estava **commitada** (`b0405eb`, 15/07), **empacotada** (`KampekiFinance-Setup-1.5.1.exe`, gerado 16/07 às 10:37 — minutos após o último save do brief) e **instalada no cliente**. Registrado no topo da seção da 1.5.2.

**2. Bug reportado:** cliente instalou a 1.5.1 e o **"Manter-me conectado" não funcionava** — redigitava a senha a cada abertura. Pedido: "pode validar o porquê".

**3. Diagnóstico (com evidência, não dedução):** o Electron subia o backend com `port: 0` → **porta sorteada a cada abertura** → como o `localStorage` do Chromium é isolado **por origem, e a origem inclui a porta**, cada abertura era uma origem nova e vazia. Confirmado inspecionando o `Local Storage` do app instalado: **16 origens acumuladas**, uma por execução. O `Login.jsx`/`client.js` estavam corretos — por isso passou na validação da 1.5.1, feita no navegador (Vite = porta fixa 5173).

**4. "Valide se fica bom e não afeta mais nada":** implementada a **porta fixa 43117 com fallback** e validada **rodando o app real** (o `desktop/build/.env` existe na máquina de dev):
- Harness Electron com perfil descartável **reproduziu o bug** (porta diferente → credencial some) e provou a correção (mesma porta → volta; voltando à porta original → o dado **nunca tinha sido apagado**).
- App real: **43117 nas duas aberturas**; com a porta ocupada → **43118 sem crash**; liberada → volta sozinho à 43117.
- **Dois achados fora do pedido:** (a) o `startServer` **não tratava o evento `error`** — sem isso um `EADDRINUSE` derrubaria o app e **o fallback não existiria** (corrigido); (b) `app.use(cors())` **com wildcard** — com a porta previsível, uma página maliciosa poderia bater no `POST /api/auth/login` (público, sem rate-limit) **e ler a resposta**. Aperto do CORS **proposto e não aplicado — aguardando aval**; verificado que é seguro (front sempre chama `/api` na mesma origem; no dev o proxy do Vite é server-side).

**5. Dúvida do gestor — "não seria mais simples guardar usuário/senha num arquivo local?"** Resposta: **não neste app**, e o motivo é concreto:
- **Custa mais:** a janela roda com `contextIsolation: true`/`nodeIntegration: false` e **não há preload** — o React não tem `fs`. Exigiria preload + `contextBridge` + 3 `ipcMain.handle`, funções **assíncronas** no `client.js` (com fallback p/ o navegador) e refazer o prefill **síncrono** do `Login.jsx`. ~4 arquivos vs. 2 da porta fixa.
- **Resolve menos:** cobre só as credenciais — **token e zoom continuariam zerando**. A porta é a doença; o arquivo é curativo num sintoma.
- **Armadilha evitada:** fazer via **backend** (fugindo do preload) exigiria endpoint **público** devolvendo usuário/senha em texto na porta fixa.
- **Onde a ideia está certa:** é imune à porta → fica como **plano B**, aplicável em cima do que já existe.

**6. "Impacta o dev? E o cliente?"** — respondido **testando**: backend standalone sobe em **3001** (a porta fixa vive só no Electron); com a 3001 ocupada a mensagem de `EADDRINUSE` segue idêntica à de antes (sem regressão); `npm run dev` intacto. Ganho colateral: o `npm start` do desktop também fixa a porta, então **dá para testar o login persistente no dev** (antes era impossível). Para o cliente: instala o `.exe` novo, **digita o login uma vez** (o salvo antigo ficou órfão numa origem antiga, irrecuperável), reajusta o **zoom** uma vez, e nada mais muda — nenhuma escrita no Sheets, sem aviso de firewall.

**7. Pedido da 1.5.3 (4 frentes):** (1) a dialog de item do Dash Custos não respeitava o filtro de data; (2) faltava o **Fornecedor** nas informações; (3) mesmas dialogs de detalhe na **Análise por Período** (Composição por grupo, Comparativo por Categoria/Subcategoria/Item), com A e B separados e "ver as notas de cada um"; (4) **exportar PDF** nessas dialogs, com o botão **no topo**.

**8. Três decisões perguntadas antes de implementar (e as respostas do gestor):**
- **Conteúdo da nota** — nota inteira × só as linhas do filtro → **"só as linhas do filtro"** (contra a recomendação inicial, que era manter a nota inteira). Consequência aceita: o total exibido é o **do item no recorte**, não o da nota. Isso **mudou o formato** da dialog (card por nota → **tabela plana**) e foi o que fez o **Fornecedor** encaixar naturalmente como coluna.
- **Profundidade do drill** — **encadeado com breadcrumb** (Grupo/Categoria → Subcategoria → Item → Notas), em vez de parar no nível pedido.
- **Aba Folha** — **só Custos**, porque a folha **não tem nota** (`custoParaFolha` carrega só Tag/Item/Valor/Categoria).

**9. Bug de reconciliação evitado na implementação:** o `groupSum` **descarta chave vazia** e o grupo **"Outros"** é onde caem os custos **sem categoria** (itens "a classificar") — um drill ingênuo em "Outros" abriria uma tabela que **não fecharia** com a linha clicada. Resolvido com o rótulo `(sem subcategoria)` e coberto por teste.

**10. Ajuste seguinte (feedback do gestor):** *"clico no item, vejo a separação por período, e não tenho um botão de voltar à dialog que iniciou"*. O breadcrumb **já** permitia voltar, mas estava discreto demais (lia como texto de caminho). Adicionado o **"← Voltar"** explícito (um nível por clique), mantendo o breadcrumb para **pular direto** a qualquer nível.

**11. Validação da sessão:** `vite build` OK; **17/17** na lógica do drill exercitada em Node **contra os módulos reais** (incluindo o caso "Outros" e a garantia de que o item vizinho da mesma nota **não vaza**); **26/26** nos PDFs, gerados de verdade e conferidos por **extração de texto** (pdfjs) — coluna Fornecedor, breadcrumb, KPIs A/B, TOTAL e casos vazios. Backend inalterado na 1.5.3.

**Estado ao fim da sessão:** `desktop/package.json` **ainda em 1.5.1** (a versão sobe ao gerar o build, como na 1.5.1). Pendentes: **decidir o aperto do CORS**, **subir para 1.5.3 + gerar/validar o instalador** (que leva junto a correção do login da 1.5.2) e o **teste manual no navegador** das dialogs novas.

---

## Atualizações — 21/07/2026 — Builder e teste multiplataforma (Windows + macOS)

> Sessão de **empacotamento**: o app desktop passou a poder ser **gerado e testado também no macOS** (`.dmg`), além do Windows (`.exe`), e os comandos `dist`/`start` ganharam um **argumento de sistema** (`Apple` | `Windows`). Gestor tem um **Mac físico** e roda o gerador de instalador nele. **Sem mudança no app** (backend/frontend intactos) — só na camada `desktop/` e na documentação. A `version` do `desktop/package.json` **não** foi subida (continua **1.5.4**).

### Comandos com sistema no próprio comando

Antes: `npm run dist` e `npm start` (`electron .`) eram fixos em Windows. Agora ambos aceitam o sistema como argumento posicional:

```bash
npm run dist Apple      # gera o .dmg  (rodar num Mac)
npm run dist Windows    # gera o .exe  (rodar no Windows)
npm run dist            # usa o sistema deste computador

npm start Apple         # testa no Mac
npm start Windows       # testa no Windows
npm start               # usa o sistema deste computador
```

- Confirmado que o npm (11.3.0) **repassa o argumento posicional sem precisar de `--`** (`npm run dist Apple` → `process.argv[2] === 'Apple'`). Os wrappers leem esse argumento.
- Aceita apelidos amigáveis (`Apple`/`Windows`) e técnicos (`mac`/`win`/`darwin`/`win32`), **case-insensitive**. Valor inválido é recusado com mensagem de uso; sem argumento, assume o SO do host.

### Não há cross-build (por construção)
Gerar `.dmg` exige macOS; NSIS `.exe` exige Windows. O `dist` **avisa** se você pedir um alvo diferente do computador atual (e o electron-builder falharia mesmo), mas não tenta emular. Cada instalador sai na sua própria máquina — o `.dmg` no Mac, o `.exe` no Windows. O `start` idem: o Electron sempre roda no binário do host; o argumento é simetria + aviso.

### Ícone do macOS (`.icns`)
O macOS não usa `.ico`. Gerado `desktop/build/icon.icns` (e um `build/icon.png` 1024 master/fallback) a partir do mesmo `frontend/public/favicon.svg`, **nativamente** no Mac (`rsvg-convert` → `sips` → `iconutil`). Versionados junto do `icon.ico` — só regerar se a logo mudar. O `build-icon.js` foi estendido para, ao rodar `npm run icon`, emitir `.ico` + `.png` (qualquer SO) e `.icns` (só no macOS, via `iconutil` nativo).

### Correção — `npm start` mostrava "Cannot GET /"
**Sintoma:** ao rodar `npm start` (Mac), a janela do Electron abria com **"Cannot GET /"** em vez do login.

**Causa:** o app desktop serve o React pelo **próprio Express** (lendo `frontend/dist`); esse diretório **não existia** (o front nunca fora buildado), então o Express não tinha `index.html` para servir. Não era específico do Mac nem do novo wrapper — o antigo `electron .` no Windows daria o mesmo. **O builder nunca teve esse problema** porque o `dist` já builda o frontend antes de empacotar.

**Correção:** o `scripts/start.js` passou a **buildar o frontend (vite) antes de abrir o Electron** — o mesmo passo do `dist`. Assim `npm start` reflete fielmente o que vai no instalador e "só funciona".

### macOS — app não assinado (Gatekeeper)
O `.dmg` sai **sem assinatura de código** (mesma escolha do Windows), via `mac.identity: null` no electron-builder — evita falha de build por falta de certificado Apple. Na 1ª abertura o cliente usa **botão direito → Abrir → Abrir** (ou `xattr -cr` uma vez). A arquitetura acompanha o Mac de build (Apple Silicon → `arm64`; Intel → `x64`): gerar no mesmo tipo de Mac do cliente.

### Changelog técnico — 21/07/2026 (por arquivo, tudo em `desktop/`)

| Arquivo | O que mudou |
|---|---|
| `scripts/platform.js` | **Novo** — resolve o argumento de sistema (`Apple`/`Windows` + apelidos, case-insensitive) → `{ key, label, ebFlag, isHost }`; sem argumento assume o host; valor inválido encerra com uso. |
| `scripts/dist.js` | **Novo** — orquestra o build: `check-env` → `vite build` do frontend → `electron-builder --mac`/`--win` conforme o alvo. Aborta em qualquer passo com erro; avisa em cross-build; valida a presença do bin local (senão pede `npm install`). |
| `scripts/start.js` | **Novo** — **builda o frontend** e abre o app (`electron .`); avisa se o alvo diferir do host. (Corrige o "Cannot GET /".) |
| `package.json` | `start` → `node scripts/start.js`; `dist` → `node scripts/dist.js`; novos `pack:mac`/`pack:win`. Novo bloco **`build.mac`** (target `dmg`, `icon.icns`, `category`, `identity: null`, `artifactName`) e **`build.dmg`** (title). Descrição atualizada (Windows e macOS). |
| `main.js` | Ícone da janela/dock por plataforma: `.png` + `app.dock.setIcon` no macOS (dev), `.ico` no Windows. Ciclo de vida já era mac-friendly (`window-all-closed` não sai no darwin). |
| `build-icon.js` | Reescrito: gera `.ico` + `.png` (1024) em qualquer SO e `.icns` no macOS (iconset via `sips` implícito no fluxo + `iconutil`). Documentado que o `.icns` só é gerado no Mac. |
| `build/icon.icns`, `build/icon.png` | **Novos** — ícones do Mac versionados (gerados do `favicon.svg`). |
| `README-INSTALADOR.md`, `../README.md` | Documentam os dois sistemas, os comandos com argumento, os artefatos (`.exe`/`.dmg`), a nota do Gatekeeper e a regeração de ícones. |

### Validação
- `node --check` OK em `main.js`, `build-icon.js`, `scripts/platform.js`, `scripts/dist.js`, `scripts/start.js`.
- **Resolução de plataforma** exercitada via arquivo real (como o npm invoca): `Apple`→mac/`--mac`, `Windows`/`win32`→win/`--win`, vazio→host, `Banana`→erro (exit 1).
- **Encadeamento npm→wrapper** provado com `npm run dist Banana` e `npm start Banana` (argumento chega e é recusado).
- **`.icns`** gerado e validado (`file` → "Mac OS X icon"); **frontend** builda OK (`vite build`, `dist/index.html` presente) — comprovando o fim do "Cannot GET /".
- **Pendente (só o gestor consegue, no Mac dele):** rodar `npm install` em `desktop/` e `npm run dist Apple` de fato para gerar/abrir o `.dmg`; conferir login e `v<versão>` no rodapé; abrir com o contorno do Gatekeeper.

### Pendências em aberto
- **Gerar o `.dmg` real** no Mac (`npm install` + `npm run dist Apple`) e validar a instalação/execução.
- Herdadas: **decidir o aperto do CORS** (desde a 1.5.2) e **subir `desktop/package.json` → versão do próximo build** ao empacotar (Windows e/ou macOS).
- Assinatura/notarização Apple (opcional) — hoje o `.dmg` é não assinado (Gatekeeper avisa na 1ª abertura), espelhando o Windows sem code signing.

### Correção — `npm run dist Windows` / `npm start Windows` falhavam de volta no Windows (`EINVAL`)

**Sintoma:** feita a alteração de multiplataforma no Mac (onde `npm run dist Apple` / `npm start Apple` funcionam), ao trazer o projeto de volta ao **Windows** os comandos `npm run dist Windows` e `npm start Windows` **pararam de funcionar**. O erro:

```
[dist] Falha ao executar "Build do frontend (vite)": spawnSync npm.cmd EINVAL
```

**Causa (com evidência, não dedução):** confirmado que **não** era o repasse do argumento — um probe provou que o npm 11 no Windows entrega `ARGV: ["Windows"]` tanto em `npm run dist Windows` quanto em `npm start Windows` (sem precisar de `--`). O problema é uma **mudança de segurança do Node** (CVE-2024-27980, a partir do Node 18.20 / 20.12 / 21; a máquina está no **Node 24**): no Windows, `spawnSync` de arquivos **`.cmd`/`.bat`** agora **falha com `EINVAL`** a menos que se passe `shell: true`.
- No **macOS** os binários locais são `npm`, `electron`, `electron-builder` (sem extensão) → `spawnSync` roda direto. Por isso **sempre funcionou no Apple**.
- No **Windows** os `scripts/` chamam `npm.cmd`, `electron-builder.cmd` e `electron.cmd` (arquivos batch) → **EINVAL**. Atingia as **3** chamadas: build do frontend e empacotamento (`dist.js`) e build + abertura do app (`start.js`).

**Correção (só na camada `desktop/`, app intacto):** em `scripts/dist.js` e `scripts/start.js`, quando `process.platform === 'win32'` (`IS_WIN`), os `spawnSync` passam `shell: true` e citam com aspas os tokens que contêm espaço (helper `q()` — necessário porque o caminho do `.bin` fica sob `…\Renan Milech Pereira\…`). Com o `/s /c` do `cmd.exe`, as aspas internas no executável convivem com o wrapper do Node.

> **Apple inalterado (por construção):** todo o ajuste é condicionado a `IS_WIN`. No macOS `IS_WIN` é `false` → `shell: false` (o default de antes), sem aspas e sem alteração de comando/args; a `q()` devolve a string intacta fora do Windows. O caminho de código no Mac é **idêntico** ao anterior — `.dmg` e `npm start Apple` seguem iguais.

**Validação:**
- **Windows:** `npm run dist Windows` roda de ponta a ponta (check-env → `vite build` → `electron-builder --win`) e **gera o `KampekiFinance-Setup-1.5.4.exe`** (87,4 MB, 21/07 12:09). `node --check` OK nos dois scripts.
- **Ressalva benigna:** aparece um aviso `DEP0190` ("passing args … with shell option true") — inofensivo aqui, pois os argumentos são **constantes internas** (`--win`, `--prefix ../frontend run build`), não entrada de usuário; não afeta o build.
- `npm start Windows` **não** foi exercitado no ambiente headless (abre a janela do Electron), mas recebe a mesma correção do `dist` e o frontend é buildado no fluxo.

**Changelog técnico — correção Windows (por arquivo, tudo em `desktop/`)**

| Arquivo | O que mudou |
|---|---|
| `scripts/dist.js` | `IS_WIN` + helper `q()` (cita tokens com espaço no Windows); `run()` passa `shell: IS_WIN` e cita `cmd`/`args`. |
| `scripts/start.js` | Mesmo `IS_WIN`/`q()` no `run()`; a abertura direta do Electron (`spawnSync`) também passa `shell: IS_WIN` e cita o binário. |

---

## Atualizações — 25/07/2026 — versão 1.6.0 (em preparação) — Auto-update + build na nuvem (CI/CD)

> Virada de **entrega**: o app deixa de ser gerado e instalado à mão a cada versão. Agora os instaladores (Windows **e** macOS) são **buildados na nuvem** (GitHub Actions) e **publicados no GitHub Releases**, de onde os clientes se **atualizam sozinhos**. Objetivo do gestor: melhorar a entrega ao cliente e poder gerar os executáveis **sem depender de máquina local** (em especial, sem possuir um Mac). **Sem mudança no app** (backend/frontend intactos) — tudo na camada `desktop/` + CI + modelo de distribuição de segredos.

### Contexto e as três verdades que guiaram o desenho
1. **Windows atualiza sozinho, mesmo sem assinatura** — auto-update via `electron-updater` (que já era dependência e estava **dormente** no `main.js`) funciona sem certificado.
2. **macOS só auto-atualiza se for assinado** (certificado Apple pago). Como a decisão foi **custo zero**, no Mac a atualização vira **semiautomática**: o app **detecta** a versão nova e mostra um aviso com link para baixar o `.dmg` (instala por cima). O `.dmg` **continua sendo gerado na nuvem**, de graça.
3. **`.dmg` só se builda em macOS** — logo, gerar Mac sem ter um Mac exige um **runner `macos-latest`** na nuvem. O `.exe` pode ser buildado em qualquer lugar.

### Modelo de segredos — o `.env` sai do instalador (Nível 2)
Antes, o `build/.env` (chave da Service Account + senha admin + JWT) era **empacotado em texto puro** no instalador (`extraResources`). Isso impedia distribuir o instalador abertamente (auto-update num feed público vazaria os segredos) e obrigava o CI a ter os segredos.

**Agora:** o instalador **não empacota mais o `.env`**. O cliente recebe o `.env` **uma vez** e o deposita na pasta de configuração do app (`userData`), que **sobrevive às atualizações** (a pasta de instalação é substituída a cada update; `userData` não). Consequências:
- O instalador vira **seguro para distribuir publicamente** → GitHub Releases + auto-update ficam triviais.
- O **CI não precisa de nenhum segredo** — o único token é o `GITHUB_TOKEN` que o Actions fornece sozinho.
- `main.js`: novo `clientEnvFile()` (`userData/.env`, com override `KAMPEKI_ENV_FILE`); no app empacotado, se o `.env` faltar, um **diálogo** mostra o caminho exato e abre a pasta ("Abrir a pasta"), encerrando em vez de subir pela metade.

### 🔴 Achado de segurança crítico — chave real versionada em `backend/.env.example`
Durante o estudo, descobriu-se que **`KampekiDash/backend/.env.example` estava versionado com credenciais REAIS** (não placeholders): a `private_key` completa da Service Account, o `GOOGLE_SHEET_ID` real e a senha admin — presente no histórico desde o `first commit` (`844b883`) e no `c9db1d4`. Com o repositório **tornado público** (decisão desta sessão), a chave ficou **exposta publicamente**.
- **Correção de código (feita):** `backend/.env.example` reescrito **só com placeholders**.
- **Ação obrigatória do gestor (fora do código):** **rotacionar a chave** no Google Cloud (excluir a `private_key_id` `806c084d…`, gerar nova), **trocar `ADMIN_PASSWORD` e `JWT_SECRET`**. Como os valores já estão no histórico público, rotacionar é o que de fato neutraliza o vazamento (a faxina de histórico é opcional/bônus). **Enquanto não rotacionar, a chave antiga segue válida e exposta.**

### CI/CD — GitHub Actions (`.github/workflows/release.yml`)
- Dispara em **tag `v*`** (push) ou pelo botão **"Run workflow"**.
- **Matriz** `windows-latest` + `macos-latest`: em cada um, instala deps (frontend/backend/desktop), builda o frontend (vite), e roda `electron-builder --win`/`--mac --publish always`.
- **Guard de versão:** em release por tag, um passo confere que a tag (`vX.Y.Z`) bate com a `version` do `desktop/package.json` (o electron-builder nomeia o Release por essa versão) — aborta se divergirem.
- `permissions: contents: write` + `GH_TOKEN: secrets.GITHUB_TOKEN` (automático) para publicar. `CSC_IDENTITY_AUTO_DISCOVERY: false` no Mac (app não assinado, sem procurar certificado).

### `build.publish` = GitHub Releases
`desktop/package.json` ganhou `build.publish: [{ provider: github, owner: Renanmp14, repo: _KampekiDev }]`. Isso faz o electron-builder gerar o `app-update.yml` (embutido no app, lido pelo `electron-updater` no Windows) e o `latest.yml` (manifesto), e publicar os artefatos no Release da versão.

### Changelog técnico — 25/07/2026 (por arquivo)
| Arquivo | O que mudou |
|---|---|
| `desktop/package.json` | `version` → **1.6.0**; novo `build.publish` (github); **removido** o `build/.env` do `extraResources` (segredo sai do pacote); `files` exclui `GUIA-CLIENTE.md`. |
| `desktop/main.js` | Novo `clientEnvFile()` (`.env` em `userData`, override `KAMPEKI_ENV_FILE`); `resourcePaths()` empacotado lê o `.env` do cliente, não do pacote; diálogo "configuração ausente" (abre a pasta); `setupAutoUpdate()` reescrito — Windows via `electron-updater` (app-update.yml), macOS via `checkMacUpdate()` (checa GitHub API + aviso com link); helper `versaoMaisNova()`. |
| `desktop/scripts/dist.js` | Removido o passo `check-env` do pipeline (o instalador não empacota mais segredos). |
| `desktop/check-env.js` | Mantido; deixou de ser gate do build — agora só um validador manual do `build/.env` em dev (`npm run check-env`). |
| `backend/.env.example` | Reescrito **só com placeholders** (removidas as credenciais reais que estavam versionadas). |
| `desktop/build/.env.example` | **Novo** — modelo do `.env` (dev e cliente), com os caminhos de `userData` por SO. |
| `desktop/GUIA-CLIENTE.md` | **Novo** — guia de instalação e atualização para o cliente (Windows automático; macOS por 1 clique; onde colocar o `.env`). |
| `.github/workflows/release.yml` | **Novo** — build+publish na nuvem (Windows + macOS) no GitHub Releases. |

### Validação
- `node --check` OK em `main.js`, `scripts/dist.js`, `check-env.js`.
- **Build real do Windows** (`electron-builder --win --publish never`) gerou `KampekiFinance-Setup-1.6.0.exe` + `latest.yml` + `app-update.yml` (owner/repo corretos).
- **Conferido que nenhum segredo real vazou** para o pacote: `.env` ausente em `resources/`; busca pelo fragmento único da chave privada, pelo e-mail da Service Account e pelo `GOOGLE_SHEET_ID` real em `dist/win-unpacked` — **tudo vazio**.
- **Não exercitado localmente:** o build do **macOS** (exige runner mac — será validado no primeiro run do Actions) e o ciclo de auto-update ponta a ponta (exige um Release publicado).

### Transição (primeira vez) e pendências
- **Primeira troca é manual:** o app instalado hoje tem o updater dormente e lê o `.env` embutido; ele **não** se auto-atualiza para a 1.6.0. O cliente instala a **1.6.0 manualmente uma vez** e, **antes**, deposita o `.env` na pasta de `userData` (o app mostra o caminho). Do 1.6.0 em diante, o Windows atualiza sozinho.
- **Pendências:** (1) **rotacionar a chave/senha/JWT** (crítico, ver acima); (2) primeiro release de fato (`git push` da tag `v1.6.0`) e validação do build macOS no Actions; (3) enviar ao cliente o instalador + `.env` da 1.6.0. Herdada: aperto do CORS (desde a 1.5.2).

### Guia operacional — como publicar uma versão (release)

> Também disponível como arquivo próprio: `GUIA-PUBLICACAO.md` (raiz do repo). O guia do **cliente** (instalar/atualizar) é `KampekiDash/desktop/GUIA-CLIENTE.md`.

**Pré-requisitos (uma vez):** repo público; chave da Service Account rotacionada + senha admin/`JWT_SECRET` trocados; `desktop/build/.env` local preenchido com as credenciais atuais. **Nenhum segredo é necessário no GitHub** — o instalador não empacota o `.env` e o upload usa o `GITHUB_TOKEN` automático do Actions.

**Regra de ouro:** a `version` do `desktop/package.json` e a tag têm de ser iguais (versão `1.6.1` → tag `v1.6.1`). O workflow aborta de propósito se divergirem.

**Passo a passo:**
1. **Suba a versão** em `KampekiDash/desktop/package.json` (campo `version`). Semver: correção → `1.6.1`; recurso → `1.7.0`; mudança grande → `2.0.0`.
2. **Commit:** `git add KampekiDash/desktop/package.json && git commit -m "desktop 1.6.1"`.
3. **Push do código:** `git push origin main`.
4. **Crie a tag:** `git tag -a v1.6.1 -m "Kampeki Finance 1.6.1"` (`-a` = tag anotada).
5. **Publique a tag (DISPARA o build):** `git push origin v1.6.1`. Saída esperada: `* [new tag] v1.6.1 -> v1.6.1`.
6. **Acompanhe:** GitHub → **Actions** → workflow "Release Kampeki Finance" → esperar os jobs `windows-latest` e `macos-latest` ficarem verdes (~5–10 min).
7. **Publique o Release:** o build cria um **rascunho (draft)**. Em **Releases**, conferir os arquivos (`.exe`, `.dmg`, `latest.yml`, `latest-mac.yml`) e clicar **"Publish release"**. ⚠️ Só um Release **publicado** faz os clientes atualizarem (o updater ignora rascunhos); **não apagar** os `latest*.yml`.

**Atalho sem terminal:** Actions → Release Kampeki Finance → **Run workflow** (usa a versão do `package.json`).

**Desfazer uma tag errada (antes de publicar):** `git tag -d v1.6.1` (local) + `git push origin :v1.6.1` (remoto).

**Bloco copiar/colar** (trocando `X.Y.Z`):
```bash
# editar KampekiDash/desktop/package.json -> "version": "X.Y.Z"
git add KampekiDash/desktop/package.json
git commit -m "desktop X.Y.Z"
git push origin main
git tag -a vX.Y.Z -m "Kampeki Finance X.Y.Z"
git push origin vX.Y.Z
```

### Mapa do projeto — onde fica cada informação

Raiz do repositório: `_KampekiDev/` (público no GitHub: `Renanmp14/_KampekiDev`).

| Local | O que guarda |
|---|---|
| `KAMPEKI_APP_BRIEF.md` | **Documento mestre** — histórico de decisões, regras de negócio, changelog de cada versão (este arquivo). |
| `GUIA-PUBLICACAO.md` | Guia de publicação (release). |
| `.github/workflows/release.yml` | Pipeline de build na nuvem (GitHub Actions) — builda e publica os instaladores. |
| `README.md`, `docs/`, PDFs, `.xlsx`, manuais | Documentação, guias e planilhas-modelo de importação. |
| `KampekiDash/backend/` | **API** (Node + Express): lógica de negócio, rotas, integração com o Google Sheets. |
| `KampekiDash/backend/.env` | Credenciais **reais** para dev (ignorado pelo git). |
| `KampekiDash/backend/.env.example` | Modelo do `.env` (placeholders — versionado). |
| `KampekiDash/frontend/` | **Interface** (React + Vite): telas, dashboards, componentes. |
| `KampekiDash/desktop/` | Empacotamento **Electron** (app de mesa). |
| `KampekiDash/desktop/package.json` | **A VERSÃO do app** (campo `version` — a tag espelha isto) + config do electron-builder e do `publish` (GitHub Releases). |
| `KampekiDash/desktop/main.js` | Processo principal do Electron: sobe o backend, abre a janela, faz o **auto-update**. |
| `KampekiDash/desktop/build/` | Ícones (`.ico`/`.icns`/`.png`) e o `.env` de **dev** (`build/.env`, ignorado). |
| `KampekiDash/desktop/build/.env.example` | Modelo do `.env` (placeholders — versionado). |
| `KampekiDash/desktop/GUIA-CLIENTE.md` | Guia de instalação/atualização **para o cliente**. |
| `KampekiDash/desktop/dist/` | Saída dos builds locais (ignorado). |
| **GitHub Releases** (fora do repo) | Instaladores publicados (`.exe`, `.dmg`) + manifestos de update (`latest.yml`, `latest-mac.yml`). De onde os clientes baixam/atualizam. |
| **Máquina do cliente** — `userData/.env` | O `.env` depositado uma vez. Windows: `%APPDATA%\Kampeki Finance\.env`; macOS: `~/Library/Application Support/Kampeki Finance/.env`. Sobrevive às atualizações. |
| `GUIA-SERVIDOR-WEB.html` | *(add. 26/07)* **Manual do servidor web** — ficha técnica, etapas do deploy, rotina de atualização, comandos e troubleshooting. |
| `GUIA-DEPLOY-ORACLE.md` | *(add. 26/07)* Roteiro passo a passo do deploy na Oracle Cloud (14 fases). |
| **VM Oracle** (fora do repo) | *(add. 26/07)* A **versão web** em produção — `https://kampeki.duckdns.org`. Node+pm2 e Caddy; `backend/.env` e `frontend/dist` vivem só nela (fora do git). |
| **Google Sheets** | O **banco de dados** do app (Fornecedor, Tag, Itens, Custos, Folha). |
| **Google Cloud** (IAM / Service Account) | A chave que autentica o app no Sheets — onde a chave é **rotacionada**. |

---

## Atualizações — 25/07/2026 — versão 1.6.1 (em preparação) — Configurações + verificação manual de update; e o muro do macOS não assinado

> Sessão que estende a 1.6.0: nasce a aba **Configurações** com verificação manual de atualização, e prepara-se a **notarização do macOS** (dormente). Mas o assunto que **não fechou** foi o **bloqueio do macOS em app não assinado** — documentado abaixo em detalhe para retomar. **Nada foi commitado nem a versão subida** (o gestor faz o release); as mudanças estão no working tree.

### Aba Configurações + botão "Verificar atualizações" (com o app aberto)
Nova seção **Sistema → Configurações** na sidebar. Botão **"🔄 Verificar atualizações"** que procura versão nova na hora (a checagem automática só roda na abertura):
- **Windows:** acha → baixa → oferece **"Reiniciar e atualizar agora"** (cancelável; se cancelar, instala ao fechar o app).
- **macOS:** acha → mostra a versão e botão **Baixar** (link do `.dmg`).
- Sem update: **"Você já está na versão mais recente"**. Em dev: desativado.
- **Arquitetura:** como o front (React/renderer) não tinha ponte com o processo principal (decisão de 16/07 de não usar preload), criou-se um **`preload.js` mínimo** que expõe só `window.kampekiUpdater` (`verificar`/`aplicar`) via `contextBridge` — sem `fs`/rede. `main.js` ganhou os handlers IPC `updates:check`/`updates:apply` (Windows via `electron-updater`; macOS via GitHub API), reusando a lógica da 1.6.0.

### Notarização do macOS — PREPARADA e DORMENTE
Tudo pronto para assinar/notarizar quando o gestor quiser; **enquanto não houver secrets, sai ad-hoc como hoje** (nenhuma mudança de comportamento):
- `desktop/package.json`: **removido `identity: null`** (agora a assinatura é decidida por secret).
- `.github/workflows/release.yml`: passo condicional — **Windows** normal; **macOS sem `MAC_CSC_LINK` → ad-hoc** (`--config.mac.identity=null`); **macOS com certificado → assina + notariza** (usa `entitlements` + `hardenedRuntime`). Secrets wireados e inertes.
- `desktop/build/entitlements.mac.plist` (**novo**) — usado só no build assinado.
- `desktop/scripts/dist.js`: mantém o build **local** do Mac ad-hoc quando não há `CSC_LINK` (senão sairia sem assinatura, que não abre no Apple Silicon).
- **`desktop/NOTARIZACAO.md`** (**novo**) — passo a passo: conta Apple Developer (US$ 99/ano), certificado Developer ID → `.p12` → base64, senha de app, Team ID, e os **5 secrets** do GitHub (`MAC_CSC_LINK`, `MAC_CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`). Cadastrou os 5 → próximo build sai notarizado, sem tocar em código.

### 🔴 O muro do macOS não assinado — status (ONDE PARAMOS)

**Sintoma:** ao instalar o `.dmg` no Mac, o macOS mostra **"Malware Bloqueado e Movido para o Lixo — O app Kampeki Finance.app não foi aberto porque contém malware."** e joga o app no Lixo. **Não** é a tela do Gatekeeper "desenvolvedor não identificado" (essa teria "Abrir Mesmo Assim") — é o **XProtect**, o antivírus do próprio macOS. É **falso positivo** (app Electron não assinado), mas o macOS não deixa abrir.

**O que foi tentado (em ordem):**
1. `xattr -cr` / `sudo xattr -rd com.apple.quarantine` — remover a quarentena. Sozinho **não** resolve.
2. `sudo codesign --force --deep --sign -` — re-assinatura **ad-hoc** local. `spctl` segue `rejected` (não notarizado).
3. Empacotado no helper **`ReleaseNotes/Liberar-Kampeki-Mac.command`** (dequarantine + re-sign + open).
4. **"Abrir Mesmo Assim"** em Ajustes → Privacidade e Segurança: **não aparece** (XProtect não oferece essa opção).
5. `spctl --master-disable`: **não** ajuda (controla o Gatekeeper, não o XProtect).

**Resultado (o dado decisivo):**
- **No Mac do desenvolvedor** (`renanpereira@PC-MAC-RENAN`): o ad-hoc re-sign + dequarantine **FUNCIONOU** — o app abriu e rodou.
- **No Mac do cliente** (`nataliavolpato`, macOS Sequoia, FileVault on): **FALHOU** — mesmo com o `.command` rodando com **sucesso** (logs OK), o XProtect re-escaneou na abertura, re-flagou como malware e **jogou no Lixo de novo**.
- **Conclusão:** a re-assinatura ad-hoc **não vence o XProtect** (veredito por **conteúdo**, não por assinatura). O contorno grátis é **não confiável entre máquinas** — funciona em umas, não em outras, e piora a cada macOS mais novo.
- **Atrito extra do helper:** o `.command` **perde o bit de executável** ao passar por Windows/download → precisa `chmod +x` (ou ser zipado num Mac para preservar o bit). Mais um passo de Terminal, o que anula o "1 clique" para um cliente não técnico.

**Última tentativa grátis pendente (não confirmada):** rodar o binário direto (`"/Applications/Kampeki Finance.app/Contents/MacOS/Kampeki Finance"`), que às vezes escapa da checagem de abertura. Se falhar, o caminho grátis está **esgotado** nessa máquina.

### DECISÃO EM ABERTO (o que falta o gestor escolher)
Sem notarização, **não roda** num Mac que o XProtect bloqueia — comprovado num Mac de cliente real. Dois caminhos:
- **A) Notarização Apple (US$ 99/ano)** — fim definitivo; instala/atualiza limpo em qualquer Mac. **Tudo pronto** (`NOTARIZACAO.md` + workflow dormente); falta só o gestor abrir a conta e plugar os 5 secrets. **Recomendado** (há cliente no Mac).
- **B) Versão web para o Mac** — o app já é web por dentro; hospedar e o cliente do Mac abre um **link no navegador** (sem instalar, sem Gatekeeper/XProtect). Windows segue com o desktop. Elimina o problema de raiz; custo = montar a **hospedagem** (backend na nuvem com as credenciais — reabre a discussão de segredos do "Nível 3").

> **Estado:** aguardando o gestor decidir A ou B. O Windows **não** é afetado por nada disso (auto-update funciona; SmartScreen só avisa na 1ª instalação).

### Changelog técnico — 25/07/2026 (1.6.1, por arquivo)
| Arquivo | O que mudou |
|---|---|
| `desktop/preload.js` | **Novo** — ponte `window.kampekiUpdater` (`verificar`/`aplicar`) via contextBridge. |
| `desktop/main.js` | Preload na janela; handlers IPC `updates:check`/`updates:apply`; `fetchLatestRelease`, `verificarWindows`, `verificarMac`; `checkMacUpdate` refatorado. |
| `desktop/package.json` | Removido `mac.identity: null` (assinatura por secret); `!NOTARIZACAO.md` no `files`. |
| `.github/workflows/release.yml` | Passo de empacotamento **condicional** (win / mac ad-hoc / mac assinado+notarizado); 5 secrets de assinatura wireados (inertes). |
| `desktop/scripts/dist.js` | Build local do Mac força ad-hoc quando não há `CSC_LINK`. |
| `desktop/build/entitlements.mac.plist` | **Novo** — entitlements p/ hardened runtime (build assinado). |
| `desktop/NOTARIZACAO.md` | **Novo** — como ativar assinatura+notarização (5 secrets). |
| `frontend/src/pages/Configuracoes.jsx` | **Novo** — aba Configurações com "Verificar atualizações". |
| `frontend/src/App.jsx`, `components/Layout.jsx` | Rota `/configuracoes` + seção "Sistema" na sidebar. |
| `ReleaseNotes/Liberar-Kampeki-Mac.command` | **Novo** — helper de liberação do Mac (paliativo; ver limites acima). |
| `ReleaseNotes/ReleaseNotes_1.6.1_Kampeki_Finance.html` | **Novo** — notas da 1.6.1 (modelo de update, passo a passo Win/Mac, onde fica o `.env`). |

### Validação
- `node --check` (main.js, preload.js, dist.js), `vite build` (1265 módulos), workflow **YAML válido** (js-yaml), `package.json` válido. Build **Windows** da 1.6.0 conferido (sem segredos no pacote, `latest.yml`/`app-update.yml` corretos).
- **Não testável aqui:** build do **macOS** (exige Mac/CI) — validar o ad-hoc local com `npm run dist Apple`; o assinado só com a conta Apple.

### Pendências
- **Decidir A (notarizar) ou B (web) para o Mac** — bloqueador do cliente do Mac.
- Subir `desktop/package.json` → **1.6.1**, commit e release (gestor).
- Reorganização feita pelo gestor: docs/PDFs/manuais movidos para `KampekiDash/ReleaseNotes/` — **atenção:** repo é público, então o **PDF da marca (24 MB)** e manuais ali ficam visíveis; tirar da pasta o que não deve ser público antes do commit.
- Herdadas: rotação da chave (crítico), aperto do CORS.

---

## Atualizações — 25/07/2026 — DECISÃO do Mac: partir para a versão web (Opção B) via Oracle Cloud

> Registro do ponto em que paramos: a 1.6.1 saiu, o **auto-update do Windows foi validado ponta a ponta** (release publicado → cliente atualizou sozinho ✓). O que resta é **só o Mac**, e a decisão sobre ele foi tomada: **seguir com a Opção B (versão web)**, em vez de notarizar.

### A escolha
- **Contexto:** no Mac do cliente (`nataliavolpato`, Sequoia), o XProtect bloqueia o app não assinado como "malware" e o contorno ad-hoc **não vence** (comprovado). Sem notarização (US$ 99/ano) não roda. As saídas eram **A) notarizar** ou **B) web**.
- **Decisão:** testar a **Opção B — versão web** (o app já é web por dentro; o cliente do Mac abriria uma **URL no navegador**, sem instalar nada, sem Gatekeeper/XProtect). O Windows **continua** no app desktop (auto-update funcionando).
- **Onde hospedar — avaliado:**
  - *Google Cloud Run* (grátis na escala do app, mesmo ecossistema do Google, aguenta importações longas) — porém tem **cold start** (~15–30s na 1ª abertura ociosa).
  - *Render free* (simples, mas hiberna/cold start).
  - **Oracle Cloud "Always Free" — ESCOLHIDO:** VM real 24/7, **grátis para sempre e sem cold start**. Custo: setup mais técnico. O gestor topou o setup em troca do "sempre ligado + grátis".

### O que temos que fazer (roteiro do deploy na Oracle)
Divisão: **gestor** faz a conta/VM/SSH; **assistente** prepara código, scripts e configs e guia comando a comando.

1. **Gestor:** criar conta Oracle Cloud (cartão só p/ verificação; Always Free não cobra) → provisionar a **VM Always Free** → anotar o **IP público**.
   - VM: tentar **ARM Ampere** (4 núcleos/24GB, mais forte); se der "out of capacity", cair p/ **AMD micro** (1GB, sempre disponível — suficiente p/ este app).
2. **Endereço/HTTPS:** apontar um domínio pro IP (HTTPS não sai em IP puro). Opções: **domínio próprio** (~US$10/ano) **ou** subdomínio grátis **DuckDNS** (ex.: `kampeki.duckdns.org`).
3. **Assistente prepara / gestor roda (via SSH):**
   - Mudança de código: backend passar a escutar em **`0.0.0.0:$PORT`** (hoje é `127.0.0.1`, que o host não alcança).
   - Instalar **Node + pm2** (mantém o app vivo e no boot) + **Caddy** (proxy reverso com **HTTPS automático grátis**).
   - Subir os segredos como `.env` na VM (usar a **chave rotacionada**).
4. **Testar:** abrir a URL no navegador do Mac.

### Pega-ratão da Oracle (já mapeados)
- **Firewall duplo:** liberar 80/443 **no painel da Oracle E no firewall do SO** da VM (erro nº 1 de quem começa).
- **Capacidade ARM** pode faltar → plano B AMD micro.
- **HTTPS exige domínio** → DuckDNS grátis se não houver domínio.

### Perguntas em aberto (aguardando o gestor, para retomar)
1. **Domínio próprio ou DuckDNS grátis?**
2. **VM ARM (tento primeiro) com AMD micro de plano B?** (recomendado)
3. O assistente pode **adiantar o código** (bind `0.0.0.0` + configs de Caddy/pm2) enquanto a VM não existe — **pendente de OK**.

### Segurança (obrigatório quando a web for definitiva)
Na web o **login fica público** na internet → endurecer: **limite de tentativas no login**, **apertar o CORS**, **senha admin forte**, e HTTPS (o Caddy resolve). Usar sempre a **chave rotacionada** no `.env`.

> **Retomar daqui:** o gestor saiu para criar a conta/VM. Próximo passo ao voltar: responder as 3 perguntas acima; então o assistente adianta o código e guia o deploy na VM.

---

## Atualizações — 26/07/2026 — **A VERSÃO WEB ESTÁ NO AR** (deploy na Oracle Cloud)

> A Opção B saiu do papel na mesma sessão em que foi retomada. O app está acessível em
> **<https://kampeki.duckdns.org>** com HTTPS válido, dados reais do Google Sheets, e o **muro do macOS
> deixou de existir**: a cliente do Mac abre uma URL no navegador, sem instalador, sem Gatekeeper, sem
> XProtect. O **Windows continua no app desktop** com auto-update — os dois caminhos coexistem sobre o
> mesmo código e a mesma planilha.
>
> **Documentação operacional completa:** `GUIA-SERVIDOR-WEB.html` (novo, na raiz) — manual do servidor com
> ficha técnica, as 13 etapas de construção, rotina de atualização, comandos do dia a dia e catálogo de
> problemas. Esta seção do brief registra as **decisões e os achados**; o *como fazer* está lá.

### As 3 perguntas em aberto de 25/07 — respondidas

| Pergunta | Resposta |
|---|---|
| Domínio próprio ou DuckDNS grátis? | **DuckDNS** — `kampeki.duckdns.org`. Grátis, 2 minutos, sem cartão. Migrar para domínio próprio depois é **uma linha** no `Caddyfile` (o Caddy reemite o certificado sozinho); não valia travar o deploy numa compra. |
| VM ARM com AMD micro de plano B? | **Caiu no plano B.** O ARM `A1.Flex` foi recusado com *"Out of capacity… in availability domain AD-1"*. Detalhe que fecha a porta da sugestão da Oracle: **São Paulo tem um único Availability Domain**, então "tente outro AD" não se aplica. Ficou o **AMD `VM.Standard.E2.1.Micro`** (1 OCPU, 1 GB), que praticamente nunca falta. |
| Adiantar o código antes da VM existir? | **Não foi necessário** — ver a correção de plano abaixo. |

### Correção de plano — o bind `0.0.0.0` **não** era necessário (e seria pior)

**Antes (plano de 25/07):** listava como mudança de código obrigatória "backend passar a escutar em
`0.0.0.0:$PORT` (hoje é `127.0.0.1`, que o host não alcança)".

**Agora:** **mantido `127.0.0.1`.** O Caddy roda **na mesma VM**, então alcança o Node em `127.0.0.1:3001`
sem qualquer mudança. Manter o bind local é **melhor**: a porta 3001 fica inacessível da internet, e o único
ponto de entrada é o Caddy (com HTTPS). Expor `0.0.0.0` teria aberto o Express cru ao mundo sem ganho algum.

**Consequência:** o deploy da web exigiu **zero mudança de código de aplicação**. O backend já servia o
`frontend/dist` na mesma origem (`app.js`, bloco "Frontend estático") e o front já chamava `/api` em URL
relativa — o app **já estava pronto para web** desde antes.

### O que subiu (produção)

| Camada | Decisão |
|---|---|
| **VM** | Oracle Always Free, AMD `E2.1.Micro` (1 OCPU / 1 GB), Ubuntu 24.04.4, Brazil East (São Paulo), IP `163.176.35.169` |
| **Swap** | 2 GB em `/swapfile` — **obrigatório** com 1 GB de RAM (sem isso, `npm install`/build morrem por falta de memória) |
| **Runtime** | Node 22.23.1 (NodeSource), pm2 7.0.3, git 2.43.0 |
| **Processo** | pm2 `kampeki`, habilitado no systemd → volta sozinho após reboot |
| **Proxy/HTTPS** | Caddy 2.11.4 — certificado Let's Encrypt automático, renovação automática, redirect 308 de `http://`. Caddyfile de **3 linhas** |
| **DNS** | DuckDNS |
| **Frontend** | Buildado **no Windows** e enviado por `scp` — o `vite build` (1265 módulos) não cabe confortavelmente em 1 GB |
| **Segredos** | `.env` em `backend/.env` (permissão `600`), enviado por **pipe direto** para a VM — nunca gravado em disco na máquina de dev |
| **Firewall** | Portas 80/443 liberadas **nos dois** (Security List da Oracle **e** iptables do Ubuntu) |

### 🔴 Achado — o pm2 **não** sobe este app com `pm2 start src/app.js`

**Sintoma:** `pm2 status` mostrava `online` consumindo 123 MB, **sem uma única linha de log** e com a porta
3001 **fechada**. Nada de erro, nada de restart. Rodar `node src/app.js` na mão funcionava perfeitamente.

**Causa (comprovada rodando em primeiro plano, não deduzida):** o guarda no fim de `backend/src/app.js`:

```js
const invokedDirectly = process.argv[1]
  && pathToFileURL(process.argv[1]).href === import.meta.url;
if (invokedDirectly) startServer();
```

Esse guarda existe para o **Electron** poder `import`ar o `startServer` sem subir um servidor duplicado. Mas
o pm2, em modo *fork*, **importa** o script a partir do wrapper dele (`ProcessContainerFork.js`) — então
`process.argv[1]` aponta para o wrapper, a comparação dá `false` e **`startServer()` nunca é chamado**. O
módulo carrega, o container do pm2 mantém o processo vivo, e o servidor simplesmente não existe.

**Correção (sem tocar no código):** fazer o pm2 executar o `npm start`, aí quem roda o script é o `node` de
verdade e `process.argv[1]` volta a ser o `app.js`:

```bash
cd ~/_KampekiDev/KampekiDash/backend
pm2 start npm --name kampeki -- start
```

> **Vale para qualquer gerenciador de processos que importe o módulo em vez de executá-lo** (não é uma
> peculiaridade do pm2). Registrado aqui porque o sintoma — "online, sem log, porta fechada" — não sugere
> a causa de forma alguma.

### Versão exibida no app — a web mostrava `1.0.0`

**Antes:** `resolveVersion()` em `app.js` usava `APP_VERSION` (injetada pelo Electron em
`desktop/main.js:87`) e, na falta dela, caía no `backend/package.json` — que está em **`1.0.0` desde o
primeiro commit** e nunca foi versionado junto do app. Resultado: desktop mostrava `1.6.1`, web mostrava
`1.0.0`.

**Agora:** a cadeia de resolução passou a ser **`APP_VERSION` → `desktop/package.json` →
`backend/package.json` → `'dev'`**. O `desktop/package.json` já era a fonte única da versão do app (é o que
a tag do release espelha), então a **web passa a acompanhar o desktop automaticamente** a cada `git pull` —
sem passo manual por release. O caminho do Electron fica **idêntico** (o `APP_VERSION` tem precedência;
verificado com `APP_VERSION=9.9.9-teste`).

> **Nota:** rebuildar o frontend **não** resolveria — a versão nunca esteve no bundle do React. O
> `VersionBadge.jsx` sempre consultou `GET /api/version`.

### 🟢 Segurança — a chave vazada foi **confirmada revogada**

A pendência crítica aberta em 25/07 (chave real da Service Account versionada em `backend/.env.example`, com
o repo tornado público) está **resolvida**, e com **evidência**, não com suposição:

- A chave em produção é a **rotacionada** (`private_key_id 416a93e9…`), conferida antes de subir — o script
  que monta o `.env` **aborta** se detectar a `806c084d…`.
- Ao testar o backend na máquina de dev, o Google respondeu **`invalid_grant: Invalid JWT Signature`** para
  a chave do `.env` **local** — ou seja, a `806c084d…` foi de fato **apagada no Google Cloud**. É o que
  neutraliza o vazamento (o histórico público do repo agora carrega uma chave morta).
- `ADMIN_PASSWORD` e `JWT_SECRET` também foram trocados (senha aleatória de 24 caracteres, JWT de 96).

> **Efeito colateral a corrigir:** o `KampekiDash/backend/.env` **local (dev)** continua com a chave morta —
> `npm run dev` sobe mas não lê a planilha. Basta substituir o `GOOGLE_CREDENTIALS_JSON` pelo JSON novo.

### Rotina de atualização da web — **dois destinos independentes**

O ponto que mais gera erro operacional daqui em diante: **publicar um release não atualiza o servidor web**,
e **atualizar o servidor não atualiza o desktop**. São dois destinos a partir do mesmo commit.

```
CÓDIGO ALTERADO
   ├── tag vX.Y.Z → GitHub Actions → Releases → desktop se auto-atualiza (Windows)
   └── git push → na VM: git pull + pm2 restart      (backend)
       npm run build (no Windows) + scp dist/        (frontend)
```

- **Mexeu no backend:** `git push` → na VM `git pull` + `pm2 restart kampeki`.
- **Mexeu no frontend:** `npm run build` no Windows + `scp -r dist` para
  `…/KampekiDash/frontend/` (o destino termina em `/frontend/`, **não** em `/frontend/dist`).
- `git pull` **não** atropela o `dist` enviado nem o `.env`: ambos estão no `.gitignore`.

### Documentação nova

| Arquivo | O que é |
|---|---|
| `GUIA-SERVIDOR-WEB.html` | **Manual do servidor** — ficha técnica completa, as 13 etapas do deploy, acesso SSH, `.env`, DNS, Caddy, rotina de atualização, comandos do dia a dia, 8 problemas com sintoma → causa → solução, e anexo com todos os comandos na ordem. Autocontido (abre offline), com botão de copiar em cada comando. |
| `GUIA-DEPLOY-ORACLE.md` | O roteiro passo a passo usado **durante** o deploy (14 fases), preservado com as notas de campo (capacidade do ARM, atalho de build local). |

### Changelog técnico — 26/07/2026 (por arquivo)

| Arquivo | O que mudou |
|---|---|
| `backend/src/app.js` | `resolveVersion()` reescrita: cadeia `APP_VERSION` → `desktop/package.json` → `backend/package.json` → `'dev'`; novo helper `lerVersaoDe(...partes)`. Unifica a versão exibida na web com a do desktop. **Única mudança de código do deploy.** |
| `frontend/package.json` | `version` `1.0.0` → `1.6.1` (cosmético — nada no app lê este campo; alinha por consistência). |
| `GUIA-SERVIDOR-WEB.html` | **Novo** — manual do servidor web (ver acima). |
| `GUIA-DEPLOY-ORACLE.md` | **Novo** — roteiro do deploy na Oracle. |
| *(servidor, fora do repo)* | `backend/.env` na VM (`600`); `/etc/caddy/Caddyfile`; `/swapfile` + entrada no `/etc/fstab`; regras iptables + `netfilter-persistent`; serviços `pm2-ubuntu` e `caddy` habilitados no systemd. |

### Validação

- **Ponta a ponta pela URL pública**, de fora da VM: `/` → **HTTP 200**; `/api/health` → `{"ok":true}`;
  `/api/version` → **`{"version":"1.6.1"}`**; `http://` → **308** para `https://`; certificado
  **Let's Encrypt válido** (`ssl_verify_result 0`), emitido 26/07, expira 24/10/2026.
- **Login real** pela URL pública: token JWT de 195 caracteres devolvido.
- **Dados reais atravessando a web** (com o token, contra o Sheets):
  **7.675 custos · 3.420 itens · 773 fornecedores · 540 folhas · 22 tags**.
- **Resolução de versão** exercitada nos dois modos: sem `APP_VERSION` → `1.6.1` (lida do desktop);
  com `APP_VERSION=9.9.9-teste` → `9.9.9-teste` (caminho do Electron intacto).
- **Persistência:** `pm2-ubuntu` e `caddy` **enabled** no systemd; `pm2 save` executado; swap ativo
  (`/etc/fstab`); regras de firewall salvas (`netfilter-persistent`).
- **Segredos fora do pacote:** `.env` com permissão `600`, 13 linhas / 2.664 bytes (JSON em uma linha só).
- **Não exercitado:** reboot completo da VM (a configuração está feita, mas o religamento automático não foi
  testado na prática); comportamento sob carga simultânea de vários usuários.

### Pendências em aberto

- 🔴 **Rate limit no login** — `POST /api/auth/login` está na internet **aceitando tentativas ilimitadas de
  senha**. No desktop era aceitável (rodava só na máquina do usuário); na web **não é**. Mudança de código,
  **não aplicada**.
- 🔴 **Apertar o CORS** — `app.js` ainda usa `app.use(cors())` com wildcard. Pendente desde a **1.5.2**;
  com o app na internet, deixou de ser recomendação e passou a ser obrigatório.
- **`.env` local (dev) com a chave revogada** — trocar o `GOOGLE_CREDENTIALS_JSON` pelo JSON novo.
- **IP público é efêmero** — parar (Stop) e iniciar a instância pelo painel **pode mudar o IP**, derrubando
  o site até o DuckDNS ser corrigido (um `sudo reboot` de dentro **não** muda). Duas saídas documentadas no
  `GUIA-SERVIDOR-WEB.html`: converter para **Reserved** no painel (recomendado, também gratuito) ou um cron
  de 5 min sincronizando o DuckDNS.
- **Enviar a URL para a cliente do Mac** — recomendado **só depois** do rate limit e do CORS.
- **Manutenção do SO** — `sudo apt update && sudo apt upgrade -y` uma vez por mês.
- Herdadas do desktop, **inalteradas**: a notarização do macOS segue **preparada e dormente**
  (`NOTARIZACAO.md`) — a web tornou a decisão A/B **desnecessária por ora**, mas se um dia o desktop no Mac
  voltar à mesa, o caminho está pronto.

> **Estado:** a versão web substitui o app desktop **apenas no Mac**. Nada do fluxo do Windows mudou —
> release por tag, build no Actions, auto-update pelo GitHub Releases (`GUIA-PUBLICACAO.md`).
