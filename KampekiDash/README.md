# Kampeki Finance

Aplicação fullstack para lançamento e visualização de custos e folha de pagamento do Kampeki.
O **Google Sheets** é a camada de persistência; toda a lógica de negócio fica na aplicação.

- **Backend:** Node.js + Express + Google Sheets API v4 (porta `3001`)
- **Frontend:** React + Vite + Recharts (porta `5173`)
- **Auth:** JWT (email/senha do `.env`)

## Pré-requisitos

- Node.js 18+ (testado em Node 24)
- Uma planilha Google e uma **Service Account** com acesso de edição a ela

## Configuração do Google

1. No Google Cloud, crie uma Service Account e gere uma chave JSON.
2. Habilite a **Google Sheets API** no projeto.
3. Compartilhe a planilha com o `client_email` da Service Account (permissão de Editor).
4. Pegue o `GOOGLE_SHEET_ID` da URL: `docs.google.com/spreadsheets/d/<ESTE_ID>/edit`.

## Backend

```bash
cd backend
npm install
cp .env.example .env   # edite com suas credenciais
npm run dev            # ou: npm start
```

Preencha no `.env`:
- `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`
- `GOOGLE_SHEET_ID`
- `GOOGLE_CREDENTIALS_JSON` — o JSON da Service Account **em uma única linha**
- `GROWTH_ALERT_THRESHOLD` — % de crescimento que dispara alerta no Dash Custos (padrão 20)

Ao iniciar, o backend roda `initSheets()`: cria as abas que faltarem
(`FORNECEDOR`, `TAG`, `ITENS`, `CUSTOS`, `FOLHA`) com seus cabeçalhos. Dados existentes
não são alterados. **Convenção das abas:** linha 1 = cabeçalho, linha 2 = notas, dados a partir da linha 3.

## Frontend

```bash
cd frontend
npm install
npm run dev
```

O Vite faz proxy de `/api` para `http://localhost:3001`. Acesse `http://localhost:5173`
e faça login com o `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

## Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/auth/login` | Login, retorna JWT |
| GET/POST/PUT/DELETE | `/api/fornecedor` | CRUD fornecedores |
| GET/POST/PUT/DELETE | `/api/tag` | CRUD tags |
| GET/POST/PUT/DELETE | `/api/itens` | CRUD itens (categoria derivada) |
| GET | `/api/itens/subcategorias` | Catálogo subcategoria→categoria |
| GET/POST/PUT/DELETE | `/api/custos` | CRUD custos |
| GET/POST/PUT/DELETE | `/api/folha` | CRUD folha |
| GET | `/api/config` | Configurações (threshold) |

Todas exigem header `Authorization: Bearer <token>`, exceto o login.

## Regras de negócio principais

- `CATEGORIA` é sempre derivada da `SUB_CATEGORIA` (mapa em `utils/switch-categoria.js`) — nunca enviada pelo frontend.
- Custo com categoria de folha (`FOLHA CANOAS/POA/TELE`) exige seleção de **TAG**
  (gravada na coluna `TAG` adicionada ao final da aba CUSTOS).
- `VALOR_TOTAL = QTD × VALOR_UNIT`, exibido antes de salvar.
- Nomes de Fornecedor, Tag e Item não podem repetir (case-insensitive).
- Datas trafegam como string `DD/MM/YYYY`; `MES_ANO`, `MES_NUM`, `ANO`, `DIA_MES_ANO` são derivados pela aplicação.
