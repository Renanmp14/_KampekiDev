# Kampeki Finance — Instalador Desktop (Electron): Windows e macOS

App desktop que empacota o backend (Express + Google Sheets) e o frontend (React)
num único instalador. O usuário Beta **não precisa instalar Node** nem nada.

- **Windows** → instalador `.exe` (NSIS).
- **macOS** → imagem `.dmg` (arrasta o app para a pasta Aplicativos).

> **Você escolhe o sistema no próprio comando** (ver abaixo):
> `npm run dist Apple` / `npm run dist Windows` para gerar, e
> `npm start Apple` / `npm start Windows` para testar. Sem argumento, ambos
> assumem o sistema do computador atual.
>
> ⚠️ **Cada instalador é gerado na sua própria máquina:** o `.dmg` só é gerado
> rodando `npm run dist Apple` **num Mac**; o `.exe`, rodando
> `npm run dist Windows` **no Windows**. Não há cross-build.

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

## 2) Testar localmente antes de empacotar (opcional)

Dentro de `desktop/`, roda o app direto (sem gerar instalador):

```bash
npm start Apple       # testar no Mac
npm start Windows     # testar no Windows
npm start             # usa o sistema deste computador
```

O Electron sempre executa no sistema da máquina atual — o argumento serve para
manter o comando simétrico e avisar caso você peça um alvo diferente do host.

## 3) Gerar o instalador (build)

Dentro de `desktop/`:

```bash
npm run dist Apple       # gera o .dmg (rode NUM MAC)
npm run dist Windows     # gera o .exe (rode NO WINDOWS)
npm run dist             # usa o sistema deste computador
```

Isso faz, em ordem: valida o `build/.env` (`check-env`) → `vite build` do
frontend → empacota backend + frontend + `.env` → gera o instalador do sistema
escolhido. Qualquer passo que falhe aborta o processo.

> Também existem os atalhos crus `npm run pack:mac` / `npm run pack:win` (só o
> `electron-builder`, sem check-env nem build do frontend) — úteis para depurar o
> empacotamento.

## 4) Onde o instalador fica

**Windows:**
```
desktop/dist/KampekiFinance-Setup-<versao>.exe      ← arquivo que você entrega
desktop/dist/latest.yml                             ← manifesto (só auto-update)
desktop/dist/win-unpacked/                          ← app "cru" (testar sem instalar)
```

**macOS:**
```
desktop/dist/KampekiFinance-<versao>.dmg            ← arquivo que você entrega
desktop/dist/mac/ (ou mac-arm64/)                   ← o .app "cru" (testar sem instalar)
```

Entregue o instalador ao cliente (Drive, WeTransfer, etc.). No Windows ele dá
dois cliques e ganha o atalho **"Kampeki Finance"**; no Mac ele abre o `.dmg` e
arrasta o **Kampeki Finance** para a pasta **Aplicativos**.

### macOS — app não assinado (Gatekeeper)

O build não é assinado com certificado Apple (mesma escolha do Windows, que
também vai sem assinatura). Na 1ª abertura o macOS pode dizer que "não é possível
verificar o desenvolvedor". Para abrir mesmo assim: **clique com o botão direito
no app → Abrir → Abrir**. (Só na primeira vez; depois abre normal.) Se ainda
recusar, rode uma vez no Terminal: `xattr -cr "/Applications/Kampeki Finance.app"`.

> A arquitetura do `.dmg` acompanha o Mac onde o build roda: Apple Silicon (M1+)
> gera `arm64`; Mac Intel gera `x64`. Gere no mesmo tipo de Mac do cliente.

## Atualizar o cliente (handoff manual)

1. Suba a `version` no `desktop/package.json`.
2. `npm run dist Windows` (no Windows) e/ou `npm run dist Apple` (no Mac).
3. Envie o novo instalador (`.exe` para Windows, `.dmg` para Mac).
4. O cliente executa; **sobrescreve** a versão anterior e passa a rodar a nova
   (no Mac, arrasta de novo para Aplicativos substituindo). O número novo aparece
   no rodapé do app.

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

## Ícone

Os ícones da marca já vêm versionados em `build/`:

- `build/icon.ico` — Windows
- `build/icon.icns` — macOS
- `build/icon.png` — master 1024×1024 (fonte / fallback)

Só precisa **regerar se a logo mudar** (fonte: `frontend/public/favicon.svg`).
Dentro de `desktop/`:

```bash
npm i -D sharp png-to-ico
npm run icon
```

O `npm run icon` gera `.ico` e `.png` em qualquer sistema; o `.icns` só é gerado
rodando **num Mac** (usa o `iconutil`, nativo do macOS).
