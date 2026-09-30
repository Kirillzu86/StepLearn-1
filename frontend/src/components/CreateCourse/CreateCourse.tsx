import React, { useState, useRef } from "react";
import axios from "axios";
import { API_URL, createCourse, saveCustomCourse } from "../../api/api";
import { useNavigate } from "react-router-dom";
import { marked } from "marked";
import Header from "../Header/Header";
import Sidebar from "../Sidebar/sidebar";
import "../HomePage/StyleHomePage.css";
import "../Sidebar/StyleSidebar.css";
import "./CreateCourse.css";

interface CreateCourseProps {
  theme: "dark" | "light";
  toggleTheme: () => void;
}

function CreateCourse({ theme, toggleTheme }: CreateCourseProps) {
  const [courseType, setCourseType] = useState<"text" | "quiz">("text");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");
  const [totalLessons, setTotalLessons] = useState<number>(0);
  const [price, setPrice] = useState<number>(0);
  const [priceStatus, setPriceStatus] = useState("Free");
  const [previewTab, setPreviewTab] = useState<"edit" | "preview">("edit");
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [questions, setQuestions] = useState<
    Array<{ text: string; answers: Array<{ text: string; is_correct: boolean }> }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const navigate = useNavigate();

  // Обработка загрузки Markdown файла
  const processMarkdownFile = (file: File) => {
    if (!file) return;
    setError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = (e.target?.result as string) || "";
      setContent(text);
      setUploadedFileName(file.name);
      setCourseType("text");

      // Автоматическое извлечение заголовка из первого '# Заголовок'
      const titleMatch = text.match(/^#\s+(.+)$/m);
      if (titleMatch && titleMatch[1]) {
        setTitle(titleMatch[1].trim());
      } else if (!title.trim()) {
        const cleanedName = file.name.replace(/\.(md|markdown|txt)$/i, "");
        setTitle(cleanedName);
      }

      // Автоматическое извлечение описания из первого абзаца
      if (!description.trim()) {
        const lines = text.split("\n");
        for (const line of lines) {
          const trimmed = line.trim();
          if (
            trimmed &&
            !trimmed.startsWith("#") &&
            !trimmed.startsWith("```") &&
            !trimmed.startsWith("---") &&
            !trimmed.startsWith(">")
          ) {
            setDescription(trimmed.slice(0, 300));
            break;
          }
        }
      }

      // Подсчет глав/уроков по заголовкам # и ##
      const sectionCount = (text.match(/^#{1,2}\s+/gm) || []).length;
      if (sectionCount > 0) {
        setTotalLessons(sectionCount);
      }
    };
    reader.onerror = () => {
      setError("Не удалось прочитать файл");
    };
    reader.readAsText(file, "UTF-8");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processMarkdownFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processMarkdownFile(file);
  };

  // Вставка markdown разметки по кнопкам на панели
  const insertMarkdownSnippet = (before: string, after: string = "", placeholder: string = "") => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setContent(prev => prev + before + placeholder + after);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.substring(start, end) || placeholder;
    const replacement = before + selected + after;
    const newContent = content.substring(0, start) + replacement + content.substring(end);
    setContent(newContent);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + selected.length);
    }, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Название курса обязательно");
      return;
    }

    if (courseType === "text") {
      if (!content.trim()) {
        setError("Содержание курса обязательно. Загрузите .md файл или введите текст курса.");
        return;
      }
    } else {
      // Валидация вопросов для квиза
      if (questions.length === 0) {
        setError("Для курса с тестом необходимо добавить хотя бы один вопрос");
        return;
      }
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        if (!q.text || !q.text.trim()) {
          setError(`Текст вопроса ${i + 1} обязателен`);
          return;
        }
        if (!q.answers || q.answers.length === 0) {
          setError(`Вопрос ${i + 1} должен содержать хотя бы один ответ`);
          return;
        }
        const hasCorrect = q.answers.some((a) => a.is_correct);
        if (!hasCorrect) {
          setError(`У вопроса ${i + 1} должен быть отмечен правильный ответ`);
          return;
        }
      }
    }

    setLoading(true);
    try {
      const userStr = localStorage.getItem("currentUser");
      const user = userStr ? JSON.parse(userStr) : null;

      const calculatedLessons =
        totalLessons ||
        (courseType === "text"
          ? Math.max(1, (content.match(/^#{1,2}\s+/gm) || []).length)
          : questions.length);

      const payload: any = {
        title: title.trim(),
        description: description.trim(),
        course_type: courseType,
        total_lessons: calculatedLessons,
        price: price,
        price_status: priceStatus,
        content: courseType === "text" ? content.trim() : (content.trim() || undefined),
        questions:
          courseType === "quiz"
            ? questions.map((q) => ({
                text: q.text,
                answers: q.answers.map((a) => ({ text: a.text, is_correct: !!a.is_correct })),
              }))
            : [],
      };

      if (user && user.id) payload.author_id = user.id;

      const created = await createCourse(payload).catch(async () => {
        // Fallback endpoint retry
        const base = API_URL ? API_URL.replace(/\/$/, "") : "";
        const resp = await axios.post(`${base}/v1/courses`, payload);
        return resp.data;
      });

      if (created) {
        saveCustomCourse(created);
      }

      if (created && created.id) {
        navigate(`/course/${created.id}`);
      } else {
        navigate("/catalog");
      }
    } catch (err: any) {
      console.error("Не удалось создать курс:", err);
      const resp = err?.response?.data;
      if (resp) {
        if (typeof resp.detail === "string") setError(resp.detail);
        else if (Array.isArray(resp.detail))
          setError(resp.detail.map((d: any) => d.msg || JSON.stringify(d)).join("; "));
        else setError(JSON.stringify(resp));
      } else {
        setError(err.message || "Ошибка при создании курса");
      }
    } finally {
      setLoading(false);
    }
  };

  // Управление вопросами/ответами для режима теста
  const addQuestion = () =>
    setQuestions((prev) => [...prev, { text: "", answers: [{ text: "", is_correct: false }] }]);
  const removeQuestion = (index: number) =>
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  const updateQuestionText = (index: number, text: string) =>
    setQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, text } : q)));
  const addAnswer = (qIndex: number) =>
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qIndex ? { ...q, answers: [...q.answers, { text: "", is_correct: false }] } : q
      )
    );
  const removeAnswer = (qIndex: number, aIndex: number) =>
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qIndex ? { ...q, answers: q.answers.filter((_, ai) => ai !== aIndex) } : q
      )
    );
  const updateAnswerText = (qIndex: number, aIndex: number, text: string) =>
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qIndex
          ? { ...q, answers: q.answers.map((a, ai) => (ai === aIndex ? { ...a, text } : a)) }
          : q
      )
    );
  const markCorrect = (qIndex: number, aIndex: number) =>
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIndex) return q;
        return { ...q, answers: q.answers.map((a, ai) => ({ ...a, is_correct: ai === aIndex })) };
      })
    );

  const backgroundStyle: React.CSSProperties = {
    minHeight: "100vh",
    backgroundColor: theme === "dark" ? "#030712" : "#f8fafc",
    backgroundImage:
      theme === "dark"
        ? "radial-gradient(circle at 50% 0%, #3b82f640, #030712 35%)"
        : "radial-gradient(circle at 50% 0%, #e2e8f040, #f8fafc 35%)",
  };

  return (
    <div className="sl-app">
      <Header />
      <div className="sl-layout">
        <Sidebar />
        <main className="sl-main">
            <div className="content-header">
              <h1 className="main-title">Создать курс</h1>
            </div>

            <div className="create-course-container">
              {error && (
                <div className="error-state" style={{ marginBottom: 20 }}>
                  {typeof error === "string" ? error : JSON.stringify(error)}
                </div>
              )}

              {/* Выбор типа курса */}
              <div className="course-type-selector">
                <button
                  type="button"
                  className={`type-tab-btn ${courseType === "text" ? "active" : ""}`}
                  onClick={() => setCourseType("text")}
                >
                  📖 Текстовый курс (Markdown / .md файл)
                </button>
                <button
                  type="button"
                  className={`type-tab-btn ${courseType === "quiz" ? "active" : ""}`}
                  onClick={() => setCourseType("quiz")}
                >
                  📝 Курс с тестом (вопросы и ответы)
                </button>
              </div>

              <form onSubmit={handleSubmit} className="course-create-form">
                {/* Загрузка .md файла при текстовом режиме */}
                {courseType === "text" && (
                  <div>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept=".md,.markdown,text/markdown,text/plain"
                      style={{ display: "none" }}
                    />
                    <div
                      className={`md-dropzone ${isDragging ? "dragging" : ""}`}
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                    >
                      <div className="md-dropzone-icon">📄</div>
                      <div className="md-dropzone-title">
                        {uploadedFileName
                          ? `Загружен: ${uploadedFileName}`
                          : "Нажмите для выбора или перетащите .md файл сюда"}
                      </div>
                      <div className="md-dropzone-sub">
                        Поддерживаются файлы формата .md, .markdown. Заголовок и содержание
                        заполнятся автоматически.
                      </div>
                      {uploadedFileName && (
                        <div className="file-info-badge">
                          ✓ Готово к публикации или ручному редактированию
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="input-group">
                  <label>Название курса *</label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Например: Полное руководство по Python"
                    className="form-input"
                    required
                  />
                </div>

                <div className="input-group">
                  <label>Краткое описание курса</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="О чем этот курс, для кого он предназначен..."
                    className="form-input"
                    rows={3}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                  <div className="input-group">
                    <label>Цена (руб.)</label>
                    <input
                      type="number"
                      value={price}
                      onChange={(e) => setPrice(Number(e.target.value))}
                      className="form-input"
                      min={0}
                    />
                  </div>

                  <div className="input-group">
                    <label>Количество глав/уроков</label>
                    <input
                      type="number"
                      value={totalLessons}
                      onChange={(e) => setTotalLessons(Number(e.target.value))}
                      className="form-input"
                      placeholder={courseType === "text" ? "Авто по разделам #" : "Авто по вопросам"}
                      min={0}
                    />
                  </div>

                  <div className="input-group">
                    <label>Статус цены</label>
                    <select
                      value={priceStatus}
                      onChange={(e) => setPriceStatus(e.target.value)}
                      className="form-input"
                    >
                      <option value="Free">Бесплатный</option>
                      <option value="Paid">Платный</option>
                    </select>
                  </div>
                </div>

                {/* Блок Markdown контента (если выбран текстовый курс) */}
                {courseType === "text" && (
                  <div style={{ marginTop: 24, marginBottom: 20 }}>
                    <div className="md-view-controls">
                      <label style={{ fontWeight: 600 }}>Содержание курса (Markdown) *</label>
                      <div className="md-view-tabs">
                        <button
                          type="button"
                          className={`md-view-tab ${previewTab === "edit" ? "active" : ""}`}
                          onClick={() => setPreviewTab("edit")}
                        >
                          ✏️ Редактор
                        </button>
                        <button
                          type="button"
                          className={`md-view-tab ${previewTab === "preview" ? "active" : ""}`}
                          onClick={() => setPreviewTab("preview")}
                        >
                          👁️ Предпросмотр
                        </button>
                      </div>
                    </div>

                    {previewTab === "edit" ? (
                      <div>
                        <div className="md-toolbar">
                          <button
                            type="button"
                            className="md-tool-btn"
                            onClick={() => insertMarkdownSnippet("# ", "", "Заголовок 1")}
                          >
                            H1
                          </button>
                          <button
                            type="button"
                            className="md-tool-btn"
                            onClick={() => insertMarkdownSnippet("## ", "", "Заголовок 2")}
                          >
                            H2
                          </button>
                          <button
                            type="button"
                            className="md-tool-btn"
                            onClick={() => insertMarkdownSnippet("### ", "", "Заголовок 3")}
                          >
                            H3
                          </button>
                          <button
                            type="button"
                            className="md-tool-btn"
                            onClick={() => insertMarkdownSnippet("**", "**", "жирный текст")}
                          >
                            B
                          </button>
                          <button
                            type="button"
                            className="md-tool-btn"
                            onClick={() => insertMarkdownSnippet("*", "*", "курсив")}
                          >
                            I
                          </button>
                          <button
                            type="button"
                            className="md-tool-btn"
                            onClick={() => insertMarkdownSnippet("`", "`", "код")}
                          >
                            Code
                          </button>
                          <button
                            type="button"
                            className="md-tool-btn"
                            onClick={() =>
                              insertMarkdownSnippet("```python\n", "\n```", "print('Hello, world!')")
                            }
                          >
                            Блок кода
                          </button>
                          <button
                            type="button"
                            className="md-tool-btn"
                            onClick={() => insertMarkdownSnippet("> ", "", "Цитата или важное примечание")}
                          >
                            Цитата
                          </button>
                          <button
                            type="button"
                            className="md-tool-btn"
                            onClick={() => insertMarkdownSnippet("- ", "", "Пункт списка")}
                          >
                            Список
                          </button>
                          <button
                            type="button"
                            className="md-tool-btn"
                            onClick={() => insertMarkdownSnippet("[", "](https://example.com)", "текст ссылки")}
                          >
                            Ссылка
                          </button>
                        </div>
                        <textarea
                          ref={textareaRef}
                          value={content}
                          onChange={(e) => setContent(e.target.value)}
                          placeholder="# Введение&#10;&#10;Текст вашего курса в формате Markdown...&#10;&#10;## Глава 1. Основы&#10;&#10;Здесь может быть любой объем теоретического материала, примеры кода, списки и таблицы!"
                          className="md-textarea"
                          rows={14}
                        />
                      </div>
                    ) : (
                      <div className="md-preview-pane">
                        {content.trim() ? (
                          <div
                            className="markdown-body"
                            dangerouslySetInnerHTML={{
                              __html: marked.parse(content) as string,
                            }}
                          />
                        ) : (
                          <p style={{ color: "#94a3b8", textAlign: "center", padding: 40 }}>
                            Пока здесь ничего нет. Введите текст в редакторе или загрузите .md файл.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Блок Вопросов и ответов (если выбран курс-тест) */}
                {courseType === "quiz" && (
                  <div style={{ marginTop: 24, marginBottom: 20 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 12,
                      }}
                    >
                      <h3>Вопросы теста ({questions.length})</h3>
                      <button
                        type="button"
                        className="start-course-btn"
                        onClick={addQuestion}
                      >
                        + Добавить вопрос
                      </button>
                    </div>

                    {questions.length === 0 && (
                      <div className="welcome-banner" style={{ padding: 20, textAlign: "center" }}>
                        Вопросы еще не добавлены. Нажмите «+ Добавить вопрос», чтобы создать первый вопрос.
                      </div>
                    )}

                    {questions.map((q, qi) => (
                      <div
                        key={qi}
                        style={{
                          border: "1px solid rgba(148, 163, 184, 0.3)",
                          padding: 16,
                          marginBottom: 16,
                          borderRadius: 8,
                          background: theme === "dark" ? "rgba(30, 41, 59, 0.4)" : "rgba(255, 255, 255, 0.8)",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <strong>Вопрос {qi + 1}</strong>
                          <button
                            type="button"
                            className="auth-link-button"
                            onClick={() => removeQuestion(qi)}
                            style={{ color: "#ef4444" }}
                          >
                            Удалить вопрос
                          </button>
                        </div>
                        <div className="input-group" style={{ marginTop: 10 }}>
                          <label>Текст вопроса *</label>
                          <textarea
                            value={q.text}
                            onChange={(e) => updateQuestionText(qi, e.target.value)}
                            className="form-input"
                            rows={2}
                            placeholder="Введите вопрос..."
                            required
                          />
                        </div>
                        <div style={{ marginTop: 12 }}>
                          <strong style={{ fontSize: "0.9rem" }}>Варианты ответов:</strong>
                          <div style={{ marginTop: 8 }}>
                            {q.answers.map((a, ai) => (
                              <div
                                key={ai}
                                style={{
                                  display: "flex",
                                  gap: 8,
                                  alignItems: "center",
                                  marginBottom: 8,
                                }}
                              >
                                <input
                                  type="radio"
                                  name={`correct-${qi}`}
                                  checked={!!a.is_correct}
                                  onChange={() => markCorrect(qi, ai)}
                                  title="Отметить как правильный ответ"
                                />
                                <input
                                  value={a.text}
                                  onChange={(e) => updateAnswerText(qi, ai, e.target.value)}
                                  placeholder={`Вариант ${ai + 1}`}
                                  className="form-input"
                                  required
                                />
                                <button
                                  type="button"
                                  className="auth-link-button"
                                  onClick={() => removeAnswer(qi, ai)}
                                  style={{ color: "#ef4444" }}
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                            <div>
                              <button
                                type="button"
                                className="type-tab-btn"
                                onClick={() => addAnswer(qi)}
                                style={{ fontSize: "0.85rem", padding: "6px 12px" }}
                              >
                                + Добавить вариант ответа
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ marginTop: 30 }}>
                  <button
                    type="submit"
                    className="start-course-btn"
                    disabled={loading}
                    style={{ width: "100%", padding: "14px", fontSize: "1.05rem" }}
                  >
                    {loading
                      ? "Сохранение курса..."
                      : courseType === "text"
                      ? "Опубликовать текстовый курс"
                      : "Создать курс с тестом"}
                  </button>
                </div>
              </form>
            </div>
          </main>
        </div>
      </div>
  );
}

export default CreateCourse;
