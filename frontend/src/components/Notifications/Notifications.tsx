import React, { useState } from "react";
import Header from "../Header/Header";
import Sidebar from "../Sidebar/sidebar";
import { FiBell, FiCheck, FiTrash2, FiBookOpen, FiAward, FiInfo, FiCheckCircle } from "react-icons/fi";
import "../HomePage/StyleHomePage.css";
import "../Sidebar/StyleSidebar.css";
import "./StyleNotifications.css";

interface NotificationItem {
  id: number;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type: "course" | "system" | "award";
}

interface NotificationsProps {
  theme: "dark" | "light";
  toggleTheme: () => void;
}

const initialNotifications: NotificationItem[] = [
  {
    id: 1,
    title: "Добро пожаловать в StepLearn! 🎉",
    message: "Спасибо за регистрацию. Выберите ваш первый курс в каталоге и начните путь к новым навыкам!",
    time: "10 минут назад",
    read: false,
    type: "system",
  },
  {
    id: 2,
    title: "Новое задание по Python",
    message: "В курсе 'Основы Python' доступен новый практический блок с автоматической проверкой решений.",
    time: "2 часа назад",
    read: false,
    type: "course",
  },
  {
    id: 3,
    title: "Достижение разблокировано!",
    message: "Вы успешно заходили на платформу 3 дня подряд. Награда 'Настойчивый ученик' добавлена в профиль.",
    time: "Вчера в 18:45",
    read: false,
    type: "award",
  },
  {
    id: 4,
    title: "Обновление платформы v2.4",
    message: "Мы улучшили скорость загрузки уроков и добавили темный режим для удобного обучения вечером.",
    time: "3 дня назад",
    read: true,
    type: "system",
  },
];

export default function Notifications({ theme, toggleTheme }: NotificationsProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>(initialNotifications);
  const [filter, setFilter] = useState<"all" | "unread" | "course" | "system">("all");

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const toggleRead = (id: number) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: !n.read } : n))
    );
  };

  const deleteNotification = (id: number) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const clearRead = () => {
    setNotifications((prev) => prev.filter((n) => !n.read));
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filter === "unread") return !n.read;
    if (filter === "course") return n.type === "course";
    if (filter === "system") return n.type === "system" || n.type === "award";
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  const getTypeIcon = (type: NotificationItem["type"]) => {
    switch (type) {
      case "course":
        return <FiBookOpen className="sl-notif-icon sl-notif-icon--course" />;
      case "award":
        return <FiAward className="sl-notif-icon sl-notif-icon--award" />;
      default:
        return <FiInfo className="sl-notif-icon sl-notif-icon--system" />;
    }
  };

  return (
    <div className="sl-app">
      <Header />
      <div className="sl-layout">
        <Sidebar />
        <main className="sl-main">
          <div className="sl-notif-container">
            {/* Page Header */}
            <div className="sl-notif-header">
              <div>
                <div className="sl-notif-title-wrap">
                  <h1 className="sl-notif-title">Уведомления</h1>
                  {unreadCount > 0 && (
                    <span className="sl-notif-badge">{unreadCount} новых</span>
                  )}
                </div>
                <p className="sl-notif-subtitle">
                  Важные события, новости курсов и обновления системы
                </p>
              </div>

              <div className="sl-notif-actions">
                {unreadCount > 0 && (
                  <button onClick={markAllAsRead} className="sl-notif-btn sl-notif-btn--secondary">
                    <FiCheck /> Прочитать все
                  </button>
                )}
                {notifications.some((n) => n.read) && (
                  <button onClick={clearRead} className="sl-notif-btn sl-notif-btn--ghost">
                    <FiTrash2 /> Очистить прочитанные
                  </button>
                )}
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="sl-notif-tabs">
              <button
                className={`sl-notif-tab ${filter === "all" ? "sl-notif-tab--active" : ""}`}
                onClick={() => setFilter("all")}
              >
                Все ({notifications.length})
              </button>
              <button
                className={`sl-notif-tab ${filter === "unread" ? "sl-notif-tab--active" : ""}`}
                onClick={() => setFilter("unread")}
              >
                Непрочитанные ({unreadCount})
              </button>
              <button
                className={`sl-notif-tab ${filter === "course" ? "sl-notif-tab--active" : ""}`}
                onClick={() => setFilter("course")}
              >
                Курсы ({notifications.filter((n) => n.type === "course").length})
              </button>
              <button
                className={`sl-notif-tab ${filter === "system" ? "sl-notif-tab--active" : ""}`}
                onClick={() => setFilter("system")}
              >
                Системные ({notifications.filter((n) => n.type !== "course").length})
              </button>
            </div>

            {/* Notification List */}
            <div className="sl-notif-list">
              {filteredNotifications.length > 0 ? (
                filteredNotifications.map((item) => (
                  <div
                    key={item.id}
                    className={`sl-notif-card ${!item.read ? "sl-notif-card--unread" : ""}`}
                    onClick={() => toggleRead(item.id)}
                  >
                    <div className="sl-notif-card-icon">{getTypeIcon(item.type)}</div>

                    <div className="sl-notif-card-body">
                      <div className="sl-notif-card-top">
                        <h3 className="sl-notif-card-title">{item.title}</h3>
                        <span className="sl-notif-card-time">{item.time}</span>
                      </div>
                      <p className="sl-notif-card-msg">{item.message}</p>
                    </div>

                    <div className="sl-notif-card-actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        title={item.read ? "Отметить как непрочитанное" : "Отметить как прочитанное"}
                        onClick={() => toggleRead(item.id)}
                        className="sl-notif-action-btn"
                      >
                        <FiCheckCircle className={item.read ? "sl-icon-read" : ""} />
                      </button>
                      <button
                        title="Удалить"
                        onClick={() => deleteNotification(item.id)}
                        className="sl-notif-action-btn sl-notif-action-btn--delete"
                      >
                        <FiTrash2 />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="sl-empty sl-notif-empty">
                  <FiBell style={{ fontSize: "3rem", color: "var(--text-muted)", marginBottom: "12px" }} />
                  <div>Уведомлений не найдено</div>
                  <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                    Здесь будут появляться обновления по вашим курсам и системе.
                  </span>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
