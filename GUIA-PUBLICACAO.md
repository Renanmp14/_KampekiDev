# Kampeki Finance — Guia de Publicação (Release)

Como publicar uma nova versão do app desktop. O build acontece **na nuvem**
(GitHub Actions) e os instaladores (Windows + macOS) são publicados no **GitHub
Releases**, de onde os clientes se atualizam. Você não precisa buildar nada na sua
máquina, nem ter um Mac.

> Guia do **cliente** (instalar/atualizar): `KampekiDash/desktop/GUIA-CLIENTE.md`.

---

## Pré-requisitos (uma vez só)

- O repositório `_KampekiDev` está **público** (o build usa o GitHub Actions e
  publica no Releases). ✅
- A **chave da Service Account foi rotacionada** no Google Cloud e a senha
  admin / `JWT_SECRET` foram trocados (a chave antiga vazou no histórico público).
- Seu `KampekiDash/desktop/build/.env` está preenchido com as **credenciais atuais**
  (esse arquivo é ignorado pelo git e usado só para rodar em dev).

Nenhum segredo é necessário no GitHub: o instalador **não empacota** o `.env` (o
cliente guarda o dele localmente) e o upload do Release usa o `GITHUB_TOKEN`
automático do Actions.

---

## Publicar uma nova versão — passo a passo

A regra de ouro: **a versão no `package.json` e a tag precisam ser iguais**
(ex.: versão `1.6.1` → tag `v1.6.1`). O workflow aborta de propósito se divergirem.

### 1. Suba a versão

Edite o campo `version` em:

```
KampekiDash/desktop/package.json
```

Exemplo: de `"version": "1.6.0"` para `"version": "1.6.1"`.

> Convenção (semver): correção pequena → `1.6.1`; recurso novo → `1.7.0`; mudança
> grande → `2.0.0`.

### 2. Faça o commit da mudança de versão

```bash
git add KampekiDash/desktop/package.json
git commit -m "desktop 1.6.1"
```

(Se houver outras alterações da versão, inclua-as no commit também.)

### 3. Envie o código para o GitHub

```bash
git push origin main
```

### 4. Crie a tag (mesmo número da versão, com "v" na frente)

```bash
git tag -a v1.6.1 -m "Kampeki Finance 1.6.1"
```

- `-a` cria uma tag "anotada" (com autor/data/mensagem — o recomendado).
- Troque `v1.6.1` pela versão que você colocou no `package.json`.

### 5. Publique a tag — isto DISPARA o build

```bash
git push origin v1.6.1
```

Saída esperada:

```
 * [new tag]         v1.6.1 -> v1.6.1
```

Assim que a tag chega ao GitHub, o Actions detecta o padrão `v*` e começa a
buildar Windows e macOS.

### 6. Acompanhe o build

No GitHub → aba **Actions** → workflow **"Release Kampeki Finance"**. Espere os
dois jobs (`windows-latest` e `macos-latest`) ficarem **verdes** (~5–10 min).

### 7. Publique o Release

O build cria o Release como **rascunho (draft)**. Vá em **Releases**, confira que
os arquivos subiram (`.exe`, `.dmg`, `latest.yml`, `latest-mac.yml`) e clique em
**"Publish release"**.

> ⚠️ Só um Release **publicado** faz os clientes se atualizarem (o updater ignora
> rascunhos). **Não apague** os arquivos `latest.yml` / `latest-mac.yml` — são eles
> que o auto-update lê.

Pronto. No Windows os clientes atualizam sozinhos ao abrir; no Mac recebem um aviso
com botão **Baixar**.

---

## Atalho: publicar sem linha de comando

Se não quiser usar o terminal para a tag, o build também pode ser disparado pela
web: **Actions → Release Kampeki Finance → Run workflow → Run**. Ele usa a versão
que estiver no `package.json`. (A tag, porém, é a forma recomendada de marcar a
versão no histórico.)

---

## Comandos de referência (copiar e colar)

Trocando `X.Y.Z` pela versão nova (ex.: `1.6.1`):

```bash
# 1) editar KampekiDash/desktop/package.json -> "version": "X.Y.Z"
git add KampekiDash/desktop/package.json
git commit -m "desktop X.Y.Z"
git push origin main
git tag -a vX.Y.Z -m "Kampeki Finance X.Y.Z"
git push origin vX.Y.Z
```

Errou a tag antes de publicar? Apague e refaça:

```bash
git tag -d vX.Y.Z              # apaga localmente
git push origin :vX.Y.Z        # apaga no GitHub (se já tinha subido)
```

---

## Onde fica alocada cada informação do projeto

Raiz do repositório: `_KampekiDev/`

| Local | O que guarda |
|---|---|
| `KAMPEKI_APP_BRIEF.md` | **Documento mestre** do projeto — histórico de decisões, regras de negócio, changelog de cada versão. É a memória do projeto. |
| `GUIA-PUBLICACAO.md` | **Este arquivo** — como publicar uma versão. |
| `.github/workflows/release.yml` | O **pipeline de build na nuvem** (GitHub Actions): builda e publica os instaladores. |
| `README.md`, `docs/`, PDFs, `.xlsx`, manuais | Documentação, guias e planilhas-modelo de importação. |
| `KampekiDash/backend/` | **API** (Node + Express). Lógica de negócio, rotas, e a integração com o Google Sheets. |
| `KampekiDash/backend/.env` | Credenciais **reais** para rodar em dev (ignorado pelo git). |
| `KampekiDash/backend/.env.example` | Modelo do `.env` (só placeholders — versionado). |
| `KampekiDash/frontend/` | **Interface** (React + Vite): telas, dashboards, componentes. |
| `KampekiDash/desktop/` | Empacotamento **Electron** (o app de mesa). |
| `KampekiDash/desktop/package.json` | **A VERSÃO do app** fica no campo `version` — é o que a tag precisa espelhar. Também a config do electron-builder e do `publish` (GitHub Releases). |
| `KampekiDash/desktop/main.js` | Processo principal do Electron: sobe o backend, abre a janela, e faz o **auto-update**. |
| `KampekiDash/desktop/build/` | Ícones (`.ico`/`.icns`/`.png`) e o `.env` de **dev** (`build/.env`, ignorado pelo git). |
| `KampekiDash/desktop/build/.env.example` | Modelo do `.env` (placeholders — versionado). |
| `KampekiDash/desktop/GUIA-CLIENTE.md` | Guia de instalação/atualização **para o cliente**. |
| `KampekiDash/desktop/dist/` | Saída dos builds locais (ignorado pelo git). |

### Fora do repositório

| Onde | O que guarda |
|---|---|
| **GitHub Releases** (`Renanmp14/_KampekiDev`) | Os instaladores publicados (`.exe`, `.dmg`) + os manifestos de update (`latest.yml`, `latest-mac.yml`). É de onde os clientes baixam e se atualizam. |
| **Máquina do cliente** — `userData/.env` | O `.env` que o cliente depositou uma vez. Windows: `%APPDATA%\Kampeki Finance\.env`; macOS: `~/Library/Application Support/Kampeki Finance/.env`. Sobrevive às atualizações. |
| **Google Sheets** | O **banco de dados** do app (Fornecedor, Tag, Itens, Custos, Folha). A aplicação lê/escreve nele via Service Account. |
| **Google Cloud** (IAM / Service Account) | A chave que autentica o app no Google Sheets. É aqui que a chave é **rotacionada** quando necessário. |
