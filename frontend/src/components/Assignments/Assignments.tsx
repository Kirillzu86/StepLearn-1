import React, { useState } from "react";
import Header from "../Header/Header";
import Sidebar from "../Sidebar/sidebar";
import { FiClipboard, FiCheckCircle, FiClock, FiUploadCloud, FiFileText } from "react-icons/fi";
import "../HomePage/StyleHomePage.css";
import "../Sidebar/StyleSidebar.css";
import "./StyleAssignments.css";

interface Assignment {
  id: number;
  courseTitle: string;
  taskTitle: string;
  description: string;
  deadline: string;
  status: "pending" | "submitted" | "graded";
  grade?: string;
  maxGrade: string;
}

const initialAssignments: Assignment[] = [
  {
    id: 1,
    courseTitle: "Введение в Python",
    taskTitle: "Практический проект: Парсер вакансий hh.ru",
    description: "Разработайте скрипт на Python с использованием requests и BeautifulSoup для парсинга вакансий с сохранением в JSON.",
    deadline: "До 5 октября 2026",
    status: "pending",
    maxGrade: "100 баллов",
  },
  {
    id: 2,
    courseTitle: "React & TypeScript",
    taskTitle: "Лабораторная работа: Интерактивный Todo List с фильтрами",
    description: "Реализуйте приложение списка задач на React, с типизацией props и хранением данных в localStorage.",
    deadline: "До 28 сентября 2026",
    status: "submitted",
    maxGrade: "100 баллов",
  },
  {
    id: 3,
    courseTitle: "Основы верстки HTML & CSS",
    taskTitle: "Итоговая верстка: Адаптивный лендинг StepLearn",
    description: "Сверстайте макет адаптивного лендинга с использованием Flexbox и CSS Grid. Проверьте адаптив на мобильных устройствах.",
    deadline: "15 сентября 2026",
    status: "graded",
    grade: "95 / 100",
    maxGrade: "100 баллов",
  },
];

export default function Assignments({ theme, toggleTheme }: { theme: "dark" | "light"; toggleTheme: () => void }) {
  const [assignments, setAssignments] = useState<Assignment[]>(initialAssignments);
  const [filter, setFilter] = useState<"all" | "pending" | "submitted" | "graded">("all");

  const [activeUploadId, setActiveUploadId] = useState<number | null>(null);
  const [solutionText, setSolutionText] = useState("");

  const handleSubmitSolution = (id: number) => {
    if (!solutionText.trim()) return;
    setAssignments(assignments.map((a) => (a.id === id ? { ...a, status: "submitted" } : a)));
    setActiveUploadId(null);
    setSolutionText("");
  };

  const filtered = assignments.filter((a) => (filter === "all" ? true : a.status === filter));

  return (
    <div className="sl-app">
      <Header />
      <div className="sl-layout">
        <Sidebar />
        <main className="sl-main">
          <div className="sl-ass-container">
            <div className="sl-ass-header">
              <h1 className="sl-ass-title">Задания и проекты</h1>
              <p className="sl-ass-subtitle">
                Практические работы, курсовые проекты и тесты для проверки знаний.
              </p>
            </div>

            {/* Status Filter Tabs */}
            <div className="sl-ass-tabs">
              <button
                className={`sl-ass-tab ${filter === "all" ? "sl-ass-tab--active" : ""}`}
                onClick={() => setFilter("all")}
              >
                Все задания ({assignments.length})
              </button>
              <button
                className={`sl-ass-tab ${filter === "pending" ? "sl-ass-tab--active" : ""}`}
                onClick={() => setFilter("pending")}
              >
                К сдаче ({assignments.filter((a) => a.status === "pending").length})
              </button>
              <button
                className={`sl-ass-tab ${filter === "submitted" ? "sl-ass-tab--active" : ""}`}
                onClick={() => setFilter("submitted")}
              >
                На проверке ({assignments.filter((a) => a.status === "submitted").length})
              </button>
              <button
                className={`sl-ass-tab ${filter === "graded" ? "sl-ass-tab--active" : ""}`}
                onClick={() => setFilter("graded")}
              >
                Проверено ({assignments.filter((a) => a.status === "graded").length})
              </button>
            </div>

            {/* List */}
            <div className="sl-ass-list">
              {filtered.length > 0 ? (
                filtered.map((item) => (
                  <div key={item.id} className="sl-ass-card">
                    <div className="sl-ass-card-top">
                      <span className="sl-ass-course">{item.courseTitle}</span>
                      <span className={`sl-ass-status sl-ass-status--${item.status}`}>
                        {item.status === "pending" && <><FiClock /> К сдаче</>}
                        {item.status === "submitted" && <><FiFileText /> На проверке</>}
                        {item.status === "graded" && <><FiCheckCircle /> Оценено: {item.grade}</>}
                      </span>
                    </div>

                    <h2 className="sl-ass-card-title">{item.taskTitle}</h2>
                    <p className="sl-ass-card-desc">{item.description}</p>

                    <div className="sl-ass-card-footer">
                      <div className="sl-ass-meta">
                        <span>Срок: {item.deadline}</span>
                        <span>Макс. оценка: {item.maxGrade}</span>
                      </div>

                      {item.status === "pending" && (
                        <button
                          className="sl-ass-submit-btn"
                          onClick={() => setActiveUploadId(item.id)}
                        >
                          <FiUploadCloud /> Сдать работу
                        </button>
                      )}
                    </div>

                    {/* Inline Solution Form */}
                    {activeUploadId === item.id && (
                      <div className="sl-ass-upload-box">
                        <h3>Сдача работы</h3>
                        <textarea
                          placeholder="Вставьте ссылку на репозиторий GitHub или напишите ответ..."
                          value={solutionText}
                          onChange={(e) => setSolutionText(e.target.value)}
                          rows={3}
                        />
                        <div className="sl-ass-upload-actions">
                          <button
                            className="sl-ass-submit-btn"
                            onClick={() => handleSubmitSolution(item.id)}
                          >
                            Отправить на проверку
                          </button>
                          <button
                            className="sl-ass-cancel-btn"
                            onClick={() => setActiveUploadId(null)}
                          >
                            Отмена
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="sl-empty">Заданий в данной категории не найдено</div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
