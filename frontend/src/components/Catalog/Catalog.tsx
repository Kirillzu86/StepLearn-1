import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { fetchCourses, API_URL } from "../../api/api";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import Header from "../Header/Header";
import Sidebar from "../Sidebar/sidebar";
import "../HomePage/StyleHomePage.css";
import "../Sidebar/StyleSidebar.css";
import "./StyleCatalog.css";

interface Course {
  id: number;
  title: string;
  description: string;
  rating?: number;
  price?: number;
  students_count?: number;
  price_status?: string;
  total_lessons?: number;
  completed_lessons?: number;
  progress_percentage?: number;
  course_type?: string;
  has_content?: boolean;
  category?: string;
}

const categoryFilters = [
  "Все категории",
  "IT и программирование",
  "Дизайн",
  "Бизнес и управление",
  "Маркетинг",
  "Языки",
];

const fallbackCourses: Course[] = [
  {
    id: 1,
    title: "Python с нуля",
    description: "Полный практический курс программирования на Python для начинающих разработчиков.",
    category: "IT и программирование",
    rating: 4.9,
    price: 0,
    students_count: 1420,
    price_status: "Free",
    total_lessons: 12,
    has_content: true,
    course_type: "programming",
  },
  {
    id: 2,
    title: "React & TypeScript",
    description: "Современная разработка пользовательских интерфейсов на React 19, TypeScript и Vite.",
    category: "IT и программирование",
    rating: 4.8,
    price: 0,
    students_count: 980,
    price_status: "Free",
    total_lessons: 10,
    has_content: true,
    course_type: "programming",
  },
  {
    id: 3,
    title: "UI/UX Дизайн в Figma",
    description: "Проектирование пользовательских интерфейсов, создание компонентов и интерактивных прототипов.",
    category: "Дизайн",
    rating: 4.9,
    price: 2900,
    students_count: 650,
    price_status: "Paid",
    total_lessons: 8,
    has_content: true,
    course_type: "design",
  },
  {
    id: 4,
    title: "Основы бизнес-анализа",
    description: "Сбор требований, проектирование бизнес-процессов и работа с метриками продукта.",
    category: "Бизнес и управление",
    rating: 4.7,
    price: 0,
    students_count: 510,
    price_status: "Free",
    total_lessons: 6,
    has_content: true,
    course_type: "business",
  },
];

function CatalogCourseCard({ course }: { course: Course }) {
  const isTextCourse = course.course_type === "text" || course.has_content;

  return (
    <Link to={`/course/${course.id}`} className="sl-catalog-card">
      <div className="sl-catalog-card__image">
        <div className="sl-catalog-card__image-bg">
          <span style={{ fontSize: "2.5rem" }}>📘</span>
        </div>
      </div>
      <div className="sl-catalog-card__body">
        <div className="sl-catalog-card__top">
          <span
            className={`sl-catalog-card__type ${
              isTextCourse
                ? "sl-catalog-card__type--text"
                : "sl-catalog-card__type--test"
            }`}
          >
            {isTextCourse ? "📖 Текст" : "📝 Тест"}
          </span>
          {course.price_status === "Enrolled" && (
            <span className="sl-catalog-card__enrolled">✓ Записан</span>
          )}
        </div>
        <h3 className="sl-catalog-card__title">{course.title}</h3>
        <p className="sl-catalog-card__desc">{course.description}</p>
        <div className="sl-catalog-card__footer">
          <div className="sl-catalog-card__stats">
            <span>⭐ {Number(course.rating || 4.8).toFixed(1)}</span>
            <span>👤 {(course.students_count || 0).toLocaleString()}</span>
            {course.total_lessons ? <span>📑 {course.total_lessons}</span> : null}
          </div>
          <span
            className={`sl-catalog-card__price ${
              course.price_status === "Enrolled"
                ? "sl-catalog-card__price--enrolled"
                : course.price && course.price > 0
                ? "sl-catalog-card__price--paid"
                : "sl-catalog-card__price--free"
            }`}
          >
            {course.price_status === "Enrolled"
              ? "Вы записаны"
              : course.price && course.price > 0
              ? `${course.price} ₽`
              : "Бесплатно"}
          </span>
        </div>
        {typeof course.progress_percentage === "number" &&
          course.progress_percentage > 0 && (
            <div className="sl-catalog-card__progress">
              <div className="sl-catalog-card__progress-bar">
                <div
                  className="sl-catalog-card__progress-fill"
                  style={{ width: `${course.progress_percentage}%` }}
                />
              </div>
              <span className="sl-catalog-card__progress-text">
                {course.progress_percentage.toFixed(0)}%
              </span>
            </div>
          )}
      </div>
    </Link>
  );
}

