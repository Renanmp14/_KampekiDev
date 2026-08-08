import React from 'react';
import ChipEvento from './ChipEvento.jsx';
import { ultimoDiaMes, formatarData } from '../utils/recorrentesCalc.js';

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
// No telefone o cabeçalho da grade tem ~50px por coluna: só a inicial cabe.
const DIAS_SEMANA_CURTOS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

// Cor do marcador do dia, por prioridade: o que ainda vai ser lançado fala mais
// alto que o que já foi, e custo avulso é a informação menos urgente das três.
function corDoDia(eventos) {
  if (eventos.some((e) => e.tipo === 'recorrente' && !e.lancado && !e.pulado)) return 'pend';
  if (eventos.some((e) => e.tipo === 'recorrente')) return 'feito';
  return 'custo';
}

// Teto de chips por célula. Com "mostrar todos os custos" ligado, um dia de
// compras traz dezenas de lançamentos e a célula viraria uma parede ilegível —
// pior, empurraria a linha inteira da grade. O dia completo fica a um clique.
const MAX_CHIPS = 3;

/**
 * Visão mês. No desktop é a grade clássica de 7 colunas; no telefone (`estreita`)
 * vira uma LISTA de dias com evento, e tocar no dia expande os chips — a grade de
 * 7 colunas em 390px daria células de ~50px, onde nenhum chip é legível.
 *
 * `eventosPorDia`: Map de 'DD/MM/YYYY' → evento[]. A lista de cada dia já chega
 * ordenada com os RECORRENTES primeiro (ver Recorrentes.jsx), então o corte em
 * MAX_CHIPS nunca esconde uma recorrência para mostrar um custo avulso.
 *
 * `onDia(data)` abre o dia inteiro — inclusive quando não há nada nele.
 */
export default function CalendarioMensal({
  ano, mes, eventosPorDia, hoje, onEvento, onDia, estreita = false,
}) {
  const totalDias = ultimoDiaMes(mes, ano);
  // getUTCDay do dia 1: em que coluna a grade começa.
  const deslocamento = new Date(Date.UTC(ano, mes - 1, 1)).getUTCDay();

  const dias = [];
  for (let d = 1; d <= totalDias; d += 1) {
    const data = formatarData({ dia: d, mes, ano });
    dias.push({ dia: d, data, eventos: eventosPorDia.get(data) || [] });
  }

  if (estreita) {
    // Grade compacta, no modelo do Calendário do iPhone: os dias lado a lado,
    // semana a semana, com o número e — quando há lançamento — um ponto colorido
    // embaixo. Tocar no dia abre a lista completa dele. Em ~50px de coluna não
    // cabe chip nenhum; o ponto é o que informa sem tentar caber o incabível.
    return (
      <div className="cal-mini">
        {DIAS_SEMANA_CURTOS.map((d, i) => (
          // eslint-disable-next-line react/no-array-index-key
          <div key={`h-${i}`} className="cal-mini-h">{d}</div>
        ))}
        {Array.from({ length: deslocamento }, (_, i) => (
          <div key={`vazio-${i}`} />
        ))}
        {dias.map((d) => {
          const tem = d.eventos.length > 0;
          return (
            <button
              key={d.data}
              type="button"
              className={`cal-mini-dia ${d.data === hoje ? 'hoje' : ''} ${tem ? 'tem' : ''}`}
              onClick={() => onDia?.(d.data)}
              title={tem ? `${d.eventos.length} lançamento(s) em ${d.data}` : d.data}
            >
              <span className="cal-mini-n">{d.dia}</span>
              {tem && <span className={`cal-mini-dot ${corDoDia(d.eventos)}`} />}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="cal-grade">
      {DIAS_SEMANA.map((d) => (
        <div key={d} className="cal-cabecalho">{d}</div>
      ))}
      {Array.from({ length: deslocamento }, (_, i) => (
        <div key={`vazio-${i}`} className="cal-celula cal-celula-vazia" />
      ))}
      {dias.map((d) => {
        const visiveis = d.eventos.slice(0, MAX_CHIPS);
        const ocultos = d.eventos.length - visiveis.length;
        return (
          <div
            key={d.data}
            className={`cal-celula ${d.data === hoje ? 'cal-hoje' : ''}`}
            onClick={() => onDia?.(d.data)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') onDia?.(d.data); }}
            title={`Ver o dia ${d.data}`}
          >
            <div className="cal-numero">{d.dia}</div>
            <div className="cal-eventos">
              {visiveis.map((ev) => (
                <ChipEvento key={ev.id} evento={ev} onClick={onEvento} compacto />
              ))}
              {ocultos > 0 && (
                <span className="cal-mais">+{ocultos} lançamento{ocultos > 1 ? 's' : ''}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
