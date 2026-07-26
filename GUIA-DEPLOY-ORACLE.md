# Guia de Deploy — Kampeki Finance na Oracle Cloud (Always Free)

> Objetivo: colocar o app no ar numa URL `https://…` que **qualquer navegador** abre — resolvendo o bloqueio do macOS (XProtect) sem pagar notarização. O Windows **continua** usando o app desktop com auto-update; nada muda para ele.
>
> Resultado final: `https://kampeki.duckdns.org` (ou seu domínio) → tela de login do Kampeki.
>
> Tempo estimado: **2 a 3 horas** na primeira vez, sendo boa parte espera (verificação da conta Oracle, propagação de DNS).

---

## Índice

- [Fase 0 — Antes de começar (OBRIGATÓRIO)](#fase-0--antes-de-começar-obrigatório)
- [Fase 1 — Criar a conta Oracle Cloud](#fase-1--criar-a-conta-oracle-cloud)
- [Fase 2 — Gerar a chave SSH (no seu Windows)](#fase-2--gerar-a-chave-ssh-no-seu-windows)
- [Fase 3 — Criar a VM (a máquina virtual)](#fase-3--criar-a-vm-a-máquina-virtual)
- [Fase 4 — Abrir as portas 80 e 443 no painel da Oracle](#fase-4--abrir-as-portas-80-e-443-no-painel-da-oracle)
- [Fase 5 — Conectar na VM por SSH](#fase-5--conectar-na-vm-por-ssh)
- [Fase 6 — Abrir as portas no firewall do sistema (a pegadinha nº 1)](#fase-6--abrir-as-portas-no-firewall-do-sistema-a-pegadinha-nº-1)
- [Fase 7 — Instalar Node, git e pm2](#fase-7--instalar-node-git-e-pm2)
- [Fase 8 — Baixar e montar o app](#fase-8--baixar-e-montar-o-app)
- [Fase 9 — Colocar as credenciais (.env) na VM](#fase-9--colocar-as-credenciais-env-na-vm)
- [Fase 10 — Subir o app com pm2](#fase-10--subir-o-app-com-pm2)
- [Fase 11 — O endereço: DuckDNS (grátis)](#fase-11--o-endereço-duckdns-grátis)
- [Fase 12 — Caddy: HTTPS automático](#fase-12--caddy-https-automático)
- [Fase 13 — Testar](#fase-13--testar)
- [Fase 14 — Segurança (antes de virar definitivo)](#fase-14--segurança-antes-de-virar-definitivo)
- [Como atualizar o app depois](#como-atualizar-o-app-depois)
- [Comandos de socorro](#comandos-de-socorro)
- [Se travar, me chame assim](#se-travar-me-chame-assim)

---

## Fase 0 — Antes de começar (OBRIGATÓRIO)

### 0.1 🔴 Rotacionar a chave da Service Account

A chave atual **está exposta publicamente** no histórico do repositório (achado de 25/07). Colocar o app na internet com ela seria multiplicar o risco. Antes de qualquer coisa:

1. Acesse <https://console.cloud.google.com/iam-admin/serviceaccounts>
2. Abra a Service Account usada pelo Kampeki → aba **Chaves**
3. **Exclua** a chave `806c084d…` e clique em **Adicionar chave → Criar nova chave → JSON**
4. Guarde o `.json` baixado — o conteúdo dele vai virar o `GOOGLE_CREDENTIALS_JSON`
5. Escolha uma **nova `ADMIN_PASSWORD`** (forte — o login vai ficar público na internet) e um **novo `JWT_SECRET`** (string aleatória longa)

> Para gerar um `JWT_SECRET` no PowerShell do Windows:
> ```powershell
> -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | ForEach-Object {[char]$_})
> ```

### 0.2 O que ter em mãos

- [ ] Cartão de crédito (a Oracle usa **só para verificar identidade** — o Always Free não cobra; a cobrança de teste de ~US$1 é estornada)
- [ ] Um e-mail que você acessa agora
- [ ] Celular para receber SMS
- [ ] O `.json` novo da Service Account (passo 0.1)
- [ ] O `GOOGLE_SHEET_ID` (está no seu `KampekiDash/backend/.env` local)

### 0.3 Glossário rápido (para não se perder)

| Termo | O que é, em português claro |
|---|---|
| **VM / Instância** | Um computador virtual na nuvem, ligado 24h. É onde o app vai morar. |
| **SSH** | O jeito de "entrar" nesse computador pelo terminal, de longe. |
| **Chave SSH** | Um par de arquivos: a **pública** você entrega à Oracle, a **privada** fica no seu PC e é sua senha de entrada. Nunca compartilhe a privada. |
| **VCN / Security List** | O firewall da Oracle, no painel do site. |
| **iptables** | O firewall **de dentro** da VM. São dois firewalls diferentes — precisa liberar nos dois. |
| **pm2** | Programa que mantém o Node rodando e o religa se cair ou se a VM reiniciar. |
| **Caddy** | Servidor que recebe as visitas na porta 443 (HTTPS), pega o certificado SSL sozinho e repassa para o seu Node. |
| **DuckDNS** | Serviço grátis que te dá um endereço (`algo.duckdns.org`) apontando para o IP da sua VM. |

---

## Fase 1 — Criar a conta Oracle Cloud

**Site:** <https://www.oracle.com/br/cloud/free/>  → botão **"Comece gratuitamente"**

1. Preencha país **Brasil**, nome e e-mail → verifique o e-mail.
2. **⚠️ Escolha da região — é PERMANENTE.** A região que você escolher agora é a *home region* e **não pode ser trocada depois**. Os recursos Always Free só existem nela.
   - Recomendado: **Brazil East (São Paulo)** ou **Brazil Southeast (Vinhedo)**.
   - Se aparecer aviso de capacidade esgotada em ambas, **US East (Ashburn)** funciona bem (latência ~120ms, imperceptível para este app).
3. Cadastro + verificação por SMS.
4. Cartão de crédito → cobrança de verificação (~US$1) que é estornada.
5. Aguarde o e-mail **"Your Oracle Cloud Infrastructure account is ready"** (de 2 minutos a algumas horas).

> **Se a conta for recusada:** acontece com alguns cartões (pré-pagos e alguns virtuais costumam falhar). Tente outro cartão de crédito real, ou fale comigo que avaliamos o plano B (Google Cloud Run).

Ao final, você entra em <https://cloud.oracle.com> com seu usuário.

---

## Fase 2 — Gerar a chave SSH (no seu Windows)

Faça isto **antes** de criar a VM. No **PowerShell** (não precisa ser administrador):

```powershell
ssh-keygen -t ed25519 -C "kampeki-oracle" -f "$env:USERPROFILE\.ssh\kampeki_oracle"
```

- Quando pedir *passphrase*, pode dar **Enter** duas vezes (sem senha) — simplifica o dia a dia.
- Isso cria dois arquivos em `C:\Users\<você>\.ssh\`:
  - `kampeki_oracle` → **privada** (fica no seu PC, nunca sai)
  - `kampeki_oracle.pub` → **pública** (essa você entrega à Oracle)

Copie o conteúdo da pública para a área de transferência:

```powershell
Get-Content "$env:USERPROFILE\.ssh\kampeki_oracle.pub" | Set-Clipboard
```

---

## Fase 3 — Criar a VM (a máquina virtual)

No painel: **☰ Menu → Compute → Instances → Create instance**

1. **Name:** `kampeki-web`
2. **Image and shape → Edit:**
   - **Image:** `Canonical Ubuntu 24.04` (ou 22.04)
   - **Shape → Change shape → Ampere:** `VM.Standard.A1.Flex` com **4 OCPUs** e **24 GB** de memória
     > Esse é o Always Free "forte". Se ao criar aparecer **"Out of capacity"** (comum em São Paulo), volte em Change shape → **AMD** → `VM.Standard.E2.1.Micro` (1 OCPU, 1 GB). **Funciona para este app** — a Fase 7 tem um passo extra de memória swap para ele.
3. **Networking:** deixe o padrão (ele cria a VCN sozinho). Confirme que **"Assign a public IPv4 address"** está marcado (`Yes`).
4. **Add SSH keys:** escolha **Paste public keys** e cole o que você copiou na Fase 2.
5. **Boot volume:** padrão (50 GB) está ótimo.
6. **Create**.

Em 1–2 minutos o estado fica **RUNNING**. **Anote o `Public IP address`** que aparece na página da instância — vamos chamá-lo de `SEU_IP` daqui pra frente.

> 💡 **"Out of capacity" no ARM (aconteceu neste deploy, 26/07/2026).** O Ampere é o recurso mais disputado do Always Free e vive esgotado em São Paulo. Atenção: **Brazil East (São Paulo) só tem UM Availability Domain (AD-1)** — a sugestão da Oracle de "tente outro AD" não se aplica. O que dá para tentar: reduzir para **1 OCPU / 6 GB** (configurações menores às vezes encaixam) ou repetir o Create em outro horário. Sem fila e sem aviso: é tentativa e erro.
>
> **Decisão tomada:** seguir com o **AMD `VM.Standard.E2.1.Micro`** (1 OCPU, 1 GB), que praticamente nunca falta. Roda este app sem problema — só siga o passo de **swap** na Fase 7 e, de preferência, o **atalho do build local** na Fase 8. Migrar para ARM depois, se liberar, são ~30 min refazendo o guia (os dados moram no Google Sheets; a VM não guarda nada insubstituível).

---

## Fase 4 — Abrir as portas 80 e 443 no painel da Oracle

Sem isto, o site nunca responde. Ainda no painel:

1. Na página da instância, em **Primary VNIC**, clique no nome da **Subnet**
2. Clique na **Security List** (geralmente `Default Security List for vcn-…`)
3. **Add Ingress Rules** → adicione **duas** regras:

| Campo | Regra 1 (HTTP) | Regra 2 (HTTPS) |
|---|---|---|
| Stateless | Não | Não |
| Source Type | CIDR | CIDR |
| Source CIDR | `0.0.0.0/0` | `0.0.0.0/0` |
| IP Protocol | TCP | TCP |
| Destination Port Range | `80` | `443` |

4. **Add Ingress Rules** para salvar.

---

## Fase 5 — Conectar na VM por SSH

No PowerShell do seu Windows (troque `SEU_IP`):

```powershell
ssh -i "$env:USERPROFILE\.ssh\kampeki_oracle" ubuntu@SEU_IP
```

- Na primeira vez ele pergunta se confia no host → digite `yes`.
- O usuário é **`ubuntu`** (imagem Canonical). Se você escolheu Oracle Linux, é `opc`.
- Deu certo quando o prompt vira algo como `ubuntu@kampeki-web:~$`.

> **Erro "Permission denied (publickey)"?** Quase sempre é chave errada ou usuário errado. Confira que apontou para o arquivo **sem** `.pub` e que o usuário é `ubuntu`.
>
> **Travou sem responder (timeout)?** A VM ainda está subindo, ou o IP está errado. Espere 2 minutos e tente de novo.

**Daqui em diante, todos os comandos são digitados dentro dessa sessão SSH.**

---

## Fase 6 — Abrir as portas no firewall do sistema (a pegadinha nº 1)

A imagem Ubuntu da Oracle vem com o iptables bloqueando tudo, menos o SSH. Liberar só no painel **não basta**:

```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

> Se `iptables -I INPUT 6` reclamar de índice inválido, use sem o `6`:
> `sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT` (idem para 443).
>
> Se `netfilter-persistent` não existir: `sudo apt install -y iptables-persistent` (responda **Yes** para salvar as regras) e rode o `save` de novo.

Confira que o `ufw` está inativo (o padrão da Oracle):

```bash
sudo ufw status
```
Se disser `inactive`, ótimo — nada a fazer. Se estiver ativo: `sudo ufw allow 80,443/tcp`.

---

## Fase 7 — Instalar Node, git e pm2

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

Confira:
```bash
node -v    # deve mostrar v22.x
npm -v
pm2 -v
```

### ⚠️ Só se você ficou com a VM AMD micro (1 GB de RAM)

O build do frontend estoura 1 GB e morre com "JavaScript heap out of memory". Crie 2 GB de swap **antes** de continuar:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h    # deve mostrar 2Gi em "Swap"
```

---

## Fase 8 — Baixar e montar o app

O repositório é público, então o clone é direto:

```bash
cd ~
git clone https://github.com/Renanmp14/_KampekiDev.git
cd ~/_KampekiDev/KampekiDash

# dependências
npm install --prefix backend
npm install --prefix frontend

# build do frontend (gera frontend/dist, que o próprio Express serve)
npm --prefix frontend run build
```

O build leva 1–3 minutos. Confirme que deu certo:

```bash
ls ~/_KampekiDev/KampekiDash/frontend/dist/index.html
```
Se o arquivo aparecer, está pronto.

### 💡 Atalho para a VM de 1 GB — buildar no Windows e subir pronto

Na AMD micro, o `vite build` é o único passo que sofre com a memória. Dá para pular ele na VM: builde no seu PC (onde já roda) e envie só o resultado.

**No PowerShell do Windows:**
```powershell
cd "$env:USERPROFILE\Documents\_KampekiDev\KampekiDash\frontend"
npm run build
scp -i "$env:USERPROFILE\.ssh\kampeki_oracle" -r dist ubuntu@SEU_IP:/home/ubuntu/_KampekiDev/KampekiDash/frontend/
```

Nesse caso, na VM você **não precisa** rodar `npm install --prefix frontend` nem o `npm --prefix frontend run build` — só o `npm install --prefix backend`. Menos coisa instalada, menos disco, sem risco de estourar memória.

> Contrapartida: a cada atualização do app você repete o build + `scp` em vez de um `git pull` que resolve tudo. A seção [Como atualizar o app depois](#como-atualizar-o-app-depois) cobre os dois fluxos.

---

## Fase 9 — Colocar as credenciais (.env) na VM

O backend lê o `.env` da pasta `KampekiDash/backend/`. Ele contém a chave do Google — **use a chave rotacionada da Fase 0**, nunca a antiga.

### Jeito recomendado: enviar do seu Windows por `scp`

Monte o arquivo primeiro **no seu PC** (não na VM), num arquivo novo — por exemplo `C:\Users\<você>\Desktop\env-oracle.txt` — com este conteúdo:

```dotenv
PORT=3001
NODE_ENV=production

JWT_SECRET=COLE_O_NOVO_SEGREDO_AQUI
JWT_EXPIRES_IN=7d

ADMIN_EMAIL=admin@kampeki.local
ADMIN_PASSWORD=COLE_A_NOVA_SENHA_FORTE_AQUI

GOOGLE_SHEET_ID=COLE_O_ID_DA_PLANILHA
GOOGLE_CREDENTIALS_JSON={"type":"service_account", ... }

GROWTH_ALERT_THRESHOLD=20
```

> **⚠️ O `GOOGLE_CREDENTIALS_JSON` tem que ficar em UMA ÚNICA LINHA.** Abra o `.json` novo que você baixou do Google, copie **tudo** e cole numa linha só. Os `\n` que existem dentro da `private_key` são literais — deixe como estão, não troque por quebras de linha reais.

Depois, **numa nova janela do PowerShell no Windows** (não na sessão SSH):

```powershell
scp -i "$env:USERPROFILE\.ssh\kampeki_oracle" "$env:USERPROFILE\Desktop\env-oracle.txt" ubuntu@SEU_IP:/home/ubuntu/_KampekiDev/KampekiDash/backend/.env
```

De volta na sessão SSH, proteja e confira o arquivo:

```bash
chmod 600 ~/_KampekiDev/KampekiDash/backend/.env
head -c 120 ~/_KampekiDev/KampekiDash/backend/.env
```

E **apague o `env-oracle.txt` do Desktop do Windows** depois — ele tem segredos em texto puro.

### Jeito alternativo (sem scp): editar direto na VM

```bash
nano ~/_KampekiDev/KampekiDash/backend/.env
```
Cole o conteúdo (botão direito do mouse cola no PowerShell), depois `Ctrl+O` → `Enter` → `Ctrl+X`. Confira com `cat` se a linha do JSON não quebrou.

---

## Fase 10 — Subir o app com pm2

```bash
cd ~/_KampekiDev/KampekiDash/backend
pm2 start src/app.js --name kampeki
pm2 logs kampeki --lines 30
```

**O que você quer ver nos logs:**
```
Kampeki Finance API (v1.0.0) em http://127.0.0.1:3001
```

Se aparecer `[initSheets] Falha ao inicializar a planilha`, o `.env` está errado (chave, ID da planilha, ou o JSON quebrado em várias linhas). Saia dos logs com `Ctrl+C` e me chame com a mensagem completa.

Teste local (ainda dentro da VM):
```bash
curl http://127.0.0.1:3001/api/health
# esperado: {"ok":true}
```

Faça o pm2 religar tudo sozinho quando a VM reiniciar:
```bash
pm2 save
pm2 startup
```
> O `pm2 startup` **imprime um comando** começando com `sudo env PATH=…`. **Copie e cole esse comando** e execute. Depois rode `pm2 save` de novo.

---

## Fase 11 — O endereço: DuckDNS (grátis)

HTTPS não funciona em IP puro — precisa de um nome. O DuckDNS resolve de graça em 2 minutos.

1. Acesse <https://www.duckdns.org> → **sign in** com Google/GitHub
2. No campo de domínio, digite `kampeki` (ou o nome que quiser) → **add domain**
3. Na linha criada, preencha o campo **current ip** com o `SEU_IP` da VM → **update ip**
4. Anote também o **token** que aparece no topo da página (útil se o IP mudar)

Seu endereço agora é **`kampeki.duckdns.org`**. Confirme que resolve (no PowerShell do Windows):

```powershell
nslookup kampeki.duckdns.org
```
Deve devolver o IP da VM. Se não devolver, espere 2 minutos e repita.

> **Prefere um domínio próprio?** Compre em qualquer registrador (~R$40–60/ano, ex.: Registro.br para `.com.br`) e crie um registro **A** apontando para `SEU_IP`. O resto do guia é idêntico — só troque o nome no Caddyfile da Fase 12. Dá pra começar com DuckDNS e migrar depois: são 2 linhas de mudança.

---

## Fase 12 — Caddy: HTTPS automático

O Caddy pega o certificado do Let's Encrypt sozinho, renova sozinho, e repassa as visitas para o Node.

**Instalar** (na sessão SSH):

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy
```

**Configurar:**

```bash
sudo nano /etc/caddy/Caddyfile
```

Apague tudo o que estiver lá e deixe **apenas** isto (trocando pelo seu endereço):

```
kampeki.duckdns.org {
    reverse_proxy 127.0.0.1:3001
}
```

Salve (`Ctrl+O` → `Enter` → `Ctrl+X`) e reinicie:

```bash
sudo systemctl restart caddy
sudo systemctl status caddy --no-pager
```

Deve aparecer `active (running)`. Nos primeiros segundos o Caddy busca o certificado — acompanhe com:

```bash
sudo journalctl -u caddy -n 30 --no-pager
```
Procure por `certificate obtained successfully`.

> **Se o certificado falhar:** 99% das vezes é a porta 80 fechada (revise Fases 4 e 6) ou o DNS ainda não propagou (revise Fase 11). O Let's Encrypt precisa alcançar a porta 80 para validar.

---

## Fase 13 — Testar

1. No navegador do seu Windows: **`https://kampeki.duckdns.org`** → tela de login do Kampeki, com o cadeado de seguro.
2. Faça login com o `ADMIN_EMAIL` / a **nova** `ADMIN_PASSWORD`.
3. Navegue: Custos, Dash Custos, Dash Folha — os dados vêm do mesmo Google Sheets de sempre.
4. **No Mac da cliente:** abra a mesma URL no Safari/Chrome. Sem instalar nada, sem Gatekeeper, sem XProtect. Dá pra "Adicionar à Dock" pelo Safari (Compartilhar → Adicionar à Dock) para virar quase um app.

✅ Se chegou aqui, o problema do Mac está resolvido.

---

## Fase 14 — Segurança (antes de virar definitivo)

Com o app na internet, o login fica exposto ao mundo. Três coisas precisam ser feitas — **as duas primeiras são mudanças de código que eu faço, é só pedir**:

| Item | Situação | Quem faz |
|---|---|---|
| **Apertar o CORS** (hoje `app.use(cors())` com wildcard) | Pendente desde a v1.5.2 — agora virou obrigatório | Eu (código) |
| **Limite de tentativas no login** (rate limit) — hoje o `/api/auth/login` aceita tentativas infinitas | Não existe | Eu (código) |
| **Senha admin forte** | Feito na Fase 0 | Você |
| **HTTPS** | Feito pelo Caddy | ✅ |
| **Chave rotacionada** | Feito na Fase 0 | ✅ |

Manutenção do sistema operacional, de tempos em tempos:
```bash
sudo apt update && sudo apt upgrade -y
```

---

## Como atualizar o app depois

Quando eu mexer no código e você fizer o push para o GitHub, atualizar a versão web é isto (na sessão SSH):

```bash
cd ~/_KampekiDev
git pull
cd KampekiDash
npm install --prefix backend
npm install --prefix frontend
npm --prefix frontend run build
pm2 restart kampeki
```

**Se você usou o atalho do build local** (VM de 1 GB), o fluxo é este:

```bash
# na VM
cd ~/_KampekiDev && git pull
npm install --prefix KampekiDash/backend
```
```powershell
# no Windows, depois do git pull local
cd "$env:USERPROFILE\Documents\_KampekiDev\KampekiDash\frontend"
npm run build
scp -i "$env:USERPROFILE\.ssh\kampeki_oracle" -r dist ubuntu@SEU_IP:/home/ubuntu/_KampekiDev/KampekiDash/frontend/
```
```bash
# de volta na VM
pm2 restart kampeki
```

> O `git pull` traz a versão publicada no GitHub. O app **desktop do Windows** continua se atualizando sozinho pelo GitHub Releases — os dois caminhos são independentes e usam o mesmo código.

---

## Comandos de socorro

| Preciso… | Comando (na sessão SSH) |
|---|---|
| Ver se o app está de pé | `pm2 status` |
| Ver os logs do app | `pm2 logs kampeki --lines 50` |
| Reiniciar o app | `pm2 restart kampeki` |
| Ver os logs do Caddy | `sudo journalctl -u caddy -n 50 --no-pager` |
| Reiniciar o Caddy | `sudo systemctl restart caddy` |
| Testar o app sem passar pelo Caddy | `curl http://127.0.0.1:3001/api/health` |
| Ver memória/disco | `free -h` e `df -h` |
| Ver as regras de firewall | `sudo iptables -L INPUT -n --line-numbers` |
| Reiniciar a VM inteira | `sudo reboot` (o pm2 e o Caddy voltam sozinhos) |

**Conectar na VM (do PowerShell do Windows):**
```powershell
ssh -i "$env:USERPROFILE\.ssh\kampeki_oracle" ubuntu@SEU_IP
```

---

## Se travar, me chame assim

Para eu resolver na primeira tentativa, me mande:

1. **Em que fase e passo** você parou (ex.: "Fase 12, o `systemctl status caddy`")
2. **O comando exato** que você rodou
3. **A saída completa** — copie tudo, inclusive as linhas antes do erro. Não resuma nem descreva ("deu erro"): cole.

Se for erro do painel da Oracle (site), me diga a tela e a mensagem exata.

---

## Anotações desta instalação

> Preencha conforme for avançando — vira sua referência depois.

- Região da conta Oracle: `________________`
- IP público da VM: `________________`
- Shape escolhido: ( ) ARM A1.Flex 4/24  ( ) AMD E2.1.Micro
- Usuário SSH: `ubuntu`
- Endereço: `________________.duckdns.org`
- Token DuckDNS: `________________`
- Data do deploy: `____/____/______`
