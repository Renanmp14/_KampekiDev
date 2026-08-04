// Hook para o que a media query do CSS NÃO alcança.
//
// O Recharts recebe largura de eixo, margem e altura em PROPS de JavaScript
// (YAxis width, BarChart margin, ResponsiveContainer height) — nada disso é
// estilo, então o bloco "Telefone" do styles.css não consegue ajustá-los. Sem
// isto, os gráficos de barra horizontal do Caixa ficavam com ~100px úteis num
// iPhone 14: a legenda lateral e a margem do rótulo comiam a área da barra.

import { useEffect, useState } from 'react';

export function useMediaQuery(query) {
  const [combina, setCombina] = useState(() => (
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : false
  ));

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const mql = window.matchMedia(query);
    const aoMudar = (e) => setCombina(e.matches);
    setCombina(mql.matches); // reavalia caso a query tenha mudado
    mql.addEventListener('change', aoMudar);
    return () => mql.removeEventListener('change', aoMudar);
  }, [query]);

  return combina;
}

// 520px é o MESMO ponto de corte do bloco "Telefone (iPhone 14)" do styles.css —
// manter os dois no mesmo número evita um intervalo em que o CSS já empilhou mas
// o gráfico ainda acha que tem espaço de desktop.
export const useTelaEstreita = () => useMediaQuery('(max-width: 520px)');
