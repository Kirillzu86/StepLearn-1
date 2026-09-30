import React from "react";
import Header from "../Header/Header";
import Sidebar from "../Sidebar/sidebar";
import { Link } from "react-router-dom";
import { FiBriefcase, FiCheck, FiArrowRight, FiClock, FiStar, FiLayers } from "react-icons/fi";
import "../HomePage/StyleHomePage.css";
import "../Sidebar/StyleSidebar.css";
import "./StyleProfessions.css";

interface Profession {
  id: string;
  title: string;
  category: string;
  description: string;
  duration: string;
  level: string;
  rating: number;
  coursesCount: number;
  skills: string[];
  color: string;
  icon: string;
}

const professionList: Profession[] = [
  {
    id: "frontend",
    title: "Frontend-разработчик",
    category: "IT и программирование",
    description: "Создавайте современные веб-интерфейсы и интерактивные сайты с помощью HTML, CSS, JavaScript, React и TypeScript.",
    duration: "6 месяцев",
    level: "С нуля",
    rating: 4.9,
    coursesCount: 5,
    skills: ["HTML5 / CSS3", "JavaScript ES6+", "React", "TypeScript", "Vite & Webpack", "Git"],
    color: "#4F46E5",
    icon: "💻",
  },
  {
    id: "backend-python",
    title: "Backend-разработчик на Python",
    category: "IT и программирование",
    description: "Проектируйте архитектуру веб-сервисов, работайте с базами данных PostgreSQL и разрабатывайте API на Django и FastAPI.",
    duration: "7 месяцев",
    level: "С нуля",
    rating: 4.8,
    coursesCount: 6,
    skills: ["Python 3", "Django / FastAPI", "PostgreSQL / Redis", "REST API", "Docker", "Asyncio"],
    color: "#10B981",
    icon: "🐍",
  },
  {
    id: "data-analyst",
    title: "Аналитик данных",
    category: "Бизнес и управление",
    description: "Анализируйте большие массивы данных, стройте визуализации и дашборды для принятия бизнес-решений.",
    duration: "5 месяцев",
    level: "Начальный",
    rating: 4.7,
    coursesCount: 4,
    skills: ["SQL", "Python (Pandas, NumPy)", "Tableau / PowerBI", "Статистика", "A/B тестирование"],
    color: "#F97316",
    icon: "📊",
  },
  {
    id: "uiux-designer",
    title: "UI/UX Дизайнер",
    category: "Дизайн",
    description: "Создавайте удобные пользовательские сценарии, прототипы в Figma и дизайн-системы для сайтов и мобильных приложений.",
    duration: "4 месяца",
    level: "С нуля",
    rating: 4.9,
    coursesCount: 4,
    skills: ["Figma", "User Research", "Wireframing", "Дизайн-системы", "Интерактивные прототипы"],
    color: "#EC4899",
    icon: "🎨",
  },
];

export default function Professions({ theme, toggleTheme }: { theme: "dark" | "light"; toggleTheme: () => void }) {
  return (
    <div className="sl-app">
      <Header />
      <div className="sl-layout">
        <Sidebar />
        <main className="sl-main">
          <div className="sl-prof-container">
            {/* Header */}
            <div className="sl-prof-header">
              <span className="sl-prof-tag">Путь к карьере</span>
              <h1 className="sl-prof-title">Востребованные профессии</h1>
              <p className="sl-prof-desc">
                Комплексные программы обучения с нуля до трудоустройства. Содержат практические проекты, тесты и сертификаты.
              </p>
            </div>

            {/* Grid */}
            <div className="sl-prof-grid">
              {professionList.map((prof) => (
                <div key={prof.id} className="sl-prof-card">
                  <div className="sl-prof-card-top">
                    <div className="sl-prof-icon-bg" style={{ background: `${prof.color}15`, color: prof.color }}>
                      <span style={{ fontSize: "2rem" }}>{prof.icon}</span>
                    </div>
                    <div className="sl-prof-badge" style={{ background: `${prof.color}15`, color: prof.color }}>
                      {prof.category}
                    </div>
                  </div>

                  <h2 className="sl-prof-card-title">{prof.title}</h2>
                  <p className="sl-prof-card-desc">{prof.description}</p>

                  <div className="sl-prof-meta">
                    <span><FiClock /> {prof.duration}</span>
                    <span><FiLayers /> {prof.coursesCount} курсов</span>
                    <span><FiStar style={{ color: "#F59E0B" }} /> {prof.rating}</span>
                  </div>

                  <div className="sl-prof-skills">
                    <div className="sl-prof-skills-title">Навыки в программе:</div>
                    <div className="sl-prof-skills-tags">
                      {prof.skills.map((skill, idx) => (
                        <span key={idx} className="sl-prof-skill-tag">
                          <FiCheck /> {skill}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="sl-prof-card-footer">
                    <Link to="/catalog" className="sl-prof-btn" style={{ background: prof.color }}>
                      Открыть программу <FiArrowRight />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
