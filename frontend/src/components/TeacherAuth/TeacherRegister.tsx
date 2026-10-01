import { useState, type ChangeEvent, type FormEvent, type SVGProps, type FC } from "react";
import { teacherRegister } from "../../api/api";
import { useNavigate, Link } from "react-router-dom";
import Header from "../Header/Header";
import "../HomePage/StyleHomePage.css";
import "../LogPage/StyleLogPage.css";
import "./StyleTeacherAuth.css";

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
    ),
    Shield: (props: IconProps) => (
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>
        </svg>
    )
};

interface TeacherRegisterProps {
    theme: "dark" | "light";
    toggleTheme: () => void;
}

function TeacherRegister({ }: TeacherRegisterProps) {
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
        first_name: '',
        last_name: '',
    });
    const [message, setMessage] = useState({ text: '', type: '' });
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const navigate = useNavigate();

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        setMessage({ text: '', type: '' });
    };

    const handleFormSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const { username, email, password, confirmPassword, first_name, last_name } = formData;

        if (!username || !email || !password || !first_name || !last_name) {
            setMessage({ text: 'Заполните все обязательные поля', type: 'error' });
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
            const user = await teacherRegister({
                username,
                email,
                password,
                first_name,
                last_name,
            });
            window.localStorage.setItem("currentUser", JSON.stringify(user));
            try {
                window.dispatchEvent(new CustomEvent('currentUserChanged', { detail: user }));
            } catch {
                window.dispatchEvent(new Event('currentUserChanged'));
            }
            setMessage({ text: 'Аккаунт преподавателя создан! Перенаправляем...', type: 'success' });
            setTimeout(() => navigate('/admin-panel'), 1200);
        } catch (err: any) {
            const data = err.response?.data;
            let errorMsg = '';
            if (data && typeof data === 'object') {
                for (const key of Object.keys(data)) {
                    const val = Array.isArray(data[key]) ? data[key][0] : data[key];
                    if (typeof val === 'string') {
                        errorMsg = val;
                        break;
                    }
                }
            }
            setMessage({ text: errorMsg || err.message || "Ошибка при регистрации", type: "error" });
        } finally {
            setSubmitting(false);
        }
    };

    const renderInputField = (label: string, type: string, name: keyof typeof formData, Icon: FC<IconProps>, placeholder: string, isPass = false) => {
        return (
            <div className="sl-auth-input-group">
                <label className="sl-auth-label">{label}</label>
                <div className="sl-auth-input-wrapper">
                    <span className="sl-auth-input-icon sl-auth-input-icon--left"><Icon /></span>
                    <input
                        type={isPass ? (isPasswordVisible ? 'text' : 'password') : type}
                        name={name}
                        value={formData[name]}
                        onChange={handleChange}
                        className="sl-auth-input"
                        placeholder={placeholder}
                    />
                    {isPass && (
                        <button type="button" onClick={() => setIsPasswordVisible(!isPasswordVisible)} className="sl-auth-input-icon sl-auth-input-icon--right" tabIndex={-1}>
                            {isPasswordVisible ? <Icons.EyeOff /> : <Icons.Eye />}
                        </button>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="sl-app">
            <Header />
            <div className="sl-teacher-auth-layout">
                <main className="sl-auth-main sl-teacher-auth-main">
                    <div className="sl-auth-card sl-teacher-auth-card sl-teacher-register-card">
                        <div className="sl-auth-header">
                            <div className="sl-teacher-auth-badge">
                                <Icons.Shield stroke="#4F46E5" />
                            </div>
                            <h1 className="sl-auth-title">Регистрация преподавателя</h1>
                            <p className="sl-auth-subtitle">Создайте преподавательский аккаунт для управления курсами</p>
                        </div>

                        {message.text && (
                            <div className={`sl-auth-alert ${message.type === 'success' ? 'sl-auth-alert--success' : 'sl-auth-alert--error'}`}>
                                <span className="sl-auth-alert-icon">{message.type === 'success' ? <Icons.Check /> : <Icons.XCircle />}</span>
                                {message.text}
                            </div>
                        )}

                        <form onSubmit={handleFormSubmit} className="sl-auth-form">
                            <div className="sl-auth-row">
                                {renderInputField('Имя *', 'text', 'first_name', Icons.User, 'Иван')}
                                {renderInputField('Фамилия *', 'text', 'last_name', Icons.User, 'Иванов')}
                            </div>
                            {renderInputField('Имя пользователя *', 'text', 'username', Icons.User, 'teacher_ivanov')}
                            {renderInputField('Email *', 'email', 'email', Icons.Mail, 'teacher@example.com')}
                            {renderInputField('Пароль *', 'password', 'password', Icons.Lock, 'Минимум 6 символов', true)}
                            {renderInputField('Подтвердите пароль *', 'password', 'confirmPassword', Icons.Lock, 'Повторите пароль', true)}
                            
                            <div className="sl-auth-actions">
                                <button type="submit" className="sl-auth-submit-btn sl-teacher-submit-btn" disabled={submitting}>
                                    {submitting ? "Регистрация..." : "Создать аккаунт преподавателя"}
                                </button>
                            </div>
                        </form>

                        <div className="sl-auth-footer">
                            <span>Уже есть преподавательский аккаунт? </span>
                            <Link to="/teacher-login" className="sl-auth-link">Войти</Link>
                        </div>
                        <div className="sl-auth-footer" style={{ marginTop: '8px' }}>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}

export default TeacherRegister;
