# FEATURE — Módulo de Custos Recorrentes + Paginação em Custos

> **Versão alvo:** 1.8.0
> **Gerado em:** 07/08/2026
> **Escopo:** duas entregas independentes neste prompt, executadas em sequência.
>
> ⚠ **Leia antes o tópico [Ajustes acordados — 07/08/2026](#ajustes-acordados--07082026), no fim do documento.** Ele revoga alguns pontos do texto abaixo (gatilho, retroativo, mapeamento de `ITEM`, cancelamento) depois da conferência contra o código real.

---

## PARTE 1 — Paginação na tela de Custos (ajuste simples, executar primeiro)

### Contexto

A tela `Custos.jsx` carrega todas as linhas de `CUSTOS` na abertura. Com o crescimento dos dados, isso está ficando lento. O ajuste limita a exibição a **100 linhas recentes** por padrão, sem prejudicar filtros nem a contagem das opções nos selects.

### Regras

1. **Sem filtro ativo:** exibe apenas os **100 registros mais recentes por `DATA_NOTA` (desc)**. Uma nota discreta aparece abaixo da toolbar:
   > *"Exibindo os 100 lançamentos mais recentes. Aplique um filtro para ver todos."*
   A nota tem estilo secundário (cor `#888`, `font-size: 0.82rem`), não é um alerta.

2. **Com qualquer filtro ativo:** o limitador some, a nota desaparece, e **todos os registros filtrados** são exibidos normalmente — sem limite.

3. **Os selects de filtro (Fornecedor, Subcategoria, Tag, Mês/Ano, etc.) continuam populados com todas as opções disponíveis**, independente do limite — os dados brutos completos seguem sendo lidos do backend; só a renderização da tabela é limitada.

4. **Ordenação padrão (sem filtro):** `DATA_NOTA` desc. Com filtro: mantém a ordenação existente.

### Implementação

- A lógica de limitação fica **inteiramente no frontend** (`Custos.jsx`), sem alteração de backend.
- Criar uma variável derivada `registrosExibidos`:
  ```js
  const semFiltroAtivo = !filtroMesAno.length && !filtroFornecedor && !filtroSubcat && !filtroTag && !filtroNota && !filtroDia;
  const registrosExibidos = semFiltroAtivo
    ? [...custosFiltrados].sort((a, b) => comparaData(b.DATA_NOTA, a.DATA_NOTA)).slice(0, 100)
    : custosFiltrados;
  ```
- A tabela renderiza `registrosExibidos` em vez de `custosFiltrados`.
- A nota aparece condicionalmente: `{semFiltroAtivo && custos.length > 100 && <p className="custos-limite-nota">…</p>}`.
- **Nenhum endpoint novo.** Nenhuma mudança em `custos.js` (backend).

### Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `frontend/src/pages/Custos.jsx` | Variável `semFiltroAtivo`, `registrosExibidos`, nota condicional |
| `frontend/src/styles.css` | Classe `.custos-limite-nota` (cor, tamanho, margem) |

---

## PARTE 2 — Módulo de Custos Recorrentes

### Visão geral

Um novo módulo que permite cadastrar **templates de custo fixo** (assinaturas, contratos, serviços recorrentes) que são **automaticamente lançados em `CUSTOS`** quando a data de vencimento chega. A visualização principal é um **calendário** que mostra eventos futuros e passados.

---

## Modelo de dados — nova aba `CUSTOS_RECORRENTES`

```
| UUID | DESCRICAO | FORNECEDOR | ITEM | SUB_CATEGORIA | CATEGORIA | TAG | QTD | VALOR_UNIT | NUM_NOTA | FREQUENCIA | DIA_BASE | DATA_INICIO | DATA_FIM | ULTIMO_LANCAMENTO | ATIVO |
```

### Campos

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `UUID` | string | Sim | UUID v4 — identificador do template |
| `DESCRICAO` | string | Sim | Nome/descrição da recorrência (ex: "Assinatura Adobe") |
| `FORNECEDOR` | string | Não | Nome do fornecedor (casado com `FORNECEDOR`) |
| `ITEM` | string | Não | UUID do item (casado com `ITENS`) |
| `SUB_CATEGORIA` | string | Não | Derivada do item ou definida manualmente |
| `CATEGORIA` | string | Não | Derivada da subcategoria |
| `TAG` | string | Não | UUID da tag |
| `QTD` | number | Sim | Quantidade (default `1`) |
| `VALOR_UNIT` | number | Sim | Valor unitário (`> 0`, `round(…,2)`) |
| `NUM_NOTA` | string | Não | Número de nota (opcional) |
| `FREQUENCIA` | string | Sim | Ver opções abaixo |
| `DIA_BASE` | number | Sim | Dia do mês base (1–31). Para frequências < mensal, representa o dia de início do ciclo. |
| `DATA_INICIO` | string | Sim | `DD/MM/YYYY` — primeira ocorrência |
| `DATA_FIM` | string | Não | `DD/MM/YYYY` — fim da recorrência (vazio = indefinido) |
| `ULTIMO_LANCAMENTO` | string | Não | `DD/MM/YYYY` — última data efetivamente lançada em `CUSTOS`. Usado para evitar duplicação entre desktop e web. |
| `ATIVO` | string | Sim | `"sim"` / `"nao"` |

### Valores de `FREQUENCIA`

| Valor (gravado) | Label na UI |
|---|---|
| `diario` | Todo dia |
| `3dias` | A cada 3 dias |
| `5dias` | A cada 5 dias |
| `semanal` | Toda semana |
| `quinzenal` | A cada 2 semanas |
| `mensal` | Todo mês |
| `trimestral` | A cada 3 meses |
| `semestral` | A cada 6 meses |
| `anual` | Todo ano |

### Regra do dia inexistente no mês

Se o `DIA_BASE` não existe no mês calculado (ex: dia 31 em fevereiro), lança no **último dia do mês**.

---

## Lógica de disparo — verificação no login

### Onde fica

`backend/src/services/recorrentes.js` → função `processarPendentes()`.

### Fluxo

```
ao fazer login com sucesso:
  chamar processarPendentes()
  (não bloqueia o login — executa em background, erros são logados mas não retornam ao frontend)
```

### Algoritmo de `processarPendentes()`

```
1. Ler todos os registros de CUSTOS_RECORRENTES onde ATIVO = "sim"
2. Para cada template:
   a. Calcular todas as datas de ocorrência desde DATA_INICIO até hoje (inclusive)
   b. Filtrar as datas > ULTIMO_LANCAMENTO (ou > DATA_INICIO se ULTIMO_LANCAMENTO vazio)
   c. Para cada data pendente (em ordem cronológica):
      - Se DATA_FIM preenchida e data > DATA_FIM: ignorar
      - Criar registro em CUSTOS com os campos do template
        (DATA_NOTA = data calculada, NUM_NOTA = NUM_NOTA do template, etc.)
      - Atualizar ULTIMO_LANCAMENTO no template com a data recém-lançada
3. Retornar resumo { lançados: N, templates: M }
```

### Proteção anti-duplicação (multiprocesso desktop + web)

O campo `ULTIMO_LANCAMENTO` é a trava. Antes de lançar uma data, o processo verifica se `ULTIMO_LANCAMENTO >= data_calculada`. Se sim, pula. Como o Sheets é a fonte da verdade e ambos os processos leem e gravam `ULTIMO_LANCAMENTO` na planilha, o segundo processo (desktop ou web) que tentar processar a mesma data vai ver que já foi lançada e pular.

> **Risco residual registrado:** janela de corrida pequena se dois processos rodarem `processarPendentes()` ao mesmo tempo com `ULTIMO_LANCAMENTO` ainda vazio. Mitigação aceitável: o usuário raramente loga simultaneamente no desktop e na web no mesmo segundo. Não justifica lock distribuído.

### Lançamento em `CUSTOS`

Cada data processada gera uma linha em `CUSTOS` com:

| Campo CUSTOS | Origem |
|---|---|
| `UUID` | Novo UUID v4 |
| `DATA_NOTA` | Data calculada pelo algoritmo |
| `NUM_NOTA` | `NUM_NOTA` do template (pode ser vazio) |
| `MES_ANO` | Derivado de `DATA_NOTA` |
| `MES_NUM` | Derivado |
| `ANO` | Derivado |
| `DIA_MES_ANO` | Derivado |
| `FORNECEDOR` | Do template |
| `ITEM` | UUID do item no template |
| `SUB_CATEGORIA` | Do template |
| `CATEGORIA` | Do template |
| `QTD` | Do template |
| `VALOR_UNIT` | Do template |
| `VALOR_TOTAL` | `round(QTD × VALOR_UNIT, 2)` |
| `TAG` | Do template |
| `CHAVE_NFE` | Vazio (não é NF-e) |

---

## Edição de ocorrências futuras

Ao editar um template via calendário, perguntar ao usuário:

> **"Alterar apenas esta ocorrência ou esta e todas as seguintes?"**
> - [ ] Só esta data
> - [ ] Esta e todas as seguintes

### Caso "Só esta data" — exceção pontual

Criar um registro separado em uma nova aba `CUSTOS_RECORRENTES_EXCECOES`:

```
| UUID_EXCECAO | UUID_TEMPLATE | DATA_EXCECAO | DESCRICAO | FORNECEDOR | ITEM | SUB_CATEGORIA | CATEGORIA | TAG | QTD | VALOR_UNIT | NUM_NOTA |
```

O algoritmo de `processarPendentes()`, ao calcular as datas, verifica se existe exceção para aquela data — se sim, usa os dados da exceção em vez do template.

### Caso "Esta e todas as seguintes"

Atualiza o template (`CUSTOS_RECORRENTES`) com os novos valores. O `ULTIMO_LANCAMENTO` é preservado — apenas as datas futuras ainda não lançadas serão afetadas.

> **O que já foi lançado em `CUSTOS` nunca é alterado.** Edições no template são sempre prospectivas.

---

## Cancelamento de recorrência

Ao cancelar, perguntar:

> **"Cancelar a partir de qual data?"**
> - Data selecionada pelo usuário (default: hoje)

Comportamento:
- Grava `DATA_FIM = data escolhida - 1 dia` no template
- Grava `ATIVO = "nao"` no template
- Remove as exceções futuras (`DATA_EXCECAO > data escolhida`) da aba de exceções
- **Não apaga** nenhum lançamento já feito em `CUSTOS`

---

## Endpoints de API

### Recorrentes

| Método | Rota | Ação |
|---|---|---|
| `GET` | `/api/recorrentes` | Lista todos os templates (ativos e inativos) |
| `POST` | `/api/recorrentes` | Cria novo template |
| `PUT` | `/api/recorrentes/:uuid` | Edita template (todas as futuras) |
| `DELETE` | `/api/recorrentes/:uuid` | Cancela (grava DATA_FIM + ATIVO=nao) |

### Exceções

| Método | Rota | Ação |
|---|---|---|
| `GET` | `/api/recorrentes/excecoes` | Lista exceções (opcional: filtro por template) |
| `POST` | `/api/recorrentes/excecoes` | Cria exceção para data específica |
| `PUT` | `/api/recorrentes/excecoes/:uuid` | Edita exceção existente |
| `DELETE` | `/api/recorrentes/excecoes/:uuid` | Remove exceção |

### Processar pendentes

| Método | Rota | Ação |
|---|---|---|
| `POST` | `/api/recorrentes/processar` | Dispara `processarPendentes()` manualmente (botão na tela) |

### Custos por intervalo (novo filtro no endpoint existente)

Adicionar suporte a `?dataInicio=DD/MM/YYYY&dataFim=DD/MM/YYYY` no `GET /api/custos` para o calendário carregar apenas o intervalo visível quando a flag "mostrar todos os custos" estiver ativa.

---

## Frontend — arquivos novos e alterados

### Novos arquivos

| Arquivo | Descrição |
|---|---|
| `src/pages/Recorrentes.jsx` | Página principal — calendário + toolbar |
| `src/components/RecorrenteForm.jsx` | Modal de criação/edição de template |
| `src/components/RecorrenteDialog.jsx` | Dialog de detalhes ao clicar no evento do calendário |
| `src/components/CalendarioMensal.jsx` | Grade de calendário — visão mês |
| `src/components/CalendarioSemanal.jsx` | Grade de calendário — visão semana |
| `src/components/CalendarioDiario.jsx` | Lista de eventos — visão dia |
| `src/utils/recorrentesCalc.js` | Funções puras: `calcularOcorrencias(template, de, ate)`, `aplicarExcecoes(ocorrencias, excecoes)`, `ultimoDiaMes(mes, ano)` |
| `src/api/recorrentes.js` | Chamadas ao backend (recorrentes + exceções) |

### Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `src/App.jsx` | Nova rota `/recorrentes` → `<Recorrentes />` |
| `src/components/Layout.jsx` | Novo item na sidebar: "Recorrentes" (ícone calendário 🗓) |
| `backend/src/routes/recorrentes.js` | Novo arquivo de rotas |
| `backend/src/services/recorrentes.js` | Novo arquivo de serviço |
| `backend/src/app.js` | Registrar rota `/api/recorrentes` + chamar `processarPendentes()` no login |
| `backend/src/routes/auth.js` | Após login bem-sucedido, disparar `processarPendentes()` em background |
| `backend/src/routes/custos.js` | Suporte a `?dataInicio` e `?dataFim` no `GET /custos` |
| `backend/src/services/custos.js` | Filtro por intervalo de datas no `listar()` |
| `frontend/src/styles.css` | Estilos do calendário, chips de evento, dialog de detalhes |
| `desktop/package.json` + `frontend/package.json` | `version` 1.7.1 → **1.8.0** |

---

## Frontend — comportamento do calendário

### Toolbar (acima do calendário)

```
[ 🗓 Recorrentes ]    [ < Anterior ]  [ Agosto 2026 ]  [ Próximo > ]  [ Hoje ]
[ Visão: Mês | Semana | Dia ]    [ ☐ Mostrar todos os custos ]    [ + Novo Recorrente ]
```

- O seletor de visão é um segmented control (3 opções)
- A flag "Mostrar todos os custos" é um checkbox com label
- Ao marcar a flag, carrega `GET /api/custos?dataInicio=…&dataFim=…` com o intervalo visível
- Ao navegar entre meses/semanas com a flag ativa, recarrega o intervalo novo

### Tipos de chip no calendário

| Tipo | Cor | Ícone | Condição |
|---|---|---|---|
| Recorrente futuro | Coral `#FF8B7C` | — | `data > hoje` |
| Recorrente já lançado | Coral esmaecido + `✓` | ✓ | `data <= ULTIMO_LANCAMENTO` |
| Custo manual (flag ativa) | Areia `#D7C4B6` | — | Qualquer custo de `CUSTOS` não-recorrente |

### Visão mês — mobile (≤ 520px)

- Cada dia vira uma **linha compacta**: `Seg 4 | ● 2 eventos`
- Toque no dia expande um painel abaixo com os chips daquele dia
- O seletor de visão fica na topbar (compacto)

### Visão semana e dia — mobile

- Renderiza em coluna única, natural para mobile
- Chips em largura total dentro do dia

---

## Dialog de detalhes do evento (ao clicar no chip)

### Para recorrente futuro

```
┌─────────────────────────────────────┐
│ 📌 Assinatura Adobe                 │
│ Dia 20/08/2026 · Mensal             │
├─────────────────────────────────────┤
│ Fornecedor: Adobe Inc.              │
│ Item: Software de Design            │
│ Valor: R$ 250,00                    │
│ Tag: TELE                           │
├─────────────────────────────────────┤
│ [ Editar ]  [ Cancelar recorrência ]│
└─────────────────────────────────────┘
```

Ao clicar em **Editar**: pergunta "Só esta data ou esta e as seguintes?" → abre `RecorrenteForm` no modo edição.

### Para recorrente já lançado

```
┌─────────────────────────────────────┐
│ ✓ Assinatura Adobe  (já lançado)    │
│ Dia 20/07/2026 · Mensal             │
├─────────────────────────────────────┤
│ Fornecedor: Adobe Inc.              │
│ Item: Software de Design            │
│ Valor: R$ 250,00                    │
│ → Lançado em Custos em 20/07/2026   │
├─────────────────────────────────────┤
│ [ Ver em Custos ]                   │
└─────────────────────────────────────┘
```

"Ver em Custos" navega para `/custos` com filtro pré-aplicado na data.

### Para custo manual (flag ativa)

```
┌─────────────────────────────────────┐
│ 📄 Custo manual                     │
│ Dia 15/08/2026                      │
├─────────────────────────────────────┤
│ Fornecedor: Fornecedor XYZ          │
│ Item: Produto ABC                   │
│ Subcategoria: ALIMENTOS EM GERAL    │
│ Valor: R$ 1.234,56                  │
│ Nº Nota: 001234                     │
├─────────────────────────────────────┤
│ [ Ver em Custos ]                   │
└─────────────────────────────────────┘
```

Somente leitura — sem edição inline no calendário.

---

## Formulário de novo/editar recorrente (`RecorrenteForm`)

Campos (em ordem no formulário):

1. **Descrição** — input texto, obrigatório
2. **Fornecedor** — `SearchableSelect` (reusa componente existente)
3. **Item** — `SearchableSelect` (reusa componente existente)
4. **Subcategoria / Categoria** — derivadas do item (exibidas, não editáveis), ou `SearchableSelect` se item não tiver classificação
5. **Tag** — `SearchableSelect` (reusa componente existente)
6. **Qtd** — input numérico, default `1`
7. **Valor unitário** — input numérico `R$`
8. **Nº Nota** — input texto, opcional
9. **Frequência** — select com as 9 opções
10. **Dia base** — input numérico 1–31 (aparece só para frequências ≥ mensal) ou derivado automaticamente para frequências menores
11. **Data de início** — date picker `DD/MM/YYYY`
12. **Data de fim** — date picker `DD/MM/YYYY`, opcional ("sem data de encerramento")

---

## `recorrentesCalc.js` — funções puras (testáveis sem React)

```js
// Retorna array de datas (strings DD/MM/YYYY) para o template no intervalo [de, ate]
calcularOcorrencias(template, de, ate)

// Aplica exceções: substitui os campos da ocorrência quando existe exceção para aquela data
aplicarExcecoes(ocorrencias, excecoes)

// Retorna o último dia do mês (resolve dia 31 em fev, etc.)
ultimoDiaMes(mes, ano) // mes: 1-12

// Dada uma frequência e data anterior, retorna a próxima data
proximaData(frequencia, dataAnterior, diaBase)
```

---

## Inicialização da planilha (`initSheets`)

Adicionar verificação/criação das novas abas:

### Aba: `CUSTOS_RECORRENTES`
```
| UUID | DESCRICAO | FORNECEDOR | ITEM | SUB_CATEGORIA | CATEGORIA | TAG | QTD | VALOR_UNIT | NUM_NOTA | FREQUENCIA | DIA_BASE | DATA_INICIO | DATA_FIM | ULTIMO_LANCAMENTO | ATIVO |
```

### Aba: `CUSTOS_RECORRENTES_EXCECOES`
```
| UUID_EXCECAO | UUID_TEMPLATE | DATA_EXCECAO | DESCRICAO | FORNECEDOR | ITEM | SUB_CATEGORIA | CATEGORIA | TAG | QTD | VALOR_UNIT | NUM_NOTA |
```

---

## Controle de acesso (perfil `leitura`)

Seguindo o padrão já estabelecido no middleware `escritaRequerAdmin`:

- Perfil `leitura` **vê** o calendário e os detalhes dos eventos
- Perfil `leitura` **não vê** os botões: "+ Novo Recorrente", "Editar", "Cancelar recorrência"
- O middleware já bloqueia automaticamente qualquer `POST/PUT/DELETE` por método — sem necessidade de rota específica

---

## Itens explicitamente fora de escopo desta versão

- Notificação por e-mail/push quando um custo é lançado
- Exportação do calendário (PDF, iCal)
- Recorrência com dia da semana fixo (ex: "toda segunda-feira") — a frequência `semanal` usa intervalo de 7 dias a partir de `DATA_INICIO`
- Recorrência com múltiplas datas no mês (ex: "dia 5 e dia 20")
- Dashboard específico de recorrentes (possível evolução futura)
- Arrastar e soltar eventos no calendário

---

## Ordem de execução sugerida

1. `recorrentesCalc.js` — funções puras (sem dependência externa, testável imediatamente)
2. `initSheets` — adicionar as duas novas abas
3. Backend: `services/recorrentes.js` + `routes/recorrentes.js` + registro em `app.js`
4. Backend: `processarPendentes()` disparado no login (`routes/auth.js`)
5. Backend: filtro por intervalo de datas em `custos.js` + `routes/custos.js`
6. Frontend: `api/recorrentes.js`
7. Frontend: `CalendarioMensal.jsx`, `CalendarioSemanal.jsx`, `CalendarioDiario.jsx`
8. Frontend: `RecorrenteForm.jsx` + `RecorrenteDialog.jsx`
9. Frontend: `Recorrentes.jsx` (página principal, integra tudo)
10. Frontend: rota + sidebar em `App.jsx` + `Layout.jsx`
11. **PARTE 1:** paginação em `Custos.jsx` + `styles.css` (pode ser feito antes ou depois, é independente)

---

## Paleta e padrões visuais (reforço)

Seguir os padrões já estabelecidos no projeto:

- Coral `#FF8B7C` — eventos recorrentes futuros
- Teal `#4F868F` — destaques secundários
- Oliva `#BFCB7F` — badges de confirmação / lançado
- Areia `#D7C4B6` — eventos de custo manual
- Verde `#18322E` — sidebar, cabeçalhos
- Reutilizar: `SearchableSelect`, `Modal`, `ConfirmDialog`, `brl()`, `brlCompact()`
- CSS: seguir convenção de classes já existente (kebab-case, prefixo por módulo: `.recorrente-*`, `.cal-*`)
- Responsividade: ponto de corte `≤520px` para mobile, `≤820px` para drawer da sidebar (já estabelecidos)

---

## Ajustes acordados — 07/08/2026

> Registro da conversa de alinhamento feita **antes de escrever qualquer linha de código**. O
> documento original foi conferido linha a linha contra o código real (`services/custos.js`,
> `services/sheets.js`, `middleware/auth.js`, `routes/auth.js`, `pages/Custos.jsx`,
> `components/Layout.jsx`). O que está aqui **prevalece** sobre o texto acima quando houver conflito.
>
> Nada foi implementado ainda.

### 1. Decisões tomadas pelo gestor

| # | Tema | Decisão |
|---|---|---|
| 1 | **Rastreio do lançamento** | Acrescentar a coluna **`UUID_RECORRENTE`** em `CUSTOS`, após `CHAVE_NFE`, gravando o UUID do template + a data da ocorrência. |
| 2 | **Gatilho do processamento** | **Somente o botão manual.** Sem hook no login, sem hook no boot. |
| 3 | **Ocorrências retroativas** | **Nada retroativo no cadastro.** `DATA_INICIO` no passado apenas ancora o ciclo. |
| 4 | **Vencidas acumuladas** | O botão é um **"colocar em dia"**: lança tudo que venceu desde a criação, cada uma na sua data, com prévia antes de gravar. |
| 5 | **Limite de 100 em Custos** | Total e contagem seguem sobre o **conjunto filtrado inteiro**; o checkbox do cabeçalho passa a marcar **só as 100 linhas renderizadas**. |

#### Por que a coluna `UUID_RECORRENTE` (decisão 1)

O `ULTIMO_LANCAMENTO` sozinho é memória do template, não da planilha. Se o usuário excluir na tela de
Custos um lançamento gerado, o template continua achando que lançou: o calendário segue marcando ✓ e
**aquela data nunca mais é gerada** — some do sistema sem sinal. Com a coluna, a verificação passa a ser
feita contra a própria `CUSTOS` ("existe linha do template X na data D?"), o que torna o processamento
**idempotente**, devolve o custo excluído ao calendário e permite que "Ver em Custos" aponte a linha
exata em vez de só filtrar pela data.

O `ULTIMO_LANCAMENTO` **permanece na aba**, rebaixado a atalho de leitura (evita varrer `CUSTOS` para
pintar o calendário) — não é mais a trava.

Custo aceito: uma coluna a mais na aba mais pesada da planilha, contando no orçamento de 10M células. Não
exige mexer na planilha à mão — o `initSheets` já sincroniza o cabeçalho de todas as abas a cada boot.

#### Consequências do gatilho manual (decisão 2)

- **Resolve** a janela de corrida descrita na seção "Proteção anti-duplicação": só um admin clicando gera
  custo, e o perfil `leitura` já é barrado por método no `escritaRequerAdmin`. O risco residual registrado
  no doc original deixa de existir na prática (e, com a decisão 1, deixa de existir por construção).
- **Cria** o risco oposto: ninguém clica, nada é lançado. Mitigação obrigatória — a página Recorrentes
  abre com uma faixa de aviso *"N ocorrências vencidas aguardando lançamento"* ao lado do botão.
- O disparo em `routes/auth.js` **sai de escopo**. A tabela "Arquivos alterados" deixa de incluir
  `backend/src/routes/auth.js`, e `app.js` só registra a rota nova.

#### Semeadura do `ULTIMO_LANCAMENTO` na criação (decisão 3)

Ao criar o template, gravar em `ULTIMO_LANCAMENTO` a **última ocorrência estritamente anterior a hoje**
(vazio se não houver). Assim:

| Caso | Resultado |
|---|---|
| `DATA_INICIO` no passado | Ocorrências anteriores a hoje não são lançadas; o ciclo fica ancorado corretamente |
| `DATA_INICIO` = hoje | A ocorrência de hoje **é** lançada no próximo clique |
| `DATA_INICIO` no futuro | `ULTIMO_LANCAMENTO` fica vazio; a primeira ocorrência é a própria `DATA_INICIO` |

### 2. 🔴 Correções à especificação (divergências com o código real)

| # | O que o doc dizia | O que o código exige | Correção |
|---|---|---|---|
| 1 | `CUSTOS.ITEM` ← "UUID do item no template" | `CUSTOS.ITEM` guarda a **descrição** do item (`custos.js:93`) | O template guarda o **UUID** (estável contra renomeação); na hora de gravar o custo, resolve para `DESCRICAO_ITEM`. Gravar UUID quebraria os 3 dashboards (agrupam por `c.ITEM` como texto), o `limparItensOrfaos()` (`custos.js:146`), o back-fill de classificação e o filtro de item da tela de Custos. |
| 2 | `NUM_NOTA` opcional | `montarLinha()` lança `'NUM_NOTA é obrigatório'` | Vazio vira `"Sem Nota"` — a mesma convenção da importação em lote. |
| 3 | `TAG` livre no template | `TAG` só é gravada quando `exigeTag(CATEGORIA)` — FOLHA CANOAS/POA/TELE (`custos.js:74`) | Mantida a regra existente. O campo Tag do formulário aparece condicionado à categoria, igual ao `Custos.jsx`. Mudar isso alteraria a regra do módulo de Custos inteiro. |
| 4 | *"Filtrar as datas **>** `ULTIMO_LANCAMENTO` (ou **>** `DATA_INICIO` se vazio)"* | — | **Bug do algoritmo:** com `>`, a primeira ocorrência nunca é lançada. Correto é **`>= DATA_INICIO`** no caso vazio. |
| 5 | Cancelar grava `DATA_FIM = data - 1` **e** `ATIVO = "nao"` juntos | — | **Contradição:** com data futura, o `ATIVO = "nao"` para o processamento na hora e as ocorrências entre hoje e a data escolhida nunca são lançadas — o oposto de "cancelar a partir de 20/09". Correto: gravar `DATA_FIM`; `ATIVO = "nao"` **só quando a data já passou** (o template sai de circulação sozinho quando `DATA_FIM < hoje`). |
| 6 | `semFiltroAtivo` com `filtroMesAno`, `filtroFornecedor`, `filtroSubcat`, `filtroTag`, `filtroNota`, `filtroDia` | Os estados reais são `fMesAnos`, `fFornecedor`, `fSubcats`, `fTag`, `fNota`, `fDia` — **e mais `fCategoria` e `fItem`**, que o doc esqueceu | Nomes corrigidos e os dois filtros faltantes entram na conta; senão o limite continuaria ativo com filtro de categoria ou de item aplicado. |
| 7 | `comparaData` no trecho de exemplo | Não existe no projeto; `filtrados` hoje **não tem ordenação nenhuma** (sai na ordem de inserção da planilha) | Escrever o comparador. "Com filtro: mantém a ordenação existente" = mantém a ordem da planilha. |
| 8 | Aba de exceções só substitui valores | — | Não cobre **"pular esta ocorrência"** (caso real: "este mês não lança") nem mover a ocorrência de data. Acrescentada a coluna **`ACAO`** (`alterar` / `pular`). |

#### Aba `CUSTOS_RECORRENTES_EXCECOES` — layout revisado

```
| UUID_EXCECAO | UUID_TEMPLATE | DATA_EXCECAO | ACAO | DESCRICAO | FORNECEDOR | ITEM | SUB_CATEGORIA | CATEGORIA | TAG | QTD | VALOR_UNIT | NUM_NOTA |
```

`ACAO = "pular"` ignora a ocorrência daquela data; `ACAO = "alterar"` usa os campos da exceção no lugar
dos do template.

#### Aba `CUSTOS` — layout revisado

```
| … | VALOR_TOTAL | TAG | CHAVE_NFE | UUID_RECORRENTE |
```

### 3. Premissas de implementação

- **`DIA_BASE`** manda nas frequências **mensais ou maiores**: a primeira ocorrência é a primeira data
  `>= DATA_INICIO` cujo dia bate com o `DIA_BASE`. Nas frequências **menores que mensal**, o ciclo sai da
  `DATA_INICIO` e o campo some do formulário (o doc já previa isso no item 10 do form).
- **Dia inexistente no mês** → último dia do mês (mantido como no doc).
- **Comparação de datas por valor**, nunca como string — `DD/MM/YYYY` ordena errado lexicograficamente.
- **Sem cache** no serviço novo. É a regra que saiu da 1.7.1: cache em memória é incompatível com deploy
  multiprocesso (VM + um backend embutido por instalação desktop) sem canal de invalidação.
- **`?dataInicio` / `?dataFim`** no `GET /api/custos` entram **opcionais e retrocompatíveis** — a chamada
  sem parâmetro segue devolvendo tudo, como hoje.
- **Sidebar:** seção própria 🗓 **Recorrentes**, seguindo o precedente do Caixa (módulo com tela própria
  ganha seção em vez de entrar em "Lançamentos").
- **Sem biblioteca de calendário nova** — componentes próprios, como o doc já pedia.
- **Perfil `leitura`:** vê o calendário e os detalhes; não vê "+ Novo Recorrente", "Editar", "Cancelar"
  nem o botão de processar. O `POST /api/recorrentes/processar` já é barrado por método no
  `escritaRequerAdmin` — sem rota específica.
- **Versão 1.8.0** em `desktop/package.json` e `frontend/package.json`.

### 4. Limitação de validação registrada

O `backend/.env` de desenvolvimento segue com a **chave do Google revogada** (pendência herdada desde a
1.6.0). Portanto **a escrita real na planilha não será exercitada**. A validação seguirá o mesmo padrão
da 1.7.1:

- funções puras de `recorrentesCalc.js` com casos de borda — fevereiro, dia 31, ano bissexto, virada de
  ano, `DATA_FIM`, exceções `alterar` e `pular`;
- `services/recorrentes.js` real rodado contra **dublês** da camada `sheets.js` (mesmas assinaturas),
  incluindo o teste de **idempotência**: processar duas vezes seguidas não pode gerar linha duplicada.

**Fica pendente para o gestor:** repor o `GOOGLE_CREDENTIALS_JSON` e fazer o teste de ponta a ponta —
clicar em "Processar" e ver a linha aparecer na planilha com o `UUID_RECORRENTE` preenchido.

### 5. Ordem de execução revisada

1. `recorrentesCalc.js` + testes das funções puras
2. `initSheets` — duas abas novas **+ a coluna `UUID_RECORRENTE` em `CUSTOS`**
3. `services/recorrentes.js` + `routes/recorrentes.js` + registro em `app.js`
4. ~~`processarPendentes()` no login (`routes/auth.js`)~~ — **fora de escopo** (decisão 2)
5. Filtro por intervalo de datas em `custos.js` + `routes/custos.js`
6. `api/recorrentes.js`
7. `CalendarioMensal.jsx`, `CalendarioSemanal.jsx`, `CalendarioDiario.jsx`
8. `RecorrenteForm.jsx` + `RecorrenteDialog.jsx`
9. `Recorrentes.jsx` — página, faixa de vencidas, botão de processar com prévia
10. Rota + sidebar em `App.jsx` / `Layout.jsx`
11. **PARTE 1:** paginação em `Custos.jsx` + `styles.css`

---

## Ajustes acordados — parte 2 (07/08/2026, antes de escrever código)

> Segunda conferência do documento contra o código real (`sheets.js`, `custos.js`, `utils/date.js`,
> `middleware/auth.js`, `routes/custos.js`, `app.js`, `pages/Custos.jsx`, `components/Layout.jsx`,
> `api/client.js`). O que está aqui **prevalece** sobre tudo o que veio antes, inclusive sobre a
> seção "Ajustes acordados — 07/08/2026".

### 1. O que a conferência confirmou (a spec estava certa)

`CUSTOS.ITEM` guarda a descrição (`custos.js:93`) e o `limparItensOrfaos()` compara por ela
(`custos.js:146`) · `NUM_NOTA` obrigatório (`custos.js:57`), com `"Sem Nota"` como convenção do import
(`custos.js:474`) · `TAG` só quando `exigeTag(CATEGORIA)` (`custos.js:74`) · os filtros da tela são
`fMesAnos, fDia, fCategoria, fSubcats, fFornecedor, fTag, fNota, fItem` (`Custos.jsx:170-177`) ·
`filtrados` não tem ordenação nenhuma (`Custos.jsx:514`) e `comparaData` não existe no projeto ·
`escritaRequerAdmin` barra escrita por método em todos os grupos protegidos (`middleware/auth.js:29`,
`app.js:90`) · `initSheets` sincroniza o cabeçalho de todas as abas a cada boot (`sheets.js:107-114`).

### 2. 🔴 Contradição entre as decisões 1 e 3 — resolvida com `DATA_CORTE`

**O problema:** se a trava passa a ser "existe linha em `CUSTOS` com este template nesta data?"
(decisão 1), um template com `DATA_INICIO` no passado gera **todas** as ocorrências antigas — nenhuma
delas tem linha. O piso teria que vir do `ULTIMO_LANCAMENTO`; só que ele é atualizado a cada
lançamento, e aí volta a ser trava: um custo excluído na tela **nunca mais** seria regerado, que é
exatamente o que a decisão 1 quis consertar. Os dois papéis não cabem no mesmo campo.

**Decisão do gestor:** nova coluna **`DATA_CORTE`** em `CUSTOS_RECORRENTES`, gravada na criação do
template e **imutável**:

| Campo | Papel |
|---|---|
| `DATA_CORTE` | **Piso.** Última ocorrência estritamente anterior a hoje no momento da criação (vazia se `DATA_INICIO` >= hoje). Nada antes dela é gerado, nunca. Não muda mais. |
| `ULTIMO_LANCAMENTO` | **Atalho de leitura**, atualizado a cada processamento. Serve para pintar o ✓ no calendário sem varrer `CUSTOS`. **Não** é trava. |
| `UUID_RECORRENTE` (em `CUSTOS`) | **Trava real.** Idempotência por ocorrência. |

Efeito combinado: nada retroativo **e** um custo gerado que for excluído na tela de Custos volta à
prévia no próximo "colocar em dia".

### 3. 🔴 Classificação vem do item, não do template

O documento mandava gravar `SUB_CATEGORIA`/`CATEGORIA` "do template". Isso briga com a regra
estabelecida na 1.4.1 — **o item é a fonte da verdade** —, em que reclassificar um item faz back-fill
em todos os custos dele: o processamento reintroduziria a classificação velha a cada ocorrência.

**Decisão do gestor:** na gravação do custo valem a **subcategoria, a categoria e a tag atuais do
item**, lidas do cadastro na hora. As colunas `SUB_CATEGORIA`/`CATEGORIA`/`TAG` do template ficam como
**cópia para exibição** no calendário (evita cruzar `ITENS` para desenhar a tela) — não são fonte.

### 4. Formato do `UUID_RECORRENTE`

`<uuid-do-template>|DD/MM/YYYY` — ex.: `3f2a…-9c1|20/08/2026`. Uma coluna só, e a checagem de
duplicidade vira comparação exata de string. Vazio em todo custo não recorrente.

### 5. Endpoint de prévia (faltava)

A decisão 4 pede prévia antes de gravar e a faixa "N ocorrências vencidas" na abertura da página, mas
a tabela de endpoints só tinha o `POST /processar`. Acrescentado:

| Método | Rota | Ação |
|---|---|---|
| `GET` | `/api/recorrentes/pendentes` | Calcula as ocorrências vencidas **sem gravar** (prévia + faixa). Leitura pura. |

O `POST /api/recorrentes/processar` fica só para efetivar.

### 6. `ensureColumnCapacity` no `initSheets` (risco de derrubar o boot)

`sheets.js` tem `ensureRowCapacity`, mas **não existe equivalente para colunas**, e o `initSheets`
grava o cabeçalho com `values.update` em `A1`. Se a grade da aba `CUSTOS` estiver com exatamente 16
colunas, a 17ª estoura a grade e o boot passa a falhar — na web **e** em toda instalação desktop ao
mesmo tempo. Abas criadas pelo Google nascem com 26 colunas, então provavelmente passaria; como a
planilha não é verificável daqui (chave de dev revogada), entra um guard `ensureColumnCapacity`
análogo ao de linhas.

### 7. A linha do custo é montada no serviço novo, não pelo `montarLinha`

`montarLinha` rejeita `NUM_NOTA` vazio e devolve **15 colunas** (a aba tem 16). É por isso que editar
um custo pela tela **não apaga a `CHAVE_NFE`**: o `values.update` escreve só de `A` até `O`. O
`UUID_RECORRENTE`, na 17ª coluna, herda a mesma proteção — **editar um custo gerado preserva o
rastro**, que é o comportamento desejado.

Fazer `montarLinha` devolver 17 colunas quebraria isso (gravaria `''` por cima da `CHAVE_NFE` na
edição pelo formulário). O serviço novo monta a própria linha, como o `importarLoteXml` já faz
(`custos.js:471`).

### 8. Duplicação da matemática de recorrência — deliberada, com teste de paridade

O cálculo das ocorrências precisa existir **nos dois lados**: no backend para gerar os custos, e no
frontend para desenhar o calendário sem uma ida ao servidor a cada troca de mês (é justamente para
isso que o `ULTIMO_LANCAMENTO` foi mantido como atalho). O backend não pode importar de
`frontend/src/` — essa pasta não é empacotada junto do backend no Electron.

Então são dois arquivos espelhados: **`backend/src/utils/recorrencia.js`** (canônico) e
**`frontend/src/utils/recorrentesCalc.js`**. Para que não haja deriva silenciosa, a validação inclui um
**teste de paridade** que roda a mesma bateria de casos nos dois módulos e exige resultado idêntico.

### 9. Ajustes menores

- `recorrentesApi` entra em **`src/api/resources.js`** (convenção do projeto), em vez do
  `src/api/recorrentes.js` que o documento propunha.
- `?dataInicio` / `?dataFim` economizam **payload e renderização**, não leitura da planilha — o
  `listar()` lê a aba inteira de qualquer forma. Seguem válidos e retrocompatíveis.
- Item apagado do cadastro → a ocorrência entra na prévia como **erro**, sem gerar linha torta.

### 10. Ordem de execução final

1. `backend/src/utils/recorrencia.js` (canônico) + `frontend/src/utils/recorrentesCalc.js` (espelho)
2. Testes das funções puras + **paridade** entre os dois módulos
3. `sheets.js` — `UUID_RECORRENTE` em `CUSTOS`, as duas abas novas (com `DATA_CORTE`) e o
   `ensureColumnCapacity`
4. `services/recorrentes.js` + `routes/recorrentes.js` + registro em `app.js`
5. `?dataInicio`/`?dataFim` em `custos.js` + `routes/custos.js`
6. `recorrentesApi` em `resources.js`
7. Componentes de calendário → `RecorrenteForm` / `RecorrenteDialog` → `Recorrentes.jsx`
8. Rota + sidebar (seção própria 🗓, precedente do Caixa)
9. **PARTE 1:** paginação em `Custos.jsx` + `styles.css`
10. Versão **1.8.0** em `desktop/package.json` e `frontend/package.json`
