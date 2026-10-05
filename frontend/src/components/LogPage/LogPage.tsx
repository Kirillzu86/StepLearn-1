import { useEffect, useState, type ChangeEvent, type FormEvent, type SVGProps, type FC } from "react";
import { API_URL } from "../../api/api";
import { TEACHER_APP_URL } from "../../api/appUrls";
import { useNavigate, Link } from "react-router-dom";
import Header from "../Header/Header";
import Sidebar from "../Sidebar/sidebar";
import "../HomePage/StyleHomePage.css";
import "../Sidebar/StyleSidebar.css";
import "./StyleLogPage.css";

type IconProps = SVGProps<SVGSVGElement>;

const Icons = {
    User: (props: IconProps) => (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
        </svg>
    ),
    Mail: (props: IconProps) => (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
        </svg>
    ),
    Lock: (props: IconProps) => (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
    ),
    Eye: (props: IconProps) => (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>
        </svg>
    ),
    EyeOff: (props: IconProps) => (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-10-7-10-7s3-7 10-7a9.12 9.12 0 0 1 4.3 1.07"/>
            <path d="m5 15-2 2M9 19l-1.5 2.5M15 19l1.5 2.5M19 15l2 2"/>
        </svg>
    ),
    Check: (props: IconProps) => (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>
        </svg>
    ),
    XCircle: (props: IconProps) => (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>
        </svg>
    )
};

interface LogPageProps {
    theme: "dark" | "light";
    toggleTheme: () => void;
}

