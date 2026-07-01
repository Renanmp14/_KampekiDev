import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import ProtectedRoute from './components/ProtectedRoute.jsx';
import Layout from './components/Layout.jsx';

import Login from './pages/Login.jsx';
import Fornecedor from './pages/Fornecedor.jsx';
import Tag from './pages/Tag.jsx';
import Itens from './pages/Itens.jsx';
import Custos from './pages/Custos.jsx';
import Folha from './pages/Folha.jsx';
import Saida from './pages/Saida.jsx';
import DashCustos from './pages/dash/DashCustos.jsx';
import DashFolha from './pages/dash/DashFolha.jsx';
import DashPeriodo from './pages/dash/DashPeriodo.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        element={(
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        )}
      >
        <Route path="/" element={<Navigate to="/dash/custos" replace />} />
        <Route path="/fornecedor" element={<Fornecedor />} />
        <Route path="/tag" element={<Tag />} />
        <Route path="/itens" element={<Itens />} />
        <Route path="/custos" element={<Custos />} />
        <Route path="/folha" element={<Folha />} />
        <Route path="/saida" element={<Saida />} />
        <Route path="/dash/custos" element={<DashCustos />} />
        <Route path="/dash/folha" element={<DashFolha />} />
        <Route path="/dash/periodo" element={<DashPeriodo />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
