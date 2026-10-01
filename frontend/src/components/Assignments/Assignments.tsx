import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import {
  fetchAssignmentSubmissions,
  fetchCourseAssignments,
  fetchStudentCourses,
  submitStudentAssignment,
} from "../../api/api";
import type {
  StudentAssignment,
  StudentAssignmentSubmission,
} from "../../api/api";
import Header from "../Header/Header";
import Sidebar from "../Sidebar/sidebar";
import { FiCheckCircle, FiClock, FiFileText, FiUploadCloud } from "react-icons/fi";
import "../HomePage/StyleHomePage.css";
import "../Sidebar/StyleSidebar.css";
import "./StyleAssignments.css";

type AssignmentWithSubmission = {
  assignment: StudentAssignment;
  courseTitle: string;
  latestSubmission: StudentAssignmentSubmission | null;
  attemptsUsed: number;
};

type CourseSummary = { id: number; title: string };
type Filter = "all" | "pending" | "submitted" | "graded";

function getRequestError(error: unknown) {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 401) return "Войдите в аккаунт, чтобы увидеть задания.";
    if (error.response?.status === 403) return "Нет доступа к заданиям. Проверьте, что курс назначен вам.";
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (!error.response) return "Не удалось подключиться к серверу. Проверьте интернет и попробуйте снова.";
  }
  return "Не удалось загрузить задания. Попробуйте ещё раз.";
}

function assignmentState(item: AssignmentWithSubmission): Exclude<Filter, "all"> {
  if (!item.latestSubmission) return "pending";
  return item.latestSubmission.status === "graded" ? "graded" : "submitted";
}

