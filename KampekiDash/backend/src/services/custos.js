import {
  getObjects, appendRow, appendRows, updateRowByUuid, deleteRowByUuid,
  updateColumnForUuids,
} from './sheets.js';
import { invalidate } from './cache.js';
import { newUuid } from '../utils/uuid.js';
import { derivarCamposData, ultimoDiaDoMes } from '../utils/date.js';
import { exigeTag, categoriaDe } from '../utils/switch-categoria.js';
import { buscarPorUuid as buscarItem } from './itens.js';
import { listar as listarFornecedores } from './fornecedor.js';
import { tagExiste } from './tag.js';

const TAB = 'CUSTOS';

// Converte valor em número. Aceita number nativo (vindo do xlsx) e strings em
// formato pt-BR ("R$ 1.234,56") ou en ("1234.56").
function num(v) {
  if (typeof v === 'number') return v;
  let s = String(v ?? '').trim();
  if (!s) return NaN;
  s = s.replace(/r\$/i, '').replace(/\s/g, '');
  if (s.includes(',') && s.includes('.')) {
    // 1.234,56 -> 1234.56 (ponto = milhar, vírgula = decimal)
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : NaN;
}

function norm(s) {
  return String(s || '').trim().toUpperCase();
}

// Resolve o VALOR_TOTAL conforme a regra de negócio: se um total foi informado
// (manualmente no formulário ou na coluna TOTAL do arquivo) e é > 0, ele é
// respeitado; caso contrário (vazio/zero/inválido) recalcula QTD × VALOR_UNIT.
// Sempre arredondado para 2 casas.
function resolverTotal(qtd, valorUnit, totalInformado) {
  const t = num(totalInformado);
  if (Number.isFinite(t) && t > 0) return +t.toFixed(2);
  return +(qtd * valorUnit).toFixed(2);
}

export async function listar() {
  return getObjects(TAB);
}

// Monta a linha de custo a partir do payload, derivando todos os campos.
async function montarLinha(uuid, payload) {
  const {
    DATA_NOTA, NUM_NOTA, FORNECEDOR, ITEM_UUID, QTD, VALOR_UNIT, VALOR_TOTAL, TAG,
  } = payload;

  if (!DATA_NOTA) throw new Error('DATA_NOTA é obrigatória');
  if (!NUM_NOTA && NUM_NOTA !== 0) throw new Error('NUM_NOTA é obrigatório');
  if (!FORNECEDOR) throw new Error('FORNECEDOR é obrigatório');
  if (!ITEM_UUID) throw new Error('ITEM é obrigatório');

  const qtd = num(QTD);
  const valorUnit = num(VALOR_UNIT);
  if (!Number.isFinite(qtd) || qtd <= 0) throw new Error('QTD inválida');
  if (!Number.isFinite(valorUnit) || valorUnit < 0) throw new Error('VALOR_UNIT inválido');

  const item = await buscarItem(ITEM_UUID);
  if (!item) throw new Error('Item não encontrado');

  const { MES_ANO, MES_NUM, ANO, DIA_MES_ANO } = derivarCamposData(DATA_NOTA);
  // Total informado manualmente é respeitado; senão calcula QTD × VALOR_UNIT.
  const valorTotal = resolverTotal(qtd, valorUnit, VALOR_TOTAL);

  let tag = '';
  if (exigeTag(item.CATEGORIA)) {
    tag = String(TAG || '').trim();
    if (!tag) throw new Error('TAG é obrigatória para categorias de folha');
    if (!(await tagExiste(tag))) throw new Error('TAG não cadastrada');
  }

  // Ordem das colunas: UUID, DATA_NOTA, NUM_NOTA, MES_ANO, MES_NUM, ANO,
  // DIA_MES_ANO, FORNECEDOR, ITEM, SUB_CATEGORIA, CATEGORIA, QTD, VALOR_UNIT,
  // VALOR_TOTAL, TAG
  return [
    uuid,
    DATA_NOTA,
    String(NUM_NOTA),
    MES_ANO,
    MES_NUM,
    ANO,
    DIA_MES_ANO,
    FORNECEDOR,
    item.DESCRICAO_ITEM,
    item.SUB_CATEGORIA,
    item.CATEGORIA,
    qtd,
    valorUnit,
    valorTotal,
    tag,
  ];
}

export async function criar(payload) {
  const uuid = newUuid();
  const linha = await montarLinha(uuid, payload);
  await appendRow(TAB, linha);
  return { UUID: uuid };
}

export async function atualizar(uuid, payload) {
  const linha = await montarLinha(uuid, payload);
  await updateRowByUuid(TAB, uuid, linha);
  return { UUID: uuid };
}

export async function remover(uuid) {
  await deleteRowByUuid(TAB, uuid);
  return { ok: true };
}

// Campos permitidos na edição em massa (o mesmo valor é replicado a todos os
// registros selecionados).
const CAMPOS_MASSA = { TAG: 'TAG', FORNECEDOR: 'FORNECEDOR' };

/**
 * Edição em massa: aplica o mesmo `valor` ao `campo` de todos os `uuids`.
 * Ex.: tagear de uma vez vários custos de folha.
 * Valida o valor conforme o campo (TAG cadastrada; FORNECEDOR existente).
 */
export async function atualizarEmMassa({ uuids, campo, valor }) {
  if (!Array.isArray(uuids) || uuids.length === 0) {
    throw new Error('Nenhum registro selecionado');
  }
  const field = CAMPOS_MASSA[String(campo || '').toUpperCase()];
  if (!field) throw new Error('Campo não permitido para edição em massa');

  const valorFinal = String(valor ?? '').trim();

  if (field === 'TAG') {
    // Vazio = limpar a tag. Caso contrário, precisa existir.
    if (valorFinal && !(await tagExiste(valorFinal))) throw new Error('TAG não cadastrada');
  } else if (field === 'FORNECEDOR') {
    if (!valorFinal) throw new Error('Fornecedor é obrigatório');
    const existe = (await listarFornecedores())
      .some((f) => norm(f.NOME_FORNECEDOR) === norm(valorFinal));
    if (!existe) throw new Error('Fornecedor não cadastrado');
  }

  const atualizados = await updateColumnForUuids(TAB, field, uuids, valorFinal);
  return { atualizados, campo: field };
}

/**
 * Importação em lote de custos antigos.
 * Cada row (já normalizada pelo parser do frontend):
 *   { DATA_NOTA: 'DD/MM/YYYY', NUM_NOTA, FORNECEDOR, ITEM,
 *     SUB_CATEGORIA, CATEGORIA, QTD, VALOR_UNIT, VALOR_TOTAL }
 *
 * Regras:
 *  1. MES_ANO/MES_NUM/ANO/DIA_MES_ANO derivados de DATA_NOTA. Linha sem data
 *     recebe o último dia do mês de `fallbackMesAno` (definido pelo usuário no
 *     front a partir dos meses presentes no arquivo). Sem fallback, é rejeitada.
 *  2. Nota em branco vira "Sem Nota".
 *  3. Fornecedor inexistente é criado (case-insensitive). Fornecedor em branco
 *     vira "Sem Fornecedor" (também cadastrado).
 *  4. Item existente: usa SUB_CATEGORIA/CATEGORIA do sistema (ignora o arquivo).
 *     Item novo: cadastra (categoria derivada da subcategoria, com fallback
 *     para a categoria do arquivo) e então usa.
 *  5. VALOR_TOTAL: respeita a coluna TOTAL do arquivo se vier preenchida (>0);
 *     senão recalcula QTD × VALOR_UNIT. Sempre arredondado para 2 casas.
 *  6. TAG fica em branco (itens de folha serão tageados depois).
 *  7. Toda linha válida vira um registro completo em CUSTOS; linhas com dados
 *     faltando são reportadas em errosLista (nunca derrubam a importação).
 *     Registros idênticos com datas diferentes (ou idênticos entre si) sobem
 *     todos — não há dedup de custos.
 *
 * Bases (FORNECEDOR/ITENS) são lidas uma única vez e os novos cadastros são
 * deduplicados em memória — suporta massas grandes com poucas chamadas à API.
 */
export async function importarLote(rows, { fallbackMesAno } = {}) {
  const [fornObjs, itemObjs] = await Promise.all([
    getObjects('FORNECEDOR'),
    getObjects('ITENS'),
  ]);

  const fornByNorm = new Map(fornObjs.map((f) => [norm(f.NOME_FORNECEDOR), f.NOME_FORNECEDOR]));
  const itemByNorm = new Map(itemObjs.map((i) => [norm(i.DESCRICAO_ITEM), i]));

  // Data a aplicar nas linhas sem data (último dia do mês escolhido).
  let fallbackData = null;
  if (fallbackMesAno) {
    try { fallbackData = ultimoDiaDoMes(fallbackMesAno); } catch { fallbackData = null; }
  }

  const novosForn = [];   // linhas p/ FORNECEDOR
  const novosItens = [];  // linhas p/ ITENS
  const novosCustos = []; // linhas p/ CUSTOS

  let vazios = 0;
  let datasAtribuidas = 0;
  const erros = [];

  rows.forEach((r, idx) => {
    const linha = idx + 2; // linha real aproximada na planilha (cabeçalho = 1)
    const fornecedorRaw = String(r?.FORNECEDOR || '').trim();
    const descricao = String(r?.ITEM || '').trim();
    let dataNota = String(r?.DATA_NOTA || '').trim();
    const numNotaRaw = String(r?.NUM_NOTA ?? '').trim();
    const qtd = num(r?.QTD);
    const valorUnit = num(r?.VALOR_UNIT);

    // Linha totalmente vazia: ignora em silêncio (testa os dados ORIGINAIS,
    // antes de aplicar qualquer default — não gera custo fantasma).
    if (!fornecedorRaw && !descricao && !dataNota
        && !Number.isFinite(qtd) && !Number.isFinite(valorUnit)) {
      vazios += 1;
      return;
    }

    // (1) Sem data: usa o último dia do mês de fallback. Sem fallback, rejeita.
    let dataAtribuida = false;
    if (!dataNota) {
      if (!fallbackData) {
        erros.push({ linha, item: descricao || fornecedorRaw || '(linha)', motivo: 'Sem data e sem mês/ano de referência no arquivo' });
        return;
      }
      dataNota = fallbackData;
      dataAtribuida = true;
    }

    // (2)/(3) Defaults para nota e fornecedor em branco.
    const numNota = numNotaRaw || 'Sem Nota';
    const fornecedor = fornecedorRaw || 'Sem Fornecedor';

    const faltando = [];
    if (!descricao) faltando.push('item');
    if (!Number.isFinite(qtd) || qtd <= 0) faltando.push('quantidade');
    if (!Number.isFinite(valorUnit) || valorUnit < 0) faltando.push('valor unitário');
    if (faltando.length) {
      erros.push({ linha, item: descricao || fornecedor || '(linha)', motivo: `Faltando: ${faltando.join(', ')}` });
      return;
    }

    let campos;
    try {
      campos = derivarCamposData(dataNota);
    } catch (e) {
      erros.push({ linha, item: descricao, motivo: `Data inválida (${dataNota}): ${e.message}` });
      return;
    }
    if (dataAtribuida) datasAtribuidas += 1;

    // (3) Fornecedor: cria se não existir (inclui o "Sem Fornecedor").
    const fkey = norm(fornecedor);
    let fornecedorNome = fornByNorm.get(fkey);
    if (!fornecedorNome) {
      fornecedorNome = fornecedor;
      fornByNorm.set(fkey, fornecedorNome);
      novosForn.push([newUuid(), fornecedorNome]);
    }

    // (3) Item: usa o do sistema se existir; senão cadastra.
    const ikey = norm(descricao);
    let item = itemByNorm.get(ikey);
    if (!item) {
      const subArquivo = norm(r?.SUB_CATEGORIA);
      const catArquivo = norm(r?.CATEGORIA);
      if (!subArquivo) {
        erros.push({ linha, item: descricao, motivo: 'Item novo sem subcategoria' });
        return;
      }
      const categoria = categoriaDe(subArquivo) || catArquivo;
      if (!categoria) {
        erros.push({ linha, item: descricao, motivo: `Subcategoria sem categoria no mapa: ${subArquivo}` });
        return;
      }
      item = { DESCRICAO_ITEM: descricao, SUB_CATEGORIA: subArquivo, CATEGORIA: categoria };
      itemByNorm.set(ikey, item);
      novosItens.push([newUuid(), descricao, subArquivo, categoria]);
    }

    // (4) Total: respeita a coluna TOTAL do arquivo se vier preenchida (>0);
    //     senão recalcula QTD × VALOR_UNIT.
    const valorTotal = resolverTotal(qtd, valorUnit, r?.VALOR_TOTAL);

    // Ordem CUSTOS: UUID, DATA_NOTA, NUM_NOTA, MES_ANO, MES_NUM, ANO,
    // DIA_MES_ANO, FORNECEDOR, ITEM, SUB_CATEGORIA, CATEGORIA, QTD, VALOR_UNIT,
    // VALOR_TOTAL, TAG
    novosCustos.push([
      newUuid(),
      campos.DIA_MES_ANO,
      numNota,
      campos.MES_ANO,
      campos.MES_NUM,
      campos.ANO,
      campos.DIA_MES_ANO,
      fornecedorNome,
      item.DESCRICAO_ITEM,
      item.SUB_CATEGORIA,
      item.CATEGORIA,
      qtd,
      valorUnit,
      valorTotal,
      '', // (5) TAG em branco — folha será tageada depois
    ]);
  });

  // Persiste cadastros novos antes dos custos (e invalida os caches).
  if (novosForn.length) {
    await appendRows('FORNECEDOR', novosForn);
    invalidate('fornecedores');
  }
  if (novosItens.length) {
    await appendRows('ITENS', novosItens);
    invalidate('itens');
  }
  if (novosCustos.length) {
    await appendRows(TAB, novosCustos);
  }

  return {
    recebidos: rows.length,
    importados: novosCustos.length,
    vazios,
    datasAtribuidas,
    dataFallback: datasAtribuidas > 0 ? fallbackData : null,
    erros: erros.length,
    novosFornecedores: novosForn.length,
    novosItens: novosItens.length,
    errosLista: erros, // lista completa — sem corte (o usuário gere os não importados)
  };
}

// Um item está "a classificar" quando não tem subcategoria ou categoria.
function itemSemClassificacao(item) {
  return !String(item?.SUB_CATEGORIA || '').trim() || !String(item?.CATEGORIA || '').trim();
}

/**
 * Importação de Custos a partir de NF-e (zip lido no frontend).
 * `notas`: [{ CHAVE_NFE, NUM_NOTA, DATA_NOTA: 'DD/MM/YYYY', FORNECEDOR,
 *            itens: [{ ITEM, QTD, VALOR_UNIT, VALOR_TOTAL }] }]
 *
 * Regras:
 *  1. Dedup por nota: se a CHAVE_NFE já existe em CUSTOS, a nota inteira é
 *     pulada (re-rodar o mesmo zip não duplica). Itens repetidos legítimos
 *     dentro de uma nota nova entram normalmente.
 *  2. Fornecedor casado/criado por nome (vazio → "Sem Fornecedor").
 *  3. Item: se existe e está classificado, usa a classificação do sistema. Se
 *     não existe (ou existe sem subcategoria/categoria), o custo É importado
 *     mesmo assim, com SUB_CATEGORIA/CATEGORIA em branco, e o item fica
 *     cadastrado em ITENS no estado "a classificar".
 *  4. VALOR_UNIT e VALOR_TOTAL arredondados para 2 casas; total informado (>0)
 *     é respeitado, senão QTD × VALOR_UNIT.
 *  5. CHAVE_NFE é gravada na última coluna de CUSTOS (só este fluxo a preenche).
 *  6. TAG fica em branco (folha é tageada depois).
 */
export async function importarLoteXml(notas) {
  const lista = Array.isArray(notas) ? notas : [];
  const [fornObjs, itemObjs, custoObjs] = await Promise.all([
    getObjects('FORNECEDOR'),
    getObjects('ITENS'),
    getObjects('CUSTOS'),
  ]);

  const fornByNorm = new Map(fornObjs.map((f) => [norm(f.NOME_FORNECEDOR), f.NOME_FORNECEDOR]));
  const itemByNorm = new Map(itemObjs.map((i) => [norm(i.DESCRICAO_ITEM), i]));
  const chavesExistentes = new Set(
    custoObjs.map((c) => String(c.CHAVE_NFE || '').trim()).filter(Boolean),
  );

  const novosForn = [];
  const novosItens = [];
  const novosCustos = [];
  const itensAClassificarSet = new Set(); // descrições (norm) sinalizadas
  const notasPuladas = [];
  const erros = [];
  let notasProcessadas = 0;

  lista.forEach((nota, ni) => {
    const chave = String(nota?.CHAVE_NFE || '').trim();
    // (1) Nota já importada → pula a nota inteira.
    if (chave && chavesExistentes.has(chave)) {
      notasPuladas.push({ chave, numNota: String(nota?.NUM_NOTA || '') });
      return;
    }
    notasProcessadas += 1;

    const dataNota = String(nota?.DATA_NOTA || '').trim();
    let campos;
    try {
      campos = derivarCamposData(dataNota);
    } catch (e) {
      erros.push({ nota: String(nota?.NUM_NOTA || `#${ni + 1}`), motivo: `Data inválida (${dataNota}): ${e.message}` });
      return;
    }

    // (2) Fornecedor: cria se não existir (vazio → "Sem Fornecedor").
    const fornecedor = String(nota?.FORNECEDOR || '').trim() || 'Sem Fornecedor';
    const fkey = norm(fornecedor);
    let fornecedorNome = fornByNorm.get(fkey);
    if (!fornecedorNome) {
      fornecedorNome = fornecedor;
      fornByNorm.set(fkey, fornecedorNome);
      novosForn.push([newUuid(), fornecedorNome]);
    }

    const itensNota = Array.isArray(nota?.itens) ? nota.itens : [];
    itensNota.forEach((it, ii) => {
      const descricao = String(it?.ITEM || '').trim();
      const qtd = num(it?.QTD);
      const valorUnitRaw = num(it?.VALOR_UNIT);
      const ref = `Nota ${nota?.NUM_NOTA || `#${ni + 1}`}, item ${ii + 1}`;

      if (!descricao) { erros.push({ nota: ref, motivo: 'Item sem descrição' }); return; }
      if (!Number.isFinite(qtd) || qtd <= 0) { erros.push({ nota: ref, item: descricao, motivo: 'Quantidade inválida' }); return; }
      if (!Number.isFinite(valorUnitRaw) || valorUnitRaw < 0) { erros.push({ nota: ref, item: descricao, motivo: 'Valor unitário inválido' }); return; }

      const valorUnit = +valorUnitRaw.toFixed(2); // (4) 2 casas
      const valorTotal = resolverTotal(qtd, valorUnit, it?.VALOR_TOTAL);

      // (3) Item: usa classificação do sistema se houver; senão entra "a classificar".
      const ikey = norm(descricao);
      let item = itemByNorm.get(ikey);
      if (!item) {
        item = { DESCRICAO_ITEM: descricao, SUB_CATEGORIA: '', CATEGORIA: '' };
        itemByNorm.set(ikey, item);
        novosItens.push([newUuid(), descricao, '', '']);
      }
      if (itemSemClassificacao(item)) itensAClassificarSet.add(ikey);

      // Ordem CUSTOS: UUID, DATA_NOTA, NUM_NOTA, MES_ANO, MES_NUM, ANO,
      // DIA_MES_ANO, FORNECEDOR, ITEM, SUB_CATEGORIA, CATEGORIA, QTD,
      // VALOR_UNIT, VALOR_TOTAL, TAG, CHAVE_NFE
      novosCustos.push([
        newUuid(),
        campos.DIA_MES_ANO,
        String(nota?.NUM_NOTA || 'Sem Nota'),
        campos.MES_ANO,
        campos.MES_NUM,
        campos.ANO,
        campos.DIA_MES_ANO,
        fornecedorNome,
        item.DESCRICAO_ITEM,
        item.SUB_CATEGORIA || '',
        item.CATEGORIA || '',
        qtd,
        valorUnit,
        valorTotal,
        '', // (6) TAG
        chave, // (5) CHAVE_NFE
      ]);
    });

    // Evita duplicar caso a mesma chave apareça duas vezes no mesmo zip.
    if (chave) chavesExistentes.add(chave);
  });

  if (novosForn.length) { await appendRows('FORNECEDOR', novosForn); invalidate('fornecedores'); }
  if (novosItens.length) { await appendRows('ITENS', novosItens); invalidate('itens'); }
  if (novosCustos.length) { await appendRows(TAB, novosCustos); }

  return {
    recebidos: lista.length,
    notasProcessadas,
    notasPuladas: notasPuladas.length,
    notasPuladasLista: notasPuladas,
    importados: novosCustos.length,
    novosFornecedores: novosForn.length,
    novosItens: novosItens.length,
    aClassificar: itensAClassificarSet.size,
    erros: erros.length,
    errosLista: erros,
  };
}

// Lista os itens que estão "a classificar" (sem subcategoria/categoria).
export async function itensAClassificar() {
  const itens = await getObjects('ITENS');
  return itens
    .filter(itemSemClassificacao)
    .map((i) => ({ UUID: i.UUID, DESCRICAO_ITEM: i.DESCRICAO_ITEM }));
}

/**
 * Classifica um item pendente: grava SUB_CATEGORIA/CATEGORIA no item e faz o
 * back-fill nos custos daquele item que estavam sem classificação.
 * A categoria é derivada da subcategoria (mapa fixo + dinâmico).
 */
export async function classificarItem({ ITEM_UUID, SUB_CATEGORIA }) {
  if (!ITEM_UUID) throw new Error('Item é obrigatório');
  const sub = String(SUB_CATEGORIA || '').trim().toUpperCase();
  if (!sub) throw new Error('Subcategoria é obrigatória');
  const categoria = categoriaDe(sub);
  if (!categoria) throw new Error(`Subcategoria desconhecida: ${sub}`);

  const itens = await getObjects('ITENS');
  const item = itens.find((i) => i.UUID === ITEM_UUID);
  if (!item) throw new Error('Item não encontrado');

  // Atualiza o item.
  await updateRowByUuid('ITENS', ITEM_UUID, [ITEM_UUID, item.DESCRICAO_ITEM, sub, categoria]);
  invalidate('itens');

  // Back-fill: custos desse item ainda sem classificação.
  const custos = await getObjects('CUSTOS');
  const alvo = custos.filter(
    (c) => norm(c.ITEM) === norm(item.DESCRICAO_ITEM) && itemSemClassificacao(c),
  );
  const uuids = alvo.map((c) => c.UUID);
  if (uuids.length) {
    await updateColumnForUuids(TAB, 'SUB_CATEGORIA', uuids, sub);
    await updateColumnForUuids(TAB, 'CATEGORIA', uuids, categoria);
  }

  return {
    item: item.DESCRICAO_ITEM, SUB_CATEGORIA: sub, CATEGORIA: categoria, custosAtualizados: uuids.length,
  };
}
