import { useCallback, useState, useEffect } from "react";
import axios from "axios";
import { fetchCourseLearningProgress, fetchStudentCourses } from "../../api/api";
import type { StudentCourseSummary } from "../../api/api";
import Header from "../Header/Header";
import Sidebar from "../Sidebar/sidebar";
import { Link } from "react-router-dom";
import { FiBook, FiPlayCircle, FiCheckCircle } from "react-icons/fi";
import "../HomePage/StyleHomePage.css";
import "../Sidebar/StyleSidebar.css";
import "./StyleMyCourses.css";

function getCoursesError(error: unknown) {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 401) return "Сессия истекла. Войдите снова.";
    if (error.response?.status === 403) return "У вас нет доступа к списку курсов.";
    if (!error.response) return "Нет подключения к серверу. Проверьте интернет и попробуйте снова.";
    const detail = error.response.data?.detail;
    if (typeof detail === "string") return detail;
  }
  return error instanceof Error
    ? error.message
    : "Не удалось загрузить курсы. Попробуйте ещё раз.";
}

export default function MyCourses() {
  const [myCourses, setMyCourses] = useState<StudentCourseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "in_progress" | "completed">("all");

  const loadMyCourses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const raw = localStorage.getItem("currentUser");
      const user = raw ? JSON.parse(raw) as { id?: number; role?: string } : null;
      if (!user?.id || user.role !== "student") {
        setMyCourses([]);
        setError("Войдите в аккаунт ученика, чтобы посмотреть назначенные курсы.");
        return;
      }
      const userId = user.id;
      const courses = await fetchStudentCourses(userId);
      const withProgress = await Promise.all(courses.map(async (course) => {
        const progressResponse = await fetchCourseLearningProgress(userId, course.id);
        return {
          ...course,
          progress_percentage:
            progressResponse.learning_progress?.progress_percentage ??
            course.progress_percentage ??
            0,
        };
      }));
      setMyCourses(withProgress);
    } catch (loadError) {
      setError(getCoursesError(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMyCourses();
  }, [loadMyCourses]);

  const filteredCourses = myCourses.filter((c) => {
    const pct = c.progress_percentage || 0;
    if (filter === "in_progress") return pct < 100;
    if (filter === "completed") return pct >= 100;
    return true;
  });

  return (
    <div className="sl-app">
      <Header />
      <div className="sl-layout">
        <Sidebar />
        <main className="sl-main">
          <div className="sl-myc-container">
            <div className="sl-myc-header">
              <h1 className="sl-myc-title">Мои курсы</h1>
              <p className="sl-myc-subtitle">
                Все курсы, на которые вы записаны. Проходите уроки и отслеживайте свой прогресс.
              </p>
            </div>

            {/* Filter Tabs */}
            <div className="sl-myc-tabs">
              <button
                className={`sl-myc-tab ${filter === "all" ? "sl-myc-tab--active" : ""}`}
                onClick={() => setFilter("all")}
              >
                Все курсы ({myCourses.length})
              </button>
              <button
                className={`sl-myc-tab ${filter === "in_progress" ? "sl-myc-tab--active" : ""}`}
                onClick={() => setFilter("in_progress")}
              >
                В процессе ({myCourses.filter((c) => (c.progress_percentage || 0) < 100).length})
              </button>
              <button
                className={`sl-myc-tab ${filter === "completed" ? "sl-myc-tab--active" : ""}`}
                onClick={() => setFilter("completed")}
              >
                Завершенные ({myCourses.filter((c) => (c.progress_percentage || 0) >= 100).length})
              </button>
            </div>

            {/* Courses Grid */}
            {loading ? (
              <div className="sl-loading">Загрузка ваших курсов...</div>
            ) : error ? (
              <div className="sl-empty sl-myc-empty" role="alert">
                <div>{error}</div>
                <button type="button" className="sl-myc-btn" onClick={() => void loadMyCourses()}>
                  Повторить
                </button>
                {(error.includes("Войдите") || error.includes("Сессия")) && (
                  <Link to="/login" style={{ color: "var(--primary)", fontWeight: 600 }}>
                    Перейти ко входу
                  </Link>
                )}
              </div>
            ) : filteredCourses.length > 0 ? (
              <div className="sl-myc-grid">
                {filteredCourses.map((c) => {
                  const pct = Math.round(c.progress_percentage || 0);
                  const isDone = pct >= 100;

                  return (
                    <div key={c.id} className="sl-myc-card">
                      <div className="sl-myc-card-top">
                        <div className="sl-myc-card-icon">📘</div>
                        <span className="sl-myc-badge">
                          {isDone ? "✓ Завершен" : "В процессе"}
                        </span>
                      </div>

                      <h2 className="sl-myc-card-title">{c.title}</h2>
                      <p className="sl-myc-card-desc">{c.description}</p>

                      <div className="sl-myc-progress">
                        <div className="sl-myc-progress-label">
                          <span>Прогресс</span>
                          <span>{pct}%</span>
                        </div>
                        <div className="sl-myc-progress-bar">
                          <div className="sl-myc-progress-fill" style={{ width: `${pct}%` }} />
                        </div>
                      </div>

                      <Link to={`/course/${c.id}`} className="sl-myc-btn">
                        {isDone ? <FiCheckCircle /> : <FiPlayCircle />}
                        {isDone ? "Повторить материалы" : "Продолжить обучение"}
                      </Link>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="sl-empty sl-myc-empty">
                <FiBook style={{ fontSize: "3rem", color: "var(--text-muted)", marginBottom: "12px" }} />
                <div>Вы пока не записаны ни на один курс</div>
                <Link to="/catalog" style={{ marginTop: "12px", display: "inline-block", color: "var(--primary)", fontWeight: 600 }}>
                  Перейти в каталог курсов →
                </Link>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
