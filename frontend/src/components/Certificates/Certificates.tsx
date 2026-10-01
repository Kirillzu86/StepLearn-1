import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { FiAward, FiPrinter } from "react-icons/fi";
import { fetchCourseLearningProgress, fetchStudentCourses } from "../../api/api";
import type { StudentCourseSummary } from "../../api/api";
import Header from "../Header/Header";
import Sidebar from "../Sidebar/sidebar";
import "../HomePage/StyleHomePage.css";
import "../Sidebar/StyleSidebar.css";
import "./StyleCertificates.css";

interface CompletedCourse extends StudentCourseSummary {
  completedAt: string | null;
}

function getCertificatesError(error: unknown) {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 401) return "Сессия истекла. Войдите снова.";
    if (error.response?.status === 403) return "У вас нет доступа к сертификатам.";
    if (!error.response) return "Нет подключения к серверу. Проверьте интернет и попробуйте снова.";
    const detail = error.response.data?.detail;
    if (typeof detail === "string") return detail;
  }
  return error instanceof Error
    ? error.message
    : "Не удалось загрузить сертификаты. Попробуйте ещё раз.";
}

function getCompletedAt(
  sections: NonNullable<Awaited<ReturnType<typeof fetchCourseLearningProgress>>["learning_progress"]>["sections"],
) {
  const dates = sections.flatMap((section) => [
    ...section.lessons.flatMap((lesson) => [
      ...(lesson.completed_at ? [lesson.completed_at] : []),
      ...lesson.assignments.flatMap((assignment) =>
        assignment.submitted_at ? [assignment.submitted_at] : [],
      ),
    ]),
    ...section.assignments.flatMap((assignment) =>
      assignment.submitted_at ? [assignment.submitted_at] : [],
    ),
  ]);
  const timestamps = dates
    .map((date) => Date.parse(date))
    .filter((timestamp) => Number.isFinite(timestamp));
  return timestamps.length ? new Date(Math.max(...timestamps)).toISOString() : null;
}

export default function Certificates() {
  const [certificates, setCertificates] = useState<CompletedCourse[]>([]);
  const [studentName, setStudentName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCertificates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const raw = localStorage.getItem("currentUser");
      const user = raw
        ? JSON.parse(raw) as { id?: number; role?: string; username?: string; first_name?: string; last_name?: string }
        : null;
      if (!user?.id || user.role !== "student") {
        setCertificates([]);
        setError("Войдите в аккаунт ученика, чтобы посмотреть сертификаты.");
        return;
      }

      const userId = user.id;
      const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ");
      setStudentName(fullName || user.username || "Ученик");
      const courses = await fetchStudentCourses(userId);
      const progressResults = await Promise.all(
        courses.map(async (course) => ({
          course,
          progress: await fetchCourseLearningProgress(userId, course.id),
        })),
      );
      setCertificates(
        progressResults.flatMap(({ course, progress }) => {
          const learningProgress = progress.learning_progress;
          return learningProgress?.is_completed
            ? [{ ...course, completedAt: getCompletedAt(learningProgress.sections) }]
            : [];
        }),
      );
    } catch (loadError) {
      setError(getCertificatesError(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCertificates();
  }, [loadCertificates]);

  return (
    <div className="sl-app">
      <Header />
      <div className="sl-layout certificates-layout">
        <Sidebar />
        <main className="sl-main certificates-main">
          <header className="certificates-header">
            <h1>Мои сертификаты</h1>
            <p>Сертификаты доступны для курсов, завершение которых подтверждено платформой.</p>
          </header>

          {loading ? (
            <div className="certificates-state" role="status">Загрузка сертификатов...</div>
          ) : error ? (
            <div className="certificates-state" role="alert">
              <p>{error}</p>
              <button type="button" onClick={() => void loadCertificates()}>Повторить</button>
              {error.includes("Войдите") || error.includes("Сессия") ? (
                <Link to="/login">Перейти ко входу</Link>
              ) : null}
            </div>
          ) : certificates.length === 0 ? (
            <div className="certificates-state">
              <FiAward aria-hidden="true" />
              <h2>Сертификатов пока нет</h2>
              <p>Завершите назначенный курс, чтобы сертификат появился здесь.</p>
              <Link to="/my-courses">Перейти к моим курсам</Link>
            </div>
          ) : (
            <div className="certificates-grid">
              {certificates.map((certificate) => (
                <article className="certificate-card" key={certificate.id}>
                  <div className="certificate-card__ornament" aria-hidden="true">
                    <FiAward />
                  </div>
                  <p className="certificate-card__eyebrow">StepLearn · сертификат об окончании</p>
                  <h2>Сертификат</h2>
                  <p className="certificate-card__intro">Настоящим подтверждается, что</p>
                  <p className="certificate-card__student">{studentName}</p>
                  <p className="certificate-card__intro">успешно завершил(а) курс</p>
                  <p className="certificate-card__course">{certificate.title}</p>
                  <p className="certificate-card__date">
                    {certificate.completedAt
                      ? new Date(certificate.completedAt).toLocaleDateString("ru-RU", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })
                      : "Дата завершения не указана"}
                  </p>
                  <Link className="certificate-card__course-link" to={`/course/${certificate.id}`}>
                    Открыть курс
                  </Link>
                  <button
                    className="certificate-card__print"
                    type="button"
                    onClick={() => window.print()}
                  >
                    <FiPrinter aria-hidden="true" />
                    Распечатать
                  </button>
                </article>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
