import React, { useEffect, useState } from "react";
import axios from "axios";
import { fetchCourses, API_URL } from "../../api/api";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import Header from "../Header/Header";
import Sidebar from "../Sidebar/sidebar";
import "../HomePage/StyleHomePage.css";
import "../Sidebar/StyleSidebar.css";

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
  "Все категории", "IT и программирование", "Дизайн",
  "Бизнес и управление", "Маркетинг", "Языки"
];

function CatalogCourseCard({ course }: { course: Course }) {
  const isTextCourse = course.course_type === 'text' || course.has_content;

  return (
    <Link to={`/course/${course.id}`} className="sl-catalog-card">
      <div className="sl-catalog-card__image">
        <div className="sl-catalog-card__image-bg">
          <span style={{ fontSize: "2.5rem" }}>📘</span>
        </div>
      </div>
      <div className="sl-catalog-card__body">
        <div className="sl-catalog-card__top">
          <span className={`sl-catalog-card__type ${isTextCourse ? 'sl-catalog-card__type--text' : 'sl-catalog-card__type--test'}`}>
            {isTextCourse ? '📖 Текст' : '📝 Тест'}
          </span>
          {course.price_status === 'Enrolled' && (
            <span className="sl-catalog-card__enrolled">✓ Записан</span>
          )}
        </div>
        <h3 className="sl-catalog-card__title">{course.title}</h3>
        <p className="sl-catalog-card__desc">{course.description}</p>
        <div className="sl-catalog-card__footer">
          <div className="sl-catalog-card__stats">
            <span>⭐ {Number(course.rating || 0).toFixed(1)}</span>
            <span>👤 {(course.students_count || 0).toLocaleString()}</span>
            {course.total_lessons ? <span>📑 {course.total_lessons}</span> : null}
          </div>
          <span className={`sl-catalog-card__price ${
            course.price_status === 'Enrolled' ? 'sl-catalog-card__price--enrolled' :
            (course.price && course.price > 0 ? 'sl-catalog-card__price--paid' : 'sl-catalog-card__price--free')
          }`}>
            {course.price_status === 'Enrolled' ? 'Вы записаны' :
             (course.price && course.price > 0 ? `${course.price} ₽` : 'Бесплатно')}
          </span>
        </div>
        {typeof course.progress_percentage === "number" && course.progress_percentage > 0 && (
          <div className="sl-catalog-card__progress">
            <div className="sl-catalog-card__progress-bar">
              <div className="sl-catalog-card__progress-fill" style={{ width: `${course.progress_percentage}%` }} />
            </div>
            <span className="sl-catalog-card__progress-text">{course.progress_percentage.toFixed(0)}%</span>
          </div>
        )}
      </div>
    </Link>
  );
}

export default function Catalog({ theme, toggleTheme }: { theme: "dark" | "light"; toggleTheme: () => void }) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [displayedCourses, setDisplayedCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedTerm, setDebouncedTerm] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
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

  // Initialize search from URL
  useEffect(() => {
    const q = searchParams.get('q');
    if (q) setSearchTerm(q);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const ts = Date.now();
        const base = API_URL.replace(/\/$/, "");
        const allRaw = await fetchCourses(undefined, ts).catch(() =>
          axios.get(`${base}/api/v1/courses?_t=${ts}`, { timeout: 8000 }).then(r => r.data).catch(() => [])
        );
        const all = toCourseArray(allRaw);

        const userRaw = localStorage.getItem("currentUser");
        const user = userRaw ? JSON.parse(userRaw) : null;
        let myIds = new Set<number>();
        if (user && user.id) {
          const resp = await axios.get(`${base}/api/v1/users/${user.id}/courses?_t=${ts}`, { timeout: 8000 }).catch(() => ({ data: [] }));
          const enrolledList = toCourseArray(resp.data);
          myIds = new Set(enrolledList.map((c: any) => c.id));
        }

        const withStatus = all.map(c => ({
          ...c,
          price_status: myIds.has(c.id) ? "Enrolled" : (c.price_status || (c.price && c.price > 0 ? "Paid" : "Free"))
        }));
        setCourses(withStatus);
        setDisplayedCourses(withStatus);
      } catch (e: any) {
        setError(String(e?.message || e));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [location]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedTerm(searchTerm), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    if (debouncedTerm == null) return;
    const doSearch = async () => {
      const term = debouncedTerm.trim();
      if (!term) { setDisplayedCourses(courses); setSearchLoading(false); return; }

      const client = courses.filter(c =>
        (c.title + " " + (c.description || "")).toLowerCase().includes(term.toLowerCase()) || String(c.id).includes(term)
      );
      setDisplayedCourses(client);
      setSearchLoading(true);

      try {
        const ts = Date.now();
        const base = API_URL.replace(/\/$/, "");
        const serverRaw = await fetchCourses(term, ts).catch(() =>
          axios.get(`${base}/api/v1/courses?q=${encodeURIComponent(term)}&_t=${ts}`, { timeout: 8000 }).then(r => r.data).catch(() => [])
        );
        const server = toCourseArray(serverRaw);
        const seen = new Set<number>();
        const unique: Course[] = [];
        for (const it of server) {
          if (!seen.has(it.id)) { seen.add(it.id); unique.push(it); }
        }
        setDisplayedCourses(unique);
      } catch (e) {
        console.warn('Server search failed, using client results', e);
      } finally {
        setSearchLoading(false);
      }
    };
    doSearch();
  }, [debouncedTerm, courses]);

  return (
    <div className="sl-app">
      <Header />
      <div className="sl-layout">
        <Sidebar />
        <main className="sl-main">
          {/* Page title */}
          <div className="sl-catalog-header">
            <h1 className="sl-catalog-header__title">Каталог курсов</h1>
            <div className="sl-catalog-header__search">
              <span className="sl-catalog-header__search-icon">🔍</span>
              <input
                type="text"
                placeholder="Поиск курсов по названию или описанию"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="sl-catalog-header__input"
              />
            </div>
          </div>

          {/* Category filter tabs */}
          <div className="sl-catalog-filters">
            {categoryFilters.map(cat => (
              <button
                key={cat}
                className={`sl-catalog-filter ${activeCategory === cat ? 'sl-catalog-filter--active' : ''}`}
                onClick={() => setActiveCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Sort + count */}
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
          {searchLoading && <div className="sl-loading">Поиск...</div>}

          {!loading && !error && (
            <div className="sl-catalog-grid">
              {displayedCourses.length > 0 ? (
                displayedCourses.map(c => <CatalogCourseCard key={c.id} course={c} />)
              ) : (
                <div className="sl-empty">Курсы не найдены</div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
