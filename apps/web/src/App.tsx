import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AvaliacaoPage from './pages/AvaliacaoPage';
import AprovacaoPage from './pages/AprovacaoPage';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: Infinity, retry: false } },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/avaliacao" element={<AvaliacaoPage />} />
          <Route path="/aprovacao" element={<AprovacaoPage />} />
          <Route path="*" element={<div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>Veepie Forms</div>} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}