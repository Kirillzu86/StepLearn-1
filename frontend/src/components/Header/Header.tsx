// frontend/src/components/Header/Header.tsx

import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { FiSearch, FiSettings, FiBell, FiChevronDown } from 'react-icons/fi';
import './StyleHeader.css';

const Header: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [searchQuery, setSearchQuery] = useState('');

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
                <button className="sl-header__icon-btn" aria-label="Настройки">
                    <FiSettings />
                </button>
                <button className="sl-header__icon-btn sl-header__icon-btn--notif" aria-label="Уведомления">
                    <FiBell />
                    <span className="sl-header__notif-badge">3</span>
                </button>

                {currentUser ? (
                    <button
                        className="sl-header__user"
                        onClick={() => navigate('/profile')}
                    >
                        {currentUser.avatar_url ? (
                            <img src={currentUser.avatar_url} alt="" className="sl-header__avatar-img" />
                        ) : (
                            <span className="sl-header__avatar">{getUserInitial()}</span>
                        )}
                        <span className="sl-header__user-name">{getUserName()}</span>
                        <FiChevronDown className="sl-header__user-chevron" />
                    </button>
                ) : (
                    <div className="sl-header__auth">
                        <Link to="/login" className="sl-header__auth-login">Войти</Link>
                        <Link to="/register" className="sl-header__auth-register">Регистрация</Link>
                    </div>
                )}
            </div>
        </header>
    );
};

export default Header;