function LogPage({ theme, toggleTheme }: LogPageProps) {
    const [formData, setFormData] = useState({ login: '', password: '' });
    const [message, setMessage] = useState({ text: '', type: '' });
    const [errors, setErrors] = useState({ login: false, password: false });
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [passwordChangeRequired, setPasswordChangeRequired] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');
    const [pendingUser, setPendingUser] = useState<any>(null);
    const [currentPassword, setCurrentPassword] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        const storedUser = window.localStorage.getItem('currentUser');
        if (!storedUser) return;
        try {
            const user = JSON.parse(storedUser);
            if (user.must_change_password && user.access) {
                setPendingUser(user);
                setPasswordChangeRequired(true);
            }
        } catch (error) {
            console.error('Unable to restore password-change session:', error);
        }
    }, []);

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        setErrors(prev => ({ ...prev, [name]: false }));
        setMessage({ text: '', type: '' });
    };

    const handleFormSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const { login, password } = formData;
        if (!login || !password) {
            setMessage({ text: 'Заполните все поля', type: 'error' });
            return;
        }
        setSubmitting(true);
        try {
            const base = API_URL ? API_URL.replace(/\/$/, '') : (typeof window !== 'undefined' ? window.location.origin : '');
            const res = await fetch(`${base}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ login, password }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.detail || "Неверный логин или пароль");
            }

            const user = await res.json();
            window.localStorage.setItem("currentUser", JSON.stringify(user));
            if (user.must_change_password) {
                setPendingUser(user);
                setCurrentPassword(password);
                setPasswordChangeRequired(true);
                setMessage({ text: 'Для продолжения установите новый пароль.', type: 'error' });
                return;
            }
            try {
                window.dispatchEvent(new CustomEvent('currentUserChanged', { detail: user }));
            } catch {
                window.dispatchEvent(new Event('currentUserChanged'));
            }
            navigate('/');
        } catch (err: any) {
            setMessage({ text: err.message || "Ошибка при входе", type: "error" });
        } finally {
            setSubmitting(false);
        }
    };

    const handlePasswordChange = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!pendingUser?.access) {
            setMessage({ text: 'Сессия входа не найдена. Войдите снова.', type: 'error' });
            setPasswordChangeRequired(false);
            return;
        }
        if (newPassword !== confirmNewPassword) {
            setMessage({ text: 'Пароли не совпадают.', type: 'error' });
            return;
        }

        setSubmitting(true);
        try {
            const base = API_URL ? API_URL.replace(/\/$/, '') : window.location.origin;
            const res = await fetch(`${base}/auth/change-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${pendingUser.access}`,
                },
                body: JSON.stringify({
                    current_password: currentPassword,
                    new_password: newPassword,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                const validationMessage = Object.values(data).flat().join(' ');
                throw new Error(validationMessage || 'Не удалось сменить пароль.');
            }

            const updatedUser = { ...pendingUser, must_change_password: false };
            window.localStorage.setItem('currentUser', JSON.stringify(updatedUser));
            window.dispatchEvent(new CustomEvent('currentUserChanged', { detail: updatedUser }));
            navigate('/');
        } catch (err: any) {
            setMessage({ text: err.message || 'Ошибка при смене пароля.', type: 'error' });
        } finally {
            setSubmitting(false);
        }
    };

    const renderInputField = (label: string, type: string, name: keyof typeof formData, Icon: FC<IconProps>, isPass = false, visible = false, toggle = () => {}) => {
        const hasError = errors[name];
        return (
            <div className="sl-auth-input-group">
                <label className="sl-auth-label">{label}</label>
                <div className="sl-auth-input-wrapper">
                    <span className="sl-auth-input-icon sl-auth-input-icon--left"><Icon /></span>
                    <input
                        type={isPass ? (visible ? 'text' : 'password') : type}
                        name={name}
                        value={formData[name]}
                        onChange={handleChange}
                        className={`sl-auth-input ${hasError ? 'sl-auth-input--error' : ''}`}
                        placeholder={isPass ? "••••••••" : "Email или имя пользователя"}
                    />
                    {isPass && (
                        <button type="button" onClick={toggle} className="sl-auth-input-icon sl-auth-input-icon--right" tabIndex={-1}>
                            {visible ? <Icons.EyeOff /> : <Icons.Eye />}
                        </button>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="sl-app">
            <Header />
            <div className="sl-layout">
                <Sidebar />
                <main className="sl-main sl-auth-main">
                    <div className="sl-auth-card">
                        <div className="sl-auth-header">
                            <div className="sl-auth-logo-icon">
                                <svg width="32" height="32" viewBox="0 0 28 28" fill="none">
                                    <path d="M14 2L24 8V20L14 26L4 20V8L14 2Z" fill="#4F46E5"/>
                                    <path d="M14 8L19 11V17L14 20L9 17V11L14 8Z" fill="white"/>
                                </svg>
                            </div>
                            <h1 className="sl-auth-title">{passwordChangeRequired ? 'Смените временный пароль' : 'Вход в StepLearn'}</h1>
                            <p className="sl-auth-subtitle">
                                {passwordChangeRequired
                                    ? 'Для безопасности задайте новый пароль перед продолжением.'
                                    : 'Войдите в аккаунт, чтобы продолжить обучение'}
                            </p>
                        </div>

                        {message.text && (
                            <div className={`sl-auth-alert ${message.type === 'success' ? 'sl-auth-alert--success' : 'sl-auth-alert--error'}`}>
                                <span className="sl-auth-alert-icon">{message.type === 'success' ? <Icons.Check /> : <Icons.XCircle />}</span>
                                {message.text}
                            </div>
                        )}

                        {passwordChangeRequired ? (
                            <form onSubmit={handlePasswordChange} className="sl-auth-form">
                                <div className="sl-auth-input-group">
                                    <label className="sl-auth-label" htmlFor="current-password">Временный пароль</label>
                                    <input
                                        id="current-password"
                                        className="sl-auth-input"
                                        type="password"
                                        autoComplete="current-password"
                                        value={currentPassword}
                                        onChange={(e) => setCurrentPassword(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="sl-auth-input-group">
                                    <label className="sl-auth-label" htmlFor="new-password">Новый пароль</label>
                                    <input
                                        id="new-password"
                                        className="sl-auth-input"
                                        type="password"
                                        autoComplete="new-password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="sl-auth-input-group">
                                    <label className="sl-auth-label" htmlFor="confirm-new-password">Повторите новый пароль</label>
                                    <input
                                        id="confirm-new-password"
                                        className="sl-auth-input"
                                        type="password"
                                        autoComplete="new-password"
                                        value={confirmNewPassword}
                                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="sl-auth-actions">
                                    <button type="submit" className="sl-auth-submit-btn" disabled={submitting}>
                                        {submitting ? 'Сохраняем...' : 'Сменить пароль'}
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <form onSubmit={handleFormSubmit} className="sl-auth-form">
                                {renderInputField('Логин или Email', 'text', 'login', Icons.Mail)}
                                {renderInputField('Пароль', 'password', 'password', Icons.Lock, true, isPasswordVisible, () => setIsPasswordVisible(!isPasswordVisible))}
                                <div className="sl-auth-actions">
                                    <button type="submit" className="sl-auth-submit-btn" disabled={submitting}>
                                        {submitting ? "Вход..." : "Войти"}
                                    </button>
                                </div>
                            </form>
                        )}

                        {!passwordChangeRequired && (
                            <>
                                <div className="sl-auth-footer">
                                    <span>Учетную запись создаёт преподаватель.</span>
                                </div>
                                {TEACHER_APP_URL && <div className="sl-auth-footer" style={{ marginTop: '8px' }}>
                                    <a href={TEACHER_APP_URL} className="sl-auth-link sl-auth-link--secondary">Вход для преподавателей →</a>
                                </div>}
                            </>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}

export default LogPage;