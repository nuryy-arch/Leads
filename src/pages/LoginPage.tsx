import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  LogIn,
  Mail,
  Lock,
  AlertCircle,
  RefreshCw,
  ShieldCheck,
  Eye,
  EyeOff,
  Key,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, isLoading, isConfigured, error, clearError } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setLocalError('Пожалуйста, укажите email (логин) и пароль');
      return;
    }

    setIsSubmitting(true);
    const res = await signIn(cleanEmail, password);
    setIsSubmitting(false);

    if (res.success) {
      const targetPath = (location.state as any)?.from?.pathname || '/leads';
      navigate(targetPath, { replace: true });
    }
  };

  return (
    <div
      className="auth-page-container"
      style={{
        minHeight: '85vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
      }}
    >
      <div
        className="auth-card"
        style={{
          maxWidth: 440,
          width: '100%',
          background: '#ffffff',
          borderRadius: 20,
          border: '1px solid #e2e8f0',
          padding: '36px 32px',
          boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04)',
        }}
      >
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div
            style={{
              display: 'inline-flex',
              padding: 14,
              background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
              borderRadius: 18,
              color: '#059669',
              marginBottom: 14,
              boxShadow: '0 2px 8px rgba(5, 150, 105, 0.15)',
            }}
          >
            <ShieldCheck size={32} />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
            Lead Hunter Kazakhstan
          </h1>
          <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 12px' }}>
            Персональная CRM-система поиска клиентов
          </p>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: '#f1f5f9',
              color: '#475569',
              fontSize: 11,
              fontWeight: 600,
              padding: '4px 10px',
              borderRadius: 20,
              border: '1px solid #e2e8f0',
            }}
          >
            <Lock size={12} color="#059669" />
            Закрытый доступ • Личный кабинет
          </span>
        </div>

        {/* Unconfigured Warning */}
        {!isConfigured && (
          <div
            style={{
              background: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: 10,
              padding: '12px 14px',
              marginBottom: 20,
              fontSize: 12,
              color: '#92400e',
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
              lineHeight: 1.5,
            }}
          >
            <Key size={16} style={{ flexShrink: 0, marginTop: 2, color: '#d97706' }} />
            <div>
              <strong>Облачная база не подключена:</strong> укажите <code>VITE_SUPABASE_URL</code> и <code>VITE_SUPABASE_ANON_KEY</code> в настройках окружения Vercel или в <code>.env.local</code>.
            </div>
          </div>
        )}

        {/* Error notification */}
        {(localError || error) && (
          <div
            style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 10,
              padding: '12px 14px',
              marginBottom: 18,
              fontSize: 13,
              color: '#b91c1c',
              display: 'flex',
              gap: 10,
              alignItems: 'center',
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{localError || error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
              Логин или Email
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={{ position: 'absolute', left: 14, top: 13, color: '#94a3b8' }} />
              <input
                type="text"
                className="input-custom w-full"
                placeholder="ваш-email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ paddingLeft: 40, height: 44, borderRadius: 10 }}
                disabled={isSubmitting || isLoading}
                autoComplete="username"
                required
              />
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', margin: 0 }}>
                Пароль
              </label>
              <Link
                to="/forgot-password"
                style={{ fontSize: 12, color: '#059669', textDecoration: 'none', fontWeight: 500 }}
              >
                Забыли пароль?
              </Link>
            </div>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: 14, top: 13, color: '#94a3b8' }} />
              <input
                type={showPassword ? 'text' : 'password'}
                className="input-custom w-full"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ paddingLeft: 40, paddingRight: 40, height: 44, borderRadius: 10 }}
                disabled={isSubmitting || isLoading}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: 12,
                  top: 11,
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: 2,
                  display: 'flex',
                  alignItems: 'center',
                }}
                title={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={isSubmitting || isLoading || !isConfigured}
            style={{
              height: 44,
              marginTop: 6,
              background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
              borderColor: '#059669',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              boxShadow: '0 4px 12px rgba(5, 150, 105, 0.25)',
            }}
          >
            {isSubmitting ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                <span>Вход в систему...</span>
              </>
            ) : (
              <>
                <LogIn size={16} />
                <span>Войти в CRM</span>
              </>
            )}
          </button>
        </form>

        {/* Single Tenant Security Notice */}
        <div
          style={{
            marginTop: 24,
            paddingTop: 18,
            borderTop: '1px solid #f1f5f9',
            textAlign: 'center',
            fontSize: 12,
            color: '#64748b',
            lineHeight: 1.5,
          }}
        >
          🔒 <strong>Внимание:</strong> Публичная регистрация отключена. Учётная запись создаётся администратором в панели Supabase.
        </div>
      </div>
    </div>
  );
};
