import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import Landing from './pages/Landing';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import NewBrand from './pages/NewBrand';
import BrandDetail from './pages/BrandDetail';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/dashboard/new" element={<NewBrand />} />
          <Route path="/dashboard/brand/:brandId" element={<BrandDetail />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
