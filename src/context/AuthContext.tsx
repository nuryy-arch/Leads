import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isConfigured: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password: string, displayName?: string) => Promise<{ success: boolean; message?: string; error?: string }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ success: boolean; message?: string; error?: string }>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      return;
    }

    let isMounted = true;

    // Initial session load
    supabase.auth.getSession().then(({ data: { session: initialSession }, error: sessionError }) => {
      if (!isMounted) return;
      if (sessionError) {
        console.warn('Supabase getSession error:', sessionError.message);
      }
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      setIsLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!isMounted) return;
      setSession(newSession);
      setUser(newSession?.user ?? null);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const clearError = () => setError(null);

  const signIn = async (email: string, password: string) => {
    setError(null);
    if (!isSupabaseConfigured || !supabase) {
      const msg = 'Supabase не настроен. Настройте переменные окружения VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY.';
      setError(msg);
      return { success: false, error: msg };
    }

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        const errorText = signInError.message.includes('Invalid login credentials')
          ? 'Неверный адрес электронной почты или пароль'
          : signInError.message;
        setError(errorText);
        return { success: false, error: errorText };
      }

      setSession(data.session);
      setUser(data.user);
      return { success: true };
    } catch (err: any) {
      const msg = err.message || 'Ошибка подключения к серверу авторизации';
      setError(msg);
      return { success: false, error: msg };
    }
  };

  const signUp = async (email: string, password: string, displayName?: string) => {
    setError(null);
    if (!isSupabaseConfigured || !supabase) {
      const msg = 'Supabase не настроен.';
      setError(msg);
      return { success: false, error: msg };
    }

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            display_name: displayName?.trim() || splitEmail(email),
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        return { success: false, error: signUpError.message };
      }

      // Check if email confirmation is required
      if (data.user && !data.session) {
        return {
          success: true,
          message: 'Регистрация успешна! Проверьте почту для подтверждения аккаунта.',
        };
      }

      setSession(data.session);
      setUser(data.user);
      return { success: true, message: 'Регистрация завершена!' };
    } catch (err: any) {
      const msg = err.message || 'Ошибка регистрации';
      setError(msg);
      return { success: false, error: msg };
    }
  };

  const signOut = async () => {
    setError(null);
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('SignOut warning:', err);
      }
    }
    setUser(null);
    setSession(null);
  };

  const resetPassword = async (email: string) => {
    setError(null);
    if (!isSupabaseConfigured || !supabase) {
      return { success: false, error: 'Supabase не настроен' };
    }

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/login`,
      });

      if (resetError) {
        setError(resetError.message);
        return { success: false, error: resetError.message };
      }

      return {
        success: true,
        message: 'Инструкция по восстановлению пароля отправлена на вашу почту.',
      };
    } catch (err: any) {
      const msg = err.message || 'Ошибка сброса пароля';
      setError(msg);
      return { success: false, error: msg };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        isConfigured: isSupabaseConfigured,
        error,
        signIn,
        signUp,
        signOut,
        resetPassword,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

function splitEmail(email: string): string {
  return email.split('@')[0] || 'Пользователь';
}
