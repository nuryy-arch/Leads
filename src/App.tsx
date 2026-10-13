import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import type { BusinessLead } from './types';
import { INITIAL_LEADS } from './data/mockLeads';
import { Navigation } from './components/Navigation';
import { LeadsPage } from './pages/LeadsPage';
import { FinderPage } from './pages/FinderPage';
import { SettingsPage } from './pages/SettingsPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { MigrationModal } from './components/MigrationModal';
import { ToastContainer } from './components/Toast';
import type { ToastMessage } from './components/Toast';
import { getStoredTwoGisApiKey } from './services/twoGisService';
import { useAuth } from './context/AuthContext';
import { leadRepository } from './services/leadRepository';
import './styles/app.css';

const LOCAL_STORAGE_KEY = 'whatsapp_click_to_chat_leads_v1';

export const App: React.FC = () => {
  const { user } = useAuth();

  // Leads state with localStorage persistence
  const [leads, setLeads] = useState<BusinessLead[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {}
    return INITIAL_LEADS;
  });

  // Cloud sync and migration state
  const [isMigrationModalOpen, setIsMigrationModalOpen] = useState(false);
  const [hasLocalLeadsToMigrate, setHasLocalLeadsToMigrate] = useState(false);

  // 2GIS API Key active check
  const [apiKey, setApiKey] = useState(getStoredTwoGisApiKey);

  // Toast notifications state
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((text: string, type: 'success' | 'error' | 'info' = 'info') => {
    const newToast: ToastMessage = {
      id: `toast-${Date.now()}-${Math.random()}`,
      text,
      type,
    };
    setToasts((prev) => [...prev, newToast]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
    }, 4000);
  }, []);

  const handleDismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Sync leads with Supabase when authenticated
  useEffect(() => {
    if (!user) {
      return;
    }

    let isMounted = true;
    (async () => {
      try {
        const cloudLeads = await leadRepository.fetchUserLeads(user.id);
        if (!isMounted) return;

        setLeads((currentLeads) => {
          const cloudClientIds = new Set(cloudLeads.map((l) => l.id));
          const unmigrated = currentLeads.filter((l) => !cloudClientIds.has(l.id));

          if (cloudLeads.length > 0) {
            if (unmigrated.length > 0) {
              setHasLocalLeadsToMigrate(true);
            }
            return cloudLeads;
          } else if (currentLeads.length > 0) {
            setHasLocalLeadsToMigrate(true);
            return currentLeads;
          }
          return currentLeads;
        });
      } catch (err: any) {
        console.error('Failed to fetch cloud leads:', err);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [user]);

  // Persist to localStorage on change with QuotaExceededError protection
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(leads));
    } catch (e: any) {
      console.error('Failed to save to localStorage', e);
      if (e?.name === 'QuotaExceededError' || e?.code === 22) {
        setTimeout(() => {
          showToast(
            'Внимание: локальное хранилище переполнено! Часть данных может не сохраниться после закрытия вкладки.',
            'error'
          );
        }, 0);
      }
    }
  }, [leads, showToast]);

  // Keep apiKey in sync if changed elsewhere
  useEffect(() => {
    const handleStorageChange = () => {
      setApiKey(getStoredTwoGisApiKey());
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const handleUpdateLead = (updated: BusinessLead) => {
    setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));

    // Sync to Supabase in background if user is authenticated
    if (user) {
      leadRepository.updateLead(updated, user.id).catch((err) => {
        console.error('Failed to sync updated lead to Supabase:', err);
      });
    }
  };

  const handleAddLead = (newLead: BusinessLead) => {
    setLeads((prev) => [newLead, ...prev]);

    // Sync to Supabase in background if user is authenticated
    if (user) {
      leadRepository.createLead(newLead, user.id).catch((err) => {
        console.error('Failed to sync new lead to Supabase:', err);
      });
    }
  };

  // Batch import from 2GIS / OSM / CSV with QuotaExceededError safety
  const handleImportLeads = (newLeads: BusinessLead[]) => {
    try {
      const merged = [...newLeads, ...leads];
      // Test storage quota before state update to ensure no existing leads are lost
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(merged));
      setLeads(merged);
      showToast(`Импортировано ${newLeads.length} контактов в CRM!`, 'success');

      // Sync imported leads to Supabase if authenticated
      if (user) {
        leadRepository.batchInsertLeads(newLeads, user.id).then(({ inserted, failed }) => {
          if (inserted > 0) {
            showToast(`Синхронизировано ${inserted} лидов с облаком Supabase`, 'info');
          }
          if (failed > 0) {
            console.warn(`Не удалось загрузить ${failed} лидов в облако`);
          }
        }).catch((err) => {
          console.error('Failed to batch sync leads to Supabase:', err);
        });
      }
    } catch (e: any) {
      console.error('Storage quota exceeded on import:', e);
      showToast(
        'Ошибка: превышен лимит хранилища браузера (QuotaExceededError). Существующая база сохранена без потерь.',
        'error'
      );
    }
  };

  const handleResetDemo = () => {
    if (window.confirm('Сбросить базу контактов к демонстрационным исходным данным?')) {
      setLeads(INITIAL_LEADS);
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      showToast('База успешно сброшена к исходным демо-данным', 'info');
    }
  };

  const newLeadsCount = leads.filter((l) => l.status === 'NEW').length;

  return (
    <div className="app-root">
      {/* Top Navbar & Mobile Navigation */}
      <Navigation
        totalLeadsCount={leads.length}
        newLeadsCount={newLeadsCount}
        is2GisKeySet={Boolean(apiKey)}
        hasLocalLeadsToMigrate={hasLocalLeadsToMigrate}
        onOpenMigration={() => setIsMigrationModalOpen(true)}
      />

      {/* Main Content View with Routes */}
      <main className="app-main-content">
        <Routes>
          <Route path="/" element={<Navigate to="/leads" replace />} />
          <Route
            path="/leads"
            element={
              <LeadsPage
                leads={leads}
                onUpdateLead={handleUpdateLead}
                onAddLead={handleAddLead}
                onImportLeads={handleImportLeads}
                onResetDemo={handleResetDemo}
                is2GisKeySet={Boolean(apiKey)}
                onShowToast={showToast}
              />
            }
          />
          <Route
            path="/finder"
            element={
              <FinderPage
                existingLeads={leads}
                onImportLeads={handleImportLeads}
                onShowToast={showToast}
              />
            }
          />
          <Route
            path="/settings"
            element={
              <SettingsPage
                leads={leads}
                onResetDemo={handleResetDemo}
                onShowToast={showToast}
              />
            }
          />

          {/* Supabase Auth Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />

          <Route path="*" element={<Navigate to="/leads" replace />} />
        </Routes>
      </main>

      {/* Migration Modal */}
      {isMigrationModalOpen && user && (
        <MigrationModal
          localLeads={leads}
          userId={user.id}
          onClose={() => setIsMigrationModalOpen(false)}
          onMigrationComplete={(cloudLeads) => {
            setLeads(cloudLeads);
            setHasLocalLeadsToMigrate(false);
          }}
          onShowToast={showToast}
        />
      )}

      {/* Floating Notifications */}
      <ToastContainer toasts={toasts} onDismiss={handleDismissToast} />
    </div>
  );
};

export default App;
