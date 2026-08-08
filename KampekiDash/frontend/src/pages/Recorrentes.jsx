import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { recorrentesApi, custosApi, itensApi, fornecedorApi } from '../api/resources.js';
import { podeEscrever } from '../api/client.js';
import Modal from '../components/Modal.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import CalendarioMensal from '../components/CalendarioMensal.jsx';
import CalendarioSemanal from '../components/CalendarioSemanal.jsx';
import CalendarioDiario from '../components/CalendarioDiario.jsx';
import RecorrenteForm from '../components/RecorrenteForm.jsx';
import RecorrenteDialog from '../components/RecorrenteDialog.jsx';
import { brl, toNum } from '../utils/format.js';
import { useTelaEstreita } from '../utils/useMediaQuery.js';
import {
  FREQUENCIAS, calcularOcorrencias, compararDatas, formatarData, hojeStr,
  labelFrequencia, parseData, somarDias, ultimoDiaMes, normalizarData,
} from '../utils/recorrentesCalc.js';

const MESES_NOME = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

// Domingo da semana de uma data (a grade semanal começa no domingo).
function domingoDa(data) {
  const p = parseData(data);
  if (!p) return data;
  const diaSemana = new Date(Date.UTC(p.ano, p.mes - 1, p.dia)).getUTCDay();
  return somarDias(data, -diaSemana);
}

// Intervalo visível conforme a visão — é ele que alimenta o cálculo das
// ocorrências e, quando a flag está ligada, a busca dos custos no backend.
function intervaloDe(visao, cursor) {
  const p = parseData(cursor) || parseData(hojeStr());
  if (visao === 'dia') return { de: cursor, ate: cursor };
  if (visao === 'semana') {
    const dom = domingoDa(cursor);
    return { de: dom, ate: somarDias(dom, 6) };
  }
  return {
    de: formatarData({ dia: 1, mes: p.mes, ano: p.ano }),
    ate: formatarData({ dia: ultimoDiaMes(p.mes, p.ano), mes: p.mes, ano: p.ano }),
  };
}

function rotuloPeriodo(visao, cursor) {
  const p = parseData(cursor);
  if (!p) return '';
  if (visao === 'dia') return cursor;
  if (visao === 'semana') {
    const { de, ate } = intervaloDe('semana', cursor);
    return `${de.slice(0, 5)} – ${ate}`;
  }
  return `${MESES_NOME[p.mes - 1]} ${p.ano}`;
}

// Navegação: mês a mês (mantendo o dia 1), semana a semana, dia a dia.
function mover(visao, cursor, passo) {
  const p = parseData(cursor);
  if (!p) return cursor;
  if (visao === 'dia') return somarDias(cursor, passo);
  if (visao === 'semana') return somarDias(cursor, passo * 7);
  const idx = p.ano * 12 + (p.mes - 1) + passo;
  const ano = Math.floor(idx / 12);
  const mes = (idx % 12) + 1;
  return formatarData({ dia: Math.min(p.dia, ultimoDiaMes(mes, ano)), mes, ano });
}

