import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import WorkspacePage from './pages/WorkspacePage';
import CompilerPage from './pages/CompilerPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/workspace/:sessionId" element={<WorkspacePage />} />
        <Route path="/compiler" element={<CompilerPage />} />
      </Routes>
    </BrowserRouter>
  );
}
