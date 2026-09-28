import React, { useState, useEffect } from "react";
import axios from "axios";
import { API_URL } from "../../api/api";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Header from "../Header/Header";
import Sidebar from "../Sidebar/sidebar";
import "./StyleHomePage.css";
import "../Sidebar/StyleSidebar.css";

// --- Interfaces ---
interface Course {
  id: number;
  title: string;
  description: string;
  rating: number;
  price?: number;
  students_count: number;
  price_status: string;
  total_lessons: number;
  completed_lessons: number;
  progress_percentage: number;
  category?: string;
}

// --- Category type ---
interface Category {
  title: string;
  icon: string;
  color: string;
}

const categories: Category[] = [
  { title: "IT и программирование", icon: "</>", color: "#4F46E5" },
  { title: "Дизайн", icon: "🎨", color: "#EC4899" },
  { title: "Бизнес и управление", icon: "📊", color: "#10B981" },
  { title: "Маркетинг", icon: "📢", color: "#F97316" },
  { title: "Гуманитарные науки", icon: "📚", color: "#8B5CF6" },
  { title: "Языки", icon: "🌍", color: "#3B82F6" },
  { title: "Все категории", icon: "•••", color: "#6B7280" },
];

// --- Feature card data ---
const features = [
  { icon: "⏰", title: "Гибкий формат", desc: "Учись в удобное время и в своём темпе" },
  { icon: "✏️", title: "Практические задания", desc: "Закрепляй знания на реальных кейсах" },
  { icon: "📜", title: "Сертификаты", desc: "Подтверждай свои навыки и добавляй в резюме" },
  { icon: "👥", title: "Сообщество", desc: "Общайся с единомышленниками и экспертами" },
];

// --- Course Card ---
function CourseCard({ course }: { course: Course }) {
  const getCategoryLabel = () => {
    if (course.category) return course.category;
    const title = course.title.toLowerCase();
    if (title.includes("python") || title.includes("программ")) return "IT и программирование";
    if (title.includes("бизнес") || title.includes("аналитик")) return "Бизнес и управление";
    if (title.includes("дизайн") || title.includes("ui") || title.includes("ux")) return "Дизайн";
    if (title.includes("маркетинг")) return "Маркетинг";
    return "IT и программирование";
  };

  const getCategoryColor = () => {
    const cat = getCategoryLabel();
    const found = categories.find(c => c.title === cat);
    return found?.color || "#4F46E5";
  };

  return (
    <Link to={`/course/${course.id}`} className="sl-course-card">
      <div className="sl-course-card__image">
        <div className="sl-course-card__image-placeholder" style={{
          background: `linear-gradient(135deg, ${getCategoryColor()}22, ${getCategoryColor()}44)`
        }}>
          <span style={{ fontSize: "2rem" }}>📘</span>
        </div>
      </div>
      <div className="sl-course-card__body">
        <span className="sl-course-card__badge" style={{
          background: `${getCategoryColor()}15`,
          color: getCategoryColor(),
          border: `1px solid ${getCategoryColor()}30`,
        }}>
          {getCategoryLabel()}
        </span>
        <h3 className="sl-course-card__title">{course.title}</h3>
        <p className="sl-course-card__desc">{course.description}</p>
        <div className="sl-course-card__meta">
          <span className="sl-course-card__students">
            👤 {course.students_count?.toLocaleString() || 0} учеников
          </span>
          <span className="sl-course-card__rating">
            ⭐ {course.rating?.toFixed(1) || "0.0"}
            {course.students_count > 0 && (
              <span className="sl-course-card__rating-count">
                ({course.students_count > 1000
                  ? `${(course.students_count / 1000).toFixed(1)}k`
                  : course.students_count})
              </span>
            )}
          </span>
        </div>
      </div>
    </Link>
  );
}

// --- Right Panel: My Course Item ---
function MyCourseItem({ course }: { course: Course }) {
  const pct = course.progress_percentage || 0;
  return (
    <Link to={`/course/${course.id}`} className="sl-my-course">
      <div className="sl-my-course__icon">📘</div>
      <div className="sl-my-course__info">
        <div className="sl-my-course__title">{course.title}</div>
        <div className="sl-my-course__lesson">
          Урок {course.completed_lessons || 0} из {course.total_lessons || 0}
        </div>
      </div>
      <div className="sl-my-course__progress-wrap">
        <span className="sl-my-course__pct">{pct}%</span>
        <div className="sl-my-course__bar">
          <div className="sl-my-course__bar-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </Link>
  );
}

