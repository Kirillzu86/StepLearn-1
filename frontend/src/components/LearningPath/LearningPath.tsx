import React from "react";
import Header from "../Header/Header";
import Sidebar from "../Sidebar/sidebar";
import { Link } from "react-router-dom";
import { FiCheckCircle, FiPlayCircle, FiLock, FiArrowRight } from "react-icons/fi";
import "../HomePage/StyleHomePage.css";
import "../Sidebar/StyleSidebar.css";
import "./StyleLearningPath.css";

interface Step {
  number: number;
  title: string;
  desc: string;
  status: "completed" | "current" | "locked";
  courses: string[];
  duration: string;
}

const pathSteps: Step[] = [
  {
    number: 1,
    title: "Основы веб-технологий и алгоритмов",
    desc: "Изучение базовых концепций программирования, структуры HTML-страниц, стилей CSS и алгоритмического мышления.",
    status: "completed",
    courses: ["Введение в веб-разработку", "Основы Git и GitHub"],
    duration: "3 недели",
  },
  {
    number: 2,
    title: "Программирование на JavaScript / Python",
    desc: "Глубокое освоение синтаксиса, работы с функциями, массивами, объектами и асинхронными запросами.",
    status: "current",
    courses: ["JavaScript с нуля до PRO", "Продвинутый Python"],
    duration: "5 недель",
  },
  {
    number: 3,
    title: "Работа с фреймворками и базами данных",
    desc: "Разработка полнофункциональных веб-приложений с использованием React, Node.js или Django.",
    status: "locked",
    courses: ["Разработка на React & Redux Toolkit", "Базы данных и SQL"],
    duration: "6 недель",
  },
  {
    number: 4,
    title: "Дипломный проект и подготовка к собеседованию",
    desc: "Создание финального веб-приложения для портфолио, ревью кода ментором и составление резюме.",
    status: "locked",
    courses: ["Финальный командный проект", "Карьерный трек"],
    duration: "4 недели",
  },
];

export default function LearningPath() {
  return (
    <div className="sl-app">
      <Header />
      <div className="sl-layout">
        <Sidebar />
        <main className="sl-main sl-page-shell">
          <div className="sl-lp-container">
            <div className="sl-lp-header">
              <span className="sl-lp-tag">Персональная траектория</span>
              <h1 className="sl-lp-title">Путь обучения</h1>
              <p className="sl-lp-subtitle">
                Пошаговый план развития от начального уровня до квалифицированного специалиста.
              </p>
            </div>

            {/* Progress summary banner */}
            <div className="sl-lp-summary">
              <div className="sl-lp-summary-info">
                <h3>Общий прогресс трека</h3>
                <p>Пройдено 1 из 4 этапов (25%)</p>
              </div>
              <div className="sl-lp-progress-bar-wrap">
                <div className="sl-lp-progress-bar" style={{ width: "25%" }} />
              </div>
            </div>

            {/* Timeline Steps */}
            <div className="sl-lp-timeline">
              {pathSteps.map((step) => (
                <div key={step.number} className={`sl-lp-step sl-lp-step--${step.status}`}>
                  <div className="sl-lp-step-node">
                    {step.status === "completed" ? (
                      <FiCheckCircle className="sl-lp-node-icon sl-lp-node-icon--done" />
                    ) : step.status === "current" ? (
                      <FiPlayCircle className="sl-lp-node-icon sl-lp-node-icon--active" />
                    ) : (
                      <FiLock className="sl-lp-node-icon sl-lp-node-icon--locked" />
                    )}
                  </div>

                  <div className="sl-lp-step-card">
                    <div className="sl-lp-step-top">
                      <span className="sl-lp-step-num">Этап {step.number}</span>
                      <span className="sl-lp-step-dur">{step.duration}</span>
                    </div>

                    <h2 className="sl-lp-step-title">{step.title}</h2>
                    <p className="sl-lp-step-desc">{step.desc}</p>

                    <div className="sl-lp-step-courses">
                      <div className="sl-lp-step-courses-label">Курсы на этапе:</div>
                      <ul>
                        {step.courses.map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    </div>

                    {step.status === "current" && (
                      <Link to="/catalog" className="sl-lp-btn">
                        Продолжить этап <FiArrowRight />
                      </Link>
                    )}
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
