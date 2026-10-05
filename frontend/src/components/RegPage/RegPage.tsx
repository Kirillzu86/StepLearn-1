import { useState, type ChangeEvent, type FormEvent, type SVGProps, type FC } from "react";
import { API_URL } from "../../api/api";
import { useNavigate, Link } from "react-router-dom";
import Header from "../Header/Header";
import Sidebar from "../Sidebar/sidebar";
import "../HomePage/StyleHomePage.css";
import "../Sidebar/StyleSidebar.css";
import "../LogPage/StyleLogPage.css";

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

interface RegPageProps {
    theme: "dark" | "light";
    toggleTheme: () => void;
}

function RegPage({ theme, toggleTheme }: RegPageProps) {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({ username: '', email: '', password: '', confirmPassword: '' });
    const [message, setMessage] = useState({ text: '', type: '' });
    const [errors, setErrors] = useState({ username: false, email: false, password: false, confirmPassword: false });
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        setErrors(prev => ({ ...prev, [name]: false }));
        setMessage({ text: '', type: '' });
    };

    const handleFormSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const { username, email, password, confirmPassword } = formData;
        if (!username.trim() || !email.trim() || !password || !confirmPassword) {
            setMessage({ text: 'Заполните все поля', type: 'error' });
            return;
        }
        if (password.length < 6) {
            setMessage({ text: 'Пароль должен быть не менее 6 символов', type: 'error' });
            return;
        }
        if (password !== confirmPassword) {
            setMessage({ text: 'Пароли не совпадают', type: 'error' });
            return;
        }
        setSubmitting(true);
        try {
            const base = API_URL ? API_URL.replace(/\/$/, '') : (typeof window !== 'undefined' ? window.location.origin : '');
            
            // Попробуем отправить запрос на бесплатный сервер регистрации
            let res = await fetch(`${base}/auth/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, email, password }),
            });

            if (!res.ok && res.status === 404) {
                // Запасной путь для /api/auth/register
                res = await fetch(`${base}/api/auth/register`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username, email, password }),
                });
            }

            if (!res.ok) {
                let data: any = {};
                try {
                    data = await res.json();
                } catch {
                    data.detail = await res.text().catch(() => `Ошибка ${res.status}`);
                }
                const errorMsg = typeof data.detail === 'string' ? data.detail : 
                    (Array.isArray(data.detail) ? data.detail[0]?.msg : null) || 
                    (data.username ? data.username[0] : null) || 
                    (data.email ? data.email[0] : null) || 
                    "Не удалось создать аккаунт";
                throw new Error(errorMsg);
            }

            const user = await res.json();
            window.localStorage.setItem("currentUser", JSON.stringify(user));
            try {
                window.dispatchEvent(new CustomEvent('currentUserChanged', { detail: user }));
            } catch {
                window.dispatchEvent(new Event('currentUserChanged'));
            }
            setMessage({ text: `Аккаунт успешно создан!`, type: 'success' });
            setTimeout(() => navigate('/'), 800);
        } catch (err: any) {
            setMessage({ text: err.message || 'Ошибка при регистрации', type: 'error' });
        } finally {
            setSubmitting(false);
        }
    };

    const renderInputField = (label: string, type: string, name: keyof typeof formData, Icon: FC<IconProps>, placeholder: string, isPass = false, visible = false, toggle = () => {}) => {
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
                        placeholder={placeholder}
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
                            <h1 className="sl-auth-title">Регистрация</h1>
                            <p className="sl-auth-subtitle">Создайте аккаунт и откройте доступ к курсам</p>
                        </div>

                        {message.text && (
                            <div className={`sl-auth-alert ${message.type === 'success' ? 'sl-auth-alert--success' : 'sl-auth-alert--error'}`}>
                                <span className="sl-auth-alert-icon">{message.type === 'success' ? <Icons.Check /> : <Icons.XCircle />}</span>
                                {message.text}
                            </div>
                        )}

                        <form onSubmit={handleFormSubmit} className="sl-auth-form">
                            {renderInputField('Имя пользователя', 'text', 'username', Icons.User, 'alex_dev')}
                            {renderInputField('Email', 'email', 'email', Icons.Mail, 'alex@example.com')}
                            {renderInputField('Пароль', 'password', 'password', Icons.Lock, '••••••••', true, isPasswordVisible, () => setIsPasswordVisible(!isPasswordVisible))}
                            {renderInputField('Повторите пароль', 'password', 'confirmPassword', Icons.Lock, '••••••••', true, isConfirmPasswordVisible, () => setIsConfirmPasswordVisible(!isConfirmPasswordVisible))}

                            <div className="sl-auth-actions">
                                <button type="submit" className="sl-auth-submit-btn" disabled={submitting}>
                                    {submitting ? "Создание аккаунта..." : "Зарегистрироваться"}
                                </button>
                            </div>
                        </form>

                        <div className="sl-auth-footer">
                            <span>Уже есть аккаунт? </span>
                            <Link to="/login" className="sl-auth-link">Войти</Link>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}

export default RegPage;