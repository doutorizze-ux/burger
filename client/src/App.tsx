import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import Catalog from './pages/Catalog';
import AdminPanel from './pages/AdminPanel';
import Login from './pages/Login';

import LandingPage from './pages/LandingPage';
import SuperAdmin from './pages/SuperAdmin';

export const AuthContext = React.createContext<any>(null);

function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      fetch('/api/me', { headers: { 'Authorization': `Bearer ${token}` }})
        .then(res => res.json())
        .then(data => {
          if(!data.error) setUser(data);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  if (loading) return null;

  return (
    <AuthContext.Provider value={{ user, setUser }}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/admin" element={user ? <AdminPanel /> : <Navigate to="/login" />} />
          <Route path="/catalogo/:slug" element={<Catalog />} />
          <Route path="/superadmin" element={user ? <SuperAdmin /> : <Navigate to="/login" />} />
        </Routes>
      </BrowserRouter>
      <ToastContainer position="bottom-right" />
    </AuthContext.Provider>
  );
}

export default App;
