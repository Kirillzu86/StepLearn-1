import { useCallback, useEffect, useState, type FormEvent } from "react";
import axios from "axios";
import {
  downloadTeacherSubmissionFile,
  fetchAssignmentSubmissions,
  fetchCourseAssignments,
  fetchTeacherCourses,
  fetchTeacherStudents,
  gradeTeacherSubmission,
} from "../../api/api";
import type { StudentAssignmentSubmission } from "../../api/api";

interface SubmissionRow extends StudentAssignmentSubmission {
  assignment_type: "text" | "short_answer" | "quiz" | "multiple_choice" | "file_upload" | "code";
  assignment_title: string;
  assignment_points: number;
  course_title: string;
  student_label: string;
}

interface GradingDraft {
  submissionId: number;
  score: string;
  feedback: string;
}

function formatSubmittedAt(value: string): string {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp)
    ? "Дата неизвестна"
    : new Date(timestamp).toLocaleString();
}

function requestErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error) && error.response?.status === 401) {
    return "Сессия истекла. Войдите в аккаунт преподавателя и повторите попытку.";
  }
  if (axios.isAxiosError(error) && error.response?.status === 403) {
    return "Недостаточно прав для просмотра или изменения этих работ.";
  }
  return fallback;
}

export default function TeacherSubmissionsPanel() {
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [grading, setGrading] = useState<GradingDraft | null>(null);
  const [savingGrade, setSavingGrade] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchSubmissions = useCallback(async (): Promise<SubmissionRow[]> => {
    const [courses, students] = await Promise.all([
      fetchTeacherCourses(),
      fetchTeacherStudents(),
    ]);
    const studentLabels = new Map<number, string>(
      students.map((student: {
          id: number;
          first_name?: string;
          last_name?: string;
          username?: string;
      }) => [
        student.id,
        [student.first_name, student.last_name].filter(Boolean).join(" ")
          || student.username
          || `Ученик #${student.id}`,
      ]),
    );
    const assignmentsByCourse = await Promise.all(
      courses.map(async (course) => ({
        course,
        assignments: await fetchCourseAssignments(course.id),
      })),
    );
    const rows = await Promise.all(
      assignmentsByCourse.flatMap(({ course, assignments }) =>
        assignments.map(async (assignment) => {
          const assignmentSubmissions = await fetchAssignmentSubmissions(assignment.id);
          return assignmentSubmissions.map((submission) => ({
            ...submission,
            assignment_title: assignment.title,
            assignment_type: assignment.assignment_type,
            assignment_points: assignment.points,
            course_title: course.title,
            student_label: studentLabels.get(submission.student_id)
              ?? `Ученик #${submission.student_id}`,
          }));
        }),
      ),
    );
    return rows.flat().sort(
      (left, right) => Date.parse(right.submitted_at) - Date.parse(left.submitted_at),
    );
  }, []);

  const refreshSubmissions = async () => {
    setLoading(true);
    setError(null);
    try {
      setSubmissions(await fetchSubmissions());
    } catch (loadError) {
      console.error("Не удалось загрузить ответы учеников:", loadError);
      setError(requestErrorMessage(
        loadError,
        "Не удалось загрузить отправленные работы. Проверьте подключение и повторите попытку.",
      ));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    fetchSubmissions()
      .then((rows) => {
        if (active) setSubmissions(rows);
      })
      .catch((loadError: unknown) => {
        console.error("Не удалось загрузить ответы учеников:", loadError);
        if (active) {
          setError(requestErrorMessage(
            loadError,
            "Не удалось загрузить отправленные работы. Проверьте подключение и повторите попытку.",
          ));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetchSubmissions]);

  const saveGrade = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!grading) return;
    const score = Number(grading.score);
    const submission = submissions.find((item) => item.id === grading.submissionId);
    if (
      !submission
      || !Number.isInteger(score)
      || score < 0
      || score > submission.assignment_points
    ) {
      setActionError("Укажите целую оценку от 0 до максимума задания.");
      return;
    }

    setSavingGrade(true);
    setActionError(null);
    try {
      await gradeTeacherSubmission(grading.submissionId, {
        score,
        feedback: grading.feedback,
      });
      setGrading(null);
      await refreshSubmissions();
    } catch (gradeError) {
      console.error("Не удалось сохранить оценку:", gradeError);
      setActionError(requestErrorMessage(
        gradeError,
        "Не удалось сохранить оценку. Проверьте подключение и повторите попытку.",
      ));
    } finally {
      setSavingGrade(false);
    }
  };

  const downloadFile = async (submission: SubmissionRow) => {
    setActionError(null);
    try {
      const file = await downloadTeacherSubmissionFile(submission.id);
      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = submission.original_file_name || `submission-${submission.id}`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      console.error("Не удалось скачать файл ответа:", downloadError);
      setActionError(requestErrorMessage(
        downloadError,
        "Не удалось скачать вложение. Проверьте подключение и повторите попытку.",
      ));
    }
  };

  return (
    <section aria-labelledby="teacher-submissions-title">
      <div className="section-header-row" style={{ marginBottom: 20 }}>
        <h2 id="teacher-submissions-title" style={{ fontSize: "1.4rem", margin: 0 }}>
          Отправленные работы
        </h2>
        <button className="btn-secondary" onClick={() => void refreshSubmissions()} disabled={loading}>
          Обновить
        </button>
      </div>

      {actionError && <div className="error-state" role="alert">{actionError}</div>}
      {error && (
        <div className="error-state" role="alert">
          {error}{" "}
          <button className="btn-secondary" onClick={() => void refreshSubmissions()}>
            Повторить
          </button>
        </div>
      )}
      {loading && <div role="status">Загружаем отправленные работы...</div>}
      {!loading && !error && submissions.length === 0 && (
        <div className="empty-state">Отправленных работ пока нет.</div>
      )}
      {!loading && !error && submissions.length > 0 && (
        <div className="teacher-submissions-list">
          {submissions.map((submission) => (
            <article className="teacher-submission-card" key={submission.id}>
              <div className="teacher-submission-card__header">
                <div>
                  <h3>{submission.assignment_title}</h3>
                  <p>{submission.course_title} · {submission.student_label}</p>
                </div>
                <span>{submission.assignment_type === "code"
                  ? ({
                      pending: "В очереди",
                      running: "Выполняется",
                      passed: "Все тесты пройдены",
                      failed: "Не все тесты пройдены",
                      timeout: "Таймаут",
                      runtime_error: "Ошибка выполнения",
                      compile_error: "Ошибка компиляции",
                      system_error: "Системная ошибка",
                      submitted: "Отправлено",
                      graded: "Проверено",
                    }[submission.status])
                  : submission.status === "graded" ? "Проверено" : "Ожидает проверки"}</span>
              </div>
              <p className="teacher-submission-card__date">
                Отправлено: {formatSubmittedAt(submission.submitted_at)}
              </p>
              {submission.answer_text && (
                <pre className="teacher-submission-answer">{submission.answer_text}</pre>
              )}
              {submission.has_file && (
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={() => void downloadFile(submission)}
                >
                  Скачать файл: {submission.original_file_name || "вложение"}
                </button>
              )}
              {submission.score !== null && (
                <p>Оценка: {submission.score} / {submission.assignment_points}</p>
              )}
              {submission.assignment_type === "code" && submission.tests_total != null && (
                <p>
                  Пройдено тестов: {submission.tests_passed ?? 0} / {submission.tests_total}
                  {submission.execution_time_ms != null && ` · ${submission.execution_time_ms} мс`}
                </p>
              )}
              {submission.assignment_type === "code" && submission.error_message && (
                <p>{submission.error_message}</p>
              )}
              {submission.feedback && <p>Отзыв: {submission.feedback}</p>}
              {submission.assignment_type !== "code" && submission.status !== "graded" && (
                grading?.submissionId === submission.id ? (
                  <form className="teacher-submission-grade-form" onSubmit={saveGrade}>
                    <label>
                      Баллы (0–{submission.assignment_points})
                      <input
                        aria-label={`Баллы для ${submission.assignment_title}`}
                        type="number"
                        min={0}
                        max={submission.assignment_points}
                        step={1}
                        required
                        value={grading.score}
                        onChange={(event) => setGrading({ ...grading, score: event.target.value })}
                      />
                    </label>
                    <label>
                      Отзыв
                      <textarea
                        aria-label={`Отзыв для ${submission.assignment_title}`}
                        value={grading.feedback}
                        onChange={(event) => setGrading({ ...grading, feedback: event.target.value })}
                      />
                    </label>
                    <button className="btn-primary" type="submit" disabled={savingGrade}>
                      {savingGrade ? "Сохраняем..." : "Сохранить оценку"}
                    </button>
                    <button
                      className="btn-secondary"
                      type="button"
                      onClick={() => setGrading(null)}
                      disabled={savingGrade}
                    >
                      Отмена
                    </button>
                  </form>
                ) : (
                  <button
                    className="btn-primary"
                    type="button"
                    onClick={() => {
                      setActionError(null);
                      setGrading({
                        submissionId: submission.id,
                        score: "",
                        feedback: "",
                      });
                    }}
                  >
                    Проверить работу
                  </button>
                )
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
