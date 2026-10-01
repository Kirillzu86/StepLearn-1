// frontend/src/components/Header/Header.tsx

import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { FiSearch, FiSettings, FiBell, FiChevronDown, FiSun, FiMoon } from 'react-icons/fi';
import './StyleHeader.css';

const Header: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        return (document.body.dataset.theme as 'light' | 'dark') || 'dark';
    });

    const toggleThemeHeader = () => {
        const next = theme === 'dark' ? 'light' : 'dark';
        document.body.dataset.theme = next;
        localStorage.setItem('theme', next);
        setTheme(next);
    };

    useEffect(() => {
        const raw = localStorage.getItem('currentUser');
        try {
            setCurrentUser(raw ? JSON.parse(raw) : null);
        } catch (e) {
            setCurrentUser(null);
        }
    }, [location]);

    useEffect(() => {
        const onStorage = (e: StorageEvent) => {
            if (e.key === 'currentUser') {
                try {
                    setCurrentUser(e.newValue ? JSON.parse(e.newValue) : null);
                } catch {
                    setCurrentUser(null);
                }
            }
        };
        const onCurrentUserChanged = (ev: Event) => {
            try {
                const ce = ev as CustomEvent;
                if (ce && ce.detail) {
                    setCurrentUser(ce.detail);
                    return;
                }
            } catch {}
            const raw = localStorage.getItem('currentUser');
            try {
                setCurrentUser(raw ? JSON.parse(raw) : null);
            } catch {
                setCurrentUser(null);
            }
        };
        window.addEventListener('storage', onStorage);
        window.addEventListener('currentUserChanged', onCurrentUserChanged as EventListener);
        return () => {
            window.removeEventListener('storage', onStorage);
            window.removeEventListener('currentUserChanged', onCurrentUserChanged as EventListener);
        };
    }, []);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            navigate(`/catalog?q=${encodeURIComponent(searchQuery.trim())}`);
        }
    };

    const getUserName = () => {
        if (!currentUser) return '';
        return currentUser.username || currentUser.name || currentUser.email || '';
    };

    const getUserInitial = () => {
        const name = getUserName();
        return name.trim() ? name.trim()[0].toUpperCase() : 'U';
    };

    return (
        <header className="sl-header">
            {/* Logo */}
            <Link to="/" className="sl-header__logo">
                <div className="sl-header__logo-icon">
                    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                        <path d="M14 2L24 8V20L14 26L4 20V8L14 2Z" fill="#4F46E5"/>
                        <path d="M14 8L19 11V17L14 20L9 17V11L14 8Z" fill="white"/>
                    </svg>
                </div>
                <div className="sl-header__logo-text">
                    <span className="sl-header__logo-name">StepLearn</span>
                    <span className="sl-header__logo-tagline">Учись. Развивайся. Достигай.</span>
                </div>
            </Link>

            {/* Search */}
            <form className="sl-header__search" onSubmit={handleSearch}>
                <FiSearch className="sl-header__search-icon" />
                <input
                    type="text"
                    className="sl-header__search-input"
                    placeholder="Поиск курсов, тем, преподавателей..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </form>

            {/* Right controls */}
            <div className="sl-header__controls">
                <button
                    className="sl-header__icon-btn"
                    aria-label="Смена темы"
                    title={theme === 'dark' ? "Переключить на светлую тему" : "Переключить на тёмную тему"}
                    onClick={toggleThemeHeader}
                >
                    {theme === 'dark' ? <FiSun style={{ color: '#f59e0b' }} /> : <FiMoon style={{ color: '#6366f1' }} />}
                </button>
                <button className="sl-header__icon-btn" aria-label="Настройки" onClick={() => navigate('/settings')}>
                    <FiSettings />
                </button>
                <button className="sl-header__icon-btn sl-header__icon-btn--notif" aria-label="Уведомления" onClick={() => navigate('/notifications')}>
                    <FiBell />
                    <span className="sl-header__notif-badge">3</span>
                </button>

                {currentUser ? (
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {(currentUser.role === 'teacher' || currentUser.role === 'admin' || currentUser.is_staff) && (
                            <Link to="/admin-panel" className="sl-header__auth-login" style={{ background: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 100%)', color: '#fff', fontWeight: 600 }}>
                                Панель учителя
                            </Link>
                        )}
                        <button
                            className="sl-header__user"
                            onClick={() => setUserMenuOpen(!userMenuOpen)}
                        >
                            {currentUser.avatar_url ? (
                                <img src={currentUser.avatar_url} alt="" className="sl-header__avatar-img" />
                            ) : (
                                <span className="sl-header__avatar">{getUserInitial()}</span>
                            )}
                            <span className="sl-header__user-name">{getUserName()}</span>
                            <FiChevronDown className="sl-header__user-chevron" />
                        </button>

                        {userMenuOpen && (
                            <div className="sl-header__dropdown" onClick={() => setUserMenuOpen(false)}>
                                <div className="sl-header__dropdown-info">
                                    <div className="sl-header__dropdown-name">{getUserName()}</div>
                                    <div className="sl-header__dropdown-email">{currentUser.email || ''}</div>
                                    <div className="sl-header__dropdown-role">{currentUser.role === 'teacher' ? 'Преподаватель' : currentUser.role === 'admin' ? 'Администратор' : 'Студент'}</div>
                                </div>
                                <hr className="sl-header__dropdown-divider" />
                                <button className="sl-header__dropdown-item" onClick={() => navigate('/profile')}>
                                    Мой профиль
                                </button>
                                {(currentUser.role === 'teacher' || currentUser.role === 'admin' || currentUser.is_staff) && (
                                    <button className="sl-header__dropdown-item" onClick={() => navigate('/admin-panel')}>
                                        Панель учителя
                                    </button>
                                )}
                                <button className="sl-header__dropdown-item sl-header__dropdown-item--danger" onClick={() => {
                                    localStorage.removeItem('currentUser');
                                    setCurrentUser(null);
                                    try { window.dispatchEvent(new CustomEvent('currentUserChanged')); } catch {}
                                    navigate('/login');
                                }}>
                                    Выйти
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="sl-header__auth">
                        <Link to="/login" className="sl-header__auth-login">Войти</Link>
                        <Link to="/login" className="sl-header__auth-register">Войти как студент</Link>
                        <Link to="/teacher-login" className="sl-header__auth-login" style={{ border: '1px solid var(--primary)', color: 'var(--primary)', background: 'transparent', fontWeight: 600 }}>
                            Преподавателям
                        </Link>
                    </div>
                )}
            </div>
        </header>
    );
};

export default Header;