// --- Main HomePage ---
interface HomePageProps {
  theme: "dark" | "light";
  toggleTheme: () => void;
}

function HomePage({ theme, toggleTheme }: HomePageProps) {
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [myCourses, setMyCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const timestamp = new Date().getTime();
        const config = {
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
          },
        };

        let user = null;
        try {
          const userStr = localStorage.getItem("currentUser");
          user = userStr ? JSON.parse(userStr) : null;
        } catch {
          user = null;
          localStorage.removeItem("currentUser");
        }

        const base = API_URL.replace(/\/$/, '');
        const allCoursesPromise = axios
          .get<Course[]>(`${base}/api/v1/courses?_t=${timestamp}`, config)
          .catch(() => ({ data: [] as Course[] }));

        let myCoursesPromise = Promise.resolve({ data: [] as Course[] });
        if (user && user.id) {
          myCoursesPromise = axios
            .get<Course[]>(`${base}/api/v1/users/${user.id}/courses?_t=${timestamp}`, config)
            .catch((err) => {
              if (err?.response?.status === 404) {
                localStorage.removeItem("currentUser");
                setCurrentUser(null);
              }
              return { data: [] as Course[] };
            });
          setCurrentUser(user);
        } else {
          setCurrentUser(null);
        }

        const [allRes, myRes] = await Promise.all([allCoursesPromise, myCoursesPromise]);

        const normalize = (data: any): Course[] => {
          if (Array.isArray(data)) return data;
          if (data?.data && Array.isArray(data.data)) return data.data;
          if (data?.courses && Array.isArray(data.courses)) return data.courses;
          if (data?.results && Array.isArray(data.results)) return data.results;
          return [];
        };

        setAllCourses(normalize(allRes.data));
        setMyCourses(normalize(myRes.data));
      } catch (err) {
        console.error("Ошибка загрузки данных:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [location]);

  const userName = currentUser
    ? (currentUser.username || currentUser.name || "Пользователь")
    : "Гость";

  const totalProgress = myCourses.length > 0
    ? Math.round(myCourses.reduce((acc, c) => acc + (c.progress_percentage || 0), 0) / myCourses.length)
    : 0;

  return (
    <div className="sl-app">
      <Header />
      <div className="sl-layout">
        <Sidebar />

        <main className="sl-main">
          {/* Hero Banner */}
          <section className="sl-hero">
            <div className="sl-hero__content">
              <span className="sl-hero__label">StepLearn — твой путь к знаниям</span>
              <h1 className="sl-hero__title">
                Учись онлайн —<br/>развивай свое будущее
              </h1>
              <p className="sl-hero__desc">
                StepLearn — это современная образовательная платформа,
                где ты можешь изучать курсы, осваивать новые профессии
                и достигать своих целей в удобном темпе.
              </p>
              <div className="sl-hero__actions">
                <Link to="/catalog" className="sl-hero__btn sl-hero__btn--primary">
                  Начать обучение →
                </Link>
                <button className="sl-hero__btn sl-hero__btn--secondary">
                  ▶ Как это работает
                </button>
              </div>
            </div>
            <div className="sl-hero__illustration">
              <div className="sl-hero__illustration-box">
                <div className="sl-hero__float sl-hero__float--1">🎓</div>
                <div className="sl-hero__float sl-hero__float--2">💻</div>
                <div className="sl-hero__float sl-hero__float--3">📊</div>
                <div className="sl-hero__illu-text">Знания<br/>открывают<br/>возможности</div>
              </div>
            </div>
          </section>

          {/* Features */}
          <section className="sl-features">
            {features.map((f, i) => (
              <div key={i} className="sl-feature">
                <div className="sl-feature__icon">{f.icon}</div>
                <div>
                  <div className="sl-feature__title">{f.title}</div>
                  <div className="sl-feature__desc">{f.desc}</div>
                </div>
              </div>
            ))}
          </section>

          {/* Popular courses */}
          <section className="sl-section">
            <div className="sl-section__header">
              <h2 className="sl-section__title">🔥 Популярные курсы</h2>
              <Link to="/catalog" className="sl-section__link">Смотреть все →</Link>
            </div>
            <div className="sl-courses-grid">
              {loading ? (
                <div className="sl-loading">Загрузка курсов...</div>
              ) : allCourses.length > 0 ? (
                allCourses.slice(0, 4).map((course) => (
                  <CourseCard key={course.id} course={course} />
                ))
              ) : (
                <div className="sl-empty">Курсы скоро появятся! 🚀</div>
              )}
            </div>
          </section>

          {/* Categories */}
          <section className="sl-section">
            <div className="sl-section__header">
              <h2 className="sl-section__title">Категории курсов</h2>
              <Link to="/catalog" className="sl-section__link">Смотреть все →</Link>
            </div>
            <div className="sl-categories">
              {categories.map((cat, i) => (
                <Link to="/catalog" key={i} className="sl-category">
                  <div className="sl-category__icon" style={{
                    background: `${cat.color}15`,
                    color: cat.color,
                  }}>
                    {cat.icon}
                  </div>
                  <span className="sl-category__title">{cat.title}</span>
                </Link>
              ))}
            </div>
          </section>
        </main>

        {/* Right Panel */}
        <aside className="sl-right-panel">
          {/* Greeting */}
          <div className="sl-rp-greeting">
            <div className="sl-rp-greeting__header">
              <span>Привет, {userName}! 👋</span>
            </div>
            {currentUser ? (
              <p className="sl-rp-greeting__sub">Рады видеть тебя на StepLearn!</p>
            ) : (
              <p className="sl-rp-greeting__sub">
                <Link to="/login">Войди</Link> чтобы отслеживать прогресс
              </p>
            )}
          </div>

          {/* Progress */}
          {currentUser && myCourses.length > 0 && (
            <div className="sl-rp-card">
              <div className="sl-rp-card__title">Твой прогресс</div>
              <div className="sl-rp-progress">
                <div className="sl-rp-progress__bar">
                  <div className="sl-rp-progress__fill" style={{ width: `${totalProgress}%` }} />
                </div>
                <div className="sl-rp-progress__label">
                  <span>{myCourses.filter(c => (c.progress_percentage || 0) >= 100).length} из {myCourses.length} курсов</span>
                  <span>{totalProgress}%</span>
                </div>
              </div>
              {currentUser && (
                <Link to="/catalog" className="sl-rp-card__link">Продолжить обучение →</Link>
              )}
            </div>
          )}

          {/* My courses list */}
          {currentUser && myCourses.length > 0 && (
            <div className="sl-rp-card">
              <div className="sl-rp-card__header">
                <span className="sl-rp-card__title">Твои курсы</span>
                <Link to="/my-courses" className="sl-rp-card__all">Все →</Link>
              </div>
              <div className="sl-rp-courses">
                {myCourses.slice(0, 4).map((c) => (
                  <MyCourseItem key={c.id} course={c} />
                ))}
              </div>
            </div>
          )}

          {/* Certificates CTA */}
          <div className="sl-rp-cert">
            <div className="sl-rp-cert__text">
              Получай сертификаты и повышай свою ценность на рынке труда!
            </div>
            <Link to="/catalog" className="sl-rp-cert__btn">Подробнее</Link>
          </div>

          {/* News */}
          <div className="sl-rp-card">
            <div className="sl-rp-card__header">
              <span className="sl-rp-card__title">Новости и обновления</span>
              <Link to="/news" className="sl-rp-card__all">Все →</Link>
            </div>
            <div className="sl-rp-news">
              <div className="sl-rp-news__item">
                <div className="sl-rp-news__title">Новый курс: Искусственный интеллект</div>
                <div className="sl-rp-news__date">2 дня назад</div>
              </div>
              <div className="sl-rp-news__item">
                <div className="sl-rp-news__title">Запущен конкурс студенческих проектов</div>
                <div className="sl-rp-news__date">5 дней назад</div>
              </div>
              <div className="sl-rp-news__item">
                <div className="sl-rp-news__title">Добавлены новые языковые курсы</div>
                <div className="sl-rp-news__date">1 неделю назад</div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default HomePage;