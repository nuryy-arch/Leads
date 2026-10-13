import React, { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { RefreshCw, ShieldCheck } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div
        className="auth-loading-screen"
        style={{
          minHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          color: '#64748b',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
          <ShieldCheck size={24} color="#059669" />
          <span>Lead Hunter Kazakhstan</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#64748b' }}>
          <RefreshCw size={16} className="animate-spin" color="#059669" />
          <span>Проверка защищённой сессии...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
