# Nova Feature — Importação de Custo via NFS-e (PDF)

> Especificação para implementação via Claude CLI. Complementa o `KAMPEKI_APP_BRIEF.md` — não substitui nenhuma regra existente, apenas adiciona um novo caminho de lançamento de Custo.

## Contexto

O app já tem dois caminhos de lançamento de Custo: formulário manual e importação de **NF-e de produto** via `.zip` de XML (um custo por `<det>` da nota). Esta feature adiciona um **terceiro caminho**: importação de **NFS-e de serviço** (Documento Auxiliar da NFS-e, padrão nacional **DANFSe v1.0**) a partir de um **arquivo PDF único**, gerando **um único lançamento de Custo** por nota (diferente do XML, uma NFS-e de serviço = um item = um custo, sempre `QTD = 1`).

O DANFSe é um layout padronizado nacionalmente — os rótulos e a disposição dos campos são idênticos independente da prefeitura emissora (validado com notas de Porto Alegre e Canoas). O PDF tem texto real selecionável (não é imagem escaneada), então a extração é por leitura de texto, não OCR.

## Escopo desta primeira versão

- ✅ Upload de **um PDF por vez** (fluxo tipo formulário, com etapa de conferência antes de salvar). Importação em lote (múltiplos PDFs de uma vez) fica **fora de escopo agora**, mas o desenho do backend deve deixar isso fácil de adicionar depois (ver "Fora de escopo").
- ✅ Suporta apenas o padrão de PDF que os exemplos seguem (DANFSe v1.0, texto selecionável). **Não** há suporte a foto/print/imagem (OCR) nesta versão.
- ✅ Casamento de Fornecedor **só por nome** (mesmo critério já usado no import de NF-e XML). Não usa CNPJ/CPF como chave.

## Mapeamento de campos (PDF → Custo)

| Campo no PDF (DANFSe) | Campo em `CUSTOS` | Regra |
|---|---|---|
| Competência da NFS-e | `DATA_NOTA` | Já vem em `DD/MM/YYYY`. Sistema deriva `MES_ANO`, `MES_NUM`, `ANO`, `DIA_MES_ANO` automaticamente, como já ocorre hoje em qualquer lançamento. |
| Número da NFS-e | `NUM_NOTA` | Valor direto (ex: `11`, `49`). |
| Nome/Nome Empresarial (bloco **EMITENTE DA NFS-e** — Prestador do Serviço) | `FORNECEDOR` | Ver regra de limpeza abaixo. Casa por nome (case-insensitive) com `FORNECEDOR` existente; se não existir, **cria** — mesmo comportamento do import de NF-e XML. |
| Código de Tributação Nacional (bloco **SERVIÇO PRESTADO**) | `ITEM` | Ver regra de limpeza abaixo. |
| Valor Líquido da NFS-e (bloco **VALOR TOTAL DA NFS-E**) | `VALOR_UNIT` **e** `VALOR_TOTAL` | Os dois recebem o mesmo valor, pois `QTD` é sempre 1. |
| — | `QTD` | Fixo em `1`. Não vem do PDF. |
| Chave de Acesso da NFS-e | `CHAVE_NFE` | Reaproveita a coluna já existente em `CUSTOS` (criada para o import de NF-e XML) como chave de deduplicação. Nota: a chave de NFS-e tem tamanho diferente da chave de NF-e de produto (44 dígitos) — a coluna é texto livre, então isso não é um problema técnico, só uma observação. |

Campos **não mapeados** (ignorados nesta versão, por não terem correspondente em `CUSTOS`): Descrição do Serviço, dados de tributação (ISSQN, IRRF, PIS/COFINS), CNPJ/CPF do emitente, dados do tomador.

`SUB_CATEGORIA`/`CATEGORIA`/`TAG` seguem exatamente a mesma lógica já implementada para itens de folha e para o import de NF-e XML:
- Se o `ITEM` (após limpeza) já existir cadastrado e classificado em `ITENS`, herda `SUB_CATEGORIA`/`CATEGORIA`/`TAG` dele.
- Se o `ITEM` for novo, é criado em `ITENS` no estado **"a classificar"** (sem subcategoria/categoria), e o custo entra com esses campos em branco — aparece no fluxo já existente de `ClassificarItensModal` / contador "⚠ N item(ns) a classificar".
- Se o item (existente ou recém-classificado) tiver `TAG`, o custo herda a tag automaticamente (regra já implementada em `montarLinha`/`resolverTagItem`).

