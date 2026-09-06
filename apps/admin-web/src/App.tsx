import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './auth';
import Login from './pages/Login';
import Layout from './components/Layout';
import Cargos from './pages/Cargos';
import Editor from './pages/Editor';
import Rascunhos from './pages/Rascunhos';
import Historico from './pages/Historico';

export default function App() {
  const { loading, authed } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!authed) return <Login />;

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Cargos />} />
        <Route path="/editor/:draftId" element={<Editor />} />
        <Route path="/rascunhos" element={<Rascunhos />} />
        <Route path="/historico/:schemaId" element={<Historico />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
