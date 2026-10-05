import axios from "axios";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  createTeacherAssignment,
  deleteTeacherAssignment,
  fetchTeacherAssignments,
  updateTeacherAssignment,
} from "../../api/api";
import type {
  TeacherAssignment,
  TeacherAssignmentPayload,
  TeacherAssignmentQuestion,
  TeacherAssignmentType,
} from "../../api/api";

interface TeacherAssignmentsPanelProps {
  courseId: number;
}

interface AssignmentForm {
  title: string;
  description: string;
  assignment_type: TeacherAssignmentType;
  points: string;
  max_attempts: string;
  is_published: boolean;
  due_at: string;
  programming_language: "python" | "javascript";
  starter_code: string;
  hints: string;
  time_limit_seconds: string;
  memory_limit_mb: string;
  questions: TeacherAssignmentQuestion[];
  test_cases: Array<{ input_data: string; expected_output: string }>;
}

const assignmentTypeLabels: Record<TeacherAssignmentType, string> = {
  text: "Развёрнутый ответ",
  short_answer: "Краткий ответ",
  quiz: "Тест (один правильный ответ)",
  multiple_choice: "Тест (несколько правильных ответов)",
  file_upload: "Загрузка файла",
  code: "Программирование",
};

const emptyQuestion = (): TeacherAssignmentQuestion => ({
  text: "",
  options: [
    { text: "", is_correct: false },
    { text: "", is_correct: false },
  ],
});

function createEmptyForm(): AssignmentForm {
  return {
    title: "",
    description: "",
    assignment_type: "text",
    points: "100",
    max_attempts: "3",
    is_published: false,
    due_at: "",
    programming_language: "python",
    starter_code: "",
    hints: "",
    time_limit_seconds: "5",
    memory_limit_mb: "128",
    questions: [],
    test_cases: [],
  };
}

function toForm(assignment: TeacherAssignment): AssignmentForm {
  return {
    title: assignment.title,
    description: assignment.description,
    assignment_type: assignment.assignment_type,
    points: String(assignment.points),
    max_attempts: String(assignment.max_attempts),
    is_published: assignment.is_published,
    due_at: assignment.due_at
      ? new Date(assignment.due_at).toISOString().slice(0, 16)
      : "",
    programming_language: assignment.programming_language,
    starter_code: assignment.starter_code,
    hints: assignment.hints.join("\n"),
    time_limit_seconds: String(assignment.time_limit_seconds),
    memory_limit_mb: String(assignment.memory_limit_mb),
    questions: assignment.questions.map((question) => ({
      id: question.id,
      text: question.text,
      options: question.options.map((option) => ({
        id: option.id,
        text: option.text,
        is_correct: option.is_correct,
      })),
    })),
    test_cases: assignment.test_cases.map(({ input_data, expected_output }) => ({
      input_data,
      expected_output,
    })),
  };
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    if (status === 401) return "Сессия истекла. Войдите повторно.";
    if (status === 403) return "Недостаточно прав для управления заданиями этого курса.";
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (status === 409) return "Задание нельзя удалить: у него уже есть ответы учеников.";
  }
  return fallback;
}

function isObjective(type: TeacherAssignmentType): boolean {
  return type === "quiz" || type === "multiple_choice";
}

