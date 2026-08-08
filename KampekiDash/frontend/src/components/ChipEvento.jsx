import React from 'react';
import { brl } from '../utils/format.js';

/**
 * Chip de um evento no calendário. Os três tipos combinados na mesma tela:
 *  - recorrente futuro          → coral (ainda vai ser lançado)
 *  - recorrente já lançado      → coral esmaecido com ✓
 *  - custo manual               → areia (só com a flag "mostrar todos os custos")
 *
 * Uma ocorrência com exceção 'pular' aparece RISCADA em vez de sumir: quem
 * marcou precisa ver que aquele mês não vai lançar — um buraco silencioso no
 * calendário pareceria bug.
 */
export default function ChipEvento({ evento, onClick, compacto = false }) {
  const classes = ['cal-chip', `cal-chip-${evento.tipo}`];
  if (evento.lancado) classes.push('cal-chip-lancado');
  if (evento.pulado) classes.push('cal-chip-pulado');

  const marca = [evento.lancado ? '✓' : '', evento.alterado ? '✎' : ''].filter(Boolean).join(' ');
  const titulo = [
    evento.titulo,
    evento.pulado ? '(pulada)' : '',
    `· ${brl(evento.valor)}`,
    evento.tipo === 'custo' ? '· custo lançado' : '',
  ].filter(Boolean).join(' ');

  return (
    <button
      type="button"
      className={classes.join(' ')}
      onClick={(e) => {
        // A célula do dia também é clicável (abre o dia inteiro). Sem parar a
        // propagação, clicar num chip abriria as duas coisas.
        e.stopPropagation();
        onClick?.(evento);
      }}
      title={titulo}
    >
      <span className="cal-chip-titulo">
        {marca && <span className="cal-chip-marca">{marca}</span>}
        {evento.titulo}
      </span>
      {!compacto && <span className="cal-chip-valor">{brl(evento.valor)}</span>}
    </button>
  );
}
