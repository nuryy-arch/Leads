import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogIn, Mail, Lock, AlertCircle, RefreshCw, Compass, ArrowLeft, Key } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { signIn, isLoading, isConfigured, error, clearError } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();

    if (!email.trim() || !password) {
      setLocalError('Заполните все поля');
      return;
    }

    setIsSubmitting(true);
    const res = await signIn(email, password);
    setIsSubmitting(false);

    if (res.success) {
      navigate('/leads');
    }
  };

  return (
    <div className="auth-page-container" style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="auth-card" style={{ maxWidth: 420, width: '100%', background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 32, boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ display: 'inline-flex', padding: 12, background: '#e0f2fe', borderRadius: 14, color: '#0284c7', marginBottom: 12 }}>
            <Compass size={28} />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: '0 0 6px' }}>
            Lead Hunter Kazakhstan
          </h1>
          <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
            Вход в защищённую облачную CRM
          </p>
        </div>

        {/* Warning if Supabase is unconfigured */}
        {!isConfigured && (
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '12px 14px', marginBottom: 20, fontSize: 12, color: '#92400e', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <Key size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <strong>Облачная база не подключена:</strong> настройте <code>VITE_SUPABASE_URL</code> и <code>VITE_SUPABASE_ANON_KEY</code> в <code>.env.local</code>. Локальный режим CRM продолжает работать без авторизации.
            </div>
          </div>
        )}

        {/* Error notification */}
        {(localError || error) && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#b91c1c', display: 'flex', gap: 8, alignItems: 'center' }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{localError || error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
              Электронная почта
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={{ position: 'absolute', left: 12, top: 12, color: '#94a3b8' }} />
              <input
                type="email"
                className="input-custom w-full"
                placeholder="name@example.kz"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ paddingLeft: 36, height: 42 }}
                disabled={isSubmitting || isLoading}
                required
              />
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', margin: 0 }}>
                Пароль
              </label>
              <Link to="/forgot-password" style={{ fontSize: 12, color: '#0284c7', textDecoration: 'none' }}>
                Забыли пароль?
              </Link>
            </div>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: 12, top: 12, color: '#94a3b8' }} />
              <input
                type="password"
                className="input-custom w-full"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ paddingLeft: 36, height: 42 }}
                disabled={isSubmitting || isLoading}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={isSubmitting || isLoading || !isConfigured}
            style={{ height: 42, marginTop: 8, background: '#0284c7', borderColor: '#0284c7' }}
          >
            {isSubmitting ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                <span>Авторизация...</span>
              </>
            ) : (
              <>
                <LogIn size={16} />
                <span>Войти в аккаунт</span>
              </>
            )}
          </button>
        </form>

        {/* Links */}
        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#64748b' }}>
          Ещё нет аккаунта?{' '}
          <Link to="/register" style={{ color: '#0284c7', fontWeight: 600, textDecoration: 'none' }}>
            Зарегистрироваться
          </Link>
        </div>

        <div style={{ textAlign: 'center', marginTop: 14 }}>
          <Link to="/leads" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#94a3b8', textDecoration: 'none' }}>
            <ArrowLeft size={13} />
            <span>Вернуться в локальный режим CRM</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
