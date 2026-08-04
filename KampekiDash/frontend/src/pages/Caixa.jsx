import React, { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, Cell, AreaChart, Area, LabelList,
} from 'recharts';

import { caixaApi } from '../api/resources.js';
import { podeEscrever } from '../api/client.js';
import Modal from '../components/Modal.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import SearchableSelect from '../components/SearchableSelect.jsx';
import { brl, brlCompact, toNum } from '../utils/format.js';
import {
  chaveMes, saldoCorrido, inicioKeyDe, saldoAntesDe,
} from '../utils/caixaCalc.js';
import { useTelaEstreita } from '../utils/useMediaQuery.js';

// Cores da marca (mesmas do :root do styles.css).
const OLIVA = '#bfcb7f'; // entradas
const CORAL = '#ff8b7c'; // saídas
const TEAL = '#4f868f'; // saldo
const CINZA = '#e9ebe6';

const TODOS = '(todos)';

const MESES_NOME = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

// Abreviação para o eixo do gráfico no telefone: "Agosto/2026" não cabe em
// ~28px por rótulo, "Ago/26" cabe.
const MESES_ABREV = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
];

const emptyForm = {
  DATA: '', TIPO: 'entrada', DESCRICAO: '', VALOR: '', PESSOA: '',
};

// --- helpers de data ------------------------------------------------------
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
function hojeBr() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