export default function Catalog({
  theme,
  toggleTheme,
}: {
  theme: "dark" | "light";
  toggleTheme: () => void;
}) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState("Все категории");
  const [sortBy, setSortBy] = useState<"popular" | "rating" | "new">("popular");

  const location = useLocation();
  const [searchParams] = useSearchParams();

  const toCourseArray = (data: any): Course[] => {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.data)) return data.data;
    if (data && Array.isArray(data.results)) return data.results;
    if (data && Array.isArray(data.courses)) return data.courses;
    return [];
  };

  // Initialize search from URL query
  useEffect(() => {
    const q = searchParams.get("q");
    if (q) setSearchTerm(q);
  }, [searchParams]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const ts = Date.now();
        const base = API_URL ? API_URL.replace(/\/$/, "") : "";
        let rawCourses: any[] = [];

        try {
          rawCourses = await fetchCourses(undefined, ts);
        } catch {
          try {
            const resp = await axios.get(`${base}/v1/courses?_t=${ts}`, { timeout: 5000 });
            rawCourses = toCourseArray(resp.data);
          } catch {
            const resp = await axios.get(`${base}/api/v1/courses?_t=${ts}`, { timeout: 5000 }).catch(() => ({ data: [] }));
            rawCourses = toCourseArray(resp.data);
          }
        }

        let loaded = toCourseArray(rawCourses);
        if (loaded.length === 0) {
          loaded = fallbackCourses;
        }

        const userRaw = localStorage.getItem("currentUser");
        const user = userRaw ? JSON.parse(userRaw) : null;
        let myIds = new Set<number>();

        if (user && user.id) {
          try {
            const resp = await axios.get(`${base}/v1/users/${user.id}/courses?_t=${ts}`, { timeout: 5000 });
            const enrolledList = toCourseArray(resp.data);
            myIds = new Set(enrolledList.map((c: any) => c.id));
          } catch {
            // silent ignore user enrollment error
          }
        }

        const withStatus = loaded.map((c) => ({
          ...c,
          price_status: myIds.has(c.id)
            ? "Enrolled"
            : c.price_status || (c.price && c.price > 0 ? "Paid" : "Free"),
        }));

        setCourses(withStatus);
      } catch (e: any) {
        console.error("Catalog fetch error:", e);
        setCourses(fallbackCourses);
      } finally {
        setLoading(false);
      }
    };
    loadData();

    const handleCoursesChanged = () => {
      loadData();
    };
    window.addEventListener("coursesChanged", handleCoursesChanged);
    return () => {
      window.removeEventListener("coursesChanged", handleCoursesChanged);
    };
  }, [location]);

  // Dynamic Filter & Search & Sort calculation
  const displayedCourses = useMemo(() => {
    let result = [...courses];

    // Filter by search query
    const term = searchTerm.trim().toLowerCase();
    if (term) {
      result = result.filter(
        (c) =>
          c.title.toLowerCase().includes(term) ||
          (c.description || "").toLowerCase().includes(term) ||
          String(c.id).includes(term)
      );
    }

    // Filter by category
    if (activeCategory !== "Все категории") {
      const cat = activeCategory.toLowerCase();
      result = result.filter((c) => {
        const cCat = (c.category || "").toLowerCase();
        const cTitle = (c.title || "").toLowerCase();

        if (cat.includes("it") || cat.includes("программ")) {
          return (
            cCat.includes("it") ||
            cCat.includes("программ") ||
            cCat.includes("python") ||
            cCat.includes("frontend") ||
            cCat.includes("backend") ||
            cTitle.includes("python") ||
            cTitle.includes("react") ||
            cTitle.includes("js")
          );
        }
        if (cat.includes("дизайн")) {
          return (
            cCat.includes("дизайн") ||
            cCat.includes("design") ||
            cTitle.includes("дизайн") ||
            cTitle.includes("figma")
          );
        }
        if (cat.includes("бизнес")) {
          return (
            cCat.includes("бизнес") ||
            cCat.includes("business") ||
            cTitle.includes("бизнес") ||
            cTitle.includes("анализ")
          );
        }
        if (cat.includes("маркетинг")) {
          return cCat.includes("маркетинг") || cTitle.includes("маркетинг");
        }
        if (cat.includes("язык")) {
          return cCat.includes("язык") || cTitle.includes("язык");
        }
        return cCat.includes(cat) || cTitle.includes(cat);
      });
    }

    // Sorting
    if (sortBy === "popular") {
      result.sort((a, b) => (b.students_count || 0) - (a.students_count || 0));
    } else if (sortBy === "rating") {
      result.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (sortBy === "new") {
      result.sort((a, b) => b.id - a.id);
    }

    return result;
  }, [courses, searchTerm, activeCategory, sortBy]);

  return (
    <div className="sl-app">
      <Header />
      <div className="sl-layout">
        <Sidebar />
        <main className="sl-main">
          {/* Page title & Search bar */}
          <div className="sl-catalog-header">
            <h1 className="sl-catalog-header__title">Каталог курсов</h1>
            <div className="sl-catalog-header__search">
              <span className="sl-catalog-header__search-icon">🔍</span>
              <input
                type="text"
                placeholder="Поиск курсов по названию или описанию..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="sl-catalog-header__input"
              />
            </div>
          </div>

          {/* Category filter tabs */}
          <div className="sl-catalog-filters">
            {categoryFilters.map((cat) => (
              <button
                key={cat}
                className={`sl-catalog-filter ${
                  activeCategory === cat ? "sl-catalog-filter--active" : ""
                }`}
                onClick={() => setActiveCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Sort + count toolbar */}
          <div className="sl-catalog-toolbar">
            <span className="sl-catalog-toolbar__count">
              Все курсы ({displayedCourses.length})
            </span>
            <div className="sl-catalog-toolbar__sort">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="sl-catalog-toolbar__select"
              >
                <option value="popular">По популярности</option>
                <option value="rating">По рейтингу</option>
                <option value="new">Новые</option>
              </select>
            </div>
          </div>

          {/* Course list */}
          {loading && <div className="sl-loading">Загрузка каталога...</div>}
          {error && <div className="sl-empty">Ошибка: {error}</div>}

          {!loading && !error && (
            <div className="sl-catalog-grid">
              {displayedCourses.length > 0 ? (
                displayedCourses.map((c) => (
                  <CatalogCourseCard key={c.id} course={c} />
                ))
              ) : (
                <div className="sl-empty">Курсы по выбранным фильтрам не найдены</div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
