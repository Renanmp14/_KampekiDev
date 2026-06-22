# Kampeki Finance — Documentação de Desenvolvimento

> Registro do desenvolvimento da aplicação, decisões de arquitetura e de negócio,
> funcionalidades implementadas e pontos de atenção. Documento gerado a partir da
> sessão de desenvolvimento de **13/06/2026**.

---

## 1. Visão geral

Aplicação fullstack para lançamento e visualização de **custos** e **folha de pagamento**
do Kampeki. O **Google Sheets** é a camada de persistência (banco de dados); toda a
lógica de negócio, validações e regras ficam na aplicação.

- **Backend:** Node.js + Express + Google Sheets API v4 — porta `3001`
- **Frontend:** React + Vite + Recharts + SheetJS (xlsx) — porta `5173`
- **Autenticação:** JWT (email/senha definidos no `.env`)
- **Credenciais Google:** Service Account via `.env` (`GOOGLE_CREDENTIALS_JSON`)

A base foi construída a partir do brief em `KAMPEKI_APP_BRIEF.md`.

---

## 2. Estrutura do projeto

```
KampekiDash/
├── backend/
│   ├── src/
│   │   ├── config/google.js          # auth da Service Account + cliente Sheets
│   │   ├── middleware/auth.js         # valida JWT
│   │   ├── routes/                    # auth, fornecedor, tag, itens, custos, folha
│   │   ├── services/
│   │   │   ├── sheets.js              # leitura/escrita genérica + initSheets + batch
│   │   │   ├── cache.js               # cache leve de listas
│   │   │   └── fornecedor|tag|itens|custos|folha.js
│   │   ├── utils/
│   │   │   ├── uuid.js                # crypto.randomUUID
│   │   │   ├── date.js                # derivação de MES_ANO, MES_NUM, etc.
│   │   │   └── switch-categoria.js    # mapa SUB_CATEGORIA → CATEGORIA
│   │   └── app.js
│   ├── .env                           # NÃO versionado (no .gitignore)
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── api/                       # client.js (fetch+JWT) + resources.js
│   │   ├── components/                # Layout, Modal, ConfirmDialog, ImportModal, etc.
│   │   ├── pages/                     # Login, Custos, Folha, Fornecedor, Tag, Itens
│   │   │   └── dash/                  # DashCustos, DashFolha, DashPeriodo
│   │   ├── utils/                     # format.js, agg.js, importParse.js
│   │   └── App.jsx / main.jsx
│   └── vite.config.js                 # proxy /api → :3001
├── docs/DOCUMENTACAO.md               # este arquivo
├── README.md
├── ImportItensFornecedor.xlsx                 # template de import de fornecedores
└── ImportItens_SubCategoria_Categoria.xlsx    # template de import de itens
```

---

## 3. Linha do tempo do desenvolvimento

### Etapa 1 — Construção da base (a partir do brief)
- Backend completo: config, middleware JWT, rotas e serviços CRUD para Fornecedor,
  Tag, Itens, Custos e Folha; `initSheets()` que cria as abas faltantes com cabeçalhos.
- Frontend completo: login, páginas de lançamento, 3 dashboards com gráficos (Recharts).
- Convenção de leitura: **linha 1 = cabeçalho, linha 2 = notas, dados a partir da linha 3.**

### Etapa 2 — Conexão real e validação end-to-end
- `.env` configurado e backend conectado à planilha real.
- Fluxo validado contra o Sheets: cadastros, derivação de data, cálculo de `VALOR_TOTAL`,
  custo de folha exigindo TAG, validações de duplicado. Dados de teste removidos depois.

### Etapa 3 — Importação por planilha (Fornecedor e Itens)
- Botão "Importar planilha" nas duas telas, com prévia e relatório de resultado.
- Validado com a massa real: **393 fornecedores** e **2.347 itens** importados sem
  derrubar a aplicação e sem deixar nada de fora.

### Etapa 4 — Correção de credenciais/planilha
- Ajuste do `.env` para a Service Account e planilha corretas do projeto Kampeki.

---

## 4. Regras de negócio implementadas