export default function Recorrentes() {
  const navigate = useNavigate();
  const escrever = podeEscrever();
  const estreita = useTelaEstreita();
  const hoje = hojeStr();

  const [templates, setTemplates] = useState([]);
  const [excecoes, setExcecoes] = useState([]);
  const [itens, setItens] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [pendentes, setPendentes] = useState({ total: 0, valorTotal: 0, lancamentos: [], erros: [] });
  const [custos, setCustos] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState('');

  const [visao, setVisao] = useState('mes');
  const [cursor, setCursor] = useState(hoje);
  const [mostrarCustos, setMostrarCustos] = useState(false);

  // Filtros da TABELA de recorrências. O calendário segue mostrando tudo de
  // propósito: ele é a visão do mês, não uma lista filtrável.
  const [fTexto, setFTexto] = useState('');
  const [fFreq, setFFreq] = useState('');
  const [fSituacao, setFSituacao] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState(null);
  const [eventoAberto, setEventoAberto] = useState(null);
  const [diaAberto, setDiaAberto] = useState(''); // dia clicado no calendário
  // Dia de onde o evento foi aberto: é o que permite o "← Voltar ao dia" em vez
  // de despejar a pessoa de volta no calendário.
  const [voltarAoDia, setVoltarAoDia] = useState('');
  const [showPrevia, setShowPrevia] = useState(false);
  const [cancelando, setCancelando] = useState(null); // { template, aPartirDe }
  const [confirmDel, setConfirmDel] = useState(null);

  const { de, ate } = intervaloDe(visao, cursor);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [tpls, excs, its, forns, pend] = await Promise.all([
        recorrentesApi.listar(),
        recorrentesApi.excecoes(),
        itensApi.listar(),
        fornecedorApi.listar(),
        recorrentesApi.pendentes(),
      ]);
      setTemplates(tpls);
      setExcecoes(excs);
      setItens(its);
      setFornecedores(forns);
      setPendentes(pend);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  // Os custos do intervalo visível são buscados SEMPRE — não só com a flag.
  // É deles que sai o valor REAL das ocorrências já lançadas: sem isso, editar a
  // recorrência reescreveria o passado na tela (uma ocorrência lançada por R$ 250
  // passaria a exibir R$ 300 porque o template mudou). A flag controla apenas se
  // os custos NÃO recorrentes também aparecem — por isso ligá-la é instantâneo.
  useEffect(() => {
    let cancelado = false;
    custosApi.listarPeriodo(de, ate)
      .then((rows) => { if (!cancelado) setCustos(rows); })
      .catch((e) => { if (!cancelado) setError(e.message); });
    return () => { cancelado = true; };
  }, [de, ate]);

  const itemPorUuid = useMemo(() => new Map(itens.map((i) => [i.UUID, i])), [itens]);

  // Exceções indexadas por template → data, para casar com cada ocorrência.
  const excecoesPorTemplate = useMemo(() => {
    const m = new Map();
    for (const e of excecoes) {
      if (!m.has(e.UUID_TEMPLATE)) m.set(e.UUID_TEMPLATE, new Map());
      m.get(e.UUID_TEMPLATE).set(normalizarData(e.DATA_EXCECAO), e);
    }
    return m;
  }, [excecoes]);

  // O custo REALMENTE gravado de cada ocorrência, pela chave que o processamento
  // deixa em CUSTOS. É a única fonte honesta para o que já foi lançado — e, de
  // quebra, resolve o ✓: existe linha, foi lançado; o custo foi excluído na tela,
  // volta a ser pendente. Sem heurística de data contra ULTIMO_LANCAMENTO.
  const custoPorOcorrencia = useMemo(() => {
    const m = new Map();
    for (const c of custos) {
      const chave = String(c.UUID_RECORRENTE || '').trim();
      if (chave) m.set(chave, c);
    }
    return m;
  }, [custos]);

  const eventosPorDia = useMemo(() => {
    const mapa = new Map();
    const push = (data, ev) => {
      if (!mapa.has(data)) mapa.set(data, []);
      mapa.get(data).push(ev);
    };

    for (const t of templates) {
      // Template inativo sem DATA_FIM (mexido à mão na planilha) não projeta
      // futuro; com DATA_FIM, o próprio cálculo já para na data certa.
      if (t.ATIVO !== 'sim' && !t.DATA_FIM) continue;
      const item = itemPorUuid.get(t.ITEM);
      const doTemplate = excecoesPorTemplate.get(t.UUID);
      for (const data of calcularOcorrencias(t, de, ate)) {
        const exc = doTemplate?.get(data) || null;
        const pulado = exc?.ACAO === 'pular';
        const alterado = !!exc && !pulado;
        const lancamento = custoPorOcorrencia.get(`${t.UUID}|${data}`) || null;

        // O que a recorrência PREVÊ hoje (template + exceção da data).
        const previstoQtd = alterado && exc.QTD !== '' ? toNum(exc.QTD) : toNum(t.QTD);
        const previstoUnit = alterado && exc.VALOR_UNIT !== '' ? toNum(exc.VALOR_UNIT) : toNum(t.VALOR_UNIT);
        const valorPrevisto = +(previstoQtd * previstoUnit).toFixed(2);

        // Já lançado manda o que está GRAVADO em CUSTOS. Editar a recorrência é
        // prospectivo no backend, e agora também na tela: o passado fica com o
        // valor com que foi lançado.
        const qtd = lancamento ? toNum(lancamento.QTD) : previstoQtd;
        const valorUnit = lancamento ? toNum(lancamento.VALOR_UNIT) : previstoUnit;
        const valor = lancamento ? toNum(lancamento.VALOR_TOTAL) : valorPrevisto;

        push(data, {
          id: `r-${t.UUID}-${data}`,
          tipo: 'recorrente',
          data,
          titulo: t.DESCRICAO,
          valor,
          valorPrevisto,
          // Sinaliza no detalhe que a recorrência mudou depois deste lançamento.
          divergente: !!lancamento && Math.abs(valor - valorPrevisto) > 0.005,
          qtd,
          valorUnit,
          numNota: lancamento ? (lancamento.NUM_NOTA || '') : ((alterado && exc.NUM_NOTA) || t.NUM_NOTA || ''),
          fornecedor: lancamento ? (lancamento.FORNECEDOR || '') : ((alterado && exc.FORNECEDOR) || t.FORNECEDOR || ''),
          item: lancamento ? (lancamento.ITEM || '') : (item?.DESCRICAO_ITEM || '(item não encontrado)'),
          subcategoria: lancamento ? (lancamento.SUB_CATEGORIA || '') : (item?.SUB_CATEGORIA || ''),
          categoria: lancamento ? (lancamento.CATEGORIA || '') : (item?.CATEGORIA || ''),
          tag: lancamento ? (lancamento.TAG || '') : (item?.TAG || ''),
          lancado: !!lancamento,
          custo: lancamento,
          pulado,
          alterado,
          excecao: exc,
          template: t,
        });
      }
    }

    if (mostrarCustos) {
      for (const c of custos) {
        // O custo gerado por uma recorrência já aparece como ocorrência ✓ — não
        // vale desenhar o mesmo lançamento duas vezes no dia.
        if (String(c.UUID_RECORRENTE || '').trim()) continue;
        const data = normalizarData(c.DATA_NOTA);
        if (!data) continue;
        push(data, {
          id: `c-${c.UUID}`,
          tipo: 'custo',
          data,
          titulo: c.ITEM || '(sem item)',
          valor: toNum(c.VALOR_TOTAL),
          qtd: toNum(c.QTD),
          valorUnit: toNum(c.VALOR_UNIT),
          numNota: c.NUM_NOTA || '',
          fornecedor: c.FORNECEDOR || '',
          item: c.ITEM || '',
          subcategoria: c.SUB_CATEGORIA || '',
          categoria: c.CATEGORIA || '',
          tag: c.TAG || '',
          lancado: true,
          pulado: false,
          alterado: false,
          custo: c,
        });
      }
    }

    // Recorrentes primeiro, depois os custos; dentro de cada grupo, maior valor.
    for (const lista of mapa.values()) {
      lista.sort((a, b) => (a.tipo === b.tipo ? b.valor - a.valor : (a.tipo === 'recorrente' ? -1 : 1)));
    }
    return mapa;
  }, [templates, excecoesPorTemplate, itemPorUuid, de, ate, mostrarCustos, custos, custoPorOcorrencia]);

  const p = parseData(cursor) || parseData(hoje);

  // Estado derivado de cada template (item resolvido + se já encerrou), calculado
  // uma vez e reusado pelo filtro e pela tabela.
  const templatesComEstado = useMemo(() => templates.map((t) => ({
    t,
    item: itemPorUuid.get(t.ITEM),
    encerrada: t.ATIVO !== 'sim' || (!!t.DATA_FIM && compararDatas(t.DATA_FIM, hoje) < 0),
  })), [templates, itemPorUuid, hoje]);

  const templatesFiltrados = useMemo(() => {
    const q = fTexto.trim().toLowerCase();
    return templatesComEstado.filter(({ t, item, encerrada }) => {
      if (q) {
        const alvo = `${t.DESCRICAO} ${item?.DESCRICAO_ITEM || ''} ${t.FORNECEDOR || ''}`.toLowerCase();
        if (!alvo.includes(q)) return false;
      }
      if (fFreq && t.FREQUENCIA !== fFreq) return false;
      if (fSituacao === 'ativa' && encerrada) return false;
      if (fSituacao === 'encerrada' && !encerrada) return false;
      return true;
    });
  }, [templatesComEstado, fTexto, fFreq, fSituacao]);

  const filtroTabelaAtivo = !!(fTexto.trim() || fFreq || fSituacao);

  // Próximo vencimento de cada template, para a tabela de cadastro. A janela de
  // ~13 meses cobre até o anual sem varrer o calendário inteiro.
  function proximoVencimento(t) {
    const datas = calcularOcorrencias(t, hoje, somarDias(hoje, 400));
    return datas[0] || '—';
  }

  async function acao(fn, mensagem) {
    setSalvando(true);
    setError('');
    try {
      const r = await fn();
      await carregar();
      if (mensagem) setAviso(typeof mensagem === 'function' ? mensagem(r) : mensagem);
      return r;
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setSalvando(false);
    }
  }

  async function salvarTemplate(payload) {
    const ok = await acao(
      () => (editando ? recorrentesApi.atualizar(editando.UUID, payload) : recorrentesApi.criar(payload)),
      editando ? 'Recorrência atualizada.' : 'Recorrência criada.',
    );
    if (ok) { setShowForm(false); setEditando(null); }
  }

  async function processar() {
    const r = await acao(
      () => recorrentesApi.processar(),
      (res) => `${res.lancados} lançamento(s) gravado(s) em Custos.`,
    );
    if (r) setShowPrevia(false);
  }

  // Aberto direto no calendário: não há dia de origem, então a dialog não mostra
  // o "← Voltar ao dia" (e não sobra origem antiga de um clique anterior).
  function abrirEvento(ev) {
    setVoltarAoDia('');
    setEventoAberto(ev);
  }

  function verEmCustos(ev) {
    const [dia, mes, ano] = ev.data.split('/');
    const params = new URLSearchParams({ mes: `${mes}/${ano}`, dia });
    if (ev.item) params.set('item', ev.item);
    navigate(`/custos?${params.toString()}`);
  }

  const totalPeriodo = useMemo(() => {
    let soma = 0;
    for (const [data, lista] of eventosPorDia) {
      if (compararDatas(data, de) < 0 || compararDatas(data, ate) > 0) continue;
      soma += lista.filter((e) => !e.pulado).reduce((s, e) => s + e.valor, 0);
    }
    return soma;
  }, [eventosPorDia, de, ate]);

  return (
    <div>
      <h1 className="page-title">Recorrentes</h1>
      <p className="muted" style={{ marginTop: -10, marginBottom: 18 }}>
        Custos fixos que se repetem. Nada é lançado sozinho: as ocorrências vencidas
        entram em Custos quando alguém clica em <strong>Colocar em dia</strong>.
      </p>

      {error && <div className="error-msg" style={{ marginBottom: 12 }}>{error}</div>}
      {aviso && (
        <div className="rec-aviso-ok">
          {aviso}
          <button type="button" onClick={() => setAviso('')} title="Fechar">×</button>
        </div>
      )}

      {pendentes.total > 0 && (
        <div className="rec-faixa">
          <span>
            ⚠ <strong>{pendentes.total}</strong> ocorrência(s) vencida(s) aguardando lançamento
            {pendentes.valorTotal ? ` · ${brl(pendentes.valorTotal)}` : ''}
          </span>
          <button className="btn" onClick={() => setShowPrevia(true)}>
            {escrever ? 'Colocar em dia' : 'Ver pendentes'}
          </button>
        </div>
      )}
      {pendentes.erros?.length > 0 && (
        <div className="error-msg" style={{ marginBottom: 12 }}>
          {pendentes.erros.length} recorrência(s) com problema:{' '}
          {pendentes.erros.map((e) => `${e.DESCRICAO || '—'} (${e.motivo})`).join(' · ')}
        </div>
      )}

      <div className="card">
        <div className="toolbar rec-toolbar">
          <div className="rec-nav">
            <button className="btn btn-ghost" onClick={() => setCursor(mover(visao, cursor, -1))}>‹ Anterior</button>
            <span className="rec-periodo">{rotuloPeriodo(visao, cursor)}</span>
            <button className="btn btn-ghost" onClick={() => setCursor(mover(visao, cursor, 1))}>Próximo ›</button>
            <button className="btn btn-ghost" onClick={() => setCursor(hoje)}>Hoje</button>
          </div>

          <div className="rec-visoes">
            {[['mes', 'Mês'], ['semana', 'Semana'], ['dia', 'Dia']].map(([v, label]) => (
              <button
                key={v}
                type="button"
                className={`rec-visao ${visao === v ? 'ativa' : ''}`}
                onClick={() => setVisao(v)}
              >
                {label}
              </button>
            ))}
          </div>

          <label className="rec-switch" title="Inclui no calendário os custos avulsos do período">
            <input
              type="checkbox"
              checked={mostrarCustos}
              onChange={(e) => setMostrarCustos(e.target.checked)}
            />
            <span className="rec-switch-track"><span className="rec-switch-thumb" /></span>
            <span className="rec-switch-label">Mostrar todos os custos</span>
          </label>

          <span className="spacer" />
          <span className="muted">Total no período: <strong>{brl(totalPeriodo)}</strong></span>
          {escrever && (
            <button className="btn" onClick={() => { setEditando(null); setShowForm(true); }}>
              + Nova recorrência
            </button>
          )}
        </div>

        {loading && <p className="muted">Carregando...</p>}

        {visao === 'mes' && (
          <CalendarioMensal
            ano={p.ano}
            mes={p.mes}
            eventosPorDia={eventosPorDia}
            hoje={hoje}
            onEvento={abrirEvento}
            onDia={setDiaAberto}
            estreita={estreita}
          />
        )}
        {visao === 'semana' && (
          <CalendarioSemanal
            inicio={de}
            eventosPorDia={eventosPorDia}
            hoje={hoje}
            onEvento={abrirEvento}
            onDia={setDiaAberto}
          />
        )}
        {visao === 'dia' && (
          <CalendarioDiario
            data={cursor}
            eventosPorDia={eventosPorDia}
            onEvento={abrirEvento}
          />
        )}

        <div className="rec-legenda">
          <span><i className="cal-chip cal-chip-recorrente" /> recorrente a lançar</span>
          <span><i className="cal-chip cal-chip-recorrente cal-chip-lancado" /> já lançado</span>
          {mostrarCustos && <span><i className="cal-chip cal-chip-custo" /> custo manual</span>}
        </div>
      </div>

      <div className="card">
        <h3 className="card-title">
          Recorrências cadastradas
          {filtroTabelaAtivo
            ? ` (${templatesFiltrados.length} de ${templates.length})`
            : ` (${templates.length})`}
        </h3>

        <div className="toolbar rec-filtros">
          <div className="field" style={{ maxWidth: 240 }}>
            <label>Buscar</label>
            <input
              value={fTexto}
              onChange={(e) => setFTexto(e.target.value)}
              placeholder="Descrição, item ou fornecedor..."
            />
          </div>
          <div className="field" style={{ maxWidth: 190 }}>
            <label>Frequência</label>
            <select value={fFreq} onChange={(e) => setFFreq(e.target.value)}>
              <option value="">Todas</option>
              {Object.entries(FREQUENCIAS).map(([valor, { label }]) => (
                <option key={valor} value={valor}>{label}</option>
              ))}
            </select>
          </div>
          <div className="field" style={{ maxWidth: 160 }}>
            <label>Situação</label>
            <select value={fSituacao} onChange={(e) => setFSituacao(e.target.value)}>
              <option value="">Todas</option>
              <option value="ativa">Ativas</option>
              <option value="encerrada">Encerradas</option>
            </select>
          </div>
          {filtroTabelaAtivo && (
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => { setFTexto(''); setFFreq(''); setFSituacao(''); }}
            >
              Limpar filtros
            </button>
          )}
        </div>

        <div className="table-wrap">
          <table className="sticky-actions rec-tabela">
            <thead>
              <tr>
                <th className="rec-col-larga">Descrição</th>
                <th className="rec-col-larga">Item</th>
                <th>Frequência</th>
                <th className="num">Valor</th>
                <th>Início</th>
                <th>Fim</th>
                <th>Próximo</th>
                <th>Situação</th>
                {escrever && <th>Ações</th>}
              </tr>
            </thead>
            <tbody>
              {templatesFiltrados.map(({ t, item, encerrada }) => (
                <tr key={t.UUID}>
                  <td>{t.DESCRICAO}</td>
                  <td>{item?.DESCRICAO_ITEM || <span className="muted">(item não encontrado)</span>}</td>
                  <td>{labelFrequencia(t.FREQUENCIA)}{t.DIA_BASE ? ` · dia ${t.DIA_BASE}` : ''}</td>
                  <td className="num">{brl(toNum(t.QTD) * toNum(t.VALOR_UNIT))}</td>
                  <td>{t.DATA_INICIO}</td>
                  <td>{t.DATA_FIM || <span className="muted">—</span>}</td>
                  <td>{encerrada ? <span className="muted">—</span> : proximoVencimento(t)}</td>
                  <td>
                    <span className={`badge ${encerrada ? 'badge-default' : 'badge-folha'}`}>
                      {encerrada ? 'Encerrada' : 'Ativa'}
                    </span>
                  </td>
                  {escrever && (
                    <td className="rec-acoes">
                      <button
                        className="btn btn-sm btn-ghost"
                        onClick={() => { setEditando(t); setShowForm(true); }}
                        title="Editar"
                      >
                        ✏
                      </button>
                      {!encerrada && (
                        <button
                          className="btn btn-sm btn-ghost"
                          onClick={() => setCancelando({ template: t, aPartirDe: hoje })}
                          title="Cancelar a partir de uma data"
                        >
                          ⛔
                        </button>
                      )}
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => setConfirmDel(t)}
                        title="Excluir"
                      >
                        🗑
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {templatesFiltrados.length === 0 && !loading && (
                <tr>
                  <td colSpan={escrever ? 9 : 8} className="empty">
                    {templates.length === 0
                      ? 'Nenhuma recorrência cadastrada.'
                      : 'Nenhuma recorrência com esses filtros.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <RecorrenteForm
          inicial={editando}
          itens={itens}
          fornecedores={fornecedores}
          onSalvar={salvarTemplate}
          onFechar={() => { setShowForm(false); setEditando(null); }}
          salvando={salvando}
        />
      )}

      {eventoAberto && (
        <RecorrenteDialog
          evento={eventoAberto}
          escrever={escrever}
          salvando={salvando}
          onFechar={() => { setEventoAberto(null); setVoltarAoDia(''); }}
          onVoltar={voltarAoDia ? () => {
            setEventoAberto(null);
            setDiaAberto(voltarAoDia);
            setVoltarAoDia('');
          } : undefined}
          onVerEmCustos={verEmCustos}
          onEditarTemplate={(t) => { setEventoAberto(null); setEditando(t); setShowForm(true); }}
          onCancelarRecorrencia={(t) => { setEventoAberto(null); setCancelando({ template: t, aPartirDe: hoje }); }}
          onSalvarExcecao={async (payload) => {
            const ok = await acao(() => recorrentesApi.salvarExcecao(payload), 'Exceção salva para esta data.');
            if (ok) setEventoAberto(null);
          }}
          onRemoverExcecao={async (uuid) => {
            const ok = await acao(() => recorrentesApi.removerExcecao(uuid), 'Ocorrência reativada.');
            if (ok) setEventoAberto(null);
          }}
        />
      )}

      {/* Dia inteiro: a célula do calendário mostra só os primeiros lançamentos,
          e é aqui que a pessoa vê todos — inclusive quando não há nenhum. */}
      {diaAberto && (
        <Modal
          title={`Lançamentos de ${diaAberto}`}
          className="modal-lg"
          onClose={() => setDiaAberto('')}
          footer={<button className="btn btn-ghost" onClick={() => setDiaAberto('')}>Fechar</button>}
        >
          <CalendarioDiario
            data={diaAberto}
            eventosPorDia={eventosPorDia}
            onEvento={(ev) => { setVoltarAoDia(diaAberto); setDiaAberto(''); setEventoAberto(ev); }}
          />
          {!mostrarCustos && (
            <p className="rec-hint">
              Só as recorrências aparecem aqui. Ligue <strong>Mostrar todos os custos</strong> para
              ver também os lançamentos avulsos do dia.
            </p>
          )}
        </Modal>
      )}

      {showPrevia && (
        <Modal
          title="Ocorrências vencidas"
          className="modal-lg"
          onClose={() => setShowPrevia(false)}
          footer={(
            <>
              <button className="btn btn-ghost" onClick={() => setShowPrevia(false)}>Fechar</button>
              {escrever && pendentes.total > 0 && (
                <button className="btn" onClick={processar} disabled={salvando}>
                  {salvando ? 'Lançando...' : `Lançar ${pendentes.total} ocorrência(s)`}
                </button>
              )}
            </>
          )}
        >
          <p className="rec-hint">
            Cada uma entra em Custos <strong>na sua própria data</strong>, com a classificação
            atual do item. Total: <strong>{brl(pendentes.valorTotal)}</strong>.
          </p>
          <div className="table-wrap" style={{ maxHeight: '55vh' }}>
            <table className="rec-tabela">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Descrição</th>
                  <th>Item</th>
                  <th>Fornecedor</th>
                  <th className="num">Qtd</th>
                  <th className="num">V. Unit</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {(pendentes.lancamentos || []).map((l, i) => (
                  <tr key={`${l.UUID_TEMPLATE}-${l.DATA}-${i}`}>
                    <td>{l.DATA}</td>
                    <td>{l.DESCRICAO}{l.EXCECAO ? ' ✎' : ''}</td>
                    <td>{l.ITEM}</td>
                    <td>{l.FORNECEDOR}</td>
                    <td className="num">{l.QTD}</td>
                    <td className="num">{brl(l.VALOR_UNIT)}</td>
                    <td className="num">{brl(l.VALOR_TOTAL)}</td>
                  </tr>
                ))}
                {(pendentes.lancamentos || []).length === 0 && (
                  <tr><td colSpan={7} className="empty">Nada vencido no momento.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Modal>
      )}

      {cancelando && (
        <Modal
          title="Cancelar recorrência"
          onClose={() => setCancelando(null)}
          footer={(
            <>
              <button className="btn btn-ghost" onClick={() => setCancelando(null)}>Voltar</button>
              <button
                className="btn btn-danger"
                disabled={salvando}
                onClick={async () => {
                  const ok = await acao(
                    () => recorrentesApi.cancelar(cancelando.template.UUID, cancelando.aPartirDe),
                    (r) => `Recorrência encerrada em ${r.DATA_FIM}.`,
                  );
                  if (ok) setCancelando(null);
                }}
              >
                Cancelar recorrência
              </button>
            </>
          )}
        >
          <p>
            <strong>{cancelando.template.DESCRICAO}</strong> deixa de lançar a partir da data
            escolhida. Nada do que já foi lançado em Custos é apagado.
          </p>
          <div className="field" style={{ maxWidth: 220 }}>
            <label>Cancelar a partir de</label>
            <input
              type="date"
              value={(() => {
                const m = String(cancelando.aPartirDe).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
                return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
              })()}
              onChange={(e) => {
                const [y, mm, dd] = e.target.value.split('-');
                setCancelando((c) => ({ ...c, aPartirDe: y ? `${dd}/${mm}/${y}` : c.aPartirDe }));
              }}
            />
          </div>
        </Modal>
      )}

      {confirmDel && (
        <ConfirmDialog
          message={`Excluir a recorrência "${confirmDel.DESCRICAO}"? Os custos já lançados por ela permanecem em Custos.`}
          onCancel={() => setConfirmDel(null)}
          onConfirm={async () => {
            const ok = await acao(() => recorrentesApi.remover(confirmDel.UUID), 'Recorrência excluída.');
            if (ok) setConfirmDel(null);
          }}
        />
      )}
    </div>
  );
}
