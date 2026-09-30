import React, { useState, useEffect } from "react";
import axios from "axios";
import { API_URL } from "../../api/api";
import Header from "../Header/Header";
import Sidebar from "../Sidebar/sidebar";
import { Link } from "react-router-dom";
import { FiBook, FiPlayCircle, FiCheckCircle } from "react-icons/fi";
import "../HomePage/StyleHomePage.css";
import "../Sidebar/StyleSidebar.css";
import "./StyleMyCourses.css";

interface Course {
  id: number;
  title: string;
  description: string;
  progress_percentage?: number;
  completed_lessons?: number;
  total_lessons?: number;
  category?: string;
}

export default function MyCourses({ theme, toggleTheme }: { theme: "dark" | "light"; toggleTheme: () => void }) {
  const [myCourses, setMyCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "in_progress" | "completed">("all");

  useEffect(() => {
    const loadMyCourses = async () => {
      try {
        const raw = localStorage.getItem("currentUser");
        const user = raw ? JSON.parse(raw) : null;
        if (!user || !user.id) {
          setLoading(false);
          return;
        }

        const base = API_URL.replace(/\/$/, "");
        const resp = await axios.get(`${base}/api/v1/users/${user.id}/courses`).catch(() => ({ data: [] }));
        const list = Array.isArray(resp.data) ? resp.data : (resp.data?.data || []);
        setMyCourses(list);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadMyCourses();
  }, []);

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
