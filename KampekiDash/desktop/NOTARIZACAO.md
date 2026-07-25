# Notarização do macOS — como ativar (quando quiser)

Hoje o app do macOS sai **ad-hoc** (não assinado pela Apple). Por isso o macOS
mostra o aviso de "malware/desenvolvedor não identificado" e exige o contorno
manual (ver `GUIA-CLIENTE.md`). A **notarização** elimina isso de vez: o Mac
instala e atualiza sem nenhum aviso.

O projeto já está **preparado**: o workflow e o `package.json` detectam sozinhos
se há certificado. **Enquanto os secrets abaixo não existirem, nada muda** (segue
ad-hoc). Assim que você cadastrá-los, o próximo build sai **assinado + notarizado**
— sem eu precisar mexer no código.

> Custo: **Apple Developer Program — US$ 99/ano** (obrigatório; não há caminho grátis).

## Passo a passo (uma vez)

1. **Assine o Apple Developer Program:** https://developer.apple.com/programs/ (US$ 99/ano).
2. **Gere um certificado "Developer ID Application"** (no site da Apple ou pelo Xcode) e **exporte como `.p12`** (com uma senha).
3. **Converta o `.p12` em base64** (para virar um secret de texto):
   - macOS/Linux: `base64 -i certificado.p12 | pbcopy` (copia pro clipboard)
   - Windows (PowerShell): `[Convert]::ToBase64String([IO.File]::ReadAllBytes("certificado.p12")) | Set-Clipboard`
4. **Crie uma "senha de app" (app-specific password)** para o seu Apple ID em https://appleid.apple.com → Segurança → Senhas de app.
5. **Descubra seu Team ID** em https://developer.apple.com/account → Membership (10 caracteres, ex.: `AB12CD34EF`).
6. **Cadastre os secrets** no GitHub: repositório → **Settings → Secrets and variables → Actions → New repository secret**. Crie estes **5**:

   | Secret | Conteúdo |
   |---|---|
   | `MAC_CSC_LINK` | o `.p12` em base64 (passo 3) |
   | `MAC_CSC_KEY_PASSWORD` | a senha do `.p12` (passo 2) |
   | `APPLE_ID` | seu e-mail do Apple ID |
   | `APPLE_APP_SPECIFIC_PASSWORD` | a senha de app (passo 4) |
   | `APPLE_TEAM_ID` | seu Team ID (passo 5) |

7. **Rode um release** normalmente (subir a tag `vX.Y.Z`). O job do macOS vai
   **assinar e notarizar** automaticamente. Pronto — o `.dmg` instala limpo em
   qualquer Mac.

## Como saber que funcionou

- No log do Actions (job macOS), aparece "signing" com o Developer ID e a etapa de
  **notarize** (em vez de "ad-hoc").
- No Mac do cliente, o `.dmg` abre **sem** o aviso de malware e **sem** precisar do
  `Liberar-Kampeki-Mac.command`.

## Reverter / desligar

Basta **apagar os secrets** (ou deixá-los vazios). O próximo build volta a sair
ad-hoc, sem nenhuma mudança de código.

## Observação

Só o macOS exige isso. O Windows não usa esses secrets e continua igual. Se um dia
quiser assinar o Windows também (tira o aviso do SmartScreen), é outro certificado
(OV/EV code signing) — me avise que configuro à parte.
