// frontend/src/components/Header/Header.tsx

import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FiChevronDown, FiSun, FiMoon } from 'react-icons/fi';
import { TEACHER_APP_URL } from '../../api/appUrls';
import brandLogo from '../../../UI/brand/steplearn-logo.svg';
import searchIcon from '../../../UI/icons/search.svg';
import settingsIcon from '../../../UI/icons/settings.svg';
import bellIcon from '../../../UI/icons/bell.svg';
import './StyleHeader.css';

type CurrentUser = {
    username?: string;
    name?: string;
    email?: string;
    role?: string;
    is_staff?: boolean;
    avatar_url?: string;
    access?: string;
    refresh?: string;
    must_change_password?: boolean;
};

const readCurrentUserFromStorage = (): CurrentUser | null => {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('currentUser') : null;
    if (!raw) {
        return null;
    }
    try {
        return JSON.parse(raw) as CurrentUser;
    } catch {
        return null;
    }
};

const Header: React.FC = () => {
    const navigate = useNavigate();
    const [currentUser, setCurrentUser] = useState<CurrentUser | null>(readCurrentUserFromStorage);
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
        const onStorage = (e: StorageEvent) => {
            if (e.key === 'currentUser') {
                setCurrentUser(readCurrentUserFromStorage());
            }
        };
        const onCurrentUserChanged = (ev: Event) => {
            const ce = ev as CustomEvent<CurrentUser | undefined>;
            if (ce?.detail) {
                setCurrentUser(ce.detail);
                return;
            }
            setCurrentUser(readCurrentUserFromStorage());
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
            <Link to="/" className="sl-header__logo" aria-label="StepLearn home">
                <div className="sl-header__logo-icon">
                    <img src={brandLogo} alt="StepLearn" className="sl-header__logo-image" />
                </div>
            </Link>

            {/* Search */}
            <form className="sl-header__search" onSubmit={handleSearch}>
                <img src={searchIcon} alt="" className="sl-header__search-icon" />
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
                    <img src={settingsIcon} alt="" className="sl-header__action-icon" />
                </button>
                <button className="sl-header__icon-btn sl-header__icon-btn--notif" aria-label="Уведомления" onClick={() => navigate('/notifications')}>
                    <img src={bellIcon} alt="" className="sl-header__action-icon" />
                    <span className="sl-header__notif-badge">3</span>
                </button>

                {currentUser ? (
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {TEACHER_APP_URL && (currentUser.role === 'teacher' || currentUser.role === 'admin' || currentUser.is_staff) && (
                            <a href={TEACHER_APP_URL} className="sl-header__auth-login" style={{ background: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 100%)', color: '#fff', fontWeight: 600 }}>
                                Панель учителя
                            </a>
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
                                {TEACHER_APP_URL && (currentUser.role === 'teacher' || currentUser.role === 'admin' || currentUser.is_staff) && (
                                    <a className="sl-header__dropdown-item" href={TEACHER_APP_URL}>
                                        Панель учителя
                                    </a>
                                )}
                                <button className="sl-header__dropdown-item sl-header__dropdown-item--danger" onClick={() => {
                                    localStorage.removeItem('currentUser');
                                    setCurrentUser(null);
                                    try {
                                        window.dispatchEvent(new CustomEvent('currentUserChanged'));
                                    } catch {
                                        window.dispatchEvent(new Event('currentUserChanged'));
                                    }
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
                        {TEACHER_APP_URL && <a href={TEACHER_APP_URL} className="sl-header__auth-login" style={{ border: '1px solid var(--primary)', color: 'var(--primary)', background: 'transparent', fontWeight: 600 }}>
                            Преподавателям
                        </a>}
                    </div>
                )}
            </div>
        </header>
    );
};

export default Header;