// Normaliza para comparar sem depender de caixa ou acento ("João", "joao" e
// "JOÃO" são a mesma pessoa). A grafia GRAVADA nunca é alterada — a exibida é a
// primeira registrada.
const norm = (s) => String(s || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .trim().toLowerCase();

const rotuloMes = (mesAno) => {
  const m = String(mesAno || '').match(/^(\d{2})\/(\d{4})$/);
  return m ? `${MESES_NOME[parseInt(m[1], 10) - 1]}/${m[2]}` : mesAno;
};

const rotuloMesCurto = (mesAno) => {
  const m = String(mesAno || '').match(/^(\d{2})\/(\d{4})$/);
  return m ? `${MESES_ABREV[parseInt(m[1], 10) - 1]}/${m[2].slice(2)}` : mesAno;
};

const tooltipProps = {
  contentStyle: { background: '#16302b', border: '1px solid #2c4a43', borderRadius: 6 },
  itemStyle: { color: '#f1f3f5' },
  labelStyle: { color: '#f1f3f5' },
};

// Chips de um filtro multi-seleção (mesmo padrão da tela de Custos).
function Chips({ valores, rotulo = (v) => v, onRemove }) {
  if (!valores.length) return null;
  return (
    <div className="filtro-chips">
      {valores.map((v) => (
        <span key={v} className="filtro-chip">
          {rotulo(v)}
          <button type="button" onClick={() => onRemove(v)} title="Remover">×</button>
        </span>
      ))}
    </div>
  );
}

export default function Caixa() {
  // Perfil de consulta não vê os controles de escrita (o backend também barra).
  const escrever = podeEscrever();
  // Gráficos são dimensionados por props JS — precisam saber do telefone.
  const estreita = useTelaEstreita();
  const [lista, setLista] = useState([]); // backend: mais recente primeiro
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Horário da última leitura: sem ele, clicar em "Atualizar" quando nada mudou
  // não dá sinal nenhum de que a busca aconteceu.
  const [atualizadoEm, setAtualizadoEm] = useState('');

  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const agora = new Date();
  const anoAtual = String(agora.getFullYear());
  const mesAtual = `${String(agora.getMonth() + 1).padStart(2, '0')}/${anoAtual}`;

  // Filtros multi-seleção: array vazio = "todos". Tipo segue único (só tem dois
  // valores — marcar os dois seria o mesmo que não filtrar).
  // A tela ABRE SEM FILTRO: mostra o caixa inteiro, e o saldo atual é o saldo
  // real de hoje. Filtrar é uma escolha do usuário, não o estado inicial.
  const [fAnos, setFAnos] = useState([]);
  const [fMeses, setFMeses] = useState([]);
  const [fDias, setFDias] = useState([]);
  const [fTipo, setFTipo] = useState(TODOS);
  const [fPessoas, setFPessoas] = useState([]);

  async function carregar() {
    setLoading(true);
    setError(''); // uma releitura bem-sucedida tem de limpar o erro anterior
    try {
      setLista(await caixaApi.listar());
      setAtualizadoEm(new Date().toLocaleTimeString('pt-BR', {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      }));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { carregar(); }, []);

  // --- opções dos filtros -------------------------------------------------

  const anosOptions = useMemo(() => {
    const set = new Set(lista.map((r) => String(r.ANO || '')).filter(Boolean));
    set.add(anoAtual); // o ano corrente sempre é selecionável, mesmo sem dado
    return [...set].sort((a, b) => b.localeCompare(a));
  }, [lista, anoAtual]);

  // Meses dos anos escolhidos (todos os anos quando nenhum está marcado).
  const mesesOptions = useMemo(() => {
    const set = new Set(
      lista
        .filter((r) => !fAnos.length || fAnos.includes(String(r.ANO || '')))
        .map((r) => r.MES_ANO)
        .filter(Boolean),
    );
    if (!fAnos.length || fAnos.includes(anoAtual)) set.add(mesAtual);
    return [...set].sort((a, b) => chaveMes(b).localeCompare(chaveMes(a)));
  }, [lista, fAnos, anoAtual, mesAtual]);

  // Dia só faz sentido com UM mês selecionado (o mesmo DD em meses diferentes
  // seria ambíguo) — mesma regra da tela de Custos.
  const mesUnico = fMeses.length === 1;

  const diasOptions = useMemo(() => {
    if (!mesUnico) return [];
    const set = new Set(
      lista.filter((r) => r.MES_ANO === fMeses[0])
        .map((r) => String(r.DATA || '').split('/')[0])
        .filter(Boolean),
    );
    return [...set].sort();
  }, [lista, fMeses, mesUnico]);

  const pessoasOptions = useMemo(() => {
    const vistas = new Map();
    lista.forEach((r) => {
      const k = norm(r.PESSOA);
      if (k && !vistas.has(k)) vistas.set(k, String(r.PESSOA).trim());
    });
    return [...vistas.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [lista]);

  // --- add/remove dos filtros multi ---------------------------------------

  const addEm = (set, v) => (set.some((x) => norm(x) === norm(v)) ? set : [...set, v]);
  const tiraDe = (set, v) => set.filter((x) => norm(x) !== norm(v));

  function addAno(v) { if (v) setFAnos((p) => addEm(p, v)); }
  function removeAno(v) { setFAnos((p) => tiraDe(p, v)); }

  // O adicionador de mês trabalha com o rótulo ("Agosto/2026"); o estado guarda
  // o valor cru ("08/2026"). Mudar a quantidade de meses zera o filtro de dia.
  function addMes(rotulo) {
    const raw = mesesOptions.find((m) => rotuloMes(m) === rotulo);
    if (!raw) return;
    setFMeses((p) => addEm(p, raw));
    setFDias([]);
  }
  function removeMes(raw) {
    setFMeses((p) => tiraDe(p, raw));
    setFDias([]);
  }

  function addDia(v) { if (v) setFDias((p) => addEm(p, v)); }
  function removeDia(v) { setFDias((p) => tiraDe(p, v)); }

  function addPessoa(v) { if (v) setFPessoas((p) => addEm(p, v)); }
  function removePessoa(v) { setFPessoas((p) => tiraDe(p, v)); }

  function limparFiltros() {
    setFAnos([]); setFMeses([]); setFDias([]); setFTipo(TODOS); setFPessoas([]);
  }

  const temFiltro = fAnos.length || fMeses.length || fDias.length
    || fTipo !== TODOS || fPessoas.length;

  // Ao trocar os anos, meses de anos que saíram deixam de fazer sentido.
  useEffect(() => {
    setFMeses((p) => {
      const validos = p.filter((m) => mesesOptions.includes(m));
      return validos.length === p.length ? p : validos;
    });
  }, [mesesOptions]);
  // Dias só sobrevivem com um único mês selecionado e se existirem nele.
  useEffect(() => {
    setFDias((p) => {
      if (!p.length) return p;
      if (!mesUnico) return [];
      const validos = p.filter((d) => diasOptions.includes(d));
      return validos.length === p.length ? p : validos;
    });
  }, [diasOptions, mesUnico]);

  // --- recortes -----------------------------------------------------------

  // Ordem cronológica (o backend entrega decrescente) — base do saldo corrido.
  const cronologico = useMemo(() => [...lista].reverse(), [lista]);

  // Recorte de TEMPO apenas (ano/mês/dia). É a base do saldo: o saldo é do
  // caixa, não do filtro — Tipo e Pessoa não podem alterá-lo (senão o número
  // deixaria de ser "quanto tem na caixinha").
  const noTempo = useMemo(() => cronologico.filter((r) => {
    if (fAnos.length && !fAnos.includes(String(r.ANO || ''))) return false;
    if (fMeses.length && !fMeses.includes(r.MES_ANO)) return false;
    if (mesUnico && fDias.length && !fDias.includes(String(r.DATA || '').split('/')[0])) return false;
    return true;
  }), [cronologico, fAnos, fMeses, fDias, mesUnico]);

  // Recorte completo (tempo + tipo + pessoa) — o que a tabela lista.
  const filtrados = useMemo(() => noTempo.filter((r) => {
    if (fTipo !== TODOS && r.TIPO !== fTipo) return false;
    if (fPessoas.length && !fPessoas.some((p) => norm(p) === norm(r.PESSOA))) return false;
    return true;
  }), [noTempo, fTipo, fPessoas]);

  const filtroDeConteudoAtivo = fTipo !== TODOS || fPessoas.length > 0;

  // --- saldos -------------------------------------------------------------

  // Saldo corrido sobre TODO o histórico. Com meses não contíguos selecionados
  // (ex.: Janeiro + Março), o saldo de uma linha de Março precisa embutir o que
  // passou em Fevereiro — é o dinheiro que existe de fato na caixa. Os filtros
  // escolhem o que aparece; nunca alteram o saldo.
  const saldoGeral = useMemo(() => saldoCorrido(cronologico), [cronologico]);

  // Começo do recorte: o ponto mais antigo selecionado. Tudo antes dele forma o
  // saldo inicial. Sem filtro de tempo, não há "antes" — o saldo inicial é zero.
  const inicioKey = useMemo(
    () => inicioKeyDe(fAnos, fMeses, fDias),
    [fAnos, fMeses, fDias],
  );

  const saldoInicial = useMemo(
    () => saldoAntesDe(cronologico, inicioKey),
    [cronologico, inicioKey],
  );

  const totalEntradas = filtrados.filter((r) => r.TIPO === 'entrada')
    .reduce((s, r) => s + toNum(r.VALOR), 0);
  const totalSaidas = filtrados.filter((r) => r.TIPO === 'saida')
    .reduce((s, r) => s + toNum(r.VALOR), 0);

  // Saldo ao fim do recorte = saldo real na última movimentação selecionada.
  const saldoAtual = noTempo.length
    ? (saldoGeral.get(noTempo[noTempo.length - 1].UUID) ?? 0)
    : saldoInicial;

  // Tabela: mais recente primeiro (o backend já entrega assim).
  const linhas = useMemo(() => [...filtrados].reverse(), [filtrados]);

  // --- dados dos gráficos -------------------------------------------------

  // Gráfico 1 — por dia quando há UM mês selecionado; por mês caso contrário
  // (um ano inteiro dia a dia daria ~365 rótulos ilegíveis). Clicar numa barra
  // adiciona/remove aquele mês (ou dia) do filtro.
  const porPeriodo = useMemo(() => {
    const porDia = mesUnico;
    const mapa = new Map();
    filtrados.forEach((r) => {
      const dd = String(r.DATA || '').split('/')[0];
      const key = porDia ? dd : r.MES_ANO;
      if (!key) return;
      const label = porDia ? `${dd}/${String(r.MES_ANO || '').slice(0, 2)}` : rotuloMes(r.MES_ANO);
      // No telefone o eixo usa a forma abreviada (por dia o rótulo já é curto).
      const labelCurto = porDia ? label : rotuloMesCurto(r.MES_ANO);
      const ordem = porDia ? dd : chaveMes(r.MES_ANO);
      if (!mapa.has(key)) mapa.set(key, { key, label, labelCurto, ordem, entrada: 0, saida: 0 });
      const alvo = mapa.get(key);
      if (r.TIPO === 'entrada') alvo.entrada += toNum(r.VALOR);
      else alvo.saida += toNum(r.VALOR);
    });
    return [...mapa.values()].sort((a, b) => a.ordem.localeCompare(b.ordem));
  }, [filtrados, mesUnico]);

  // Gráfico 2 — evolução do saldo (sempre sobre noTempo, como os KPIs).
  const evolucao = useMemo(() => noTempo.map((r) => ({
    key: r.UUID,
    label: r.DATA,
    saldo: saldoGeral.get(r.UUID) ?? 0,
  })), [noTempo, saldoGeral]);

  const porPessoa = (tipo) => {
    const mapa = new Map();
    filtrados.filter((r) => r.TIPO === tipo && String(r.PESSOA || '').trim()).forEach((r) => {
      const k = norm(r.PESSOA);
      if (!mapa.has(k)) mapa.set(k, { pessoa: String(r.PESSOA).trim(), total: 0 });
      mapa.get(k).total += toNum(r.VALOR);
    });
    const arr = [...mapa.values()].sort((a, b) => b.total - a.total).slice(0, 10);
    const base = arr.reduce((s, d) => s + d.total, 0);
    return arr.map((d) => ({
      ...d,
      rotulo: `${brl(d.total)} · ${base ? ((d.total / base) * 100).toFixed(1) : '0,0'}%`,
      // Versão enxuta para o telefone: o rótulo cheio exige ~130px de margem à
      // direita, o que não sobra em 390px de tela.
      rotuloCurto: `${brlCompact(d.total)} · ${base ? Math.round((d.total / base) * 100) : 0}%`,
    }));
  };
  const origens = useMemo(() => porPessoa('entrada'), [filtrados]); // eslint-disable-line react-hooks/exhaustive-deps
  const destinos = useMemo(() => porPessoa('saida'), [filtrados]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clique na barra do gráfico 1: adiciona/remove do filtro (drill-down). O
  // clique fica na <Bar> e não no <BarChart> porque o handler do gráfico deriva
  // o alvo da COORDENADA do mouse, o que erra sob zoom.
  function cliqueNoPeriodo(d) {
    const key = d?.key ?? d?.payload?.key;
    if (!key) return;
    if (mesUnico) {
      setFDias((p) => (p.includes(key) ? tiraDe(p, key) : [...p, key]));
    } else {
      setFMeses((p) => (p.includes(key) ? tiraDe(p, key) : [...p, key]));
      setFDias([]);
    }
  }
  const destacado = (key) => (mesUnico
    ? (!fDias.length || fDias.includes(key))
    : (!fMeses.length || fMeses.includes(key)));

  // --- formulário ---------------------------------------------------------

  function abrirNovo() {
    setForm({ ...emptyForm, DATA: hojeBr() });
    setEditing('novo');
    setError('');
    setShowForm(true);
  }

  function abrirEdicao(r) {
    setForm({
      DATA: r.DATA,
      TIPO: r.TIPO === 'saida' ? 'saida' : 'entrada',
      DESCRICAO: r.DESCRICAO || '',
      VALOR: r.VALOR,
      PESSOA: r.PESSOA || '',
    });
    setEditing(r);
    setError('');
    setShowForm(true);
  }

  function validarLocal() {
    if (!brToIso(form.DATA)) return 'Informe a data (DD/MM/AAAA)';
    if (form.TIPO !== 'entrada' && form.TIPO !== 'saida') return 'Selecione o tipo';
    if (!String(form.DESCRICAO || '').trim()) return 'Informe a descrição';
    if (toNum(form.VALOR) <= 0) return 'Informe um valor maior que zero';
    return '';
  }

  async function salvar() {
    const msg = validarLocal();
    if (msg) { setError(msg); return; }
    setError('');
    setSalvando(true);
    try {
      const payload = {
        DATA: form.DATA,
        TIPO: form.TIPO,
        DESCRICAO: String(form.DESCRICAO).trim(),
        VALOR: toNum(form.VALOR),
        PESSOA: String(form.PESSOA || '').trim(),
      };
      if (editing === 'novo') await caixaApi.criar(payload);
      else await caixaApi.atualizar(editing.UUID, payload);
      setShowForm(false);
      setEditing(null);
      await carregar();
    } catch (err) {
      setError(err.message);
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(uuid) {
    try {
      await caixaApi.remover(uuid);
      setConfirmDel(null);
      await carregar();
    } catch (err) {
      setError(err.message);
      setConfirmDel(null);
    }
  }

  // --- render -------------------------------------------------------------

  const labelPessoa = form.TIPO === 'entrada'
    ? 'Origem (de onde veio) — opcional'
    : 'Destino (para quem foi) — opcional';

  return (
    <div>
      <h1 className="page-title">Caixa</h1>
      <p className="muted" style={{ marginTop: -10, marginBottom: 18 }}>
        Controle de dinheiro físico
      </p>

      {error && <div className="error-msg" style={{ marginBottom: 12 }}>{error}</div>}

      <div className="toolbar">
        <div className="field" style={{ maxWidth: 150 }}>
          <label>Ano {fAnos.length > 0 ? `(${fAnos.length})` : ''}</label>
          <SearchableSelect
            value=""
            onPick={addAno}
            onChange={() => {}}
            options={anosOptions}
            placeholder={fAnos.length ? 'Adicionar outro...' : 'Todos...'}
            debounceMs={0}
          />
          <Chips valores={fAnos} onRemove={removeAno} />
        </div>

        <div className="field" style={{ maxWidth: 210 }}>
          <label>Mês {fMeses.length > 0 ? `(${fMeses.length})` : ''}</label>
          <SearchableSelect
            value=""
            onPick={addMes}
            onChange={() => {}}
            options={mesesOptions.map(rotuloMes)}
            placeholder={fMeses.length ? 'Adicionar outro...' : 'Todos...'}
            emptyText="Sem meses"
            debounceMs={0}
          />
          <Chips valores={fMeses} rotulo={rotuloMes} onRemove={removeMes} />
        </div>

        {mesUnico && (
          <div className="field" style={{ maxWidth: 150 }}>
            <label>Dia {fDias.length > 0 ? `(${fDias.length})` : ''}</label>
            <SearchableSelect
              value=""
              onPick={addDia}
              onChange={() => {}}
              options={diasOptions}
              placeholder={fDias.length ? 'Adicionar outro...' : 'Todos...'}
              emptyText="Sem dias"
              debounceMs={0}
            />
            <Chips valores={fDias} onRemove={removeDia} />
          </div>
        )}

        <div className="field" style={{ maxWidth: 150 }}>
          <label>Tipo</label>
          <SearchableSelect
            value={fTipo === TODOS ? TODOS : (fTipo === 'entrada' ? 'Entrada' : 'Saída')}
            onPick={(v) => setFTipo(v === 'Entrada' ? 'entrada' : (v === 'Saída' ? 'saida' : TODOS))}
            onChange={() => {}}
            options={[TODOS, 'Entrada', 'Saída']}
            debounceMs={0}
          />
        </div>

        <div className="field" style={{ maxWidth: 220 }}>
          <label>Pessoa {fPessoas.length > 0 ? `(${fPessoas.length})` : ''}</label>
          <SearchableSelect
            value=""
            onPick={addPessoa}
            onChange={() => {}}
            options={pessoasOptions}
            placeholder={fPessoas.length ? 'Adicionar outra...' : 'Todas...'}
            emptyText="Nenhuma pessoa registrada"
            debounceMs={0}
          />
          <Chips valores={fPessoas} onRemove={removePessoa} />
        </div>

        {temFiltro ? (
          <button className="btn btn-ghost" onClick={limparFiltros}>Limpar filtros</button>
        ) : null}

        <div className="spacer" />
        <div className="caixa-acoes">
          {/* Releitura da planilha sem F5 (navegador) e sem sair e voltar do
              módulo (desktop). É LEITURA: fica disponível também para o perfil
              de consulta, que é justamente quem mais precisa ver o dado novo. */}
          <button
            className="btn btn-ghost"
            onClick={carregar}
            disabled={loading}
            title="Buscar de novo as movimentações na planilha"
          >
            {loading ? '↻ Atualizando...' : '↻ Atualizar'}
          </button>
          {escrever && (
            <button className="btn btn-caixa-novo" onClick={abrirNovo}>+ Nova Movimentação</button>
          )}
          {atualizadoEm && (
            <span className="caixa-atualizado">{`atualizado ${atualizadoEm}`}</span>
          )}
        </div>
      </div>

      <div className="grid grid-4 caixa-kpis" style={{ marginBottom: 18 }}>
        <div className="kpi">
          <div className="kpi-label">Entradas</div>
          <div className="kpi-value" style={{ color: OLIVA }}>{brl(totalEntradas)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Saídas</div>
          <div className="kpi-value" style={{ color: CORAL }}>{brl(totalSaidas)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Saldo inicial</div>
          <div className="kpi-value" style={{ color: CINZA }}>{brl(saldoInicial)}</div>
          <div className="caixa-kpi-sub">antes do período filtrado</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Saldo atual</div>
          <div className="kpi-value" style={{ color: saldoAtual < 0 ? CORAL : TEAL }}>
            {brl(saldoAtual)}
          </div>
          <div className="caixa-kpi-sub">saldo real do caixa no fim do período</div>
        </div>
      </div>

      <div className="caixa-layout">
        <div className="card">
          <h3 className="card-title">
            Movimentações
            <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>
              {` — ${linhas.length} lançamento(s)`}
            </span>
          </h3>
          <div className="table-wrap caixa-table-wrap">
            <table className="caixa-tabela sticky-actions">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Tipo</th>
                  <th className="col-desc">Descrição</th>
                  <th>Pessoa</th>
                  <th style={{ textAlign: 'right' }}>Entrada</th>
                  <th style={{ textAlign: 'right' }}>Saída</th>
                  <th style={{ textAlign: 'right' }}>Saldo</th>
                  <th style={{ width: 120 }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((r) => {
                  const saldo = saldoGeral.get(r.UUID) ?? 0;
                  const entrada = r.TIPO === 'entrada';
                  return (
                    <tr key={r.UUID}>
                      <td>{r.DATA}</td>
                      <td>
                        <span className={`badge ${entrada ? 'badge-entrada' : 'badge-saida'}`}>
                          {entrada ? 'Entrada' : 'Saída'}
                        </span>
                      </td>
                      <td className="col-desc">{r.DESCRICAO}</td>
                      <td>{r.PESSOA || ''}</td>
                      <td style={{ textAlign: 'right', color: entrada ? OLIVA : undefined }}>
                        {entrada ? brl(r.VALOR) : '—'}
                      </td>
                      <td style={{ textAlign: 'right', color: entrada ? undefined : CORAL }}>
                        {entrada ? '—' : brl(r.VALOR)}
                      </td>
                      <td style={{ textAlign: 'right', color: saldo < 0 ? CORAL : undefined }}>
                        {brl(saldo)}
                      </td>
                      <td>
                        {escrever ? (
                          <>
                            <button className="btn btn-sm btn-ghost" onClick={() => abrirEdicao(r)} title="Editar">✏</button>
                            {' '}
                            <button className="btn btn-sm btn-danger" onClick={() => setConfirmDel(r)} title="Excluir">🗑</button>
                          </>
                        ) : <span className="muted">—</span>}
                      </td>
                    </tr>
                  );
                })}
                {linhas.length === 0 && (
                  <tr>
                    <td colSpan={8} className="muted caixa-vazio">
                      {loading ? 'Carregando...' : 'Nenhuma movimentação no período.'}
                    </td>
                  </tr>
                )}
              </tbody>
              {linhas.length > 0 && (
                <tfoot>
                  <tr>
                    <td colSpan={4} style={{ fontWeight: 600 }}>Totais</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: OLIVA }}>{brl(totalEntradas)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: CORAL }}>{brl(totalSaidas)}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        <div className="card">
          <h3 className="card-title">Resumo do período</h3>
          <div className="caixa-resumo">
            <div className="caixa-resumo-linha">
              <span className="muted">Total de entradas</span>
              <strong style={{ color: OLIVA }}>{brl(totalEntradas)}</strong>
            </div>
            <div className="caixa-resumo-linha">
              <span className="muted">Total de saídas</span>
              <strong style={{ color: CORAL }}>{brl(totalSaidas)}</strong>
            </div>
            <div className="caixa-resumo-linha">
              <span className="muted">Saldo inicial</span>
              <strong style={{ color: CINZA }}>{brl(saldoInicial)}</strong>
            </div>
            <div className="caixa-resumo-linha caixa-resumo-total">
              <span>Saldo atual</span>
              <strong style={{ color: saldoAtual < 0 ? CORAL : TEAL }}>{brl(saldoAtual)}</strong>
            </div>
          </div>
          {(filtroDeConteudoAtivo || fMeses.length > 1) && (
            <p className="muted" style={{ fontSize: 12, marginTop: 12, marginBottom: 0 }}>
              O saldo é do caixa: considera todas as movimentações do histórico até
              o fim do período, inclusive as que os filtros escondem da tabela.
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-2 caixa-graficos" style={{ marginTop: 18 }}>
        <div className="card">
          <h3 className="card-title">
            {mesUnico ? 'Entradas × Saídas por dia' : 'Entradas × Saídas por mês'}
            <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>
              {mesUnico ? ' — clique no dia para incluir/tirar do filtro' : ' — clique no mês para incluir/tirar do filtro'}
            </span>
          </h3>
          {porPeriodo.length === 0 ? (
            <p className="muted">Sem movimentações no período.</p>
          ) : (
            <ResponsiveContainer width="100%" height={estreita ? 230 : 280}>
              <BarChart data={porPeriodo} style={{ cursor: 'pointer' }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2c4a43" />
                <XAxis dataKey={estreita ? 'labelCurto' : 'label'} stroke="#93a39b" fontSize={estreita ? 10 : 12} />
                <YAxis stroke="#93a39b" fontSize={estreita ? 10 : 12} tickFormatter={brlCompact} width={estreita ? 52 : 60} />
                <Tooltip
                  {...tooltipProps}
                  formatter={(v, name) => [brl(v), name]}
                  cursor={{ fill: 'rgba(255,255,255,0.08)' }}
                />
                <Legend wrapperStyle={estreita ? { fontSize: 11 } : undefined} />
                <Bar dataKey="entrada" name="Entrada" fill={OLIVA} radius={[4, 4, 0, 0]} onClick={cliqueNoPeriodo}>
                  {porPeriodo.map((d) => (
                    <Cell key={d.key} fillOpacity={destacado(d.key) ? 1 : 0.35} />
                  ))}
                </Bar>
                <Bar dataKey="saida" name="Saída" fill={CORAL} radius={[4, 4, 0, 0]} onClick={cliqueNoPeriodo}>
                  {porPeriodo.map((d) => (
                    <Cell key={d.key} fillOpacity={destacado(d.key) ? 1 : 0.35} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card">
          <h3 className="card-title">Evolução do saldo</h3>
          {evolucao.length === 0 ? (
            <p className="muted">Sem movimentações no período.</p>
          ) : (
            <ResponsiveContainer width="100%" height={estreita ? 230 : 280}>
              <AreaChart data={evolucao}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2c4a43" />
                <XAxis dataKey="label" stroke="#93a39b" fontSize={estreita ? 10 : 12} minTickGap={estreita ? 44 : 24} />
                <YAxis stroke="#93a39b" fontSize={estreita ? 10 : 12} tickFormatter={brlCompact} width={estreita ? 52 : 60} />
                <Tooltip {...tooltipProps} formatter={(v) => [brl(v), 'Saldo']} />
                <Area
                  type="monotone"
                  dataKey="saldo"
                  stroke={TEAL}
                  fill={TEAL}
                  fillOpacity={0.25}
                  dot={(props) => {
                    const { cx, cy, payload, index } = props;
                    if (payload.saldo >= 0) return <g key={index} />;
                    return <circle key={index} cx={cx} cy={cy} r={4} fill={CORAL} stroke="#fff" strokeWidth={1} />;
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card">
          <h3 className="card-title">De onde mais entrou dinheiro</h3>
          {origens.length === 0 ? (
            <p className="muted">Nenhuma origem registrada</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(estreita ? 170 : 200, origens.length * (estreita ? 30 : 34) + 40)}>
              <BarChart data={origens} layout="vertical" margin={{ top: 5, right: estreita ? 74 : 130, bottom: 5, left: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2c4a43" horizontal={false} />
                <XAxis type="number" stroke="#93a39b" fontSize={estreita ? 10 : 12} tickFormatter={brlCompact} />
                <YAxis type="category" dataKey="pessoa" stroke="#93a39b" fontSize={estreita ? 10 : 12} width={estreita ? 72 : 110} />
                <Tooltip {...tooltipProps} formatter={(v) => [brl(v), 'Entradas']} cursor={{ fill: 'rgba(255,255,255,0.08)' }} />
                <Bar dataKey="total" fill={OLIVA} radius={[0, 4, 4, 0]}>
                  <LabelList dataKey={estreita ? 'rotuloCurto' : 'rotulo'} position="right" fill="#e9ebe6" fontSize={estreita ? 10 : 12} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card">
          <h3 className="card-title">Para onde mais saiu dinheiro</h3>
          {destinos.length === 0 ? (
            <p className="muted">Nenhum destino registrado</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(estreita ? 170 : 200, destinos.length * (estreita ? 30 : 34) + 40)}>
              <BarChart data={destinos} layout="vertical" margin={{ top: 5, right: estreita ? 74 : 130, bottom: 5, left: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2c4a43" horizontal={false} />
                <XAxis type="number" stroke="#93a39b" fontSize={estreita ? 10 : 12} tickFormatter={brlCompact} />
                <YAxis type="category" dataKey="pessoa" stroke="#93a39b" fontSize={estreita ? 10 : 12} width={estreita ? 72 : 110} />
                <Tooltip {...tooltipProps} formatter={(v) => [brl(v), 'Saídas']} cursor={{ fill: 'rgba(255,255,255,0.08)' }} />
                <Bar dataKey="total" fill={CORAL} radius={[0, 4, 4, 0]}>
                  <LabelList dataKey={estreita ? 'rotuloCurto' : 'rotulo'} position="right" fill="#e9ebe6" fontSize={estreita ? 10 : 12} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {showForm && (
        <Modal
          title={editing === 'novo' ? 'Nova movimentação' : 'Editar movimentação'}
          onClose={() => setShowForm(false)}
          footer={(
            <>
              <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancelar</button>
              <button className="btn" onClick={salvar} disabled={salvando}>
                {salvando ? 'Salvando...' : 'Salvar'}
              </button>
            </>
          )}
        >
          {error && <div className="error-msg" style={{ marginBottom: 12 }}>{error}</div>}

          <div className="grid grid-2" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>Data</label>
              <input
                type="date"
                value={brToIso(form.DATA)}
                onChange={(e) => setForm({ ...form, DATA: isoToBr(e.target.value) })}
              />
            </div>
            <div className="field">
              <label>Tipo</label>
              <div className="caixa-tipo-toggle">
                <button
                  type="button"
                  className={`caixa-tipo ${form.TIPO === 'entrada' ? 'ativo entrada' : ''}`}
                  onClick={() => setForm({ ...form, TIPO: 'entrada' })}
                >
                  Entrada
                </button>
                <button
                  type="button"
                  className={`caixa-tipo ${form.TIPO === 'saida' ? 'ativo saida' : ''}`}
                  onClick={() => setForm({ ...form, TIPO: 'saida' })}
                >
                  Saída
                </button>
              </div>
            </div>
          </div>

          <div className="field" style={{ marginBottom: 12 }}>
            <label>Descrição</label>
            <textarea
              rows={3}
              value={form.DESCRICAO}
              onChange={(e) => setForm({ ...form, DESCRICAO: e.target.value })}
              placeholder="O que foi essa movimentação"
            />
          </div>

          <div className="grid grid-2">
            <div className="field">
              <label>Valor (R$)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.VALOR}
                onChange={(e) => setForm({ ...form, VALOR: e.target.value })}
              />
            </div>
            <div className="field">
              <label>{labelPessoa}</label>
              <SearchableSelect
                value={form.PESSOA}
                onChange={(v) => setForm((f) => ({ ...f, PESSOA: v }))}
                options={pessoasOptions}
                placeholder="Nome (texto livre)"
                emptyText="Nenhuma pessoa registrada ainda"
                fixedMenu
                debounceMs={0}
              />
            </div>
          </div>
        </Modal>
      )}

      {confirmDel && (
        <ConfirmDialog
          message={`Excluir a movimentação de ${brl(confirmDel.VALOR)} em ${confirmDel.DATA} (${confirmDel.DESCRICAO})?`}
          onConfirm={() => excluir(confirmDel.UUID)}
          onCancel={() => setConfirmDel(null)}
        />
      )}
    </div>
  );
}