function AssignmentCard({
  item,
  onSubmitted,
}: {
  item: AssignmentWithSubmission;
  onSubmitted: (submission: StudentAssignmentSubmission) => void;
}) {
  const { assignment } = item;
  const [isOpen, setIsOpen] = useState(false);
  const [answer, setAnswer] = useState("");
  const [selectedOptions, setSelectedOptions] = useState<Record<number, number[]>>({});
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const attemptsLeft = Math.max(0, assignment.max_attempts - item.attemptsUsed);
  const isPastDue = Boolean(assignment.due_at && new Date(assignment.due_at) < new Date());
  const canSubmit = attemptsLeft > 0 && !isPastDue;
  const state = assignmentState(item);

  const toggleOption = (questionId: number, optionId: number, multiple: boolean) => {
    setSelectedOptions((previous) => {
      const selected = previous[questionId] || [];
      const next = multiple
        ? selected.includes(optionId)
          ? selected.filter((id) => id !== optionId)
          : [...selected, optionId]
        : [optionId];
      return { ...previous, [questionId]: next };
    });
  };

  const handleSubmit = async () => {
    setError(null);
    setSuccess(null);
    if (assignment.assignment_type === "file_upload" && !selectedFile) {
      setError("Выберите файл для отправки.");
      return;
    }
    if (
      (assignment.assignment_type === "text" || assignment.assignment_type === "short_answer") &&
      !answer.trim()
    ) {
      setError("Введите ответ перед отправкой.");
      return;
    }
    if (assignment.assignment_type === "code" && !answer.trim()) {
      setError("Добавьте исходный код перед отправкой.");
      return;
    }

    let payload:
      | { answer_text: string }
      | { source_code: string }
      | { answers: Array<{ question_id: number; option_ids: number[] }> }
      | { file: File };
    if (assignment.assignment_type === "file_upload") {
      if (!selectedFile) return;
      payload = { file: selectedFile };
    } else if (assignment.assignment_type === "quiz" || assignment.assignment_type === "multiple_choice") {
      payload = {
        answers: assignment.questions.map((question) => ({
          question_id: question.id,
          option_ids: selectedOptions[question.id] || [],
        })),
      };
      if (payload.answers.some((entry) => entry.option_ids.length === 0)) {
        setError("Ответьте на каждый вопрос.");
        return;
      }
    } else if (assignment.assignment_type === "code") {
      payload = { source_code: answer };
    } else {
      payload = { answer_text: answer };
    }

    setSubmitting(true);
    try {
      const submission = await submitStudentAssignment(assignment.id, payload);
      onSubmitted(submission);
      setSuccess(
        submission.score === null
          ? "Ответ отправлен на проверку."
          : `Ответ принят. Результат: ${submission.score} из ${assignment.points} баллов.`,
      );
      setIsOpen(false);
      setAnswer("");
      setSelectedOptions({});
      setSelectedFile(null);
    } catch (submitError) {
      setError(getRequestError(submitError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <article className="sl-ass-card">
      <div className="sl-ass-card-top">
        <span className="sl-ass-course">{item.courseTitle}</span>
        <span className={`sl-ass-status sl-ass-status--${state}`}>
          {state === "pending" && <><FiClock /> К сдаче</>}
          {state === "submitted" && <><FiFileText /> На проверке</>}
          {state === "graded" && (
            <><FiCheckCircle /> Оценено: {item.latestSubmission?.score ?? 0} / {assignment.points}</>
          )}
        </span>
      </div>
      <h2 className="sl-ass-card-title">{assignment.title}</h2>
      <p className="sl-ass-card-desc">{assignment.description || "Описание задания не добавлено."}</p>
      <div className="sl-ass-card-footer">
        <div className="sl-ass-meta">
          <span>Баллы: {assignment.points}</span>
          <span>Попыток осталось: {attemptsLeft}</span>
          {assignment.due_at && (
            <span>Срок: {new Date(assignment.due_at).toLocaleString()}</span>
          )}
        </div>
        {canSubmit && (
          <button
            type="button"
            className="sl-ass-submit-btn"
            onClick={() => {
              setError(null);
              setSuccess(null);
              setIsOpen((open) => !open);
            }}
          >
            <FiUploadCloud /> {isOpen ? "Скрыть форму" : item.attemptsUsed ? "Отправить ещё раз" : "Сдать работу"}
          </button>
        )}
      </div>

      {item.latestSubmission && (
        <div className="sl-ass-result" aria-live="polite">
          <strong>Последняя отправка:</strong>{" "}
          {new Date(item.latestSubmission.submitted_at).toLocaleString()}
          {item.latestSubmission.has_file && ` · Файл: ${item.latestSubmission.original_file_name}`}
          {item.latestSubmission.feedback && <p>{item.latestSubmission.feedback}</p>}
        </div>
      )}
      {success && <p className="sl-ass-message sl-ass-message--success" role="status">{success}</p>}
      {error && <p className="sl-ass-message sl-ass-message--error" role="alert">{error}</p>}

      {isOpen && canSubmit && (
        <div className="sl-ass-upload-box">
          <h3>{assignment.assignment_type === "code" ? `Решение на ${assignment.programming_language}` : "Сдача работы"}</h3>
          {assignment.assignment_type === "quiz" || assignment.assignment_type === "multiple_choice" ? (
            assignment.questions.map((question) => (
              <fieldset className="sl-ass-question" key={question.id}>
                <legend>{question.text}</legend>
                {question.options.map((option) => (
                  <label className="sl-ass-option" key={option.id}>
                    <input
                      type={assignment.assignment_type === "quiz" ? "radio" : "checkbox"}
                      name={`question-${assignment.id}-${question.id}`}
                      checked={(selectedOptions[question.id] || []).includes(option.id)}
                      onChange={() =>
                        toggleOption(
                          question.id,
                          option.id,
                          assignment.assignment_type === "multiple_choice",
                        )
                      }
                    />
                    {option.text}
                  </label>
                ))}
              </fieldset>
            ))
          ) : assignment.assignment_type === "file_upload" ? (
            <input
              type="file"
              accept=".pdf,.txt,.png,.jpg,.jpeg"
              onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
            />
          ) : (
            <>
              {assignment.assignment_type === "code" && assignment.starter_code && (
                <button
                  type="button"
                  className="sl-ass-cancel-btn"
                  onClick={() => setAnswer(assignment.starter_code)}
                >
                  Вставить начальный код
                </button>
              )}
              <textarea
                aria-label={assignment.assignment_type === "code" ? "Исходный код" : "Текстовый ответ"}
                placeholder={assignment.assignment_type === "code" ? "Введите решение..." : "Введите ваш ответ..."}
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                rows={assignment.assignment_type === "code" ? 12 : 5}
                maxLength={assignment.assignment_type === "code" ? 50000 : undefined}
              />
              {assignment.assignment_type === "code" && assignment.hints.length > 0 && (
                <details className="sl-ass-hints">
                  <summary>Подсказки</summary>
                  <ol>{assignment.hints.map((hint, index) => <li key={index}>{hint}</li>)}</ol>
                </details>
              )}
            </>
          )}
          <div className="sl-ass-upload-actions">
            <button
              type="button"
              className="sl-ass-submit-btn"
              disabled={submitting}
              onClick={handleSubmit}
            >
              {submitting ? "Отправка..." : "Отправить"}
            </button>
            <button
              type="button"
              className="sl-ass-cancel-btn"
              disabled={submitting}
              onClick={() => setIsOpen(false)}
            >
              Отмена
            </button>
          </div>
          {assignment.assignment_type === "file_upload" && (
            <small>Допустимы PDF, TXT, PNG и JPEG до 10 МБ.</small>
          )}
          {assignment.assignment_type === "code" && (
            <small>Код сохраняется для проверки преподавателем и не запускается на сервере.</small>
          )}
        </div>
      )}
      {!canSubmit && state === "pending" && (
        <p className="sl-ass-message">{isPastDue ? "Срок сдачи истёк." : "Попытки закончились."}</p>
      )}
    </article>
  );
}

export default function Assignments() {
  const [items, setItems] = useState<AssignmentWithSubmission[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isStudent, setIsStudent] = useState(true);

  const loadAssignments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const currentUserText = localStorage.getItem("currentUser");
      const currentUser = currentUserText ? JSON.parse(currentUserText) as { id?: number; role?: string } : null;
      if (!currentUser?.id) {
        setItems([]);
        setError("Войдите в аккаунт, чтобы увидеть назначенные задания.");
        return;
      }
      if (currentUser.role && currentUser.role !== "student") {
        setItems([]);
        setIsStudent(false);
        return;
      }
      setIsStudent(true);
      const courses = await fetchStudentCourses(currentUser.id) as CourseSummary[];
      const courseAssignments = await Promise.all(
        courses.map(async (course) => ({
          course,
          assignments: await fetchCourseAssignments(course.id),
        })),
      );
      const loaded = await Promise.all(courseAssignments.flatMap(({ course, assignments }) =>
        assignments.map(async (assignment) => {
          const submissions = await fetchAssignmentSubmissions(assignment.id);
          return {
            assignment,
            courseTitle: course.title,
            latestSubmission: submissions[0] || null,
            attemptsUsed: submissions.length,
          };
        }),
      ));
      setItems(loaded);
    } catch (loadError) {
      setError(getRequestError(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAssignments();
  }, [loadAssignments]);

  const counts = useMemo(() => ({
    all: items.length,
    pending: items.filter((item) => assignmentState(item) === "pending").length,
    submitted: items.filter((item) => assignmentState(item) === "submitted").length,
    graded: items.filter((item) => assignmentState(item) === "graded").length,
  }), [items]);
  const filteredItems = items.filter((item) => filter === "all" || assignmentState(item) === filter);

  const handleSubmitted = (assignmentId: number, submission: StudentAssignmentSubmission) => {
    setItems((previous) => previous.map((item) => item.assignment.id === assignmentId
      ? {
          ...item,
          latestSubmission: submission,
          attemptsUsed: item.attemptsUsed + 1,
        }
      : item,
    ));
  };

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
                Назначенные задания, отправки и результаты проверки.
              </p>
            </div>
            {loading ? (
              <div className="sl-loading" role="status">Загрузка заданий...</div>
            ) : error ? (
              <div className="sl-ass-empty" role="alert">
                <p>{error}</p>
                <button type="button" className="sl-ass-submit-btn" onClick={() => void loadAssignments()}>
                  Повторить
                </button>
              </div>
            ) : !isStudent ? (
              <div className="sl-ass-empty">
                Просмотр заданий здесь доступен ученикам. Перейдите в{" "}
                <Link to="/admin-panel">панель преподавателя</Link>.
              </div>
            ) : items.length === 0 ? (
              <div className="sl-ass-empty">
                <p>Пока нет заданий в назначенных курсах.</p>
                <Link to="/my-courses">Открыть мои курсы</Link>
              </div>
            ) : (
              <>
                <div className="sl-ass-tabs" role="tablist" aria-label="Фильтр заданий">
                  {([
                    ["all", "Все задания"],
                    ["pending", "К сдаче"],
                    ["submitted", "На проверке"],
                    ["graded", "Проверено"],
                  ] as const).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      role="tab"
                      aria-selected={filter === key}
                      className={`sl-ass-tab ${filter === key ? "sl-ass-tab--active" : ""}`}
                      onClick={() => setFilter(key)}
                    >
                      {label} ({counts[key]})
                    </button>
                  ))}
                </div>
                <div className="sl-ass-list">
                  {filteredItems.length ? filteredItems.map((item) => (
                    <AssignmentCard
                      key={item.assignment.id}
                      item={item}
                      onSubmitted={(submission) => handleSubmitted(item.assignment.id, submission)}
                    />
                  )) : (
                    <div className="sl-ass-empty">Заданий в этой категории пока нет.</div>
                  )}
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
