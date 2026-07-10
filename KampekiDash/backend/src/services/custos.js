import {
  getObjects, appendRow, appendRows, updateRowByUuid, deleteRowByUuid,
  deleteRowsByUuid, updateColumnForUuids,
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
    // Tag do lançamento (OPCIONAL na folha); se não vier, herda a TAG cadastrada
    // no item (folha). Quando informada, precisa existir na aba TAG.
    tag = String(TAG || '').trim() || String(item.TAG || '').trim();
    if (tag && !(await tagExiste(tag))) throw new Error('TAG não cadastrada');
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
  await limparItensOrfaos();
  return { ok: true };
}

/**
 * Exclusão em massa: remove todos os custos cujos UUID estão em `uuids`, numa
 * única chamada à API (uma leitura + um batchUpdate de deleteDimension).
 */
export async function removerEmMassa({ uuids }) {
  if (!Array.isArray(uuids) || uuids.length === 0) {
    throw new Error('Nenhum registro selecionado');
  }
  const removidos = await deleteRowsByUuid(TAB, uuids);
  const itensRemovidos = await limparItensOrfaos();
  return { removidos, itensRemovidos };
}

/**
 * Remove de ITENS os itens "a classificar" (sem subcategoria/categoria) que não
 * têm mais nenhum custo associado — tipicamente após excluir todos os custos de
 * um item importado de NF-e. Sem isso, o item órfão continuaria aparecendo em
 * "itens a classificar" sem ter nada para classificar. Itens já classificados
 * NUNCA são tocados (curados pelo usuário). Retorna quantos itens foram removidos.
 */
