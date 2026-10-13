import { NavLink, Link, useNavigate } from 'react-router-dom';
import {
  Users,
  Search,
  Settings,
  Sparkles,
  MessageSquare,
  ShieldCheck,
  AlertCircle,
  LogIn,
  LogOut,
  User,
  Cloud,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface NavigationProps {
  totalLeadsCount: number;
  newLeadsCount: number;
  is2GisKeySet: boolean;
  onOpenMigration?: () => void;
  hasLocalLeadsToMigrate?: boolean;
}

export const Navigation: React.FC<NavigationProps> = ({
  totalLeadsCount,
  newLeadsCount,
  is2GisKeySet,
  onOpenMigration,
  hasLocalLeadsToMigrate,
}) => {
  const navigate = useNavigate();
  const { user, isConfigured, signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <>
      {/* Desktop & Tablet Top Navbar */}
      <header className="main-navbar">
        <div className="navbar-container">
          {/* Logo & Brand */}
          <Link to="/leads" className="navbar-brand" style={{ textDecoration: 'none' }}>
            <div className="brand-icon">
              <MessageSquare size={22} color="#ffffff" />
            </div>
            <div className="brand-text">
              <span className="brand-title">Lead Hunter</span>
              <span className="brand-badge">Kazakhstan</span>
            </div>
          </Link>

          {/* Nav Links */}
          <nav className="nav-links">
            <NavLink
              to="/leads"
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <Users size={17} />
              <span>База лидов</span>
              <span className="nav-count-badge" title="Всего лидов / Новые">
                {totalLeadsCount}
                {newLeadsCount > 0 && <span className="nav-count-new">+{newLeadsCount}</span>}
              </span>
            </NavLink>

            <NavLink
              to="/finder"
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <Search size={17} />
              <span>Поиск клиентов</span>
              <span className="nav-tag-badge">Multi-Source</span>
            </NavLink>

            <NavLink
              to="/settings"
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <Settings size={17} />
              <span>Настройки</span>
              {is2GisKeySet ? (
                <span className="nav-status-dot active" title="Ключ 2GIS настроен" />
              ) : (
                <span className="nav-status-dot warning" title="Требуется ключ 2GIS" />
              )}
            </NavLink>
          </nav>

          {/* Right Actions & Auth Bar */}
          <div className="navbar-actions" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Cloud Sync Status / Migration trigger */}
            {user && hasLocalLeadsToMigrate && onOpenMigration && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={onOpenMigration}
                style={{ fontSize: 11, padding: '4px 8px', color: '#0284c7', borderColor: '#bae6fd', background: '#f0f9ff' }}
                title="Перенести локальные контакты в облако"
              >
                <Cloud size={13} />
                <span>Миграция в облако</span>
              </button>
            )}

            {/* Auth status */}
            {user ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div
                  className="api-pill active"
                  style={{ background: '#ecfdf5', borderColor: '#a7f3d0', color: '#065f46' }}
                  title={`Вы вошли как ${user.email} (Supabase Cloud)`}
                >
                  <User size={13} color="#10b981" />
                  <span>{user.email?.split('@')[0]}</span>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: 11, padding: '4px 8px' }}
                  title="Выйти из аккаунта"
                >
                  <LogOut size={12} />
                  <span>Выход</span>
                </button>
              </div>
            ) : isConfigured ? (
              <Link
                to="/login"
                className="btn btn-secondary btn-sm"
                style={{ fontSize: 12, padding: '5px 10px', textDecoration: 'none', color: '#0284c7', borderColor: '#bae6fd' }}
                title="Войти в облачную CRM Supabase"
              >
                <LogIn size={13} />
                <span>Войти</span>
              </Link>
            ) : (
              <div
                className={`api-pill ${is2GisKeySet ? 'active' : 'idle'}`}
                title={is2GisKeySet ? '2GIS API подключен' : '2GIS API ключ не задан'}
              >
                {is2GisKeySet ? (
                  <>
                    <ShieldCheck size={13} color="#16a34a" />
                    <span>2GIS: OK</span>
                  </>
                ) : (
                  <>
                    <AlertCircle size={13} color="#d97706" />
                    <span>Локальный CRM</span>
                  </>
                )}
              </div>
            )}

            <div className="author-pill">
              <Sparkles size={13} color="#25D366" />
              <span>Нурдаулет • Web Dev</span>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar (Screens <= 768px) */}
      <nav className="mobile-bottom-nav" aria-label="Мобильная навигация">
        <NavLink
          to="/leads"
          className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}
        >
          <div className="mobile-nav-icon-wrapper">
            <Users size={20} />
            {newLeadsCount > 0 && <span className="mobile-badge">{newLeadsCount}</span>}
          </div>
          <span>Лиды</span>
        </NavLink>

        <NavLink
          to="/finder"
          className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}
        >
          <div className="mobile-nav-icon-wrapper">
            <Search size={20} />
          </div>
          <span>Поиск</span>
        </NavLink>

        <NavLink
          to="/settings"
          className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}
        >
          <div className="mobile-nav-icon-wrapper">
            <Settings size={20} />
            {!is2GisKeySet && <span className="mobile-dot warning" />}
          </div>
          <span>Настройки</span>
        </NavLink>

        <button
          type="button"
          onClick={handleLogout}
          className="mobile-nav-item"
          style={{ background: 'none', border: 'none', cursor: 'pointer' }}
          title="Выйти из системы"
        >
          <div className="mobile-nav-icon-wrapper">
            <LogOut size={20} />
          </div>
          <span>Выход</span>
        </button>
      </nav>
    </>
  );
};
