// Filtro de Fornecedor compartilhado pelos dashboards (Custos, Folha, Análise por
// Período e Visões avançadas).
//
// A regra pedida é de CASCATA: a lista de fornecedores oferecida mostra apenas
// quem tem lançamento no recorte já escolhido (categoria → subcategoria → item).
// Sem filtro prévio, mostra todos. Isso NÃO é uma regra nova de negócio: é a
// mesma ideia que a subcategoria já seguia (restrita à categoria) desde a 1.1.0.
//
// Como usar (o padrão que garante a cascata em todas as telas):
//   1. monte a base do recorte SEM o filtro de fornecedor  → `baseOpcoes`
//   2. `opcoesFornecedor(baseOpcoes, escolhidos)` alimenta o SearchableSelect
//   3. aplique `filtrarPorFornecedor(rows, escolhidos)` para obter a base final
//
// O passo 1 é o que importa: calcular as opções sobre a base já filtrada por
// categoria/subcategoria/item (mas ainda não por fornecedor) produz a cascata de
// graça — e evita o erro clássico de o próprio filtro estreitar a própria lista,
// que impediria trocar de fornecedor sem antes limpar a seleção.

// Rótulo dos lançamentos sem fornecedor. Em CUSTOS é raro (a importação cadastra
// "Sem Fornecedor" como fornecedor real), mas os lançamentos MANUAIS da aba FOLHA
// não têm fornecedor nenhum — e precisam continuar acessíveis no filtro.
export const SEM_FORNECEDOR = '(sem fornecedor)';

// Valor de fornecedor de uma linha, já normalizado para exibição/agrupamento.
export function fornecedorDe(row) {
  return String(row?.FORNECEDOR || '').trim() || SEM_FORNECEDOR;
}

/**
 * Opções do filtro, em ordem alfabética, a partir das linhas do recorte atual
 * (ver o passo 1 acima). `escolhidos` já selecionados saem da lista — mesmo
 * padrão dos filtros multi-seleção de Custos/Itens.
 *
 * `SEM_FORNECEDOR` só aparece quando existe de fato linha sem fornecedor no
 * recorte, e vai sempre no topo (é um caso de curadoria, não um fornecedor).
 */
export function opcoesFornecedor(rows, escolhidos = []) {
  const set = new Set();
  let temVazio = false;
  for (const r of rows) {
    const f = fornecedorDe(r);
    if (f === SEM_FORNECEDOR) temVazio = true;
    else set.add(f);
  }
  const ja = new Set(escolhidos);
  const nomes = [...set]
    .filter((f) => !ja.has(f))
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));
  return temVazio && !ja.has(SEM_FORNECEDOR) ? [SEM_FORNECEDOR, ...nomes] : nomes;
}

// Aplica o filtro. Lista vazia = todos (nunca esconde nada por omissão).
export function filtrarPorFornecedor(rows, escolhidos = []) {
  if (!escolhidos.length) return rows;
  const alvo = new Set(escolhidos);
  return rows.filter((r) => alvo.has(fornecedorDe(r)));
}

// Trecho para o rótulo de "Filtros:" dos relatórios em PDF (null quando vazio,
// para compor com os demais via .filter(Boolean)).
export function rotuloFornecedor(escolhidos = []) {
  return escolhidos.length ? `Fornecedores: ${escolhidos.join(', ')}` : null;
}
