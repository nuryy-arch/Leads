import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus, Mail, Lock, User, AlertCircle, CheckCircle, RefreshCw, Compass, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { signUp, isLoading, isConfigured, error, clearError } = useAuth();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setSuccessMessage(null);
    clearError();

    if (!email.trim() || !password) {
      setLocalError('Заполните все обязательные поля');
      return;
    }

    if (password.length < 6) {
      setLocalError('Пароль должен содержать не менее 6 символов');
      return;
    }

    if (password !== confirmPassword) {
      setLocalError('Пароли не совпадают');
      return;
    }

    setIsSubmitting(true);
    const res = await signUp(email, password, displayName);
    setIsSubmitting(false);

    if (res.success) {
      if (res.message) {
        setSuccessMessage(res.message);
      } else {
        navigate('/leads');
      }
    }
  };

  return (
    <div className="auth-page-container" style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="auth-card" style={{ maxWidth: 440, width: '100%', background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 32, boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ display: 'inline-flex', padding: 12, background: '#e0f2fe', borderRadius: 14, color: '#0284c7', marginBottom: 12 }}>
            <Compass size={28} />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: '0 0 6px' }}>
            Регистрация в CRM
          </h1>
          <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
            Создайте аккаунт для облачной синхронизации базы лидов
          </p>
        </div>

        {/* Success notification */}
        {successMessage && (
          <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 8, padding: '12px 14px', marginBottom: 16, fontSize: 13, color: '#065f46', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <CheckCircle size={18} style={{ flexShrink: 0, marginTop: 1, color: '#10b981' }} />
            <div>
              <strong>Успешно!</strong> {successMessage}
              <div style={{ marginTop: 8 }}>
                <Link to="/login" style={{ color: '#0284c7', fontWeight: 600, textDecoration: 'none' }}>
                  Перейти к экрану входа
                </Link>
              </div>
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
        {!successMessage && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 5 }}>
                Ваше имя / Компания (опционально)
              </label>
              <div style={{ position: 'relative' }}>
                <User size={16} style={{ position: 'absolute', left: 12, top: 12, color: '#94a3b8' }} />
                <input
                  type="text"
                  className="input-custom w-full"
                  placeholder="Нурдаулет"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  style={{ paddingLeft: 36, height: 42 }}
                  disabled={isSubmitting || isLoading}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 5 }}>
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
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 5 }}>
                Пароль (мин. 6 символов)
              </label>
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

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 5 }}>
                Повторите пароль
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: 12, top: 12, color: '#94a3b8' }} />
                <input
                  type="password"
                  className="input-custom w-full"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
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
                  <span>Создание аккаунта...</span>
                </>
              ) : (
                <>
                  <UserPlus size={16} />
                  <span>Создать аккаунт</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* Links */}
        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#64748b' }}>
          Уже есть аккаунт?{' '}
          <Link to="/login" style={{ color: '#0284c7', fontWeight: 600, textDecoration: 'none' }}>
            Войти
          </Link>
        </div>

        <div style={{ textAlign: 'center', marginTop: 14 }}>
          <Link to="/leads" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#94a3b8', textDecoration: 'none' }}>
            <ArrowLeft size={13} />
            <span>Вернуться в CRM</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
