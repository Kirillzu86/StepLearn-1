import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { API_URL, completeLesson } from "../../api/api";
import { useParams, Link } from "react-router-dom";
import { marked } from "marked";
import { FiLock, FiUnlock, FiCheckCircle, FiUsers, FiArrowRight } from "react-icons/fi";
import Header from "../Header/Header";
import Sidebar from "../Sidebar/sidebar";
import "../HomePage/StyleHomePage.css";
import "../Sidebar/StyleSidebar.css";
import "./StyleCourseDetail.css";

// Интерфейсы данных
interface Answer {
  id: number;
  text: string;
  is_correct: boolean;
}

interface Question {
  id: number;
  text: string;
  answers: Answer[];
}

interface LessonData {
  id: number;
  title: string;
  description?: string;
  content: string;
  order: number;
  is_locked?: boolean;
  lock_reason?: string;
  is_completed?: boolean;
  group_progress_info?: {
    prev_lesson_title: string;
    passed_students: number;
    total_students: number;
    completion_percentage: number;
  };
}

interface CourseDetailData {
  id: number;
  title: string;
  description: string;
  price?: number;
  course_type?: string;
  content?: string;
  questions: Question[];
  lessons?: LessonData[];
  group_info?: { id: number; name: string } | null;
}

interface CourseDetailProps {
  theme: "dark" | "light";
  toggleTheme: () => void;
}

