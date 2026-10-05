import React, { useState } from "react";
import Header from "../Header/Header";
import Sidebar from "../Sidebar/sidebar";
import { FiUser, FiMoon, FiSun, FiBell, FiShield, FiCheck, FiSave, FiLock } from "react-icons/fi";
import "../HomePage/StyleHomePage.css";
import "../Sidebar/StyleSidebar.css";
import "./StyleSettings.css";

interface SettingsProps {
  theme: "dark" | "light";
  toggleTheme: () => void;
}

type CurrentUser = {
  username?: string;
  name?: string;
  email?: string;
  bio?: string;
  [key: string]: unknown;
};

export default function Settings({ theme, toggleTheme }: SettingsProps) {
  const [activeTab, setActiveTab] = useState<"profile" | "appearance" | "notifications" | "security">("profile");

  // User state from localStorage
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  // Profile form
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [bio, setBio] = useState("");

  // Notification toggles
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [systemNotifs, setSystemNotifs] = useState(true);
  const [courseUpdates, setCourseUpdates] = useState(true);

  // Security form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Feedback state
  const [savedMessage, setSavedMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem("currentUser");
      if (!raw) return;
      const u = JSON.parse(raw) as CurrentUser;
      setCurrentUser(u);
      setUsername(u.username || u.name || "");
      setEmail(u.email || "");
      setBio(u.bio || "Студент платформы StepLearn");
    } catch (e) {
      console.error(e);
    }
  }, []);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setErrorMessage("Имя пользователя не может быть пустым");
      return;
    }
    const updated = { ...currentUser, username, email, bio };
    localStorage.setItem("currentUser", JSON.stringify(updated));
    setCurrentUser(updated);

    try {
      window.dispatchEvent(new CustomEvent("currentUserChanged", { detail: updated }));
    } catch {
      window.dispatchEvent(new Event("currentUserChanged"));
    }

    setErrorMessage("");
    setSavedMessage("Настройки профиля успешно сохранены!");
    setTimeout(() => setSavedMessage(""), 3000);
  };

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      setErrorMessage("Пожалуйста, заполните все поля пароля");
      return;
    }
    if (newPassword.length < 6) {
      setErrorMessage("Новый пароль должен содержать минимум 6 символов");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage("Пароли не совпадают");
      return;
    }

    setErrorMessage("");
    setSavedMessage("Пароль успешно изменен!");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setTimeout(() => setSavedMessage(""), 3000);
  };

  return (
    <div className="sl-app">
      <Header />
      <div className="sl-layout">
        <Sidebar />
        <main className="sl-main sl-page-shell">
          <div className="sl-settings-container">
            {/* Page Title */}
            <div className="sl-settings-header">
              <h1 className="sl-settings-title">Настройки</h1>
              <p className="sl-settings-subtitle">Управление профилем, уведомлениями и внешним видом</p>
            </div>

            {savedMessage && (
              <div className="sl-settings-alert sl-settings-alert--success">
                <FiCheck /> {savedMessage}
              </div>
            )}
            {errorMessage && (
              <div className="sl-settings-alert sl-settings-alert--error">
                {errorMessage}
              </div>
            )}

            <div className="sl-settings-layout">
              {/* Settings Sidebar Tabs */}
              <div className="sl-settings-tabs">
                <button
                  className={`sl-settings-tab ${activeTab === "profile" ? "sl-settings-tab--active" : ""}`}
                  onClick={() => setActiveTab("profile")}
                >
                  <FiUser /> Профиль
                </button>
                <button
                  className={`sl-settings-tab ${activeTab === "appearance" ? "sl-settings-tab--active" : ""}`}
                  onClick={() => setActiveTab("appearance")}
                >
                  {theme === "dark" ? <FiMoon /> : <FiSun />} Внешний вид
                </button>
                <button
                  className={`sl-settings-tab ${activeTab === "notifications" ? "sl-settings-tab--active" : ""}`}
                  onClick={() => setActiveTab("notifications")}
                >
                  <FiBell /> Уведомления
                </button>
                <button
                  className={`sl-settings-tab ${activeTab === "security" ? "sl-settings-tab--active" : ""}`}
                  onClick={() => setActiveTab("security")}
                >
                  <FiShield /> Безопасность
                </button>
              </div>

              {/* Settings Content Area */}
              <div className="sl-settings-content">
                {/* Profile Tab */}
                {activeTab === "profile" && (
                  <form onSubmit={handleSaveProfile} className="sl-settings-section">
                    <h2 className="sl-settings-section-title">Личные данные</h2>
                    
                    <div className="sl-settings-group">
                      <label className="sl-settings-label">Имя пользователя</label>
                      <input
                        type="text"
                        className="sl-settings-input"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Ваше имя"
                      />
                    </div>

                    <div className="sl-settings-group">
                      <label className="sl-settings-label">Email</label>
                      <input
                        type="email"
                        className="sl-settings-input"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="your.email@example.com"
                      />
                    </div>

                    <div className="sl-settings-group">
                      <label className="sl-settings-label">О себе</label>
                      <textarea
                        className="sl-settings-textarea"
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        rows={4}
                        placeholder="Расскажите о ваших целях обучения..."
                      />
                    </div>

                    <button type="submit" className="sl-settings-save-btn">
                      <FiSave /> Сохранить изменения
                    </button>
                  </form>
                )}

                {/* Appearance Tab */}
                {activeTab === "appearance" && (
                  <div className="sl-settings-section">
                    <h2 className="sl-settings-section-title">Тема оформления</h2>
                    <p className="sl-settings-desc">
                      Выберите наиболее комфортную тему для работы с платформой.
                    </p>

                    <div className="sl-settings-themes-grid">
                      <div
                        className={`sl-theme-card ${theme === "light" ? "sl-theme-card--selected" : ""}`}
                        onClick={() => theme !== "light" && toggleTheme()}
                      >
                        <div className="sl-theme-preview sl-theme-preview--light">
                          <div className="sl-theme-preview-bar" />
                          <div className="sl-theme-preview-content" />
                        </div>
                        <div className="sl-theme-card-info">
                          <FiSun className="sl-theme-card-icon" />
                          <span>Светлая тема</span>
                        </div>
                      </div>

                      <div
                        className={`sl-theme-card ${theme === "dark" ? "sl-theme-card--selected" : ""}`}
                        onClick={() => theme !== "dark" && toggleTheme()}
                      >
                        <div className="sl-theme-preview sl-theme-preview--dark">
                          <div className="sl-theme-preview-bar" />
                          <div className="sl-theme-preview-content" />
                        </div>
                        <div className="sl-theme-card-info">
                          <FiMoon className="sl-theme-card-icon" />
                          <span>Тёмная тема</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Notifications Tab */}
                {activeTab === "notifications" && (
                  <div className="sl-settings-section">
                    <h2 className="sl-settings-section-title">Настройки уведомлений</h2>
                    <p className="sl-settings-desc">Управляйте отправкой сообщений и оповещений</p>

                    <div className="sl-settings-toggles-list">
                      <div className="sl-toggle-item">
                        <div>
                          <div className="sl-toggle-title">Email-уведомления</div>
                          <div className="sl-toggle-sub">Получать рассылку о новых курсах и баллах</div>
                        </div>
                        <input
                          type="checkbox"
                          className="sl-toggle-switch"
                          checked={emailNotifs}
                          onChange={(e) => setEmailNotifs(e.target.checked)}
                        />
                      </div>

                      <div className="sl-toggle-item">
                        <div>
                          <div className="sl-toggle-title">Системные оповещения</div>
                          <div className="sl-toggle-sub">Оповещения о проверке практических заданий</div>
                        </div>
                        <input
                          type="checkbox"
                          className="sl-toggle-switch"
                          checked={systemNotifs}
                          onChange={(e) => setSystemNotifs(e.target.checked)}
                        />
                      </div>

                      <div className="sl-toggle-item">
                        <div>
                          <div className="sl-toggle-title">Обновления курсов</div>
                          <div className="sl-toggle-sub">Информация о выходе новых уроков в моих курсах</div>
                        </div>
                        <input
                          type="checkbox"
                          className="sl-toggle-switch"
                          checked={courseUpdates}
                          onChange={(e) => setCourseUpdates(e.target.checked)}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Security Tab */}
                {activeTab === "security" && (
                  <form onSubmit={handlePasswordChange} className="sl-settings-section">
                    <h2 className="sl-settings-section-title">Смена пароля</h2>

                    <div className="sl-settings-group">
                      <label className="sl-settings-label">Текущий пароль</label>
                      <input
                        type="password"
                        className="sl-settings-input"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="••••••••"
                      />
                    </div>

                    <div className="sl-settings-group">
                      <label className="sl-settings-label">Новый пароль</label>
                      <input
                        type="password"
                        className="sl-settings-input"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                      />
                    </div>

                    <div className="sl-settings-group">
                      <label className="sl-settings-label">Повторите новый пароль</label>
                      <input
                        type="password"
                        className="sl-settings-input"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                      />
                    </div>

                    <button type="submit" className="sl-settings-save-btn">
                      <FiLock /> Обновить пароль
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
