import React from 'react';
import ChipEvento from './ChipEvento.jsx';
import { somarDias, parseData } from '../utils/recorrentesCalc.js';

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// A coluna da semana é mais alta que a célula do mês, mas também não comporta um
// dia de compras inteiro. Mesmo princípio: recorrentes primeiro, resto a um clique.
const MAX_CHIPS = 6;

/**
 * Visão semana: 7 colunas no desktop, coluna única no telefone (o CSS resolve —
 * aqui o markup é o mesmo). `inicio` é o domingo da semana, em DD/MM/YYYY.
 * `onDia(data)` abre o dia inteiro, inclusive quando está vazio.
 */
export default function CalendarioSemanal({
  inicio, eventosPorDia, hoje, onEvento, onDia,
}) {
  const dias = Array.from({ length: 7 }, (_, i) => {
    const data = somarDias(inicio, i);
    const p = parseData(data);
    return {
      data,
      dia: p ? p.dia : '',
      semana: DIAS_SEMANA[i],
      eventos: eventosPorDia.get(data) || [],
    };
  });

  return (
    <div className="cal-semana">
      {dias.map((d) => {
        const visiveis = d.eventos.slice(0, MAX_CHIPS);
        const ocultos = d.eventos.length - visiveis.length;
        return (
          <div
            key={d.data}
            className={`cal-semana-dia ${d.data === hoje ? 'cal-hoje' : ''}`}
            onClick={() => onDia?.(d.data)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') onDia?.(d.data); }}
            title={`Ver o dia ${d.data}`}
          >
            <div className="cal-semana-head">
              <span className="cal-semana-nome">{d.semana}</span>
              <span className="cal-numero">{d.dia}</span>
            </div>
            <div className="cal-eventos">
              {d.eventos.length === 0 && <span className="cal-vazio-dia">—</span>}
              {visiveis.map((ev) => (
                <ChipEvento key={ev.id} evento={ev} onClick={onEvento} />
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