export default function TeacherAssignmentsPanel({ courseId }: TeacherAssignmentsPanelProps) {
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [form, setForm] = useState<AssignmentForm | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const requestAssignments = useCallback(async () => {
    return fetchTeacherAssignments(courseId);
  }, [courseId]);

  const refreshAssignments = async () => {
    setLoading(true);
    setListError(null);
    try {
      setAssignments(await requestAssignments());
    } catch (error) {
      console.error("Не удалось загрузить задания курса:", error);
      setListError(getErrorMessage(
        error,
        "Не удалось загрузить задания курса. Проверьте подключение и повторите попытку.",
      ));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    requestAssignments()
      .then((items) => {
        if (active) setAssignments(items);
      })
      .catch((error: unknown) => {
        console.error("Не удалось загрузить задания курса:", error);
        if (active) {
          setListError(getErrorMessage(
            error,
            "Не удалось загрузить задания курса. Проверьте подключение и повторите попытку.",
          ));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [requestAssignments]);

  const closeForm = () => {
    setForm(null);
    setEditingId(null);
    setActionError(null);
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form) return;
    setActionError(null);
    const points = Number(form.points);
    const maxAttempts = Number(form.max_attempts);
    if (!Number.isInteger(points) || points < 0) {
      setActionError("Баллы должны быть целым числом не меньше нуля.");
      return;
    }
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
      setActionError("Число попыток должно быть целым числом не меньше одного.");
      return;
    }
    if (isObjective(form.assignment_type)) {
      if (!form.questions.length) {
        setActionError("Добавьте хотя бы один вопрос.");
        return;
      }
      for (const [index, question] of form.questions.entries()) {
        const correctOptions = question.options.filter((option) => option.is_correct).length;
        if (!question.text.trim() || question.options.some((option) => !option.text.trim())) {
          setActionError(`Заполните вопрос ${index + 1} и все его варианты.`);
          return;
        }
        if (correctOptions === 0 || (form.assignment_type === "quiz" && correctOptions !== 1)) {
          setActionError(form.assignment_type === "quiz"
            ? `Для вопроса ${index + 1} отметьте ровно один правильный вариант.`
            : `Для вопроса ${index + 1} отметьте хотя бы один правильный вариант.`);
          return;
        }
      }
    }
    const payload: TeacherAssignmentPayload = {
      title: form.title.trim(),
      description: form.description.trim(),
      assignment_type: form.assignment_type,
      points,
      max_attempts: maxAttempts,
      is_published: form.is_published,
      due_at: form.due_at ? new Date(form.due_at).toISOString() : null,
      programming_language: form.programming_language,
      starter_code: form.starter_code,
      hints: form.hints.split("\n").map((hint) => hint.trim()).filter(Boolean),
      time_limit_seconds: Number(form.time_limit_seconds),
      memory_limit_mb: Number(form.memory_limit_mb),
      questions: isObjective(form.assignment_type)
        ? form.questions.map((question) => ({
            text: question.text.trim(),
            options: question.options.map((option) => ({
              text: option.text.trim(),
              is_correct: option.is_correct,
            })),
          }))
        : undefined,
      test_cases: form.assignment_type === "code"
        ? form.test_cases.map((testCase) => ({
            input_data: testCase.input_data,
            expected_output: testCase.expected_output,
          }))
        : undefined,
    };

    setSaving(true);
    try {
      if (editingId === null) {
        await createTeacherAssignment(courseId, payload);
      } else {
        await updateTeacherAssignment(editingId, payload);
      }
      closeForm();
      await refreshAssignments();
    } catch (error) {
      console.error("Не удалось сохранить задание:", error);
      setActionError(getErrorMessage(
        error,
        "Не удалось сохранить задание. Проверьте данные и повторите попытку.",
      ));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (assignment: TeacherAssignment) => {
    if (!window.confirm(`Удалить задание «${assignment.title}»? Это действие нельзя отменить.`)) {
      return;
    }
    setDeletingId(assignment.id);
    setActionError(null);
    try {
      await deleteTeacherAssignment(assignment.id);
      await refreshAssignments();
    } catch (error) {
      console.error("Не удалось удалить задание:", error);
      setActionError(getErrorMessage(
        error,
        "Не удалось удалить задание. Работы с уже отправленными ответами сохраняются.",
      ));
    } finally {
      setDeletingId(null);
    }
  };

  const updateQuestion = (
    questionIndex: number,
    updater: (question: TeacherAssignmentQuestion) => TeacherAssignmentQuestion,
  ) => {
    setForm((previous) => previous && ({
      ...previous,
      questions: previous.questions.map((question, index) => (
        index === questionIndex ? updater(question) : question
      )),
    }));
  };

  return (
    <section className="teacher-assignments-panel" aria-labelledby="teacher-assignments-title">
      <div className="section-header-row" style={{ margin: "24px 0 16px" }}>
        <h3 id="teacher-assignments-title">Задания курса</h3>
        <button
          className="btn-primary"
          type="button"
          onClick={() => {
            setActionError(null);
            setEditingId(null);
            setForm(createEmptyForm());
          }}
        >
          Создать задание
        </button>
      </div>

      {actionError && !form && <div role="alert" className="error-state">{actionError}</div>}
      {listError && (
        <div role="alert" className="error-state">
          {listError}{" "}
          <button className="btn-secondary" type="button" onClick={() => void refreshAssignments()}>
            Повторить
          </button>
        </div>
      )}
      {loading && <div role="status">Загружаем задания...</div>}
      {!loading && !listError && assignments.length === 0 && (
        <div className="empty-state">В этом курсе пока нет заданий.</div>
      )}
      {!loading && !listError && assignments.map((assignment) => (
        <article className="teacher-assignment-card" key={assignment.id}>
          <div>
            <h4>{assignment.title}</h4>
            <p>
              {assignmentTypeLabels[assignment.assignment_type]} · {assignment.points} баллов ·{" "}
              {assignment.is_published ? "Опубликовано" : "Черновик"}
            </p>
          </div>
          <div className="teacher-assignment-card__actions">
            <button
              className="btn-secondary"
              type="button"
              onClick={() => {
                setActionError(null);
                setEditingId(assignment.id);
                setForm(toForm(assignment));
              }}
            >
              Редактировать
            </button>
            <button
              className="btn-danger"
              type="button"
              disabled={deletingId === assignment.id}
              onClick={() => void handleDelete(assignment)}
            >
              {deletingId === assignment.id ? "Удаляем..." : "Удалить"}
            </button>
          </div>
        </article>
      ))}

      {form && (
        <form className="teacher-assignment-editor quick-actions-box" onSubmit={handleSave}>
          <h4>{editingId === null ? "Новое задание" : "Редактирование задания"}</h4>
          <label>
            Название
            <input
              required
              maxLength={255}
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
            />
          </label>
          <label>
            Описание
            <textarea
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
          </label>
          <label>
            Тип задания
            <select
              value={form.assignment_type}
              disabled={editingId !== null}
              onChange={(event) => setForm({
                ...form,
                assignment_type: event.target.value as TeacherAssignmentType,
                questions: [],
                test_cases: [],
              })}
            >
              {Object.entries(assignmentTypeLabels).map(([value, label]) => (
                <option value={value} key={value}>{label}</option>
              ))}
            </select>
          </label>
          {editingId !== null && (
            <p className="teacher-assignment-editor__hint">
              Тип существующего задания нельзя изменить. Создайте новое, если нужен другой формат.
            </p>
          )}
          <div className="teacher-assignment-editor__grid">
            <label>
              Баллы
              <input
                type="number"
                min={0}
                step={1}
                required
                value={form.points}
                onChange={(event) => setForm({ ...form, points: event.target.value })}
              />
            </label>
            <label>
              Максимум попыток
              <input
                type="number"
                min={1}
                step={1}
                required
                value={form.max_attempts}
                onChange={(event) => setForm({ ...form, max_attempts: event.target.value })}
              />
            </label>
            <label>
              Срок сдачи
              <input
                type="datetime-local"
                value={form.due_at}
                onChange={(event) => setForm({ ...form, due_at: event.target.value })}
              />
            </label>
          </div>
          <label className="teacher-assignment-editor__checkbox">
            <input
              type="checkbox"
              checked={form.is_published}
              onChange={(event) => setForm({ ...form, is_published: event.target.checked })}
            />
            Опубликовать задание
          </label>

          {isObjective(form.assignment_type) && (
            <div className="teacher-assignment-editor__nested">
              <h5>Вопросы и варианты ответов</h5>
              {form.questions.map((question, questionIndex) => (
                <fieldset className="teacher-assignment-question" key={question.id ?? questionIndex}>
                  <legend>Вопрос {questionIndex + 1}</legend>
                  <label>
                    Текст вопроса
                    <textarea
                      required
                      value={question.text}
                      onChange={(event) => updateQuestion(questionIndex, (item) => ({
                        ...item,
                        text: event.target.value,
                      }))}
                    />
                  </label>
                  {question.options.map((option, optionIndex) => (
                    <div className="teacher-assignment-option" key={option.id ?? optionIndex}>
                      <input
                        aria-label={`Вариант ${optionIndex + 1} вопроса ${questionIndex + 1}`}
                        required
                        value={option.text}
                        onChange={(event) => updateQuestion(questionIndex, (item) => ({
                          ...item,
                          options: item.options.map((current, index) => (
                            index === optionIndex ? { ...current, text: event.target.value } : current
                          )),
                        }))}
                      />
                      <label>
                        <input
                          type="checkbox"
                          checked={option.is_correct}
                          onChange={(event) => updateQuestion(questionIndex, (item) => ({
                            ...item,
                            options: item.options.map((current, index) => ({
                              ...current,
                              is_correct: index === optionIndex
                                ? event.target.checked
                                : form.assignment_type === "quiz" && event.target.checked
                                  ? false
                                  : current.is_correct,
                            })),
                          }))}
                        />
                        Верный ответ
                      </label>
                      {question.options.length > 2 && (
                        <button
                          className="btn-secondary"
                          type="button"
                          onClick={() => updateQuestion(questionIndex, (item) => ({
                            ...item,
                            options: item.options.filter((_, index) => index !== optionIndex),
                          }))}
                        >
                          Удалить вариант
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    className="btn-secondary"
                    type="button"
                    onClick={() => updateQuestion(questionIndex, (item) => ({
                      ...item,
                      options: [...item.options, { text: "", is_correct: false }],
                    }))}
                  >
                    Добавить вариант
                  </button>
                  <button
                    className="btn-danger"
                    type="button"
                    onClick={() => setForm((previous) => previous && ({
                      ...previous,
                      questions: previous.questions.filter((_, index) => index !== questionIndex),
                    }))}
                  >
                    Удалить вопрос
                  </button>
                </fieldset>
              ))}
              <button
                className="btn-secondary"
                type="button"
                onClick={() => setForm((previous) => previous && ({
                  ...previous,
                  questions: [...previous.questions, emptyQuestion()],
                }))}
              >
                Добавить вопрос
              </button>
            </div>
          )}

          {form.assignment_type === "code" && (
            <div className="teacher-assignment-editor__nested">
              <h5>Параметры Code Assignment</h5>
              <label>
                Язык
                <select
                  value={form.programming_language}
                  onChange={(event) => setForm({
                    ...form,
                    programming_language: event.target.value as "python" | "javascript",
                  })}
                >
                  <option value="python">Python</option>
                  <option value="javascript">JavaScript</option>
                </select>
              </label>
              <label>
                Начальный код
                <textarea
                  value={form.starter_code}
                  onChange={(event) => setForm({ ...form, starter_code: event.target.value })}
                />
              </label>
              <label>
                Подсказки (по одной на строку)
                <textarea
                  value={form.hints}
                  onChange={(event) => setForm({ ...form, hints: event.target.value })}
                />
              </label>
              <div className="teacher-assignment-editor__grid">
                <label>
                  Лимит времени (сек., максимум 30)
                  <input
                    type="number"
                    min={1}
                    max={30}
                    required
                    value={form.time_limit_seconds}
                    onChange={(event) => setForm({ ...form, time_limit_seconds: event.target.value })}
                  />
                </label>
                <label>
                  Лимит памяти (МБ, максимум 512)
                  <input
                    type="number"
                    min={64}
                    max={512}
                    required
                    value={form.memory_limit_mb}
                    onChange={(event) => setForm({ ...form, memory_limit_mb: event.target.value })}
                  />
                </label>
              </div>
              <h5>Скрытые тест-кейсы (видны только преподавателю)</h5>
              {form.test_cases.map((testCase, index) => (
                <fieldset className="teacher-assignment-question" key={index}>
                  <legend>Тест {index + 1}</legend>
                  <label>
                    Входные данные
                    <textarea
                      value={testCase.input_data}
                      onChange={(event) => setForm({
                        ...form,
                        test_cases: form.test_cases.map((item, itemIndex) => (
                          itemIndex === index ? { ...item, input_data: event.target.value } : item
                        )),
                      })}
                    />
                  </label>
                  <label>
                    Ожидаемый результат
                    <textarea
                      value={testCase.expected_output}
                      onChange={(event) => setForm({
                        ...form,
                        test_cases: form.test_cases.map((item, itemIndex) => (
                          itemIndex === index ? { ...item, expected_output: event.target.value } : item
                        )),
                      })}
                    />
                  </label>
                  <button
                    className="btn-danger"
                    type="button"
                    onClick={() => setForm({
                      ...form,
                      test_cases: form.test_cases.filter((_, itemIndex) => itemIndex !== index),
                    })}
                  >
                    Удалить тест
                  </button>
                </fieldset>
              ))}
              <button
                className="btn-secondary"
                type="button"
                disabled={form.test_cases.length >= 100}
                onClick={() => setForm({
                  ...form,
                  test_cases: [...form.test_cases, { input_data: "", expected_output: "" }],
                })}
              >
                Добавить скрытый тест
              </button>
            </div>
          )}

          {actionError && <div role="alert" className="error-state">{actionError}</div>}
          <div className="teacher-assignment-card__actions">
            <button className="btn-primary" type="submit" disabled={saving}>
              {saving ? "Сохраняем..." : "Сохранить задание"}
            </button>
            <button className="btn-secondary" type="button" onClick={closeForm} disabled={saving}>
              Отмена
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
