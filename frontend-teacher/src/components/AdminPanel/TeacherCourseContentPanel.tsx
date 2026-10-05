import axios from "axios";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  createCourseBlock,
  createCourseLesson,
  deleteCourseBlock,
  deleteLesson,
  fetchCourseBlocks,
  fetchCourseDetail,
  updateCourse,
  updateCourseBlock,
  updateCourseLesson,
} from "../../api/api";
import type { TeacherCourseBlock, TeacherLesson } from "../../api/api";

interface TeacherCourseContentPanelProps {
  courseId: number;
}

interface CourseForm {
  title: string;
  description: string;
  category: string;
  level: "beginner" | "intermediate" | "advanced";
  price: string;
}

interface BlockForm {
  title: string;
  description: string;
  order: string;
}

interface LessonForm {
  title: string;
  description: string;
  content: string;
  order: string;
  block_id: number | null;
  lesson_type: TeacherLesson["lesson_type"];
  is_mandatory: boolean;
}

const lessonTypeLabels: Record<TeacherLesson["lesson_type"], string> = {
  theory: "Теория",
  practice: "Практика",
  test: "Тест",
  homework: "Домашнее задание",
};

const newBlockForm = (): BlockForm => ({ title: "", description: "", order: "" });

const newLessonForm = (blockId: number | null, order = ""): LessonForm => ({
  title: "",
  description: "",
  content: "",
  order,
  block_id: blockId,
  lesson_type: "theory",
  is_mandatory: true,
});

function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 401) return "Сессия истекла. Войдите повторно.";
    if (error.response?.status === 403) return "Недостаточно прав для изменения этого курса.";
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") return detail;
  }
  return fallback;
}

