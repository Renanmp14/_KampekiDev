# Kampeki Finance — Guia de Instalação e Atualização (Cliente)

Este guia é para quem **usa** o Kampeki Finance no dia a dia.

---

## 1. Primeira instalação

Você recebeu dois itens:

1. O **instalador** do aplicativo:
   - **Windows:** `KampekiFinance-Setup-X.Y.Z.exe`
   - **macOS:** `KampekiFinance-X.Y.Z.dmg`
2. Um arquivo de configuração chamado **`.env`** (contém a conexão com a planilha).
   **Guarde-o com cuidado — não compartilhe.**

### Passo a passo

**Windows**
1. Execute o `KampekiFinance-Setup-X.Y.Z.exe`.
   - Se aparecer um aviso azul do Windows ("Windows protegeu seu computador"), clique em **Mais informações → Executar assim mesmo**. Isso acontece só na primeira vez.
2. Abra o **Kampeki Finance**. Como ainda falta o `.env`, o app vai mostrar uma janela dizendo **onde colocar o arquivo** e um botão **"Abrir a pasta"**.
3. Clique em **"Abrir a pasta"**, copie o arquivo **`.env`** para dentro dela e feche.
4. Abra o app de novo. Pronto — ele conecta e pede seu login.

**macOS**
1. Abra o `.dmg` e arraste o **Kampeki Finance** para a pasta **Aplicativos**.
2. Na primeira abertura, o macOS pode bloquear (app não assinado). Faça:
   **clique com o botão direito no app → Abrir → Abrir**. Só é preciso uma vez.
3. Como ainda falta o `.env`, o app mostra a janela com o caminho e o botão **"Abrir a pasta"**.
4. Clique em **"Abrir a pasta"**, copie o **`.env`** para dentro e feche.
5. Abra o app de novo. Ele conecta e pede seu login.

> **Onde o `.env` fica guardado** (não precisa decorar — o app mostra):
> - **Windows:** `%APPDATA%\Kampeki Finance\.env`
> - **macOS:** `~/Library/Application Support/Kampeki Finance/.env`
>
> Esse local **sobrevive às atualizações** — você coloca o `.env` uma única vez.

---

## 2. Como as atualizações chegam

### Windows — automático ✅
Não precisa fazer nada. Ao abrir o app, se houver versão nova, ele **baixa e instala
sozinho** em segundo plano. Da próxima vez que você abrir, já estará atualizado.
O `.env` e seu login continuam no lugar.

### macOS — semiautomático (1 clique) 🖱️
Ao abrir o app, se houver versão nova, aparece um aviso **"Atualização disponível"**
com o botão **Baixar**. Clique nele, abra o `.dmg` baixado e **arraste o app novo
por cima do antigo** na pasta Aplicativos. O `.env` e o login permanecem.

> Por que no Mac é manual? A Apple só permite atualização automática em apps com
> assinatura paga. Para manter custo zero, no Mac a atualização é por 1 clique.

---

## 3. Problemas comuns

- **"Arquivo de configuração (.env) não encontrado"** → você ainda não colocou o
  `.env` na pasta. Clique em **"Abrir a pasta"**, coloque o arquivo e reabra o app.
- **O login não entra** → confirme com o responsável se a senha mudou (ela fica no
  `.env`). Se um `.env` novo foi enviado, substitua o antigo na mesma pasta.
- **Windows pede confirmação de administrador na atualização** → não deveria; a
  instalação é por usuário. Se pedir, pode aprovar normalmente.