function CourseDetail({ theme, toggleTheme }: CourseDetailProps) {
  const { id } = useParams<{ id: string }>();
  const [course, setCourse] = useState<CourseDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isDarkTheme = theme === "dark";

  // Режим чтения для текстовых / Markdown курсов
  const [isReadingMode, setIsReadingMode] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  // Состояния для прохождения теста
  const [activeQuestionIndex, setActiveQuestionIndex] = useState<number | null>(null);
  const [selectedAnswerId, setSelectedAnswerId] = useState<number | null>(null);
  const [isAnswerChecked, setIsAnswerChecked] = useState(false);
  const [correctAnswersCount, setCorrectAnswersCount] = useState(0);
  const [lastResult, setLastResult] = useState<{ correct: number; total: number } | null>(null);

  const [isEnrolled, setIsEnrolled] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);

  // Состояния модулей (Stepik / Cisco Gating)
  const [activeLessonId, setActiveLessonId] = useState<number | null>(null);
  const [unlockBanner, setUnlockBanner] = useState<string | null>(null);

  const fetchCourse = async () => {
    try {
      const base = API_URL.replace(/\/$/, "");
      const userStr = localStorage.getItem("currentUser");
      const currentUser = userStr ? JSON.parse(userStr) : null;
      const userParam = currentUser ? `?user_id=${currentUser.id}` : "";

      const response = await axios.get<CourseDetailData>(`${base}/v1/course/${id}${userParam}`);
      const courseData = response.data;
      if (courseData) {
        courseData.questions = Array.isArray(courseData.questions) ? courseData.questions : [];
        courseData.lessons = Array.isArray(courseData.lessons) ? courseData.lessons : [];
      }
      setCourse(courseData);

      // Инициализируем активный урок
      const lessons = courseData.lessons;
      if (lessons && lessons.length > 0) {
        setActiveLessonId((prev) => {
          if (prev && lessons.some((l) => l.id === prev)) return prev;
          // Находим первый незавершенный или первый открытый
          const firstIncomplete = lessons.find((l) => !l.is_completed && !l.is_locked);
          return firstIncomplete ? firstIncomplete.id : lessons[0].id;
        });
      }

      // Проверяем запись на курс и сохраненный прогресс
      if (currentUser) {
        try {
          axios
            .get(`${base}/v1/users/${currentUser.id}/courses`)
            .then((res) => {
              if (Array.isArray(res.data) && res.data.some((c: any) => c.id === courseData.id)) {
                setIsEnrolled(true);
              }
            })
            .catch(() => {});

          const progMap = currentUser.enrolledProgress || {};
          const saved = progMap[String(courseData.id)];
          if (saved) {
            if (saved.progress_percentage === 100) {
              setIsCompleted(true);
            }
            if (typeof saved.currentIndex === "number" && courseData.questions.length > 0) {
              if (
                saved.currentIndex >= courseData.questions.length &&
                typeof saved.correctAnswers === "number"
              ) {
                setLastResult({
                  correct: saved.correctAnswers,
                  total: courseData.questions.length,
                });
              } else if (saved.currentIndex < courseData.questions.length) {
                setActiveQuestionIndex(saved.currentIndex);
              }
              if (typeof saved.correctAnswers === "number") {
                setCorrectAnswersCount(saved.correctAnswers);
              }
            }
          }
        } catch (e) {
          console.warn("Не удалось восстановить прогресс из localStorage", e);
        }
      }
    } catch (err) {
      console.error(err);
      setError("Не удалось загрузить курс. Возможно, он не существует.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchCourse();
  }, [id]);

  const handleCompleteLesson = async (lessonId: number) => {
    const userStr = localStorage.getItem("currentUser");
    if (!userStr) {
      alert("Войдите в систему, чтобы сохранять прогресс");
      return;
    }
    const user = JSON.parse(userStr);
    try {
      const res = await completeLesson(lessonId, user.id);
      if (res.unlocked_next) {
        setUnlockBanner(
          `🎉 Поздравляем! Вся группа завершила этот модуль! Следующий модуль «${res.next_lesson?.title || ""}» теперь открыт.`
        );
      }
      fetchCourse();
    } catch (e) {
      alert("Не удалось зафиксировать прохождение урока");
    }
  };

  // Подсчет времени чтения и структуры глав (TOC) из Markdown
  const readingStats = useMemo(() => {
    if (!course?.content) return { minutes: 1, headings: [] };
    const words = course.content.trim().split(/\s+/).length;
    const minutes = Math.max(1, Math.ceil(words / 180));

    const lines = course.content.split("\n");
    const headings: Array<{ level: number; text: string; id: string }> = [];
    lines.forEach((line, idx) => {
      const match = line.match(/^(#{1,3})\s+(.+)$/);
      if (match) {
        const level = match[1].length;
        const text = match[2].trim();
        const id = `heading-${idx}-${text.toLowerCase().replace(/[^a-z0-9а-яё]+/gi, "-")}`;
        headings.push({ level, text, id });
      }
    });
    return { minutes, headings };
  }, [course?.content]);

  // Сгенерированный HTML со связными ID заголовков для перехода по содержанию
  const renderedHtml = useMemo(() => {
    if (!course?.content) return "";
    let html = marked.parse(course.content) as string;
    let idx = 0;
    html = html.replace(/<h([1-3])>(.*?)<\/h\1>/gi, (_match, level, contentText) => {
      const cleanText = contentText.replace(/<[^>]*>/g, "").trim();
      const headingId = `heading-${idx++}-${cleanText.toLowerCase().replace(/[^a-z0-9а-яё]+/gi, "-")}`;
      return `<h${level} id="${headingId}">${contentText}</h${level}>`;
    });
    return html;
  }, [course?.content]);

  // Запись на курс и переход в обучение
  const startLearning = async () => {
    if (!course) return;

    const userStr = localStorage.getItem("currentUser");
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        const base = API_URL.replace(/\/$/, "");
        await axios.post(`${base}/api/v1/enroll`, {
          user_id: user.id,
          course_id: course.id,
        });

        const resp = await axios.get(`${base}/api/v1/users/${user.id}/courses`).catch(() => null);
        const enrolledIds = resp && Array.isArray(resp.data) ? resp.data.map((c: any) => c.id) : [];
        const progMap = user.enrolledProgress || {};
        if (!progMap[String(course.id)]) {
          progMap[String(course.id)] = { currentIndex: 0, progress_percentage: 10 };
        }
        const updatedUser = { ...user, enrolledCourseIds: enrolledIds, enrolledProgress: progMap };
        localStorage.setItem("currentUser", JSON.stringify(updatedUser));
        setIsEnrolled(true);
      } catch (e) {
        console.error("Не удалось записаться на курс:", e);
      }
    }

    // Если есть текст — открываем режим чтения
    if (course.content && course.content.trim()) {
      setIsReadingMode(true);
      setActiveQuestionIndex(null);
    } else if (course.questions && course.questions.length > 0) {
      // Иначе если только вопросы — открываем тест
      setCorrectAnswersCount(0);
      setActiveQuestionIndex(0);
      setIsAnswerChecked(false);
      setSelectedAnswerId(null);
      setLastResult(null);
    } else {
      alert("В этом курсе пока нет материалов для изучения.");
    }
  };

  const handleStartClick = () => {
    if (!course) return;
    if (!course.content && (!course.questions || course.questions.length === 0)) {
      alert("В этом курсе пока нет материалов или вопросов.");
      return;
    }

    if (isEnrolled || !course.price || course.price === 0 || lastResult || isCompleted) {
      startLearning();
    } else {
      setShowPayment(true);
    }
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentProcessing(true);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    setPaymentProcessing(false);
    setShowPayment(false);
    startLearning();
  };

  // Завершение изучения текстового курса
  const completeTextCourse = async () => {
    if (!course) return;
    setIsCompleted(true);

    const userStr = localStorage.getItem("currentUser");
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        const base = API_URL.replace(/\/$/, "");
        const progMap = user.enrolledProgress || {};
        progMap[String(course.id)] = {
          currentIndex: readingStats.headings.length || 1,
          progress_percentage: 100,
        };
        const updatedUser = { ...user, enrolledProgress: progMap };
        localStorage.setItem("currentUser", JSON.stringify(updatedUser));

        await axios
          .post(`${base}/api/v1/users/${user.id}/courses/${course.id}/progress`, {
            progress_percentage: 100,
            completed_lessons: readingStats.headings.length || 1,
          })
          .catch(() => {});
      } catch (e) {
        console.warn("Не удалось сохранить статус завершения курса", e);
      }
    }
  };

  // Обработчики теста с вопросами
  const checkAnswer = () => {
    if (selectedAnswerId !== null) {
      setIsAnswerChecked(true);
      if (course && activeQuestionIndex !== null) {
        const question = course.questions[activeQuestionIndex];
        const answer = question.answers.find((a) => a.id === selectedAnswerId);
        if (answer?.is_correct) {
          setCorrectAnswersCount((prev) => prev + 1);
        }
      }
    }
  };

  const nextQuestion = () => {
    if (course && activeQuestionIndex !== null) {
      const base = API_URL.replace(/\/$/, "");
      if (activeQuestionIndex < course.questions.length - 1) {
        const nextIndex = activeQuestionIndex + 1;
        setActiveQuestionIndex(nextIndex);

        const userStr = localStorage.getItem("currentUser");
        if (userStr) {
          try {
            const user = JSON.parse(userStr);
            const progMap = user.enrolledProgress || {};
            const percent = Math.round((nextIndex / course.questions.length) * 100);
            progMap[String(course.id)] = {
              currentIndex: nextIndex,
              progress_percentage: percent,
              correctAnswers: correctAnswersCount,
            };
            const updatedUser = { ...user, enrolledProgress: progMap };
            localStorage.setItem("currentUser", JSON.stringify(updatedUser));

            axios
              .post(`${base}/api/v1/users/${user.id}/courses/${course.id}/progress`, {
                currentIndex: nextIndex,
                progress_percentage: percent,
              })
              .catch(() => {});
          } catch (e) {
            console.warn("Не удалось сохранить прогресс теста", e);
          }
        }
        setIsAnswerChecked(false);
        setSelectedAnswerId(null);
      } else {
        const finalCorrect = correctAnswersCount;
        const totalQuestions = course.questions.length;
        setLastResult({ correct: finalCorrect, total: totalQuestions });
        setIsCompleted(true);

        const userStr = localStorage.getItem("currentUser");
        if (userStr) {
          try {
            const user = JSON.parse(userStr);
            const progMap = user.enrolledProgress || {};
            progMap[String(course.id)] = {
              currentIndex: course.questions.length,
              progress_percentage: 100,
              correctAnswers: finalCorrect,
            };
            const updatedUser = { ...user, enrolledProgress: progMap };
            localStorage.setItem("currentUser", JSON.stringify(updatedUser));
            axios
              .post(`${base}/api/v1/users/${user.id}/courses/${course.id}/progress`, {
                currentIndex: course.questions.length,
                progress_percentage: 100,
              })
              .catch(() => {});
          } catch (e) {
            console.warn("Не удалось сохранить итоговый прогресс", e);
          }
        }
        setActiveQuestionIndex(null);
      }
    }
  };

  const scrollToHeading = (elementId: string) => {
    const el = document.getElementById(elementId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const backgroundStyle: React.CSSProperties = {
    minHeight: "100vh",
    backgroundColor: isDarkTheme ? "#030712" : "#f8fafc",
    backgroundImage: isDarkTheme
      ? "radial-gradient(circle at 50% 0%, #3b82f640, #030712 35%)"
      : "radial-gradient(circle at 50% 0%, #e2e8f040, #f8fafc 35%)",
  };

  if (loading)
    return (
      <div style={backgroundStyle}>
        <div className="loading-state">Загрузка курса...</div>
      </div>
    );
  if (error || !course)
    return (
      <div style={backgroundStyle}>
        <div className="error-state">{error || "Курс не найден"}</div>
      </div>
    );

  const hasMarkdown = Boolean(course.content && course.content.trim());
  const hasQuestions = Boolean(course.questions && course.questions.length > 0);

  return (
    <div className="sl-app">
      <Header />
      <div className="sl-layout">
        <Sidebar />
        <main className="sl-main">
            <div className="content-header">
              {isReadingMode || activeQuestionIndex !== null ? (
                <button
                  type="button"
                  className="back-link"
                  style={{ background: "none", border: "none", cursor: "pointer" }}
                  onClick={() => {
                    setIsReadingMode(false);
                    setActiveQuestionIndex(null);
                  }}
                >
                  ← К описанию курса
                </button>
              ) : (
                <Link to="/catalog" className="back-link">
                  ← Назад в каталог
                </Link>
              )}
            </div>

            <div className="course-detail-container">
              {/* --- БАННЕР РАЗБЛОКИРОВКИ СЛЕДУЮЩЕГО МОДУЛЯ --- */}
              {unlockBanner && (
                <div className="celebrate-banner">
                  {unlockBanner}
                  <button
                    style={{
                      background: "none",
                      border: "none",
                      color: "#34d399",
                      marginLeft: 12,
                      cursor: "pointer",
                      fontWeight: "bold",
                    }}
                    onClick={() => setUnlockBanner(null)}
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* --- БАННЕР ПРИВЯЗКИ К УЧЕБНОЙ ГРУППЕ --- */}
              {course.group_info && (
                <div className="group-indicator-banner">
                  <FiUsers style={{ fontSize: "1.3rem" }} />
                  <span>
                    Вы изучаете этот курс в составе учебной группы: <strong>{course.group_info.name}</strong>.
                    Доступ к следующим модулям регулируется преподавателем или открывается при 100% сдаче группой.
                  </span>
                </div>
              )}

              {/* --- МОДУЛЬНЫЙ КУРС (STEPIK / CISCO) --- */}
              {course.lessons && course.lessons.length > 0 ? (
                <div className="modular-course-container">
                  <div className="course-header-block" style={{ marginBottom: 0 }}>
                    <div className="course-type-badge" style={{ background: "rgba(99,102,241,0.2)", color: "#818cf8" }}>
                      🎓 Модульный курс (Stepik / Cisco NetAcad)
                    </div>
                    <h1 className="course-title-large" style={{ margin: "6px 0 10px 0" }}>
                      {course.title}
                    </h1>
                    <p className="course-description-large" style={{ marginBottom: 12 }}>
                      {course.description}
                    </p>
                  </div>

                  {/* Горизонтальная панель модулей */}
                  <div className="modular-nav">
                    {course.lessons.map((lesson) => {
                      const isCurrent = (activeLessonId || course.lessons![0].id) === lesson.id;
                      return (
                        <button
                          key={lesson.id}
                          type="button"
                          className={`module-nav-item ${isCurrent ? "active" : ""} ${
                            lesson.is_locked ? "locked" : ""
                          } ${lesson.is_completed ? "completed" : ""}`}
                          onClick={() => setActiveLessonId(lesson.id)}
                        >
                          {lesson.is_completed ? (
                            <FiCheckCircle style={{ color: "#10b981" }} />
                          ) : lesson.is_locked ? (
                            <FiLock style={{ color: "#f59e0b" }} />
                          ) : (
                            <FiUnlock style={{ color: "#3b82f6" }} />
                          )}
                          <span>
                            Модуль {lesson.order}: {lesson.title}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Контент выбранного модуля */}
                  {(() => {
                    const activeLesson =
                      course.lessons.find((l) => l.id === activeLessonId) || course.lessons[0];
                    if (!activeLesson) return null;

                    if (activeLesson.is_locked) {
                      return (
                        <div className="module-locked-screen">
                          <div className="locked-icon-large">🔒</div>
                          <div className="locked-title">Модуль заблокирован преподавателем</div>
                          <div className="locked-description">
                            {activeLesson.lock_reason ||
                              "Доступ к этому материалу еще не открыт для вашей группы."}
                          </div>

                          {activeLesson.group_progress_info && (
                            <div className="group-progress-box">
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  fontSize: "0.9rem",
                                  marginBottom: 8,
                                }}
                              >
                                <span>
                                  Предыдущий модуль:{" "}
                                  <strong>{activeLesson.group_progress_info.prev_lesson_title}</strong>
                                </span>
                                <span>
                                  Сдали: {activeLesson.group_progress_info.passed_students} из{" "}
                                  {activeLesson.group_progress_info.total_students} студентов (
                                  {activeLesson.group_progress_info.completion_percentage}%)
                                </span>
                              </div>
                              <div className="progress-bar-container">
                                <div
                                  className="progress-bar-fill partial"
                                  style={{
                                    width: `${activeLesson.group_progress_info.completion_percentage}%`,
                                  }}
                                />
                              </div>
                              <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", margin: "10px 0 0" }}>
                                💡 Доступ откроется автоматически, когда все студенты вашей группы завершат
                                предыдущий модуль, либо когда преподаватель откроет его вручную в панели
                                управления.
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    }

                    return (
                      <div className="reading-main-card">
                        <div style={{ marginBottom: 20 }}>
                          <span
                            style={{
                              fontSize: "0.85rem",
                              color: "#6366f1",
                              fontWeight: 700,
                              textTransform: "uppercase",
                            }}
                          >
                            Модуль {activeLesson.order}
                          </span>
                          <h2 style={{ margin: "4px 0 10px 0", fontSize: "1.6rem" }}>
                            {activeLesson.title}
                          </h2>
                          {activeLesson.description && (
                            <p style={{ color: "var(--text-secondary)", margin: 0 }}>{activeLesson.description}</p>
                          )}
                        </div>

                        {activeLesson.content && (
                          <div
                            className="markdown-rendered-content"
                            dangerouslySetInnerHTML={{
                              __html: marked.parse(activeLesson.content) as string,
                            }}
                          />
                        )}

                        <div
                          style={{
                            marginTop: 32,
                            padding: "20px 0",
                            borderTop: "1px solid rgba(255,255,255,0.08)",
                            textAlign: "center",
                          }}
                        >
                          {activeLesson.is_completed ? (
                            <div style={{ color: "#10b981", fontWeight: 700, fontSize: "1.1rem" }}>
                              <FiCheckCircle style={{ verticalAlign: "middle", marginRight: 8 }} />
                              Вы успешно завершили этот модуль!
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="complete-course-btn"
                              onClick={() => handleCompleteLesson(activeLesson.id)}
                            >
                              ✓ Завершить модуль
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ) : isReadingMode && hasMarkdown ? (
                <div>
                  <div className="course-header-block" style={{ marginBottom: 20 }}>
                    <div className="course-type-badge">📖 Текстовый курс (Markdown)</div>
                    <h1 className="course-title-large" style={{ margin: "6px 0 12px 0" }}>
                      {course.title}
                    </h1>
                    <div className="course-meta-row">
                      <span className="course-meta-item">⏱ ~{readingStats.minutes} мин чтения</span>
                      {readingStats.headings.length > 0 && (
                        <span className="course-meta-item">
                          📑 {readingStats.headings.length} разделов
                        </span>
                      )}
                      {isCompleted && (
                        <span
                          className="course-meta-item"
                          style={{ color: "#22c55e", fontWeight: "bold" }}
                        >
                          ✓ Пройдено
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="reading-layout">
                    {/* Боковое содержание курса (TOC) */}
                    {readingStats.headings.length > 0 && (
                      <div className="reading-toc-sidebar">
                        <div className="toc-title">📑 Содержание</div>
                        <div className="toc-list">
                          {readingStats.headings.map((h, i) => (
                            <div
                              key={i}
                              className={`toc-item level-${h.level}`}
                              onClick={() => scrollToHeading(h.id)}
                            >
                              {h.text}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Основной текст курса */}
                    <div className="reading-main-card">
                      <div
                        className="markdown-rendered-content"
                        dangerouslySetInnerHTML={{ __html: renderedHtml }}
                      />

                      {/* Карточка завершения или перехода к тесту */}
                      <div
                        className={`course-completion-card ${isCompleted ? "completed" : ""}`}
                      >
                        {isCompleted ? (
                          <>
                            <div style={{ fontSize: "2rem" }}>🎉</div>
                            <h3 style={{ margin: 0 }}>Поздравляем! Вы завершили этот курс!</h3>
                            <p style={{ margin: 0, color: isDarkTheme ? "#9ca3af" : "#64748b" }}>
                              Материал отмечен как изученный (100% прогресс).
                            </p>
                          </>
                        ) : (
                          <>
                            <h3 style={{ margin: 0 }}>Закончили чтение материалов курса?</h3>
                            <p style={{ margin: 0, color: isDarkTheme ? "#9ca3af" : "#64748b" }}>
                              Нажмите кнопку ниже, чтобы зафиксировать 100% прогресс в профиле.
                            </p>
                            <button
                              type="button"
                              className="complete-course-btn"
                              onClick={completeTextCourse}
                            >
                              ✓ Отметить курс как пройденный
                            </button>
                          </>
                        )}

                        {hasQuestions && (
                          <div style={{ marginTop: 14 }}>
                            <button
                              type="button"
                              className="start-course-btn"
                              onClick={() => {
                                setIsReadingMode(false);
                                setActiveQuestionIndex(0);
                                setCorrectAnswersCount(0);
                                setIsAnswerChecked(false);
                                setSelectedAnswerId(null);
                              }}
                            >
                              Пройти тест по материалу ({course.questions.length} вопросов) →
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : activeQuestionIndex === null ? (
                // --- РЕЖИМ ОБЗОРА КУРСА ---
                <>
                  <div className="course-header-block">
                    {hasMarkdown && !hasQuestions && (
                      <div className="course-type-badge">📖 Текстовый курс (Markdown)</div>
                    )}
                    {hasQuestions && !hasMarkdown && (
                      <div className="course-type-badge quiz">📝 Интерактивный тест</div>
                    )}
                    {hasMarkdown && hasQuestions && (
                      <div className="course-type-badge">
                        📚 Комплексный курс (Теория + Тест)
                      </div>
                    )}

                    <h1 className="course-title-large">{course.title}</h1>
                    <p className="course-description-large">{course.description}</p>

                    <div className="course-meta-row">
                      {hasMarkdown && (
                        <span className="course-meta-item">⏱ ~{readingStats.minutes} мин чтения</span>
                      )}
                      {course.price !== undefined && (
                        <span
                          className="course-meta-item"
                          style={{
                            fontWeight: "bold",
                            color: course.price > 0 ? (isDarkTheme ? "#f97316" : "#2563eb") : "#22c55e",
                          }}
                        >
                          {course.price > 0 ? `Цена: ${course.price} ₽` : "Бесплатно"}
                        </span>
                      )}
                      {isEnrolled && (
                        <span className="course-meta-item" style={{ color: "#22c55e" }}>
                          ✓ Вы записаны
                        </span>
                      )}
                      {isCompleted && (
                        <span className="course-meta-item" style={{ color: "#22c55e", fontWeight: "bold" }}>
                          🏆 Пройден (100%)
                        </span>
                      )}
                    </div>

                    {lastResult && (
                      <div className="course-result-block" style={{ marginBottom: 20 }}>
                        <h2 className="result-title">Ваш результат тестирования</h2>
                        <div className="result-stats">
                          <p>
                            ✅ Правильных ответов: {lastResult.correct} из {lastResult.total}
                          </p>
                          <p>❌ Неправильных ответов: {lastResult.total - lastResult.correct}</p>
                        </div>
                      </div>
                    )}

                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 10 }}>
                      <button className="start-course-btn" onClick={handleStartClick}>
                        {hasMarkdown
                          ? isCompleted
                            ? "Читать снова"
                            : "Начать чтение курса"
                          : lastResult
                          ? "Пройти тест еще раз"
                          : "Начать обучение"}
                      </button>

                      {hasMarkdown && hasQuestions && (
                        <button
                          className="type-tab-btn"
                          onClick={() => {
                            if (isEnrolled || !course.price || course.price === 0) {
                              setActiveQuestionIndex(0);
                              setCorrectAnswersCount(0);
                              setIsAnswerChecked(false);
                              setSelectedAnswerId(null);
                            } else {
                              setShowPayment(true);
                            }
                          }}
                        >
                          Перейти сразу к тесту ({course.questions.length} вопр.)
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Программа курса: разделы текста или список вопросов */}
                  <div className="lessons-list-section">
                    <h2>
                      {hasMarkdown && !hasQuestions
                        ? `Содержание курса (${readingStats.headings.length || 1} разд.)`
                        : `Программа курса (${course.questions.length} уроков)`}
                    </h2>
                    <div className="lessons-list">
                      {hasMarkdown && !hasQuestions ? (
                        readingStats.headings.length > 0 ? (
                          readingStats.headings.map((h, index) => (
                            <div
                              key={index}
                              className="lesson-item"
                              style={{ cursor: "pointer" }}
                              onClick={handleStartClick}
                            >
                              <span className="lesson-number">{index + 1}</span>
                              <span className="lesson-text">
                                {h.level === 1 ? "📖 " : "▫️ "} {h.text}
                              </span>
                              <span className="lesson-status">✓</span>
                            </div>
                          ))
                        ) : (
                          <div
                            className="lesson-item"
                            style={{ cursor: "pointer" }}
                            onClick={handleStartClick}
                          >
                            <span className="lesson-number">1</span>
                            <span className="lesson-text">📖 Полный текст курса</span>
                            <span className="lesson-status">✓</span>
                          </div>
                        )
                      ) : course.questions.length === 0 ? (
                        <p className="empty-lessons">В этом курсе пока нет уроков.</p>
                      ) : (
                        course.questions.map((q, index) => (
                          <div key={q.id} className="lesson-item">
                            <span className="lesson-number">{index + 1}</span>
                            <span className="lesson-text">{q.text}</span>
                            <span className="lesson-status">🔒</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              ) : (
                // --- РЕЖИМ ПРОХОЖДЕНИЯ ТЕСТА ---
                <div className="course-header-block">
                  <div style={{ marginBottom: "20px", color: isDarkTheme ? "#9ca3af" : "#666" }}>
                    Вопрос {activeQuestionIndex + 1} из {course.questions.length}
                  </div>
                  <h2 className="course-title-large" style={{ fontSize: "1.8rem" }}>
                    {course.questions[activeQuestionIndex].text}
                  </h2>

                  <div className="lessons-list" style={{ marginTop: "20px" }}>
                    {course.questions[activeQuestionIndex].answers.map((answer) => {
                      let itemStyle: React.CSSProperties = {};
                      if (isAnswerChecked) {
                        if (answer.is_correct)
                          itemStyle = {
                            border: "2px solid #22c55e",
                            background: isDarkTheme ? "rgba(34, 197, 94, 0.2)" : "#f0fdf4",
                          };
                        else if (selectedAnswerId === answer.id)
                          itemStyle = {
                            border: "2px solid #ef4444",
                            background: isDarkTheme ? "rgba(239, 68, 68, 0.2)" : "#fef2f2",
                          };
                      } else if (selectedAnswerId === answer.id) {
                        itemStyle = {
                          border: "2px solid #3b82f6",
                          background: isDarkTheme ? "rgba(59, 130, 246, 0.2)" : "#eff6ff",
                        };
                      }

                      return (
                        <div
                          key={answer.id}
                          className="lesson-item"
                          style={{ cursor: "pointer", ...itemStyle }}
                          onClick={() => !isAnswerChecked && setSelectedAnswerId(answer.id)}
                        >
                          <span className="lesson-text">{answer.text}</span>
                          {isAnswerChecked && answer.is_correct && <span>✅</span>}
                          {isAnswerChecked &&
                            !answer.is_correct &&
                            selectedAnswerId === answer.id && <span>❌</span>}
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ marginTop: "30px", display: "flex", gap: 12 }}>
                    {!isAnswerChecked ? (
                      <button
                        className="start-course-btn"
                        onClick={checkAnswer}
                        disabled={selectedAnswerId === null}
                      >
                        Проверить ответ
                      </button>
                    ) : (
                      <button className="start-course-btn" onClick={nextQuestion}>
                        {activeQuestionIndex < course.questions.length - 1
                          ? "Следующий вопрос →"
                          : "Завершить тест"}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Модальное окно оплаты */}
              {showPayment && course && (
                <div className="modal-overlay">
                  <div className="modal-content">
                    <h2 style={{ marginTop: 0 }}>Оплата курса</h2>
                    <p style={{ marginBottom: "1rem", color: isDarkTheme ? "#9ca3af" : "#666" }}>
                      Вы покупаете курс <strong>«{course.title}»</strong>
                    </p>
                    <div style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: "1.5rem" }}>
                      {course.price} ₽
                    </div>
                    <form onSubmit={handlePaymentSubmit} className="payment-form">
                      <input
                        className="payment-input"
                        placeholder="Номер карты (0000 0000 0000 0000)"
                        required
                        pattern="\d*"
                        minLength={16}
                      />
                      <div className="payment-row">
                        <input className="payment-input" placeholder="MM/YY" required style={{ width: "50%" }} />
                        <input
                          className="payment-input"
                          placeholder="CVC"
                          required
                          maxLength={3}
                          style={{ width: "50%" }}
                        />
                      </div>
                      <button type="submit" className="pay-confirm-btn" disabled={paymentProcessing}>
                        {paymentProcessing ? "Обработка..." : `Оплатить ${course.price} ₽`}
                      </button>
                      <button
                        type="button"
                        className="pay-cancel-btn"
                        onClick={() => setShowPayment(false)}
                      >
                        Отмена
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
  );
}

export default CourseDetail;