### Abas e colunas (Google Sheets)
| Aba | Colunas |
|-----|---------|
| `FORNECEDOR` | UUID, NOME_FORNECEDOR |
| `TAG` | UUID, TAG |
| `ITENS` | UUID, DESCRICAO_ITEM, SUB_CATEGORIA, CATEGORIA |
| `CUSTOS` | UUID, DATA_NOTA, NUM_NOTA, MES_ANO, MES_NUM, ANO, DIA_MES_ANO, FORNECEDOR, ITEM, SUB_CATEGORIA, CATEGORIA, QTD, VALOR_UNIT, VALOR_TOTAL, **TAG** |
| `FOLHA` | UUID, MES_ANO, MES_NUM, ANO, TAG, ITEM_FOLHA, VALOR, OBSERVACAO |

### Principais regras
- **CATEGORIA** é sempre derivada da **SUB_CATEGORIA** pelo mapa interno
  (`utils/switch-categoria.js`) — nunca enviada pelo frontend.
- **Custo de folha** (categoria `FOLHA CANOAS`, `FOLHA POA` ou `FOLHA TELE`) **exige TAG**.
- `VALOR_TOTAL = QTD × VALOR_UNIT`, exibido ao usuário antes de salvar (tela de confirmação).
- Datas trafegam como `DD/MM/YYYY`; `MES_ANO`/`MES_NUM`/`ANO`/`DIA_MES_ANO` são derivados.
- Nomes de **Fornecedor**, **Tag** e **Item** não podem repetir (case-insensitive).
- Edição/exclusão localizam o registro pelo **UUID** e atualizam/removem a linha inteira.
- Cache leve em memória para listas de Fornecedor/Tag/Itens, invalidado a cada gravação.

---

## 5. Decisões tomadas durante o desenvolvimento

Estas decisões foram confirmadas com o usuário ao longo da conversa:

### 5.1 — Coluna TAG na aba CUSTOS
O brief exigia TAG para custos de folha, mas a aba CUSTOS não tinha essa coluna.
**Decisão:** adicionar a coluna **`TAG` ao final da aba CUSTOS** para persistir a tag
selecionada nesses lançamentos.

### 5.2 — Mapa de categorias completado a partir do template de itens
O arquivo de importação de itens trazia **12 subcategorias que não existiam no mapa do
brief**. Para não deixar itens de fora, o mapa foi expandido. Decisões específicas:

| Subcategoria | Situação | Categoria definida |
|---|---|---|
| `MOTOBOY CASA` / `MOTOBOY OCTO` | Conflito: brief dizia DESPESA ADM., arquivo dizia CMV | **CMV** (arquivo venceu) |
| `TELE ENTREGA` | Sem categoria no arquivo | **FOLHA TELE** |
| `COLETA LIXO` | Sem categoria no arquivo | **DESPESA ADMINISTRATIVA** |
| `AGUA CANOAS`, `AGUA POA`, `LUZ CANOAS`, `SEGURANÇA DO TRABALHO`, `PLANO CELULAR`, `CONTABILIDADE`, `ICMS CANOAS`, `ICMS POA` | Ausentes no mapa | DESPESA ADMINISTRATIVA |
| `UTENSILIOS FUNCIONÁRIOS`, `FARMACIA` | Ausentes no mapa | FOLHA CANOAS |

> Estratégia de import para itens: a categoria é derivada pelo mapa interno; se a
> subcategoria não existir no mapa, usa-se a CATEGORIA informada no próprio arquivo como
> *fallback*. Linhas sem categoria possível são **reportadas como erro** (não entram),
> nunca derrubam a importação.

---

## 6. Funcionalidade de importação por planilha

### Templates aceitos
- **Fornecedores** (`ImportItensFornecedor.xlsx`): coluna **`LISTA FORNECEDOR`**.
- **Itens** (`ImportItens_SubCategoria_Categoria.xlsx`): colunas **`ITENS`**,
  **`SUB CATEGORIA`**, **`CATEGORIA`**.

O parsing é tolerante a variações de cabeçalho (mapeia por nome, com fallback por posição)
e ignora linhas totalmente vazias. Formatos aceitos: `.xlsx`, `.xls`, `.csv`.

### Como funciona (ponta a ponta)
1. **Frontend** lê a planilha com SheetJS, mostra prévia (linhas detectadas + amostra).
2. Envia as linhas para `POST /api/fornecedor/import` ou `POST /api/itens/import`.
3. **Backend** valida, remove duplicados e grava em **lote** no Sheets.
4. Retorna um **relatório**: importados, duplicados ignorados, vazios e erros (com nº da linha).

### Robustez para grande volume
- **Escrita em lote** (`appendRows`): poucas chamadas à API (1 leitura + N/chunk escritas),
  em vez de 2 chamadas por linha.
