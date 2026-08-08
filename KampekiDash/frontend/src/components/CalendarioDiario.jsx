import React from 'react';
import ChipEvento from './ChipEvento.jsx';
import { brl } from '../utils/format.js';

/**
 * Visão dia: a lista dos eventos daquela data, com o total do dia. É a visão que
 * naturalmente já serve ao telefone, então não tem variante estreita.
 */
export default function CalendarioDiario({ data, eventosPorDia, onEvento }) {
  const eventos = eventosPorDia.get(data) || [];
  // O total ignora as ocorrências puladas — elas não viram custo.
  const total = eventos.filter((e) => !e.pulado).reduce((s, e) => s + (e.valor || 0), 0);

  if (!eventos.length) {
    return <p className="cal-vazio">Nenhum lançamento neste dia.</p>;
  }

  return (
    <div className="cal-dia">
      <div className="cal-dia-total">
        {eventos.length} {eventos.length === 1 ? 'evento' : 'eventos'} · Total {brl(total)}
      </div>
      <div className="cal-eventos">
        {eventos.map((ev) => (
          <ChipEvento key={ev.id} evento={ev} onClick={onEvento} />
        ))}
      </div>
    </div>
  );
}