## Regras de limpeza de texto

### `ITEM` — remover o código do início

O "Código de Tributação Nacional" vem sempre como `NN.NN.NN - Descrição...` (dois dígitos, ponto, dois dígitos, ponto, dois dígitos, hífen, espaço, descrição).

```
Regex: /^\d{2}\.\d{2}\.\d{2}\s*-\s*/
Ação: remover essa ocorrência do início da string, manter o resto (trim).

Exemplos:
"07.11.02 - Jardinagem, inclusive corte e poda de árvores."
  → "Jardinagem, inclusive corte e poda de árvores."

"14.01.01 - Lubrificação, limpeza, lustração, revisão, carga e recarg..."
  → "Lubrificação, limpeza, lustração, revisão, carga e recarg..."
```

> **Observação conhecida:** quando a descrição do serviço é longa, o próprio PDF da prefeitura já entrega o texto truncado com `...` (é limitação de layout da fonte, célula de largura fixa no DANFSe — não é algo introduzido pela nossa extração). Nesses casos o `ITEM` é importado truncado mesmo, igual ao PDF. Recuperar o texto completo exigiria uma tabela externa de códigos de serviço (LC 116), o que fica como possível melhoria futura, fora do escopo agora.

### `FORNECEDOR` — remover CPF/CNPJ colado no final do nome

O campo "Nome/Nome Empresarial" do emitente, quando é pessoa física (MEI/autônomo), costuma vir com o CPF colado no final, sem separador claro além do espaço.

```
Regex: /\s*\d{9,}\s*$/
Ação: remover essa ocorrência do final da string (trim resultante).
Limite de 9+ dígitos para evitar cortar por engano algum nome empresarial
que legitimamente termine em número curto.

Exemplos:
"JEREMIAS RODRIGUES MULLER 01418331066" → "JEREMIAS RODRIGUES MULLER"
"PAULO CESAR DE OLIVEIRA 55473580025"   → "PAULO CESAR DE OLIVEIRA"
```

## Fluxo do usuário

1. Na página **Custos**, novo botão **"Importar NFS-e (PDF)"** (ao lado dos já existentes "Importar planilha" e "Importar NF-e (.zip)").
2. Usuário seleciona **um** arquivo PDF.
3. Frontend extrai o texto do PDF e localiza os campos pelos rótulos (ver "Arquitetura" abaixo).
4. Abre uma **tela de conferência** (mesmo espírito da prévia do `ImportModal`), mostrando os campos já extraídos e limpos, **editáveis** antes de salvar:
   - Data (Competência)
   - Nº Nota
   - Fornecedor (com indicação se é "existente" ou "novo — será criado")
   - Item (com indicação se é "existente, classificado", "existente, a classificar" ou "novo — será criado como a classificar")
   - Valor (Qtd fixo em 1, Valor Unit., Total)
5. Se a `CHAVE_NFE` já existir em `CUSTOS`, mostra aviso claro ("Esta nota já foi importada em DD/MM/YYYY") e **bloqueia** o salvamento (nesta versão, sem opção de forçar duplicata — igual ao espírito do dedup do NF-e XML, mas aqui é sempre 1 nota por vez, então o alerta pode ser direto e travar o fluxo em vez de "pular" silenciosamente).
6. Usuário confirma → salva o Custo.

## Arquitetura sugerida

Mesma filosofia já usada no import de NF-e XML: **extração no frontend, inteligência de negócio no backend.**

### Frontend

