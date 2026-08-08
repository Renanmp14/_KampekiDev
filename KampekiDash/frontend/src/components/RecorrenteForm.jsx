import React, { useMemo, useState } from 'react';
import Modal from './Modal.jsx';
import SearchableSelect from './SearchableSelect.jsx';
import { FREQUENCIAS, usaDiaBase, hojeStr, compararDatas } from '../utils/recorrentesCalc.js';

// Datas trafegam como DD/MM/YYYY; o <input type="date"> fala ISO.
function isoToBr(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
function brToIso(br) {
  const m = String(br || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
}

const norm = (s) => String(s || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .trim().toLowerCase();

// O item não mora aqui: ele é resolvido a partir do texto do combo (`itemTexto`),
// como na tela de Custos.
const vazio = {
  DESCRICAO: '', FORNECEDOR: '', QTD: '1', VALOR_UNIT: '', NUM_NOTA: '',
  FREQUENCIA: 'mensal', DIA_BASE: '', DATA_INICIO: '', DATA_FIM: '',
};

/**
 * Criação/edição de um template de recorrência.
 *
 * Subcategoria, categoria e tag NÃO são editáveis aqui: elas vêm do item no
 * momento de cada lançamento (o item é a fonte da verdade desde a 1.4.1). O
 * formulário as exibe apenas para conferência.
 */
export default function RecorrenteForm({
  inicial, itens, fornecedores, onSalvar, onFechar, salvando = false, erro = '',
}) {
  const [form, setForm] = useState(() => {
    if (!inicial) return { ...vazio, DATA_INICIO: hojeStr() };
    return {
      DESCRICAO: inicial.DESCRICAO || '',
      FORNECEDOR: inicial.FORNECEDOR || '',
      QTD: String(inicial.QTD ?? '1'),
      VALOR_UNIT: String(inicial.VALOR_UNIT ?? ''),
      NUM_NOTA: inicial.NUM_NOTA || '',
      FREQUENCIA: inicial.FREQUENCIA || 'mensal',
      DIA_BASE: String(inicial.DIA_BASE ?? ''),
      DATA_INICIO: inicial.DATA_INICIO || '',
      DATA_FIM: inicial.DATA_FIM || '',
    };
  });
  const [itemTexto, setItemTexto] = useState(() => {
    const item = inicial ? itens.find((i) => i.UUID === inicial.ITEM) : null;
    return item?.DESCRICAO_ITEM || '';
  });
  const [erroLocal, setErroLocal] = useState('');

  const set = (campo) => (v) => setForm((f) => ({ ...f, [campo]: v }));

  // Identidade estável nas listas do SearchableSelect: sem o memo, a normalização
  // de milhares de opções refaria a cada tecla (nota do próprio componente).
  const itemNomes = useMemo(() => itens.map((i) => i.DESCRICAO_ITEM), [itens]);
  const fornecedorNomes = useMemo(() => fornecedores.map((f) => f.NOME_FORNECEDOR), [fornecedores]);
  const itemPorNome = useMemo(() => {
    const m = new Map();
    itens.forEach((i) => m.set(norm(i.DESCRICAO_ITEM), i));
    return m;
  }, [itens]);

  const itemResolvido = itemPorNome.get(norm(itemTexto)) || null;
  const precisaDiaBase = usaDiaBase(form.FREQUENCIA);

  function salvar() {
    setErroLocal('');
    if (!form.DESCRICAO.trim()) { setErroLocal('Informe a descrição.'); return; }
    if (!itemResolvido) { setErroLocal('Escolha um item já cadastrado.'); return; }
    const qtd = Number(String(form.QTD).replace(',', '.'));
    const valor = Number(String(form.VALOR_UNIT).replace(',', '.'));
    if (!Number.isFinite(qtd) || qtd <= 0) { setErroLocal('Quantidade inválida.'); return; }
    if (!Number.isFinite(valor) || valor <= 0) { setErroLocal('Valor unitário inválido.'); return; }
    if (!form.DATA_INICIO) { setErroLocal('Informe a data de início.'); return; }
    if (precisaDiaBase) {
      const d = parseInt(form.DIA_BASE, 10);
      if (!Number.isFinite(d) || d < 1 || d > 31) { setErroLocal('Dia base deve ser de 1 a 31.'); return; }
    }
    if (form.DATA_FIM && compararDatas(form.DATA_FIM, form.DATA_INICIO) < 0) {
      setErroLocal('A data de fim não pode ser anterior à de início.'); return;
    }
    onSalvar({
      DESCRICAO: form.DESCRICAO.trim(),
      FORNECEDOR: form.FORNECEDOR.trim(),
      ITEM: itemResolvido.UUID,
      QTD: qtd,
      VALOR_UNIT: valor,
      NUM_NOTA: form.NUM_NOTA.trim(),
      FREQUENCIA: form.FREQUENCIA,
      DIA_BASE: precisaDiaBase ? parseInt(form.DIA_BASE, 10) : '',
      DATA_INICIO: form.DATA_INICIO,
      DATA_FIM: form.DATA_FIM,
    });
  }

  const inicioNoPassado = form.DATA_INICIO && compararDatas(form.DATA_INICIO, hojeStr()) < 0;

  return (
    <Modal
      title={inicial ? 'Editar recorrência' : 'Nova recorrência'}
      onClose={onFechar}
      className="modal-lg"
      footer={(
        <>
          <button className="btn btn-ghost" onClick={onFechar} disabled={salvando}>Cancelar</button>
          <button className="btn" onClick={salvar} disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
        </>
      )}
    >
      {(erro || erroLocal) && <div className="error-msg">{erro || erroLocal}</div>}

      <div className="grid grid-2">
        <div className="field">
          <label>Descrição</label>
          <input
            value={form.DESCRICAO}
            onChange={(e) => set('DESCRICAO')(e.target.value)}
            placeholder="Ex.: Assinatura Adobe"
          />
        </div>
        <div className="field">
          <label>Fornecedor (opcional)</label>
          <SearchableSelect
            value={form.FORNECEDOR}
            onChange={set('FORNECEDOR')}
            options={fornecedorNomes}
            placeholder="Todos..."
            fixedMenu
          />
        </div>
      </div>

      <div className="field">
        <label>Item</label>
        <SearchableSelect
          value={itemTexto}
          onChange={setItemTexto}
          options={itemNomes}
          placeholder="Digite para buscar o item..."
          fixedMenu
        />
        <div className="rec-hint">
          {itemResolvido ? (
            <>
              {itemResolvido.SUB_CATEGORIA || '(a classificar)'} · {itemResolvido.CATEGORIA || '(sem categoria)'}
              {itemResolvido.TAG ? ` · Tag ${itemResolvido.TAG}` : ''}
              {' — '}a classificação e a tag do lançamento seguem o item.
            </>
          ) : 'Escolha um item já cadastrado (a classificação do lançamento vem dele).'}
        </div>
      </div>

      <div className="grid grid-3">
        <div className="field">
          <label>Quantidade</label>
          <input value={form.QTD} onChange={(e) => set('QTD')(e.target.value)} />
        </div>
        <div className="field">
          <label>Valor unitário (R$)</label>
          <input value={form.VALOR_UNIT} onChange={(e) => set('VALOR_UNIT')(e.target.value)} placeholder="0,00" />
        </div>
        <div className="field">
          <label>Nº Nota (opcional)</label>
          <input
            value={form.NUM_NOTA}
            onChange={(e) => set('NUM_NOTA')(e.target.value)}
            placeholder="Sem Nota"
          />
        </div>
      </div>

      <div className="grid grid-3">
        <div className="field">
          <label>Frequência</label>
          <select value={form.FREQUENCIA} onChange={(e) => set('FREQUENCIA')(e.target.value)}>
            {Object.entries(FREQUENCIAS).map(([valor, { label }]) => (
              <option key={valor} value={valor}>{label}</option>
            ))}
          </select>
        </div>
        {precisaDiaBase && (
          <div className="field">
            <label>Dia base (1–31)</label>
            <input
              type="number"
              min="1"
              max="31"
              value={form.DIA_BASE}
              onChange={(e) => set('DIA_BASE')(e.target.value)}
            />
            <div className="rec-hint">Dia que não existir no mês cai no último dia dele.</div>
          </div>
        )}
        <div className="field">
          <label>Data de início</label>
          <input
            type="date"
            value={brToIso(form.DATA_INICIO)}
            onChange={(e) => set('DATA_INICIO')(isoToBr(e.target.value))}
          />
        </div>
      </div>

      <div className="grid grid-2">
        <div className="field">
          <label>Data de fim (opcional)</label>
          <input
            type="date"
            value={brToIso(form.DATA_FIM)}
            onChange={(e) => set('DATA_FIM')(isoToBr(e.target.value))}
          />
          <div className="rec-hint">Em branco = sem data de encerramento.</div>
        </div>
      </div>

      {!inicial && inicioNoPassado && (
        <p className="rec-hint">
          A data de início está no passado: ela só <strong>ancora o ciclo</strong>. Ocorrências
          anteriores a hoje não são lançadas.
        </p>
      )}
      {inicial && (
        <p className="rec-hint">
          A edição vale para as <strong>próximas</strong> ocorrências. O que já foi lançado em
          Custos não é alterado.
        </p>
      )}
    </Modal>
  );
}