- **Expansão da grade** (`ensureRowCapacity`): a aba é expandida antes da escrita.
  Sem isso, o `values.update` estoura ao passar do tamanho da grade (~2002 linhas).
- **Deduplicação** case-insensitive contra o que já existe **e** dentro do próprio arquivo.
- **Idempotência confirmada**: reimportar o mesmo arquivo resulta em `importados=0` e
  todos como duplicados — não duplica registros.

### Resultado da validação (massa real)
| | Recebidos | Importados | Duplicados | Erros | Tempo |
|---|---|---|---|---|---|
| Fornecedores | 411 | 393 | 18 | 0 | ~1,3 s |
| Itens | 2.400 | 2.347 | 53 | 0 | ~2,9 s |

---

## 7. Endpoints da API

Todas as rotas (exceto o login) exigem header `Authorization: Bearer <token>`.

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/auth/login` | Login → retorna JWT |
| GET | `/api/health` | Health check (público) |
| GET | `/api/config` | Configurações (threshold de alerta) |
| GET/POST/PUT/DELETE | `/api/fornecedor` | CRUD fornecedores |
| POST | `/api/fornecedor/import` | Importação em lote |
| GET/POST/PUT/DELETE | `/api/tag` | CRUD tags |
| GET/POST/PUT/DELETE | `/api/itens` | CRUD itens (categoria derivada) |
| GET | `/api/itens/subcategorias` | Catálogo subcategoria → categoria |
| POST | `/api/itens/import` | Importação em lote |
| GET/POST/PUT/DELETE | `/api/custos` | CRUD custos |
| GET/POST/PUT/DELETE | `/api/folha` | CRUD folha |

---

## 8. Dashboards

- **Dash Custos:** total geral, por categoria e subcategoria, comparativo mês a mês,
  Top N itens (configurável), variação vs. período anterior e alerta visual de crescimento
  acima do *threshold* (`GROWTH_ALERT_THRESHOLD`).
- **Dash Folha:** subtotal por Tag e por Item, cruzamento Tag × Item, evolução mensal e
  participação percentual por Tag.
- **Análise por Período:** comparação entre dois períodos (A vs B) para Custos e Folha,
  com variação absoluta e percentual por categoria, subcategoria/tag e item.

---

## 9. Configuração e execução

### Variáveis de ambiente (`backend/.env`)
```
PORT=3001
NODE_ENV=development
JWT_SECRET=...
JWT_EXPIRES_IN=7d
ADMIN_EMAIL=...
ADMIN_PASSWORD=...
GOOGLE_SHEET_ID=<id da planilha>
GOOGLE_CREDENTIALS_JSON={...}   # JSON da Service Account em UMA linha
GROWTH_ALERT_THRESHOLD=20
```

### Pré-requisitos do Google
1. Habilitar a **Google Sheets API** no projeto.
2. Compartilhar a planilha com o `client_email` da Service Account com papel **Editor**
   (Viewer apenas lê e quebra o `initSheets()` na escrita).

### Rodando
```bash
# terminal 1
cd backend && npm install && npm run dev      # http://localhost:3001

# terminal 2
cd frontend && npm install && npm run dev     # http://localhost:5173
```
Login com `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

---

## 10. Pontos de atenção / lições aprendidas

- **Permissão Editor obrigatória:** com Viewer, a leitura funciona mas a escrita falha
  com *"The caller does not have permission"* — foi o que ocorreu até trocar o papel.
- **Grade do Sheets:** `values.update` não cria linhas além da grade; é preciso expandir
  antes (resolvido por `ensureRowCapacity`). Importante para importações grandes.
- **Acentos no shell do Windows:** testes via `curl` no PowerShell corrompem acentos
  (ex.: `SALMÃO` → `SALM�O`). Use `node fetch` para testar com acento — o app real
  (fetch UTF-8) não tem esse problema.
- **Propagação de permissão:** compartilhar a planilha pode levar alguns segundos para
  valer; uma primeira tentativa logo após o compartilhamento pode falhar.

---

## 11. Segurança

- O `.env` (com a chave privada da Service Account) está no `.gitignore` e **não** é
  versionado.
- **Recomendação:** rotacionar a chave da Service Account no Google Cloud após o
  fechamento do projeto, especialmente se o JSON da chave tiver circulado fora do ambiente.
- Trocar `JWT_SECRET`, `ADMIN_EMAIL` e `ADMIN_PASSWORD` por valores definitivos antes de
  qualquer uso em produção.