export default function TeacherCourseContentPanel({ courseId }: TeacherCourseContentPanelProps) {
  const [courseForm, setCourseForm] = useState<CourseForm | null>(null);
  const [blocks, setBlocks] = useState<TeacherCourseBlock[]>([]);
  const [unassignedLessons, setUnassignedLessons] = useState<TeacherLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingBlockId, setEditingBlockId] = useState<number | null>(null);
  const [blockForm, setBlockForm] = useState<BlockForm>(newBlockForm());
  const [creatingBlock, setCreatingBlock] = useState(false);
  const [lessonForm, setLessonForm] = useState<LessonForm | null>(null);
  const [editingLessonId, setEditingLessonId] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const [course, courseBlocks] = await Promise.all([
        fetchCourseDetail(courseId),
        fetchCourseBlocks(courseId),
      ]);
      setCourseForm({
        title: course.title ?? "",
        description: course.description ?? "",
        category: course.category ?? "",
        level: course.level ?? "beginner",
        price: String(course.price ?? 0),
      });
      setBlocks(Array.isArray(courseBlocks) ? courseBlocks : []);
      setUnassignedLessons(
        Array.isArray(course.lessons)
          ? course.lessons.filter((lesson: TeacherLesson) => lesson.block_id === null)
          : [],
      );
    } catch (error) {
      setListError(getErrorMessage(error, "Не удалось загрузить содержимое курса."));
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    void Promise.resolve().then(refresh);
  }, [refresh]);

  const saveCourse = async (event: FormEvent) => {
    event.preventDefault();
    if (!courseForm || !courseForm.title.trim()) {
      setActionError("Название курса обязательно.");
      return;
    }
    const price = Number(courseForm.price);
    if (!Number.isInteger(price) || price < 0) {
      setActionError("Цена должна быть целым неотрицательным числом.");
      return;
    }
    setSaving(true);
    setActionError(null);
    try {
      await updateCourse(courseId, {
        title: courseForm.title.trim(),
        description: courseForm.description,
        category: courseForm.category.trim(),
        level: courseForm.level,
        price,
      });
      await refresh();
    } catch (error) {
      setActionError(getErrorMessage(error, "Не удалось сохранить курс."));
    } finally {
      setSaving(false);
    }
  };

  const saveBlock = async (event: FormEvent) => {
    event.preventDefault();
    if (!blockForm.title.trim()) {
      setActionError("Название раздела обязательно.");
      return;
    }
    const order = blockForm.order ? Number(blockForm.order) : undefined;
    if (order !== undefined && (!Number.isInteger(order) || order < 1)) {
      setActionError("Порядок раздела должен быть положительным целым числом.");
      return;
    }
    setSaving(true);
    setActionError(null);
    try {
      const payload = {
        title: blockForm.title.trim(),
        description: blockForm.description,
        ...(order !== undefined ? { order } : {}),
      };
      if (editingBlockId === null) {
        await createCourseBlock(courseId, payload);
      } else {
        await updateCourseBlock(editingBlockId, payload);
      }
      setBlockForm(newBlockForm());
      setEditingBlockId(null);
      setCreatingBlock(false);
      await refresh();
    } catch (error) {
      setActionError(getErrorMessage(error, "Не удалось сохранить раздел."));
    } finally {
      setSaving(false);
    }
  };

  const beginEditBlock = (block: TeacherCourseBlock) => {
    setActionError(null);
    setEditingBlockId(block.id);
    setCreatingBlock(false);
    setBlockForm({
      title: block.title,
      description: block.description,
      order: String(block.order),
    });
  };

  const saveLesson = async (event: FormEvent) => {
    event.preventDefault();
    if (!lessonForm?.title.trim()) {
      setActionError("Название урока обязательно.");
      return;
    }
    const order = lessonForm.order ? Number(lessonForm.order) : undefined;
    if (order !== undefined && (!Number.isInteger(order) || order < 1)) {
      setActionError("Порядок урока должен быть положительным целым числом.");
      return;
    }
    setSaving(true);
    setActionError(null);
    try {
      const payload = {
        title: lessonForm.title.trim(),
        description: lessonForm.description,
        content: lessonForm.content,
        block_id: lessonForm.block_id,
        lesson_type: lessonForm.lesson_type,
        is_mandatory: lessonForm.is_mandatory,
        ...(order !== undefined ? { order } : {}),
      };
      if (editingLessonId === null) {
        await createCourseLesson(courseId, payload);
      } else {
        await updateCourseLesson(editingLessonId, payload);
      }
      setLessonForm(null);
      setEditingLessonId(null);
      await refresh();
    } catch (error) {
      setActionError(getErrorMessage(error, "Не удалось сохранить урок."));
    } finally {
      setSaving(false);
    }
  };

  const beginEditLesson = (lesson: TeacherLesson) => {
    setActionError(null);
    setEditingLessonId(lesson.id);
    setLessonForm({
      title: lesson.title,
      description: lesson.description,
      content: lesson.content,
      order: String(lesson.order),
      block_id: lesson.block_id,
      lesson_type: lesson.lesson_type,
      is_mandatory: lesson.is_mandatory,
    });
  };

  const removeBlock = async (block: TeacherCourseBlock) => {
    if (!window.confirm(`Удалить раздел «${block.title}»? Пустой раздел можно удалить; сначала переместите его уроки.`)) return;
    setActionError(null);
    try {
      await deleteCourseBlock(block.id);
      await refresh();
    } catch (error) {
      setActionError(getErrorMessage(error, "Не удалось удалить раздел."));
    }
  };

  const removeLesson = async (lesson: TeacherLesson) => {
    if (!window.confirm(`Удалить урок «${lesson.title}»? Урок с прогрессом учеников или заданиями удалить нельзя.`)) return;
    setActionError(null);
    try {
      await deleteLesson(lesson.id);
      await refresh();
    } catch (error) {
      setActionError(getErrorMessage(error, "Не удалось удалить урок."));
    }
  };

  const renderLessonForm = () => lessonForm && (
    <form className="teacher-content-form" onSubmit={saveLesson}>
      <h4>{editingLessonId === null ? "Новый урок" : "Редактирование урока"}</h4>
      <label>
        Название урока *
        <input value={lessonForm.title} onChange={(event) => setLessonForm({ ...lessonForm, title: event.target.value })} required />
      </label>
      <label>
        Описание
        <textarea value={lessonForm.description} onChange={(event) => setLessonForm({ ...lessonForm, description: event.target.value })} rows={2} />
      </label>
      <label>
        Содержимое (Markdown)
        <textarea value={lessonForm.content} onChange={(event) => setLessonForm({ ...lessonForm, content: event.target.value })} rows={8} />
      </label>
      <div className="teacher-content-form-grid">
        <label>
          Тип
          <select value={lessonForm.lesson_type} onChange={(event) => setLessonForm({ ...lessonForm, lesson_type: event.target.value as TeacherLesson["lesson_type"] })}>
            {Object.entries(lessonTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>
          Раздел
          <select value={lessonForm.block_id ?? ""} onChange={(event) => setLessonForm({ ...lessonForm, block_id: event.target.value ? Number(event.target.value) : null })}>
            <option value="">Без раздела</option>
            {blocks.map((block) => <option key={block.id} value={block.id}>{block.title}</option>)}
          </select>
        </label>
        <label>
          Порядок в курсе
          <input type="number" min="1" value={lessonForm.order} onChange={(event) => setLessonForm({ ...lessonForm, order: event.target.value })} />
        </label>
      </div>
      <label className="teacher-content-checkbox">
        <input type="checkbox" checked={lessonForm.is_mandatory} onChange={(event) => setLessonForm({ ...lessonForm, is_mandatory: event.target.checked })} />
        Обязательный урок
      </label>
      <div className="teacher-content-actions">
        <button className="btn-primary" type="submit" disabled={saving}>{saving ? "Сохранение…" : "Сохранить урок"}</button>
        <button className="btn-secondary" type="button" onClick={() => { setLessonForm(null); setEditingLessonId(null); }}>Отмена</button>
      </div>
    </form>
  );

  if (loading) return <p role="status">Загрузка содержимого курса…</p>;
  if (listError) {
    return (
      <div role="alert" className="teacher-content-error">
        <p>{listError}</p>
        <button className="btn-secondary" onClick={() => void refresh()}>Повторить</button>
      </div>
    );
  }

  return (
    <section className="teacher-course-content" aria-label="Редактор курса">
      <h3>Основные данные курса</h3>
      {courseForm && (
        <form className="teacher-content-form" onSubmit={saveCourse}>
          <label>
            Название курса *
            <input value={courseForm.title} onChange={(event) => setCourseForm({ ...courseForm, title: event.target.value })} required />
          </label>
          <label>
            Описание
            <textarea value={courseForm.description} onChange={(event) => setCourseForm({ ...courseForm, description: event.target.value })} rows={3} />
          </label>
          <div className="teacher-content-form-grid">
            <label>
              Категория
              <input value={courseForm.category} onChange={(event) => setCourseForm({ ...courseForm, category: event.target.value })} />
            </label>
            <label>
              Уровень
              <select value={courseForm.level} onChange={(event) => setCourseForm({ ...courseForm, level: event.target.value as CourseForm["level"] })}>
                <option value="beginner">Начальный</option>
                <option value="intermediate">Средний</option>
                <option value="advanced">Продвинутый</option>
              </select>
            </label>
            <label>
              Цена
              <input type="number" min="0" step="1" value={courseForm.price} onChange={(event) => setCourseForm({ ...courseForm, price: event.target.value })} />
            </label>
          </div>
          <button className="btn-primary" type="submit" disabled={saving}>{saving ? "Сохранение…" : "Сохранить курс"}</button>
        </form>
      )}

      <div className="teacher-content-heading">
        <h3>Разделы и уроки</h3>
        <button className="btn-primary" onClick={() => {
          setActionError(null);
          setBlockForm(newBlockForm());
          setEditingBlockId(null);
          setCreatingBlock(true);
        }}>Добавить раздел</button>
      </div>

      {actionError && <p className="teacher-content-error" role="alert">{actionError}</p>}
      {(creatingBlock || editingBlockId !== null) && (
        <form className="teacher-content-form" onSubmit={saveBlock}>
          <h4>{editingBlockId === null ? "Новый раздел" : "Редактирование раздела"}</h4>
          <label>
            Название раздела *
            <input value={blockForm.title} onChange={(event) => setBlockForm({ ...blockForm, title: event.target.value })} required />
          </label>
          <label>
            Описание
            <textarea value={blockForm.description} onChange={(event) => setBlockForm({ ...blockForm, description: event.target.value })} rows={2} />
          </label>
          <label>
            Порядок
            <input type="number" min="1" value={blockForm.order} onChange={(event) => setBlockForm({ ...blockForm, order: event.target.value })} />
          </label>
          <div className="teacher-content-actions">
            <button className="btn-primary" type="submit" disabled={saving}>{saving ? "Сохранение…" : "Сохранить раздел"}</button>
            <button className="btn-secondary" type="button" onClick={() => { setCreatingBlock(false); setEditingBlockId(null); }}>Отмена</button>
          </div>
        </form>
      )}

      {blocks.length === 0 && <p>Разделов пока нет. Уроки можно создавать без раздела.</p>}
      {blocks.map((block) => (
        <article className="teacher-content-block" key={block.id}>
          <div className="teacher-content-heading">
            <div>
              <h4>{block.order}. {block.title}</h4>
              {block.description && <p>{block.description}</p>}
            </div>
            <div className="teacher-content-actions">
              <button className="btn-secondary" onClick={() => beginEditBlock(block)}>Изменить раздел</button>
              <button className="btn-secondary" onClick={() => void removeBlock(block)}>Удалить раздел</button>
              <button className="btn-primary" onClick={() => {
                setActionError(null);
                setEditingLessonId(null);
                setLessonForm(newLessonForm(block.id));
              }}>Добавить урок</button>
            </div>
          </div>
          {block.lessons.map((lesson) => (
            <div className="teacher-content-lesson" key={lesson.id}>
              <div>
                <strong>{lesson.order}. {lesson.title}</strong>
                <span>{lessonTypeLabels[lesson.lesson_type]}{lesson.is_mandatory ? " · обязательный" : ""}</span>
              </div>
              <div className="teacher-content-actions">
                <button className="btn-secondary" onClick={() => beginEditLesson(lesson)}>Изменить урок</button>
                <button className="btn-secondary" onClick={() => void removeLesson(lesson)}>Удалить урок</button>
              </div>
            </div>
          ))}
        </article>
      ))}
      {unassignedLessons.length > 0 && (
        <article className="teacher-content-block">
          <h4>Уроки без раздела</h4>
          {unassignedLessons.map((lesson) => (
            <div className="teacher-content-lesson" key={lesson.id}>
              <div>
                <strong>{lesson.order}. {lesson.title}</strong>
                <span>{lessonTypeLabels[lesson.lesson_type]}{lesson.is_mandatory ? " · обязательный" : ""}</span>
              </div>
              <div className="teacher-content-actions">
                <button className="btn-secondary" onClick={() => beginEditLesson(lesson)}>Изменить урок</button>
                <button className="btn-secondary" onClick={() => void removeLesson(lesson)}>Удалить урок</button>
              </div>
            </div>
          ))}
        </article>
      )}
      {blocks.flatMap((block) => block.lessons).length + unassignedLessons.length === 0 && (
        <button className="btn-secondary" onClick={() => {
          setActionError(null);
          setEditingLessonId(null);
          setLessonForm(newLessonForm(null));
        }}>Добавить урок без раздела</button>
      )}
      {renderLessonForm()}
    </section>
  );
}
