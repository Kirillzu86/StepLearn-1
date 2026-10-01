import React, { useCallback, useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { API_URL } from "../../api/api";
import Header from "../Header/Header";
import Sidebar from "../Sidebar/sidebar";
import "../HomePage/StyleHomePage.css";
import "../Sidebar/StyleSidebar.css";
import "./StyleProfile.css";

interface ProfileProps {
  theme: "dark" | "light";
  toggleTheme: () => void;
}

interface User {
  id: number;
  username: string;
  email: string;
  avatar_url: string | null;
}

function Profile(props: ProfileProps) {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({ username: "", email: "" });
  const [message, setMessage] = useState({ text: "", type: "" });
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Ensure `theme` prop is observed to avoid unused-destructuring/build errors
  useEffect(() => {
    try {
      document.body.dataset.theme = props.theme;
    } catch {
      // noop during build/server-side
    }
  }, [props.theme]);

  const fetchUserProfile = useCallback(async (userId: number) => {
    setLoading(true);
    setProfileError(null);
    try {
      const base = API_URL.replace(/\/$/, "");
      const storedUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
      const response = await fetch(`${base}/api/v1/users/${userId}`, {
        headers: { Authorization: `Bearer ${storedUser.access || ""}` },
      });
      if (response.status === 401) {
        localStorage.removeItem("currentUser");
        window.dispatchEvent(new Event("currentUserChanged"));
        navigate("/login");
        return;
      }
      const userData = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          userData.detail ||
          (response.status === 403
            ? "У вас нет доступа к этому профилю."
            : `Не удалось загрузить профиль (ошибка ${response.status}).`),
        );
      }
      const updatedUser = { ...storedUser, ...userData };
      setCurrentUser(updatedUser);
      setFormData({ username: userData.username, email: userData.email });
      setAvatarPreview(userData.avatar_url || null);
      localStorage.setItem("currentUser", JSON.stringify(updatedUser));
    } catch (error) {
      console.error("Ошибка при загрузке профиля:", error);
      setProfileError(
        error instanceof TypeError
          ? "Не удалось подключиться к серверу. Проверьте интернет и попробуйте снова."
          : error instanceof Error
            ? error.message
            : "Не удалось загрузить профиль. Попробуйте снова.",
      );
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    const userStr = localStorage.getItem("currentUser");
    if (!userStr) {
      navigate("/login");
      return;
    }

    try {
      const user = JSON.parse(userStr);
      setCurrentUser(user);
      setFormData({ username: user.username, email: user.email });
      setAvatarPreview(user.avatar_url || null);
      void fetchUserProfile(user.id);
    } catch (error) {
      console.error("Unable to read the saved profile session:", error);
      navigate("/login");
    }
  }, [fetchUserProfile, navigate]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setMessage({ text: "", type: "" });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Проверяем тип файла
    if (!file.type.startsWith("image/")) {
      setMessage({ text: "Пожалуйста, выберите изображение", type: "error" });
      return;
    }

    // Проверяем размер файла (максимум 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ text: "Размер файла не должен превышать 5MB", type: "error" });
      return;
    }

    // Создаем preview
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setAvatarPreview(result);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!currentUser) return;

    try {
      const base = API_URL.replace(/\/$/, "");
      const updateData: { username?: string; email?: string; avatar_url?: string } = {};

      if (formData.username !== currentUser.username) {
        updateData.username = formData.username;
      }
      if (formData.email !== currentUser.email) {
        updateData.email = formData.email;
      }
      if (avatarPreview && avatarPreview !== currentUser.avatar_url) {
        updateData.avatar_url = avatarPreview;
      }

      if (Object.keys(updateData).length === 0) {
        setEditing(false);
        return;
      }

      const storedUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
      const response = await fetch(`${base}/api/v1/users/${currentUser.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${storedUser.access || ""}`,
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || "Ошибка при обновлении профиля");
      }

      const updatedUser = await response.json();
      const updatedSession = { ...storedUser, ...updatedUser };
      setCurrentUser(updatedSession);
      localStorage.setItem("currentUser", JSON.stringify(updatedSession));
      setMessage({ text: "Профиль успешно обновлен", type: "success" });
      setEditing(false);

      // Обновляем header в текущей вкладке — срабатывает немедленно
      try {
        window.dispatchEvent(new CustomEvent('currentUserChanged', { detail: updatedSession }));
      } catch {
        // fallback: emit a plain event so older browsers won't fail
        window.dispatchEvent(new Event('currentUserChanged'));
      }
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : "Ошибка при сохранении",
        type: "error",
      });
    }
  };

  const handleCancel = () => {
    if (currentUser) {
      setFormData({ username: currentUser.username, email: currentUser.email });
      setAvatarPreview(currentUser.avatar_url || null);
    }
    setEditing(false);
    setMessage({ text: "", type: "" });
  };

  const handleAvatarClick = () => {
    if (editing && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  if (loading && !profileError) {
    return (
      <div className="sl-app">
        <Header />
        <div className="sl-layout">
          <Sidebar />
          <main className="sl-main">
            <div className="profile-loading" role="status" aria-live="polite">
              Загрузка профиля...
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (profileError) {
    return (
      <div className="sl-app">
        <Header />
        <div className="sl-layout">
          <Sidebar />
          <main className="sl-main">
            <div className="content-header">
              <h1 className="main-title">Профиль</h1>
            </div>
            <div className="profile-content" style={{ marginTop: 0 }}>
              <div className="profile-card">
                <h2 className="profile-title">Не удалось загрузить профиль</h2>
                <p role="alert">{profileError}</p>
                <button
                  type="button"
                  className="profile-button"
                  disabled={!currentUser}
                  onClick={() => currentUser && void fetchUserProfile(currentUser.id)}
                >
                  Повторить
                </button>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return null;
  }

  const displayName = currentUser.username || currentUser.email;
  const displayInitial = displayName.charAt(0).toUpperCase();

  return (
    <div className="sl-app">
      <Header />
      <div className="sl-layout">
        <Sidebar />
        <main className="sl-main">
            <div className="content-header">
              <h1 className="main-title">Профиль</h1>
            </div>
            <div className="profile-content" style={{ marginTop: 0 }}>
        <div className="profile-card">

          {message.text && (
            <div className={`profile-message profile-message-${message.type}`}>
              {message.text}
            </div>
          )}

          <div className="profile-avatar-section">
            <div
              className={`profile-avatar ${editing ? "profile-avatar-editable" : ""}`}
              onClick={handleAvatarClick}
            >
              {avatarPreview ? (
                <img src={avatarPreview} alt="Аватар" className="profile-avatar-image" />
              ) : (
                <div className="profile-avatar-placeholder">{displayInitial}</div>
              )}
              {editing && (
                <div className="profile-avatar-overlay">
                  <span className="profile-avatar-edit-icon">📷</span>
                  <span className="profile-avatar-edit-text">Изменить фото</span>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              style={{ display: "none" }}
            />
          </div>

          <div className="profile-form">
            <div className="profile-form-group">
              <label className="profile-label">Имя пользователя</label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                disabled={!editing}
                className="profile-input"
              />
            </div>

            <div className="profile-form-group">
              <label className="profile-label">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                disabled={!editing}
                className="profile-input"
              />
            </div>

            <div className="profile-actions">
              {!editing ? (
                <>
                  <button className="profile-button profile-button-primary" onClick={() => setEditing(true)}>
                    Редактировать профиль
                  </button>
                  <button className="profile-button profile-button-secondary" style={{ background: '#EF4444', color: '#fff' }} onClick={() => {
                    localStorage.removeItem('currentUser');
                    window.dispatchEvent(new CustomEvent('currentUserChanged'));
                    navigate('/login');
                  }}>
                    Выйти из аккаунта
                  </button>
                </>
              ) : (
                <>
                  <button className="profile-button profile-button-primary" onClick={handleSave}>
                    Сохранить
                  </button>
                  <button className="profile-button profile-button-secondary" onClick={handleCancel}>
                    Отмена
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</div>
  );
}

export default Profile;
