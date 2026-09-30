import React, { useState } from "react";
import Header from "../Header/Header";
import Sidebar from "../Sidebar/sidebar";
import { FiCalendar as FiCalIcon, FiClock, FiVideo, FiBook, FiCheckCircle, FiChevronLeft, FiChevronRight } from "react-icons/fi";
import "../HomePage/StyleHomePage.css";
import "../Sidebar/StyleSidebar.css";
import "./StyleCalendar.css";

interface CalendarEvent {
  id: number;
  date: number; // day of month
  title: string;
  course: string;
  time: string;
  type: "webinar" | "deadline" | "exam";
}

const eventList: CalendarEvent[] = [
  { id: 1, date: 2, title: "Онлайн-вебинар: Разбор асинхронности в JS", course: "JavaScript Advanced", time: "18:00 - 19:30", type: "webinar" },
  { id: 2, date: 5, title: "Дедлайн: Парсер вакансий на Python", course: "Python Backend", time: "До 23:59", type: "deadline" },
  { id: 3, date: 12, title: "Финальный экзамен: Базы данных SQL", course: "SQL & PostgreSQL", time: "15:00 - 16:30", type: "exam" },
  { id: 4, date: 18, title: "Мастер-класс: Адаптивная верстка с CSS Grid", course: "Frontend Dev", time: "19:00 - 20:30", type: "webinar" },
  { id: 5, date: 25, title: "Дедлайн проекта: Реактивный интернет-магазин", course: "React & TS", time: "До 23:59", type: "deadline" },
];

export default function Calendar({ theme, toggleTheme }: { theme: "dark" | "light"; toggleTheme: () => void }) {
  const [selectedDay, setSelectedDay] = useState<number>(2);

  const daysInMonth = Array.from({ length: 30 }, (_, i) => i + 1);

  const selectedEvents = eventList.filter((e) => e.date === selectedDay);

  const getTypeBadge = (type: CalendarEvent["type"]) => {
    switch (type) {
      case "webinar":
        return <span className="sl-cal-badge sl-cal-badge--webinar"><FiVideo /> Вебинар</span>;
      case "deadline":
        return <span className="sl-cal-badge sl-cal-badge--deadline"><FiClock /> Дедлайн</span>;
      case "exam":
        return <span className="sl-cal-badge sl-cal-badge--exam"><FiCheckCircle /> Экзамен</span>;
    }
  };

  return (
    <div className="sl-app">
      <Header />
      <div className="sl-layout">
        <Sidebar />
        <main className="sl-main">
          <div className="sl-cal-container">
            <div className="sl-cal-header">
              <div>
                <h1 className="sl-cal-title">Календарь обучения</h1>
                <p className="sl-cal-subtitle">Расписание вебинаров, сдачи работ и экзаменов</p>
              </div>

              <div className="sl-cal-month-nav">
                <button className="sl-cal-nav-btn"><FiChevronLeft /></button>
                <span className="sl-cal-month-name">Октябрь 2026</span>
                <button className="sl-cal-nav-btn"><FiChevronRight /></button>
              </div>
            </div>

            <div className="sl-cal-layout">
              {/* Calendar Grid */}
              <div className="sl-cal-grid-card">
                <div className="sl-cal-weekdays">
                  <span>Пн</span><span>Вт</span><span>Ср</span><span>Чт</span><span>Пт</span><span>Сб</span><span>Вс</span>
                </div>

                <div className="sl-cal-days-grid">
                  {daysInMonth.map((day) => {
                    const hasEvent = eventList.some((e) => e.date === day);
                    const isSelected = selectedDay === day;

                    return (
                      <button
                        key={day}
                        className={`sl-cal-day-cell ${isSelected ? "sl-cal-day-cell--selected" : ""} ${hasEvent ? "sl-cal-day-cell--has-event" : ""}`}
                        onClick={() => setSelectedDay(day)}
                      >
                        <span className="sl-cal-day-num">{day}</span>
                        {hasEvent && <span className="sl-cal-event-dot" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Selected Day Events Sidebar */}
              <div className="sl-cal-events-card">
                <h2 className="sl-cal-events-title">События {selectedDay} октября</h2>

                <div className="sl-cal-events-list">
                  {selectedEvents.length > 0 ? (
                    selectedEvents.map((evt) => (
                      <div key={evt.id} className="sl-cal-event-item">
                        <div className="sl-cal-event-top">
                          {getTypeBadge(evt.type)}
                          <span className="sl-cal-event-time">{evt.time}</span>
                        </div>
                        <h3 className="sl-cal-event-item-title">{evt.title}</h3>
                        <div className="sl-cal-event-course"><FiBook /> {evt.course}</div>
                      </div>
                    ))
                  ) : (
                    <div className="sl-empty sl-cal-empty">
                      На {selectedDay} октября занятий не запланировано ☕
                    </div>
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
