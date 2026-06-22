import React from 'react';
import SimpleCrudPage from '../components/SimpleCrudPage.jsx';
import { fornecedorApi } from '../api/resources.js';
import { parseFornecedor } from '../utils/importParse.js';

export default function Fornecedor() {
  return (
    <SimpleCrudPage
      title="Fornecedores"
      fieldLabel="Nome do fornecedor"
      fieldKey="NOME_FORNECEDOR"
      api={fornecedorApi}
      searchable
      importConfig={{
        hint: 'A planilha deve ter a coluna "LISTA FORNECEDOR". Fornecedores repetidos (no arquivo ou já cadastrados) são ignorados.',
        parse: parseFornecedor,
        onImport: (rows) => fornecedorApi.importar(rows),
        chunkSize: 5000,
        templateColumns: ['LISTA FORNECEDOR'],
        templateName: 'modelo-fornecedores.xlsx',
      }}
    />
  );
}