- Nova dependência: `pdfjs-dist` (extração de texto de PDF no navegador — não precisa OCR).
- Novo util `src/utils/parseNfsePdf.js`:
  - Recebe o arquivo PDF, extrai o texto via `pdfjs-dist`.
  - Localiza cada campo por âncora de rótulo (ex: procurar `"Competência da NFS-e"` e capturar o valor que vem em seguida no texto extraído).
  - Aplica as regras de limpeza de `ITEM` e `FORNECEDOR` descritas acima.
  - Retorna um objeto normalizado, ex:
    ```json
    {
      "chaveNfse": "43046062228486324000109000000000004926066563079848",
      "numNota": "49",
      "dataNota": "26/06/2026",
      "fornecedor": "PAULO CESAR DE OLIVEIRA",
      "item": "Jardinagem, inclusive corte e poda de árvores.",
      "valor": 3480.00
    }
    ```
  - Se algum campo obrigatório não for encontrado no texto, retorna erro claro para a tela de conferência (ex: "Não foi possível localizar 'Valor Líquido da NFS-e' neste PDF") — usuário pode preencher manualmente antes de salvar, em vez de travar totalmente.
- Novo componente `ImportNfsePdfModal.jsx` (ou reaproveitar `ImportModal` com uma variante) para a tela de conferência descrita no fluxo acima.
- `src/api/resources.js`: novo método `custosApi.importarNfse(payload)`.

### Backend

- Novo endpoint `POST /custos/import-nfse` — recebe o objeto já normalizado (chave, número, data, fornecedor, item, valor) e o usuário confirma o commit desse único registro.
- Novo serviço `custos.importarNfse({ chaveNfse, numNota, dataNota, fornecedor, item, valor })` em `src/services/custos.js`, reaproveitando o máximo possível da lógica já existente do `importarLoteXml`:
  1. **Dedup:** verificar se `chaveNfse` já existe em `CUSTOS.CHAVE_NFE` → se sim, retornar erro/aviso específico (nota já importada), sem gravar.
  2. **Fornecedor:** buscar por nome (case-insensitive) em `FORNECEDOR`; se não existir, criar.
  3. **Item:** buscar por descrição (case-insensitive) em `ITENS`; se não existir, criar como "a classificar" (sem subcategoria/categoria); se existir, usar `SUB_CATEGORIA`/`CATEGORIA`/`TAG` do sistema.
  4. **Datas:** derivar `MES_ANO`/`MES_NUM`/`ANO`/`DIA_MES_ANO` de `dataNota`, reaproveitando os helpers de `src/utils/date.js`.
  5. **Valores:** `QTD = 1`; `VALOR_UNIT = VALOR_TOTAL = valor` (arredondado a 2 casas).
  6. **Tag:** herdar `item.TAG` se aplicável, reaproveitando o fallback já existente em `montarLinha`.
  7. Gravar a linha completa em `CUSTOS`, incluindo `CHAVE_NFE`.
- Nova rota em `src/routes/custos.js`: `POST /custos/import-nfse`.

## Fora de escopo (nesta versão, mas já pensando à frente)

- **Importação em lote** (múltiplos PDFs de uma vez, com resumo tipo o do NF-e XML — "N notas importadas, N puladas por duplicidade"). O backend já nasce desenhado por nota individual (`importarNfse` recebe um objeto só), então adicionar lote depois é basicamente iterar essa mesma função por múltiplos arquivos — baixo retrabalho.
- **Suporte a foto/print (OCR).** Só PDF com texto selecionável por enquanto.
- **Casamento de Fornecedor por CNPJ/CPF.** Mantido só por nome, como hoje. Se no futuro isso virar necessário, exigiria adicionar uma coluna de CNPJ/CPF em `FORNECEDOR` e ajustar o casamento — decisão consciente de não fazer agora.
- **Tabela de códigos de serviço (LC 116) para recuperar descrições truncadas.** Fica como melhoria futura opcional.

## Validação esperada ao final da implementação

- `node --check` nos arquivos backend alterados.
- `vite build` no frontend.
- Teste manual com os dois PDFs de exemplo (Porto Alegre e Canoas), cobrindo:
  - Fornecedor novo sendo criado corretamente (nome limpo, sem CPF colado).
  - Item novo entrando como "a classificar" e aparecendo no `ClassificarItensModal`.
  - Reimportar o mesmo PDF → bloqueado por `CHAVE_NFE` duplicada.
  - `VALOR_UNIT`/`VALOR_TOTAL` batendo com "Valor Líquido da NFS-e", `QTD = 1`.