async function limparItensOrfaos() {
  const [itens, custos] = await Promise.all([
    getObjects('ITENS'), getObjects('CUSTOS'),
  ]);
  const descComCusto = new Set(custos.map((c) => norm(c.ITEM)));
  const orfaos = itens
    .filter((i) => itemSemClassificacao(i) && !descComCusto.has(norm(i.DESCRICAO_ITEM)))
    .map((i) => i.UUID);
  if (orfaos.length) {
    await deleteRowsByUuid('ITENS', orfaos);
    invalidate('itens');
  }
  return orfaos.length;
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
      String(item.TAG || '').trim(), // (5) herda a TAG do item quando houver (folha)
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
        String(item.TAG || '').trim(), // (6) herda a TAG do item quando houver
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

/**
 * Importa UM Custo a partir de uma NFS-e de serviço (DANFSe/PDF), já extraída e
 * normalizada no frontend. 1 nota = 1 item = 1 custo, sempre QTD = 1.
 * `payload`: { chaveNfse, numNota, dataNota:'DD/MM/YYYY', fornecedor, item, valor }
 *
 * Reaproveita a lógica do import de NF-e XML:
 *  1. Dedup por CHAVE_NFE → se já existe em CUSTOS, NÃO grava e devolve o aviso.
 *  2. Fornecedor casado/criado por nome (case-insensitive; vazio → "Sem Fornecedor").
 *  3. Item casado por descrição; se novo, criado em ITENS "a classificar" (sub/cat
 *     em branco); se existe, herda SUB_CATEGORIA/CATEGORIA/TAG do sistema.
 *  4. Datas derivadas de dataNota; VALOR_UNIT = VALOR_TOTAL = valor (2 casas).
 *  5. TAG herdada do item quando houver (folha).
 */
export async function importarNfse(payload) {
  const {
    chaveNfse, numNota, dataNota, fornecedor, item, valor,
  } = payload || {};

  const chave = String(chaveNfse || '').trim();
  const descricao = String(item || '').trim();
  const dataStr = String(dataNota || '').trim();
  const valorNum = num(valor);

  if (!dataStr) throw new Error('Data (competência) é obrigatória');
  if (!descricao) throw new Error('Item é obrigatório');
  if (!Number.isFinite(valorNum) || valorNum < 0) throw new Error('Valor inválido');

  const [fornObjs, itemObjs, custoObjs] = await Promise.all([
    getObjects('FORNECEDOR'), getObjects('ITENS'), getObjects('CUSTOS'),
  ]);

  // (1) Dedup por chave — bloqueia a nota já importada.
  if (chave) {
    const existente = custoObjs.find((c) => String(c.CHAVE_NFE || '').trim() === chave);
    if (existente) {
      const err = new Error(`Esta NFS-e já foi importada (nota ${existente.NUM_NOTA || '—'}, ${existente.DATA_NOTA || '—'}).`);
      err.code = 'CHAVE_DUPLICADA';
      throw err;
    }
  }

  const campos = derivarCamposData(dataStr);

  // (2) Fornecedor: cria se não existir.
  const fornNome = String(fornecedor || '').trim() || 'Sem Fornecedor';
  const fornByNorm = new Map(fornObjs.map((f) => [norm(f.NOME_FORNECEDOR), f.NOME_FORNECEDOR]));
  let fornecedorFinal = fornByNorm.get(norm(fornNome));
  let fornecedorCriado = false;
  if (!fornecedorFinal) {
    fornecedorFinal = fornNome;
    await appendRows('FORNECEDOR', [[newUuid(), fornecedorFinal]]);
    invalidate('fornecedores');
    fornecedorCriado = true;
  }

  // (3) Item: usa o do sistema se existir; senão cria "a classificar".
  const itemByNorm = new Map(itemObjs.map((i) => [norm(i.DESCRICAO_ITEM), i]));
  let itemObj = itemByNorm.get(norm(descricao));
  let itemCriado = false;
  if (!itemObj) {
    itemObj = {
      DESCRICAO_ITEM: descricao, SUB_CATEGORIA: '', CATEGORIA: '', TAG: '',
    };
    await appendRows('ITENS', [[newUuid(), descricao, '', '', '']]);
    invalidate('itens');
    itemCriado = true;
  }

  const aClassificar = itemSemClassificacao(itemObj);
  const valorTotal = +valorNum.toFixed(2);
  const tag = String(itemObj.TAG || '').trim(); // (5) herda a tag do item (folha)

  // (4) Ordem CUSTOS: UUID, DATA_NOTA, NUM_NOTA, MES_ANO, MES_NUM, ANO,
  // DIA_MES_ANO, FORNECEDOR, ITEM, SUB_CATEGORIA, CATEGORIA, QTD, VALOR_UNIT,
  // VALOR_TOTAL, TAG, CHAVE_NFE
  const uuid = newUuid();
  await appendRows(TAB, [[
    uuid,
    campos.DIA_MES_ANO,
    String(numNota || 'Sem Nota'),
    campos.MES_ANO,
    campos.MES_NUM,
    campos.ANO,
    campos.DIA_MES_ANO,
    fornecedorFinal,
    itemObj.DESCRICAO_ITEM,
    itemObj.SUB_CATEGORIA || '',
    itemObj.CATEGORIA || '',
    1, // QTD sempre 1
    valorTotal, // VALOR_UNIT = VALOR_TOTAL
    valorTotal,
    tag,
    chave,
  ]]);

  return {
    UUID: uuid,
    fornecedorCriado,
    itemCriado,
    aClassificar,
    fornecedor: fornecedorFinal,
    item: itemObj.DESCRICAO_ITEM,
    valor: valorTotal,
  };
}

/**
 * Importa VÁRIAS NFS-e (PDF) num único lote — cada uma já extraída/normalizada e
 * (opcionalmente) ajustada no frontend. 1 nota = 1 item = 1 custo, QTD = 1.
 * `notas`: [{ chaveNfse, numNota, dataNota:'DD/MM/YYYY', fornecedor, item, valor }]
 *
 * Mesma regra do envio unitário (`importarNfse`), porém em UMA passada: lê
 * FORNECEDOR/ITENS/CUSTOS uma única vez e faz um append por aba (bom p/ performance
 * e para o orçamento de células). Diferença de comportamento vs. unitário: nota com
 * CHAVE_NFE já existente (ou repetida no próprio lote) é PULADA e reportada — não
 * bloqueia o restante do lote (o 409 do unitário não se aplica aqui).
 */
export async function importarNfseLote(notas) {
  const lista = Array.isArray(notas) ? notas : [];
  const [fornObjs, itemObjs, custoObjs] = await Promise.all([
    getObjects('FORNECEDOR'), getObjects('ITENS'), getObjects('CUSTOS'),
  ]);

  const fornByNorm = new Map(fornObjs.map((f) => [norm(f.NOME_FORNECEDOR), f.NOME_FORNECEDOR]));
  const itemByNorm = new Map(itemObjs.map((i) => [norm(i.DESCRICAO_ITEM), i]));
  const chavesExistentes = new Set(
    custoObjs.map((c) => String(c.CHAVE_NFE || '').trim()).filter(Boolean),
  );

  const novosForn = [];
  const novosItens = [];
  const novosCustos = [];
  const itensAClassificarSet = new Set();
  const notasPuladas = [];
  const erros = [];

  lista.forEach((nota, ni) => {
    const ref = String(nota?.numNota || `#${ni + 1}`);
    const chave = String(nota?.chaveNfse || '').trim();

    // (1) Dedup por chave — nota já importada (ou repetida no lote) é pulada.
    if (chave && chavesExistentes.has(chave)) {
      notasPuladas.push({ chave, numNota: ref });
      return;
    }

    const descricao = String(nota?.item || '').trim();
    const valorNum = num(nota?.valor);
    const dataStr = String(nota?.dataNota || '').trim();

    if (!descricao) { erros.push({ nota: ref, motivo: 'Item é obrigatório' }); return; }
    if (!Number.isFinite(valorNum) || valorNum < 0) { erros.push({ nota: ref, item: descricao, motivo: 'Valor inválido' }); return; }

    let campos;
    try {
      campos = derivarCamposData(dataStr);
    } catch (e) {
      erros.push({ nota: ref, item: descricao, motivo: `Data inválida (${dataStr}): ${e.message}` });
      return;
    }

    // (2) Fornecedor: cria se não existir (vazio → "Sem Fornecedor").
    const fornNome = String(nota?.fornecedor || '').trim() || 'Sem Fornecedor';
    const fkey = norm(fornNome);
    let fornecedorNome = fornByNorm.get(fkey);
    if (!fornecedorNome) {
      fornecedorNome = fornNome;
      fornByNorm.set(fkey, fornecedorNome);
      novosForn.push([newUuid(), fornecedorNome]);
    }

    // (3) Item: usa classificação do sistema se houver; senão entra "a classificar".
    const ikey = norm(descricao);
    let item = itemByNorm.get(ikey);
    if (!item) {
      item = { DESCRICAO_ITEM: descricao, SUB_CATEGORIA: '', CATEGORIA: '', TAG: '' };
      itemByNorm.set(ikey, item);
      novosItens.push([newUuid(), descricao, '', '', '']);
    }
    if (itemSemClassificacao(item)) itensAClassificarSet.add(ikey);

    const valorTotal = +valorNum.toFixed(2);

    // Ordem CUSTOS: UUID, DATA_NOTA, NUM_NOTA, MES_ANO, MES_NUM, ANO, DIA_MES_ANO,
    // FORNECEDOR, ITEM, SUB_CATEGORIA, CATEGORIA, QTD, VALOR_UNIT, VALOR_TOTAL, TAG, CHAVE_NFE
    novosCustos.push([
      newUuid(),
      campos.DIA_MES_ANO,
      String(nota?.numNota || 'Sem Nota'),
      campos.MES_ANO,
      campos.MES_NUM,
      campos.ANO,
      campos.DIA_MES_ANO,
      fornecedorNome,
      item.DESCRICAO_ITEM,
      item.SUB_CATEGORIA || '',
      item.CATEGORIA || '',
      1, // QTD sempre 1
      valorTotal, // VALOR_UNIT = VALOR_TOTAL
      valorTotal,
      String(item.TAG || '').trim(), // herda a tag do item (folha)
      chave,
    ]);

    // Evita duplicar caso a mesma chave apareça duas vezes no mesmo lote.
    if (chave) chavesExistentes.add(chave);
  });

  if (novosForn.length) { await appendRows('FORNECEDOR', novosForn); invalidate('fornecedores'); }
  if (novosItens.length) { await appendRows('ITENS', novosItens); invalidate('itens'); }
  if (novosCustos.length) { await appendRows(TAB, novosCustos); }

  return {
    recebidos: lista.length,
    importados: novosCustos.length,
    notasPuladas: notasPuladas.length,
    notasPuladasLista: notasPuladas,
    novosFornecedores: novosForn.length,
    novosItens: novosItens.length,
    aClassificar: itensAClassificarSet.size,
    erros: erros.length,
    errosLista: erros,
  };
}

// Lista os itens que estão "a classificar" (sem subcategoria/categoria),
// já com a contagem de custos pendentes (sem classificação) de cada um — útil
// para o usuário priorizar quais classificar primeiro.
export async function itensAClassificar() {
  const [itens, custos] = await Promise.all([
    getObjects('ITENS'), getObjects('CUSTOS'),
  ]);
  const pendentesPorItem = new Map();
  for (const c of custos) {
    if (itemSemClassificacao(c)) {
      const k = norm(c.ITEM);
      pendentesPorItem.set(k, (pendentesPorItem.get(k) || 0) + 1);
    }
  }
  return itens
    .filter(itemSemClassificacao)
    .map((i) => ({
      UUID: i.UUID,
      DESCRICAO_ITEM: i.DESCRICAO_ITEM,
      custos: pendentesPorItem.get(norm(i.DESCRICAO_ITEM)) || 0,
    }))
    // Item sem nenhum custo pendente não tem o que classificar (ex.: todos os
    // custos foram excluídos) — não deve mais aparecer na fila.
    .filter((i) => i.custos > 0);
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

/**
 * Classificação em lote: aplica a MESMA subcategoria a vários itens pendentes de
 * uma vez e faz o back-fill nos custos sem classificação de todos eles. Os itens
 * podem ser diferentes, mas recebem a mesma subcategoria/categoria (caso de uso:
 * marcar de uma vez vários itens que pertencem à mesma subcategoria).
 *
 * Lê ITENS/CUSTOS uma única vez e usa updateColumnForUuids (uma chamada por
 * coluna), evitando o custo de classificar item a item.
 */
export async function classificarItensEmLote({ ITEM_UUIDS, SUB_CATEGORIA }) {
  if (!Array.isArray(ITEM_UUIDS) || ITEM_UUIDS.length === 0) {
    throw new Error('Nenhum item selecionado');
  }
  const sub = String(SUB_CATEGORIA || '').trim().toUpperCase();
  if (!sub) throw new Error('Subcategoria é obrigatória');
  const categoria = categoriaDe(sub);
  if (!categoria) throw new Error(`Subcategoria desconhecida: ${sub}`);

  const itens = await getObjects('ITENS');
  const alvo = new Set(ITEM_UUIDS);
  const selecionados = itens.filter((i) => alvo.has(i.UUID));
  if (!selecionados.length) throw new Error('Itens não encontrados');
  const itemUuids = selecionados.map((i) => i.UUID);
  const descricoes = new Set(selecionados.map((i) => norm(i.DESCRICAO_ITEM)));

  // Atualiza a classificação dos itens (DESCRICAO_ITEM permanece intacta).
  await updateColumnForUuids('ITENS', 'SUB_CATEGORIA', itemUuids, sub);
  await updateColumnForUuids('ITENS', 'CATEGORIA', itemUuids, categoria);
  invalidate('itens');

  // Back-fill: custos desses itens ainda sem classificação.
  const custos = await getObjects('CUSTOS');
  const custoUuids = custos
    .filter((c) => descricoes.has(norm(c.ITEM)) && itemSemClassificacao(c))
    .map((c) => c.UUID);
  if (custoUuids.length) {
    await updateColumnForUuids(TAB, 'SUB_CATEGORIA', custoUuids, sub);
    await updateColumnForUuids(TAB, 'CATEGORIA', custoUuids, categoria);
  }

  return {
    itensClassificados: itemUuids.length,
    SUB_CATEGORIA: sub,
    CATEGORIA: categoria,
    custosAtualizados: custoUuids.length,
  };
}
