import React, { useState } from 'react';
import Modal from './Modal.jsx';
import { brl } from '../utils/format.js';
import { labelFrequencia } from '../utils/recorrentesCalc.js';

function Linha({ rotulo, children }) {
  if (children === '' || children === null || children === undefined) return null;
  return (
    <div className="rec-linha">
      <span className="rec-linha-rotulo">{rotulo}</span>
      <span className="rec-linha-valor">{children}</span>
    </div>
  );
}

/**
 * Detalhe do evento clicado no calendário. Três formas, conforme o que foi
 * clicado: ocorrência futura (editável), ocorrência já lançada (só leitura, com
 * atalho para o custo) e custo manual (só leitura).
 *
 * A edição pergunta o ESCOPO antes de agir — "só esta data" vira uma exceção
 * daquela ocorrência; "esta e as seguintes" abre o template. Nunca mexe no que
 * já está gravado em CUSTOS.
 */
export default function RecorrenteDialog({
  evento, escrever, onFechar, onVoltar, onEditarTemplate, onSalvarExcecao, onRemoverExcecao,
  onCancelarRecorrencia, onVerEmCustos, salvando = false, erro = '',
}) {
  const [modo, setModo] = useState('detalhe'); // detalhe | escopo | excecao
  const t = evento.template;
  const [qtd, setQtd] = useState(String(evento.qtd ?? ''));
  const [valor, setValor] = useState(String(evento.valorUnit ?? ''));
  const [numNota, setNumNota] = useState(evento.numNota || '');

  const ehCusto = evento.tipo === 'custo';
  const podeEditar = escrever && !ehCusto && !evento.lancado;

  function salvarExcecao() {
    const q = Number(String(qtd).replace(',', '.'));
    const v = Number(String(valor).replace(',', '.'));
    onSalvarExcecao({
      UUID_TEMPLATE: t.UUID,
      DATA_EXCECAO: evento.data,
      ACAO: 'alterar',
      QTD: Number.isFinite(q) && q > 0 ? q : '',
      VALOR_UNIT: Number.isFinite(v) && v > 0 ? v : '',
      NUM_NOTA: numNota,
    });
  }

  const titulo = ehCusto
    ? '📄 Custo lançado'
    : `${evento.lancado ? '✓' : '📌'} ${evento.titulo}`;

  const rodape = (() => {
    if (modo === 'excecao') {
      return (
        <>
          <button className="btn btn-ghost" onClick={() => setModo('detalhe')} disabled={salvando}>Voltar</button>
          <button className="btn" onClick={salvarExcecao} disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar só esta data'}
          </button>
        </>
      );
    }
    if (modo === 'escopo') {
      return <button className="btn btn-ghost" onClick={() => setModo('detalhe')}>Voltar</button>;
    }
    return (
      <>
        {/* Quando a dialog veio da lista do dia, é preciso um caminho de volta —
            fechar levaria a pessoa para o calendário, perdendo o dia que ela
            estava conferindo. Mesma lição do "← Voltar" do DrillPeriodoModal. */}
        {onVoltar && (
          <button className="btn btn-ghost" onClick={onVoltar}>← Voltar ao dia</button>
        )}
        <button className="btn btn-ghost" onClick={onFechar}>Fechar</button>
        {(ehCusto || evento.lancado) && (
          <button className="btn" onClick={() => onVerEmCustos(evento)}>Ver em Custos</button>
        )}
        {podeEditar && (
          <>
            {evento.pulado ? (
              <button className="btn" onClick={() => onRemoverExcecao(evento.excecao.UUID)} disabled={salvando}>
                Reativar esta data
              </button>
            ) : (
              <button
                className="btn btn-ghost"
                onClick={() => onSalvarExcecao({
                  UUID_TEMPLATE: t.UUID, DATA_EXCECAO: evento.data, ACAO: 'pular',
                })}
                disabled={salvando}
              >
                Pular esta data
              </button>
            )}
            <button className="btn" onClick={() => setModo('escopo')}>Editar</button>
          </>
        )}
      </>
    );
  })();

  return (
    <Modal title={titulo} onClose={onFechar} footer={rodape}>
      {erro && <div className="error-msg">{erro}</div>}

      {modo === 'detalhe' && (
        <>
          <p className="rec-hint">
            {evento.data}
            {!ehCusto && t ? ` · ${labelFrequencia(t.FREQUENCIA)}` : ''}
            {evento.lancado ? ' · já lançado em Custos' : ''}
            {evento.pulado ? ' · esta ocorrência está marcada para PULAR' : ''}
            {evento.alterado && !evento.pulado ? ' · esta data tem valores próprios' : ''}
          </p>
          <Linha rotulo="Fornecedor">{evento.fornecedor}</Linha>
          <Linha rotulo="Item">{evento.item}</Linha>
          <Linha rotulo="Subcategoria">{evento.subcategoria}</Linha>
          <Linha rotulo="Categoria">{evento.categoria}</Linha>
          <Linha rotulo="Tag">{evento.tag}</Linha>
          <Linha rotulo="Nº Nota">{evento.numNota}</Linha>
          <Linha rotulo="Quantidade">{evento.qtd}</Linha>
          <Linha rotulo="Valor unitário">{evento.valorUnit ? brl(evento.valorUnit) : ''}</Linha>
          <Linha rotulo="Valor total">{brl(evento.valor)}</Linha>
          {!ehCusto && !evento.lancado && (
            <p className="rec-hint">
              Ainda não foi lançado: entra em Custos quando alguém clicar em
              <strong> Colocar em dia</strong>.
            </p>
          )}
          {evento.lancado && evento.divergente && (
            <p className="rec-hint">
              ⚠ Os valores acima são os que foram <strong>efetivamente lançados</strong> nesta data.
              A recorrência hoje prevê <strong>{brl(evento.valorPrevisto)}</strong> — a alteração
              vale só para as próximas ocorrências, e o que já está em Custos não muda.
            </p>
          )}
        </>
      )}

      {modo === 'escopo' && (
        <div className="rec-escopo">
          <p>O que você quer alterar?</p>
          <button
            className="btn btn-ghost rec-escopo-opcao"
            onClick={() => setModo('excecao')}
          >
            <strong>Só esta data ({evento.data})</strong>
            <span className="rec-hint">Cria uma exceção. As demais ocorrências seguem como estão.</span>
          </button>
          <button
            className="btn btn-ghost rec-escopo-opcao"
            onClick={() => onEditarTemplate(t)}
          >
            <strong>Esta e todas as seguintes</strong>
            <span className="rec-hint">Altera a recorrência. O que já foi lançado não muda.</span>
          </button>
          {escrever && (
            <button
              className="btn btn-danger rec-escopo-opcao"
              onClick={() => onCancelarRecorrencia(t)}
            >
              <strong>Cancelar a recorrência</strong>
              <span className="rec-hint">Para de lançar a partir de uma data. Nada é apagado de Custos.</span>
            </button>
          )}
        </div>
      )}

      {modo === 'excecao' && (
        <>
          <p className="rec-hint">
            Valores só para <strong>{evento.data}</strong>. Em branco = mantém o da recorrência.
          </p>
          <div className="grid grid-3">
            <div className="field">
              <label>Quantidade</label>
              <input value={qtd} onChange={(e) => setQtd(e.target.value)} />
            </div>
            <div className="field">
              <label>Valor unitário (R$)</label>
              <input value={valor} onChange={(e) => setValor(e.target.value)} />
            </div>
            <div className="field">
              <label>Nº Nota</label>
              <input value={numNota} onChange={(e) => setNumNota(e.target.value)} placeholder="Sem Nota" />
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}
