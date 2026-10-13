import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { KeyRound, Mail, AlertCircle, CheckCircle, RefreshCw, Compass, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const ForgotPasswordPage: React.FC = () => {
  const { resetPassword, isLoading, isConfigured, error, clearError } = useAuth();

  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setSuccessMessage(null);
    clearError();

    if (!email.trim()) {
      setLocalError('Введите адрес электронной почты');
      return;
    }

    setIsSubmitting(true);
    const res = await resetPassword(email);
    setIsSubmitting(false);

    if (res.success && res.message) {
      setSuccessMessage(res.message);
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
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: '0 0 6px' }}>
            Восстановление пароля
          </h1>
          <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
            Инструкция по сбросу пароля будет отправлена на почту
          </p>
        </div>

        {/* Success notification */}
        {successMessage && (
          <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 8, padding: '12px 14px', marginBottom: 16, fontSize: 13, color: '#065f46', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <CheckCircle size={18} style={{ flexShrink: 0, marginTop: 1, color: '#10b981' }} />
            <div>
              <strong>Отправлено!</strong> {successMessage}
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
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                Электронная почта аккаунта
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

            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={isSubmitting || isLoading || !isConfigured}
              style={{ height: 42, marginTop: 8, background: '#0284c7', borderColor: '#0284c7' }}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  <span>Отправка...</span>
                </>
              ) : (
                <>
                  <KeyRound size={16} />
                  <span>Сбросить пароль</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* Links */}
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <Link to="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#0284c7', fontWeight: 600, textDecoration: 'none' }}>
            <ArrowLeft size={14} />
            <span>Вернуться ко входу</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
