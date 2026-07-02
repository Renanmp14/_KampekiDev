# Kampeki Finance — Instalador Windows (Electron)

App desktop que empacota o backend (Express + Google Sheets) e o frontend (React)
num único instalador `.exe`. O usuário Beta **não precisa instalar Node** nem nada.

## Como funciona

- Ao abrir, o app sobe o backend em `127.0.0.1` numa **porta livre** e mostra a
  janela apontando pra ele. O próprio Express serve o frontend + as rotas `/api`.
- A **conexão fixa** (Service Account, JWT, admin) vem de `desktop/build/.env`,
  que é empacotado dentro do instalador (`resources/.env`).
- A **versão** é o campo `version` do `desktop/package.json` (fonte única).
- **Atualização:** hoje em *handoff manual* — você gera um `.exe` novo e envia; o
  cliente roda e o instalador **sobrescreve** a versão antiga. (Auto-update já
  está cabeado; veja o final.)

---

## Pré-requisitos (só na SUA máquina de build)

- Node.js 18+ e npm.
- Uma vez, instale as dependências dos três projetos:

  ```powershell
  npm --prefix backend  install
  npm --prefix frontend install
  npm --prefix desktop  install
  ```

- Crie o arquivo de credenciais **`desktop/build/.env`** a partir do modelo:

  ```powershell
  Copy-Item desktop/build/.env.example desktop/build/.env
  ```

  Edite `desktop/build/.env` com as credenciais reais (Service Account,
  `GOOGLE_SHEET_ID`, `JWT_SECRET`, `ADMIN_EMAIL/PASSWORD`). **Esse arquivo NÃO é
  versionado** (está no `.gitignore`) — ele é o segredo que vai junto no build.

---

## 1) Definir o número da versão

Edite `desktop/package.json` e altere o campo `version` (segue SemVer, ex.:
`1.0.0` → `1.0.1` → `1.1.0`):

```json
{
  "name": "kampeki-desktop",
  "version": "1.0.1",
  ...
}
```

> Sempre **suba a versão** antes de gerar um build que vá para o cliente — é ela
> que aparece no canto inferior direito do app e (quando ligar o auto-update) é
> ela que o updater compara para decidir se baixa a atualização.

## 2) Gerar o instalador (build)

Dentro de `desktop/`:

```powershell
cd desktop
npm run dist
```

Isso faz, em ordem: `vite build` do frontend → empacota backend + frontend +
`.env` → gera o instalador NSIS.

## 3) Onde o instalador fica

```
desktop/dist/KampekiFinance-Setup-<versao>.exe      ← este é o arquivo que você entrega
desktop/dist/latest.yml                             ← manifesto (usado só no auto-update)
desktop/dist/win-unpacked/                          ← app "cru" (para testar sem instalar)
```

Entregue o **`KampekiFinance-Setup-<versao>.exe`** ao cliente (Drive, WeTransfer,
etc.). Ele dá dois cliques, instala, e ganha um atalho **"Kampeki Finance"**.

## Atualizar o cliente (handoff manual)

1. Suba a `version` no `desktop/package.json`.
2. `npm run dist`.
3. Envie o novo `KampekiFinance-Setup-<versao>.exe`.
4. O cliente executa; o instalador **sobrescreve** a versão anterior e passa a
   rodar a nova. O número novo aparece no rodapé do app.

---

## Ligar o auto-update depois (opcional)

Quando quiser que o app se atualize **sozinho**, sem enviar o `.exe` manualmente:

1. Escolha um host estático com URL pública (Cloudflare R2, S3, um VPS, etc.).
2. A cada release, publique nesse host os arquivos gerados em `desktop/dist/`:
   `KampekiFinance-Setup-<versao>.exe`, `latest.yml` e o `.blockmap`.
3. Adicione a URL no `desktop/build/.env` e regere o build:

   ```dotenv
   UPDATE_FEED_URL=https://seu-host.exemplo/kampeki/updates/
   ```

Com a URL definida, a cada abertura o app checa o feed, baixa a versão nova e a
instala ao fechar. Sem a URL (vazio), continua em handoff manual — nada muda.

## Ícone (opcional)

Sem ícone customizado o app usa o ícone padrão do Electron. Para usar a marca,
coloque um `build/icon.ico` (256×256) — o electron-builder o adota
automaticamente (a pasta `build` já é o `buildResources`).
