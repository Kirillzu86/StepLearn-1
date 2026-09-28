import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
    FiHome, FiBook, FiBriefcase, FiMap, FiUsers, FiClipboard,
    FiCalendar, FiBookmark, FiBell, FiSettings, FiHelpCircle,
    FiLogOut
} from 'react-icons/fi';
import type { IconType } from 'react-icons';
import './StyleSidebar.css';

type NavItem = { title: string; icon: IconType; path: string };

const mainNavItems: NavItem[] = [
    { title: 'Главная', icon: FiHome, path: '/' },
    { title: 'Курсы', icon: FiBook, path: '/catalog' },
    { title: 'Профессии', icon: FiBriefcase, path: '/professions' },
    { title: 'Путь обучения', icon: FiMap, path: '/learning-path' },
    { title: 'Сообщество', icon: FiUsers, path: '/community' },
    { title: 'Задания и проекты', icon: FiClipboard, path: '/assignments' },
    { title: 'Календарь', icon: FiCalendar, path: '/calendar' },
    { title: 'Мои курсы', icon: FiBookmark, path: '/my-courses' },
];

const extraNavItems: NavItem[] = [
    { title: 'Уведомления', icon: FiBell, path: '/notifications' },
    { title: 'Настройки', icon: FiSettings, path: '/settings' },
    { title: 'Помощь', icon: FiHelpCircle, path: '/help' },
];

const Sidebar: React.FC = () => {
    const [user, setUser] = useState<any>(null);
    const navigate = useNavigate();
    const location = useLocation();

    const readUser = () => {
        try {
            const s = localStorage.getItem('currentUser');
            setUser(s ? JSON.parse(s) : null);
        } catch (e) {
            setUser(null);
        }
    };

    useEffect(() => {
        readUser();
        const onStorage = (e: StorageEvent) => {
            if (e.key === 'currentUser') readUser();
        };
        const onCustom = () => readUser();
        window.addEventListener('storage', onStorage);
        window.addEventListener('currentUserChanged', onCustom as EventListener);
        return () => {
            window.removeEventListener('storage', onStorage);
            window.removeEventListener('currentUserChanged', onCustom as EventListener);
        };
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('currentUser');
        setUser(null);
        try { window.dispatchEvent(new CustomEvent('currentUserChanged')); } catch (e) {}
        navigate('/');
    };

    const isActive = (p: string) => {
        if (p === '/') return location.pathname === '/';
        return location.pathname.startsWith(p);
    };

    const notifCount = 3;

    return (
        <nav className="sl-sidebar">
            <div className="sl-sidebar__main">
                {mainNavItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.path);
                    return (
                        <Link
                            to={item.path}
                            key={item.path}
                            className={`sl-sidebar__item ${active ? 'sl-sidebar__item--active' : ''}`}
                        >
                            <Icon className="sl-sidebar__item-icon" />
                            <span className="sl-sidebar__item-text">{item.title}</span>
                        </Link>
                    );
                })}
            </div>

            <div className="sl-sidebar__divider-label">Дополнительно</div>

            <div className="sl-sidebar__extra">
                {extraNavItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.path);
                    return (
                        <Link
                            to={item.path}
                            key={item.path}
                            className={`sl-sidebar__item ${active ? 'sl-sidebar__item--active' : ''}`}
                        >
                            <Icon className="sl-sidebar__item-icon" />
                            <span className="sl-sidebar__item-text">{item.title}</span>
                            {item.title === 'Уведомления' && notifCount > 0 && (
                                <span className="sl-sidebar__badge">{notifCount}</span>
                            )}
                        </Link>
                    );
                })}
            </div>

            {/* User block at bottom */}
            {user && (
                <div className="sl-sidebar__user">
                    <button className="sl-sidebar__user-info" onClick={() => navigate('/profile')}>
                        {user.avatar_url ? (
                            <img src={user.avatar_url} alt="" className="sl-sidebar__user-avatar-img" />
                        ) : (
                            <span className="sl-sidebar__user-avatar">
                                {(user.username || user.name || 'U')[0].toUpperCase()}
                            </span>
                        )}
                        <span className="sl-sidebar__user-name">
                            {user.username || user.name || 'Пользователь'}
                        </span>
                    </button>
                    <button className="sl-sidebar__logout" onClick={handleLogout} aria-label="Выход">
                        <FiLogOut />
                    </button>
                </div>
            )}

            {/* CTA for unauthenticated */}
            {!user && (
                <div className="sl-sidebar__cta">
                    <div className="sl-sidebar__cta-text">
                        Учись. Получай<br/>больше возможностей!
                    </div>
                    <p className="sl-sidebar__cta-desc">
                        Проходи курсы, выполняй задания и получай сертификаты, которые ценятся.
                    </p>
                    <Link to="/register" className="sl-sidebar__cta-btn">
                        Узнать больше
                    </Link>
                </div>
            )}
        </nav>
    );
};

export default Sidebar;