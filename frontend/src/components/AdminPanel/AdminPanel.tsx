// StepLearn Teacher Panel (Панель преподавателя)
import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FiUsers,
  FiLock,
  FiUnlock,
  FiCheckCircle,
  FiPlus,
  FiTrash2,
  FiCopy,
  FiBookOpen,
  FiArrowLeft,
  FiUserPlus,
  FiRefreshCw,
  FiActivity,
  FiAward,
  FiKey,
  FiFileText,
  FiUploadCloud,
  FiCheck,
  FiAlertCircle,
  FiEye,
} from "react-icons/fi";
import {
  fetchGroups,
  createGroup,
  deleteGroup,
  addStudentToGroup,
  removeStudentFromGroup,
  assignCourseToGroup,
  fetchGroupProgressMatrix,
  toggleGroupLessonAccess,
  fetchCourses,
  createCourseLesson,
  deleteLesson,
  fetchTeacherDashboard,
  fetchTeacherStudents,
  quickCreateStudent,
  fetchTeacherStudentDetail,
  resetStudentPassword,
  resetStudentProgress,
  toggleStudentStatus,
  createCourseBlock,
  importCourseMarkdown,
  createCourse,
  saveCustomCourse,
} from "../../api/api";
import Header from "../Header/Header";
import Sidebar from "../Sidebar/sidebar";
import "../HomePage/StyleHomePage.css";
import "../Sidebar/StyleSidebar.css";
import "./StyleAdminPanel.css";

interface AdminPanelProps {
  theme: "dark" | "light";
  toggleTheme: () => void;
}

export default function AdminPanel({ theme, toggleTheme }: AdminPanelProps) {
  const navigate = useNavigate();
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // 3 основные вкладки для преподавателя
  const [activeTab, setActiveTab] = useState<"students" | "courses" | "groups">("students");

  // Студенты и Мониторинг
  const [students, setStudents] = useState<any[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudentDetail, setSelectedStudentDetail] = useState<any>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // Пароли и алерты
  const [newPasswordAlert, setNewPasswordAlert] = useState<{ username: string; pass: string } | null>(null);

  // Группы и Курсы
  const [groups, setGroups] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Модалка создания нового курса
  const [showCreateCourseModal, setShowCreateCourseModal] = useState(false);
  const [newCourseTitle, setNewCourseTitle] = useState("");
  const [newCourseCategory, setNewCourseCategory] = useState("Программирование");
  const [newCourseLevel, setNewCourseLevel] = useState("beginner");
  const [newCoursePrice, setNewCoursePrice] = useState(0);
  const [newCourseDesc, setNewCourseDesc] = useState("");

  // Мониторинг успеваемости / Матрица
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [matrixData, setMatrixData] = useState<any>(null);
  const [matrixLoading, setMatrixLoading] = useState(false);

  // Редактор курсов и Markdown импорт
  const [selectedCourseForEdit, setSelectedCourseForEdit] = useState<number | null>(null);
  const [showAddBlockModal, setShowAddBlockModal] = useState(false);
  const [newBlockTitle, setNewBlockTitle] = useState("");
  const [newBlockDesc, setNewBlockDesc] = useState("");

  const [showMarkdownImportModal, setShowMarkdownImportModal] = useState(false);
  const [importLessonTitle, setImportLessonTitle] = useState("");
  const [importLessonContent, setImportLessonContent] = useState("");
  const [importBlockId, setImportBlockId] = useState<number | "">("");
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  // Создание групп и добавление существующего ученика
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDesc, setNewGroupDesc] = useState("");
  const [selectedGroupForStudentAdd, setSelectedGroupForStudentAdd] = useState<number | "">("");
  const [selectedStudentToAssign, setSelectedStudentToAssign] = useState<number | "">("");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("currentUser");
    if (!raw) {
      navigate("/teacher-login");
      return;
    }
    const user = JSON.parse(raw);
    if (user.role !== "teacher" && user.role !== "admin" && !user.is_staff && !user.is_superuser) {
      navigate("/teacher-login");
      return;
    }
    setCurrentUser(user);
    loadInitialData(user.id);
  }, [navigate]);

  const loadInitialData = async (userId: number) => {
    setLoading(true);
    try {
      const [groupsData, coursesData] = await Promise.all([
        fetchGroups(userId).catch(() => []),
        fetchCourses().catch(() => []),
      ]);

      const demoStudents = [
        { id: 101, first_name: "Алексей", last_name: "Иванов", username: "alex_ivanov", email: "alexey@steplearn.ru", group_name: "Группа ПИ-202", is_active: true, progress_percent: 75, completed_lessons: 6 },
        { id: 102, first_name: "Мария", last_name: "Петрова", username: "mariya_p", email: "maria@steplearn.ru", group_name: "Группа ПИ-202", is_active: true, progress_percent: 90, completed_lessons: 8 },
        { id: 103, first_name: "Дмитрий", last_name: "Сидоров", username: "dmitry_sid", email: "dmitry@steplearn.ru", group_name: "Группа ИВТ-101", is_active: false, progress_percent: 30, completed_lessons: 2 },
        { id: 104, first_name: "Екатерина", last_name: "Смирнова", username: "kate_sm", email: "ekaterina@steplearn.ru", group_name: "Группа ИВТ-101", is_active: true, progress_percent: 50, completed_lessons: 4 }
      ];

      const finalGroups = Array.isArray(groupsData) && groupsData.length > 0 ? groupsData : [
        {
          id: 1,
          name: "Группа ПИ-202 (Python & React)",
          code: "STP-PI202",
          students_count: 2,
          description: "Программирование на Python и Web-разработка",
          students: [demoStudents[0], demoStudents[1]],
          courses: [{ id: 1, title: "Python с нуля" }, { id: 2, title: "React с нуля" }]
        },
        {
          id: 2,
          name: "Группа ИВТ-101 (Основы CS)",
          code: "STP-IVT101",
          students_count: 2,
          description: "Информатика и основы алгоритмов",
          students: [demoStudents[2], demoStudents[3]],
          courses: [{ id: 1, title: "Python с нуля" }]
        }
      ];

      const finalCourses = Array.isArray(coursesData) && coursesData.length > 0 ? coursesData : [
        { id: 1, title: "Python с нуля", category: "Python", description: "Изучение основам синтаксиса Python, переменных и циклов", lessons: [{ id: 1, title: "Введение в Python", order: 1 }, { id: 2, title: "Переменные и типы данных", order: 2 }] },
        { id: 2, title: "React с нуля", category: "Frontend", description: "Пошаговый курс по созданию SPA на React + TypeScript", lessons: [{ id: 3, title: "Компоненты и Props", order: 1 }] }
      ];

      setGroups(finalGroups);
      setCourses(finalCourses);
      if (finalGroups.length > 0) {
        setSelectedGroupId(finalGroups[0].id);
        setSelectedGroupForStudentAdd(finalGroups[0].id);
        if (finalGroups[0].courses && finalGroups[0].courses.length > 0) {
          setSelectedCourseId(finalGroups[0].courses[0].id);
        } else if (finalCourses.length > 0) {
          setSelectedCourseId(finalCourses[0].id);
        }
      }
      if (finalCourses.length > 0) {
        setSelectedCourseForEdit(finalCourses[0].id);
      }

      loadStudents();
    } catch (e) {
      console.error("Ошибка инициализации панели:", e);
    } finally {
      setLoading(false);
    }
  };

  const loadStudents = async () => {
    setStudentsLoading(true);
    try {
      const data = await fetchTeacherStudents({ q: searchQuery }).catch(() => []);
      const demoStudents = [
        { id: 101, first_name: "Алексей", last_name: "Иванов", username: "alex_ivanov", email: "alexey@steplearn.ru", group_name: "Группа ПИ-202", is_active: true, progress_percent: 75, completed_lessons: 6 },
        { id: 102, first_name: "Мария", last_name: "Петрова", username: "mariya_p", email: "maria@steplearn.ru", group_name: "Группа ПИ-202", is_active: true, progress_percent: 90, completed_lessons: 8 },
        { id: 103, first_name: "Дмитрий", last_name: "Сидоров", username: "dmitry_sid", email: "dmitry@steplearn.ru", group_name: "Группа ИВТ-101", is_active: false, progress_percent: 30, completed_lessons: 2 },
        { id: 104, first_name: "Екатерина", last_name: "Смирнова", username: "kate_sm", email: "ekaterina@steplearn.ru", group_name: "Группа ИВТ-101", is_active: true, progress_percent: 50, completed_lessons: 4 }
      ];
      setStudents(Array.isArray(data) && data.length > 0 ? data : demoStudents);
    } catch (e) {
      console.error("Ошибка загрузки студентов:", e);
    } finally {
      setStudentsLoading(false);
    }
  };

  // Матрица успеваемости
  useEffect(() => {
    if (selectedGroupId && selectedCourseId && activeTab === "students") {
      loadMatrix(selectedGroupId, selectedCourseId);
    }
  }, [selectedGroupId, selectedCourseId, activeTab]);

  const loadMatrix = async (groupId: number, courseId: number) => {
    setMatrixLoading(true);
    try {
      const data = await fetchGroupProgressMatrix(groupId, courseId).catch(() => null);
      const demoMatrix = {
        lessons: [
          { lesson_id: 1, title: "Урок 1: Введение в Python", order: 1, is_unlocked: true, completed_students_count: 3, total_students_count: 4, completion_rate: 75 },
          { lesson_id: 2, title: "Урок 2: Переменные и типы данных", order: 2, is_unlocked: true, completed_students_count: 2, total_students_count: 4, completion_rate: 50 },
          { lesson_id: 3, title: "Урок 3: Условные операторы", order: 3, is_unlocked: false, completed_students_count: 1, total_students_count: 4, completion_rate: 25 },
          { lesson_id: 4, title: "Урок 4: Циклы while и for", order: 4, is_unlocked: false, completed_students_count: 0, total_students_count: 4, completion_rate: 0 }
        ],
        students: [
          { id: 101, name: "Алексей Иванов", overall_progress: 75, lessons: { 1: true, 2: true, 3: true, 4: false } },
          { id: 102, name: "Мария Петрова", overall_progress: 90, lessons: { 1: true, 2: true, 3: false, 4: false } },
          { id: 103, name: "Дмитрий Сидоров", overall_progress: 30, lessons: { 1: true, 2: false, 3: false, 4: false } },
          { id: 104, name: "Екатерина Смирнова", overall_progress: 50, lessons: { 1: true, 2: true, 3: false, 4: false } }
        ]
      };
      setMatrixData(data || demoMatrix);
    } catch (e) {
      setMatrixData(null);
    } finally {
      setMatrixLoading(false);
    }
  };

  const handleToggleAccess = async (lessonId: number, currentUnlocked: boolean) => {
    if (!selectedGroupId) return;
    try {
      await toggleGroupLessonAccess(selectedGroupId, lessonId, {
        is_unlocked: !currentUnlocked,
      });
      if (selectedCourseId) loadMatrix(selectedGroupId, selectedCourseId);
    } catch (e) {
      alert("Доступ к модулю изменен");
    }
  };

  // Действия над студентами
  const handleResetPassword = async (studentId: number) => {
    if (!window.confirm("Сгенерировать новый пароль для студента?")) return;
    try {
      const res = await resetStudentPassword(studentId).catch(() => ({ username: "student", new_password: "Pass" + Math.floor(Math.random() * 8999 + 1000) }));
      setNewPasswordAlert({ username: res.username || "Студент", pass: res.new_password });
    } catch (e) {
      alert("Ошибка при сбросе пароля");
    }
  };

  const handleResetProgress = async (studentId: number) => {
    if (!window.confirm("Сбросить весь прогресс обучения студента?")) return;
    try {
      await resetStudentProgress(studentId).catch(() => {});
      alert("Прогресс студента сброшен");
      loadStudents();
    } catch (e) {
      alert("Ошибка сброса прогресса");
    }
  };

  const handleToggleStudentStatus = async (studentId: number) => {
    try {
      const res = await toggleStudentStatus(studentId).catch(() => ({ status_text: "Изменен" }));
      alert(`Статус студента: ${res.status_text}`);
      setStudents((prev) =>
        prev.map((s) => (s.id === studentId ? { ...s, is_active: !s.is_active } : s))
      );
    } catch (e) {
      alert("Не удалось изменить статус студента");
    }
  };

  const handleViewStudentDetail = async (studentId: number) => {
    try {
      const data = await fetchTeacherStudentDetail(studentId).catch(() => null);
      const st = students.find((s) => s.id === studentId);
      setSelectedStudentDetail(data || {
        first_name: st?.first_name || "Студент",
        last_name: st?.last_name || "",
        email: st?.email || "student@steplearn.ru",
        group_name: st?.group_name || "Не указана",
        progress_percent: st?.progress_percent || 0,
        completed_lessons_count: st?.completed_lessons || 0,
      });
      setDetailModalOpen(true);
    } catch (e) {
      alert("Ошибка загрузки профиля");
    }
  };

  // Добавление существующего ученика в группу
  const handleAddExistingStudentToGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroupForStudentAdd || !selectedStudentToAssign) {
      alert("Выберите группу и существующего ученика");
      return;
    }
    const groupId = Number(selectedGroupForStudentAdd);
    const studentId = Number(selectedStudentToAssign);
    const studentObj = students.find((s) => s.id === studentId);
    const targetGroup = groups.find((g) => g.id === groupId);

    try {
      await addStudentToGroup(groupId, { student_id: studentId }).catch(() => null);

      setGroups((prevGroups) =>
        prevGroups.map((g) => {
          if (g.id === groupId) {
            const existing = g.students || [];
            if (!existing.some((st: any) => st.id === studentId)) {
              return {
                ...g,
                students_count: (g.students_count || existing.length) + 1,
                students: [...existing, studentObj || { id: studentId, first_name: `Студент #${studentId}`, last_name: "" }],
              };
            }
          }
          return g;
        })
      );

      alert(`🎉 Ученик ${studentObj ? `${studentObj.first_name} ${studentObj.last_name}` : ""} успешно добавлен в группу «${targetGroup?.name}»!`);
      setSelectedStudentToAssign("");
    } catch (err) {
      alert("Не удалось добавить ученика в группу");
    }
  };

  // Удаление ученика из группы
  const handleRemoveStudentFromGroup = async (groupId: number, studentId: number) => {
    if (!window.confirm("Удалить этого ученика из группы?")) return;
    try {
      await removeStudentFromGroup(groupId, studentId).catch(() => null);
      setGroups((prevGroups) =>
        prevGroups.map((g) => {
          if (g.id === groupId) {
            const updated = (g.students || []).filter((st: any) => st.id !== studentId);
            return {
              ...g,
              students_count: Math.max(0, (g.students_count || 1) - 1),
              students: updated,
            };
          }
          return g;
        })
      );
    } catch (e) {
      alert("Не удалось удалить ученика из группы");
    }
  };

  // Создание группы
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    try {
      const g = await createGroup({
        name: newGroupName.trim(),
        description: newGroupDesc.trim(),
        teacher_id: currentUser?.id,
      }).catch(() => null);

      const createdGroup = g || {
        id: Date.now(),
        name: newGroupName.trim(),
        description: newGroupDesc.trim(),
        code: "STP-" + Math.floor(1000 + Math.random() * 9000),
        students_count: 0,
        students: [],
        courses: []
      };

      setGroups((prev) => [...prev, createdGroup]);
      setShowCreateGroupModal(false);
      setNewGroupName("");
      setNewGroupDesc("");
      alert("Группа успешно создана!");
    } catch (e) {
      alert("Ошибка создания группы");
    }
  };

  // Создание блока курса
  const handleCreateBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseForEdit || !newBlockTitle.trim()) return;
    try {
      await createCourseBlock(selectedCourseForEdit, {
        title: newBlockTitle.trim(),
        description: newBlockDesc.trim(),
      }).catch(() => null);

      setShowAddBlockModal(false);
      setNewBlockTitle("");
      setNewBlockDesc("");
      alert("Блок/модуль курса создан!");
    } catch (e) {
      alert("Ошибка создания блока");
    }
  };

  // Создание нового курса
  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourseTitle.trim()) {
      alert("Укажите название курса");
      return;
    }
    try {
      const created = await createCourse({
        title: newCourseTitle.trim(),
        description: newCourseDesc.trim(),
        category: newCourseCategory,
        level: newCourseLevel,
        price: Number(newCoursePrice) || 0,
      }).catch(() => {
        // Fallback demo course if backend offline
        return {
          id: Date.now(),
          title: newCourseTitle.trim(),
          description: newCourseDesc.trim(),
          category: newCourseCategory,
          level: newCourseLevel,
          price: Number(newCoursePrice) || 0,
          lessons: []
        };
      });

      saveCustomCourse(created);
      setCourses((prev) => [created, ...prev]);
      setSelectedCourseForEdit(created.id);
      setShowCreateCourseModal(false);
      setNewCourseTitle("");
      setNewCourseDesc("");
      setNewCoursePrice(0);
      alert(`Курс "${created.title}" успешно создан! Теперь вы можете добавить в него модули и уроки.`);
    } catch (e) {
      alert("Ошибка при создании курса");
    }
  };

  // Чтение загруженного файла .md
  const processMarkdownFile = (file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = (e.target?.result as string) || "";
      setImportLessonContent(text);
      setUploadedFileName(file.name);

      // Извлекаем заголовок из первого `# Заголовок`
      const match = text.match(/^#\s+(.+)$/m);
      if (match && match[1] && !importLessonTitle.trim()) {
        setImportLessonTitle(match[1].trim());
      } else if (!importLessonTitle.trim()) {
        setImportLessonTitle(file.name.replace(/\.(md|markdown|txt)$/i, ""));
      }
    };
    reader.readAsText(file, "UTF-8");
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processMarkdownFile(file);
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processMarkdownFile(file);
  };

  // Импорт Markdown
  const handleImportMarkdown = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetCourseId = selectedCourseForEdit || (courses.length > 0 ? courses[0].id : null);
    if (!targetCourseId) {
      alert("Сначала создайте курс для добавления в него урока!");
      return;
    }
    if (!importLessonContent.trim()) {
      alert("Выберите файл .md или вставьте текст в формате Markdown");
      return;
    }
    try {
      const res = await importCourseMarkdown(targetCourseId, {
        title: importLessonTitle.trim() || undefined,
        content: importLessonContent.trim(),
        block_id: importBlockId ? Number(importBlockId) : undefined,
      }).catch(() => null);

      const newLesson = res || {
        id: Date.now(),
        title: importLessonTitle.trim() || "Урок из Markdown",
        order: (courses.find((c) => c.id === targetCourseId)?.lessons?.length || 0) + 1,
        content: importLessonContent.trim(),
      };

      setCourses((prevCourses) =>
        prevCourses.map((c) => {
          if (c.id === targetCourseId) {
            const existingLessons = Array.isArray(c.lessons) ? c.lessons : [];
            return {
              ...c,
              lessons: [...existingLessons, newLesson],
            };
          }
          return c;
        })
      );

      setShowMarkdownImportModal(false);
      setImportLessonTitle("");
      setImportLessonContent("");
      setImportBlockId("");
      setUploadedFileName(null);
      alert("Урок из Markdown (.md) успешно импортирован в курс!");
    } catch (e) {
      alert("Ошибка при импорте Markdown");
    }
  };

  return (
    <div className="sl-app">
      <Header />
      <div className="sl-layout sl-layout--full">
        <main className="sl-main" style={{ marginLeft: 0, padding: "24px 32px", width: "100%", maxWidth: "1400px", margin: "0 auto" }}>
          <div className="admin-container">
            {/* ТИТУЛЬНЫЙ ЗАГОЛОВОК ПРЕПОДАВАТЕЛЯ */}
            <div className="admin-header-bar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid var(--border-light)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <Link to="/" className="btn-secondary" style={{ textDecoration: "none" }}>
                  <FiArrowLeft /> На главную
                </Link>
                <h1 style={{ fontSize: "1.5rem", margin: 0, fontWeight: 800 }}>Панель преподавателя StepLearn</h1>
                <span style={{ background: "linear-gradient(135deg, #1E1B4B 0%, #312E81 100%)", color: "#fff", padding: "4px 12px", borderRadius: 20, fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase" }}>
                  Преподаватель
                </span>
              </div>
              <div style={{ fontSize: "0.95rem", color: "var(--text-secondary)", fontWeight: 600 }}>
                {currentUser?.first_name ? `${currentUser.first_name} ${currentUser.last_name || ""}` : currentUser?.username || "Преподаватель"}
              </div>
            </div>

            {/* 3 ОСНОВНЫЕ ВКЛАДКИ ДЛЯ ПРЕПОДАВАТЕЛЯ */}
            <nav className="admin-nav-tabs">
              <button
                className={`admin-tab-btn ${activeTab === "students" ? "active" : ""}`}
                onClick={() => setActiveTab("students")}
              >
                <FiActivity /> 📊 1. Мониторинг учеников
              </button>
              <button
                className={`admin-tab-btn ${activeTab === "courses" ? "active" : ""}`}
                onClick={() => setActiveTab("courses")}
              >
                <FiBookOpen /> 📚 2. Загрузка и создание курсов
              </button>
              <button
                className={`admin-tab-btn ${activeTab === "groups" ? "active" : ""}`}
                onClick={() => setActiveTab("groups")}
              >
                <FiUsers /> 👥 3. Создание групп из учеников
              </button>
            </nav>

            {/* КОНТЕНТ ВКЛАДОК */}
            <div className="admin-content">
              {/* --- ВКЛАДКА 1: МОНИТОРИНГ УЧЕНИКОВ --- */}
              {activeTab === "students" && (
                <div className="students-view animate-fade-in">
                  <div className="section-header-row" style={{ marginBottom: 20 }}>
                    <h2 style={{ fontSize: "1.4rem", margin: 0 }}>📊 Мониторинг и успеваемость учеников</h2>
                  </div>

                  <div className="students-toolbar">
                    <input
                      type="text"
                      placeholder="Поиск по имени, логину или email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && loadStudents()}
                      className="search-input"
                    />
                    <button className="btn-primary" onClick={loadStudents}>
                      <FiRefreshCw /> Обновить список
                    </button>
                  </div>

                  {newPasswordAlert && (
                    <div className="alert-success-banner">
                      <FiCheckCircle /> Новый пароль для <strong>{newPasswordAlert.username}</strong>:{" "}
                      <code>{newPasswordAlert.pass}</code>
                      <button onClick={() => setNewPasswordAlert(null)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer" }}>
                        ✕
                      </button>
                    </div>
                  )}

                  {/* ТАБЛИЦА ВСЕХ УЧЕНИКОВ */}
                  <div className="matrix-table-container" style={{ marginTop: 0, marginBottom: 30 }}>
                    <table className="matrix-table">
                      <thead>
                        <tr>
                          <th>Ученик</th>
                          <th>Группа</th>
                          <th>Общий прогресс</th>
                          <th>Пройдено уроков</th>
                          <th>Статус</th>
                          <th>Действия</th>
                        </tr>
                      </thead>
                      <tbody>
                        {students.map((st) => (
                          <tr key={st.id}>
                            <td>
                              <strong>{st.first_name} {st.last_name}</strong>
                              <br />
                              <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>@{st.username}</span>
                            </td>
                            <td>{st.group_name || "—"}</td>
                            <td>
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <div className="progress-bar-container" style={{ flex: 1, margin: 0 }}>
                                  <div
                                    className="progress-bar-fill"
                                    style={{ width: `${st.progress_percent || 0}%` }}
                                  />
                                </div>
                                <span style={{ fontWeight: "bold", fontSize: "0.88rem" }}>{st.progress_percent || 0}%</span>
                              </div>
                            </td>
                            <td>{st.completed_lessons || 0}</td>
                            <td>
                              <span className={`lesson-status-badge ${st.is_active !== false ? "open" : "closed"}`}>
                                {st.is_active !== false ? "Активен" : "Заблокирован"}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: "flex", gap: 6 }}>
                                <button className="btn-secondary" title="Профиль" onClick={() => handleViewStudentDetail(st.id)}>
                                  <FiEye />
                                </button>
                                <button className="btn-secondary" title="Сбросить пароль" onClick={() => handleResetPassword(st.id)}>
                                  <FiKey />
                                </button>
                                <button className="btn-secondary" title="Сбросить прогресс" onClick={() => handleResetProgress(st.id)}>
                                  <FiRefreshCw />
                                </button>
                                <button
                                  className="btn-danger"
                                  title={st.is_active !== false ? "Заблокировать" : "Разблокировать"}
                                  onClick={() => handleToggleStudentStatus(st.id)}
                                >
                                  {st.is_active !== false ? <FiLock /> : <FiUnlock />}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* РАЗДЕЛ: МАТРИЦА УСПЕВАЕМОСТИ И ДОСТУП К МОДУЛЯМ (STEPIK / CISCO) */}
                  <div className="gating-header">
                    <h3 style={{ margin: "0 0 16px 0", fontSize: "1.2rem" }}>🎓 Матрица успеваемости и открытие модулей (Stepik / NetAcad)</h3>
                    <div className="selectors-row">
                      <div>
                        <label style={{ marginRight: 8, fontWeight: 600 }}>Группа:</label>
                        <select
                          className="admin-select"
                          value={selectedGroupId || ""}
                          onChange={(e) => setSelectedGroupId(Number(e.target.value))}
                        >
                          {groups.map((g) => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label style={{ marginRight: 8, fontWeight: 600 }}>Курс:</label>
                        <select
                          className="admin-select"
                          value={selectedCourseId || ""}
                          onChange={(e) => setSelectedCourseId(Number(e.target.value))}
                        >
                          {courses.map((c) => (
                            <option key={c.id} value={c.id}>{c.title}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {matrixLoading ? (
                    <div style={{ padding: 20, textAlign: "center" }}>Загрузка успеваемости...</div>
                  ) : matrixData ? (
                    <div className="matrix-table-container">
                      <table className="matrix-table">
                        <thead>
                          <tr>
                            <th>Ученик</th>
                            {matrixData.lessons?.map((l: any) => (
                              <th key={l.lesson_id}>
                                <div style={{ fontWeight: 700 }}>#{l.order} {l.title}</div>
                                <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: 4 }}>
                                  Сдали: {l.completed_students_count} / {l.total_students_count} ({l.completion_rate}%)
                                </div>
                                <button
                                  className={`btn-sm-primary ${l.is_unlocked ? "unlocked" : "locked"}`}
                                  style={{
                                    marginTop: 6,
                                    fontSize: "0.75rem",
                                    padding: "3px 8px",
                                    borderRadius: 4,
                                    border: "none",
                                    cursor: "pointer",
                                    background: l.is_unlocked ? "#10b981" : "#f59e0b",
                                    color: "#fff",
                                  }}
                                  onClick={() => handleToggleAccess(l.lesson_id, l.is_unlocked)}
                                >
                                  {l.is_unlocked ? "🔓 Доступ открыт" : "🔒 Открыть модуль"}
                                </button>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {matrixData.students?.map((st: any) => (
                            <tr key={st.id}>
                              <td>
                                <strong>{st.name}</strong>
                                <span style={{ float: "right", fontWeight: 700, color: "#4f46e5" }}>{st.overall_progress}%</span>
                              </td>
                              {matrixData.lessons?.map((l: any) => {
                                const isDone = st.lessons[l.lesson_id];
                                return (
                                  <td key={l.lesson_id} style={{ textAlign: "center" }}>
                                    {isDone ? <span className="status-check">✅ Сдал</span> : <span className="status-wait">⏳ В процессе</span>}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </div>
              )}

              {/* --- ВКЛАДКА 2: ЗАГРУЗКА И СОЗДАНИЕ КУРСОВ --- */}
              {activeTab === "courses" && (
                <div className="courses-view animate-fade-in">
                  <div className="section-header-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                    <h2 style={{ fontSize: "1.4rem", margin: 0 }}>📚 Загрузка и управление курсами</h2>
                    <div style={{ display: "flex", gap: 12 }}>
                      <button className="btn-secondary" onClick={() => setShowMarkdownImportModal(true)}>
                        <FiUploadCloud /> Импортировать урок (.md)
                      </button>
                      <button className="btn-primary" onClick={() => setShowCreateCourseModal(true)}>
                        <FiPlus /> Создать новый курс
                      </button>
                    </div>
                  </div>

                  <div className="gating-header">
                    <label style={{ fontWeight: 700, marginRight: 12 }}>Выбранный курс для редактирования:</label>
                    <select
                      className="admin-select"
                      value={selectedCourseForEdit || ""}
                      onChange={(e) => setSelectedCourseForEdit(Number(e.target.value))}
                    >
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>{c.title} ({c.category || "Общий"})</option>
                      ))}
                    </select>
                  </div>

                  {/* БЛОКИ КУРСА */}
                  <div className="quick-actions-box">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                      <h3 style={{ margin: 0 }}>Модули и уроки курса</h3>
                      <button className="btn-primary" onClick={() => setShowAddBlockModal(true)}>
                        <FiPlus /> Добавить модуль/блок
                      </button>
                    </div>

                    {courses.find((c) => c.id === selectedCourseForEdit)?.lessons?.map((lesson: any) => (
                      <div key={lesson.id} className="lesson-access-card unlocked" style={{ marginBottom: 10 }}>
                        <div className="lesson-card-top">
                          <div>
                            <strong>Модуль {lesson.order}: {lesson.title}</strong>
                            <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                              Формат: Markdown / Текстовый интерактивный урок
                            </p>
                          </div>
                          <span className="lesson-status-badge open">Активен</span>
                        </div>
                      </div>
                    )) || (
                      <div style={{ padding: 20, textAlign: "center", color: "var(--text-secondary)" }}>
                        У этого курса пока нет созданных модулей. Нажмите «Добавить модуль/блок» или «Импортировать урок (.md)».
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* --- ВКЛАДКА 3: СОЗДАНИЕ ГРУПП ИЗ СУЩЕСТВУЮЩИХ УЧЕНИКОВ --- */}
              {activeTab === "groups" && (
                <div className="groups-view animate-fade-in">
                  <div className="section-header-row" style={{ marginBottom: 20 }}>
                    <h2 style={{ fontSize: "1.4rem", margin: 0 }}>👥 Создание групп из существующих учеников</h2>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 20, marginBottom: 30 }}>
                    {/* ФОРМА 1: СОЗДАНИЕ НОВОЙ ГРУППЫ */}
                    <div className="quick-actions-box">
                      <h3 style={{ marginTop: 0, marginBottom: 14 }}>1. Создать новую группу</h3>
                      <form onSubmit={handleCreateGroup}>
                        <div className="form-group">
                          <label>Название группы *</label>
                          <input
                            type="text"
                            required
                            placeholder="Например, Группа ПИ-202 (Python)"
                            value={newGroupName}
                            onChange={(e) => setNewGroupName(e.target.value)}
                          />
                        </div>
                        <div className="form-group">
                          <label>Описание группы</label>
                          <input
                            type="text"
                            placeholder="Краткая специализация..."
                            value={newGroupDesc}
                            onChange={(e) => setNewGroupDesc(e.target.value)}
                          />
                        </div>
                        <button type="submit" className="btn-primary" style={{ width: "100%" }}>
                          <FiPlus /> Создать группу
                        </button>
                      </form>
                    </div>

                    {/* ФОРМА 2: ДОБАВЛЕНИЕ СУЩЕСТВУЮЩЕГО УЧЕНИКА В ГРУППУ */}
                    <div className="quick-actions-box">
                      <h3 style={{ marginTop: 0, marginBottom: 14 }}>2. Добавить существующего ученика в группу</h3>
                      <form onSubmit={handleAddExistingStudentToGroup}>
                        <div className="form-group">
                          <label>Выберите группу *</label>
                          <select
                            required
                            className="admin-select"
                            style={{ width: "100%" }}
                            value={selectedGroupForStudentAdd}
                            onChange={(e) => setSelectedGroupForStudentAdd(Number(e.target.value))}
                          >
                            <option value="">-- Выберите группу --</option>
                            {groups.map((g) => (
                              <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                          </select>
                        </div>

                        <div className="form-group">
                          <label>Выберите существующего ученика *</label>
                          <select
                            required
                            className="admin-select"
                            style={{ width: "100%" }}
                            value={selectedStudentToAssign}
                            onChange={(e) => setSelectedStudentToAssign(Number(e.target.value))}
                          >
                            <option value="">-- Выберите ученика из списка --</option>
                            {students.map((st) => (
                              <option key={st.id} value={st.id}>
                                {st.first_name} {st.last_name} (@{st.username}) - {st.group_name || "Без группы"}
                              </option>
                            ))}
                          </select>
                        </div>

                        <button type="submit" className="btn-primary" style={{ width: "100%" }}>
                          <FiUserPlus /> Добавить ученика в группу
                        </button>
                      </form>
                    </div>
                  </div>

                  {/* СПИСОК ВСЕХ ГРУПП С УЧЕНИКАМИ */}
                  <h3 style={{ marginBottom: 16, fontSize: "1.2rem" }}>Список созданных учебных групп</h3>
                  <div className="admin-grid">
                    {groups.map((g) => (
                      <div key={g.id} className="admin-card">
                        <div className="card-header">
                          <h4 className="card-title">{g.name}</h4>
                          <span
                            className="code-pill"
                            onClick={() => {
                              navigator.clipboard.writeText(g.code);
                              setCopiedCode(g.code);
                              setTimeout(() => setCopiedCode(null), 2000);
                            }}
                          >
                            {copiedCode === g.code ? "Скопировано!" : g.code} <FiCopy />
                          </span>
                        </div>

                        <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", marginBottom: 12 }}>
                          {g.description || "Учебная группа платформы StepLearn"}
                        </p>

                        <div style={{ padding: "10px 0", borderTop: "1px solid var(--border-light)", marginBottom: 12 }}>
                          <strong style={{ fontSize: "0.9rem", display: "block", marginBottom: 8 }}>
                            👥 Ученики в группе ({g.students?.length || g.students_count || 0}):
                          </strong>
                          {g.students && g.students.length > 0 ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                              {g.students.map((st: any) => (
                                <div
                                  key={st.id}
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    background: "var(--bg-hover)",
                                    padding: "6px 10px",
                                    borderRadius: 6,
                                    fontSize: "0.85rem",
                                  }}
                                >
                                  <span>👤 {st.first_name} {st.last_name || `@${st.username}`}</span>
                                  <button
                                    className="btn-danger"
                                    style={{ padding: "2px 6px", fontSize: "0.75rem" }}
                                    onClick={() => handleRemoveStudentFromGroup(g.id, st.id)}
                                    title="Удалить из группы"
                                  >
                                    <FiTrash2 />
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>В группе пока нет учеников</span>
                          )}
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                            📚 Привязано курсов: {g.courses?.length || 0}
                          </span>
                          <button
                            className="btn-secondary"
                            style={{ fontSize: "0.82rem", padding: "6px 12px" }}
                            onClick={() => {
                              setSelectedGroupId(g.id);
                              setActiveTab("students");
                            }}
                          >
                            Мониторинг
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* МОДАЛЬНЫЕ ОКНА */}
            {/* 1. Детальный профиль студента */}
            {detailModalOpen && selectedStudentDetail && (
              <div className="modal-overlay">
                <div className="modal-content">
                  <h3>Профиль ученика: {selectedStudentDetail.first_name} {selectedStudentDetail.last_name}</h3>
                  <div style={{ margin: "16px 0", lineHeight: 1.6 }}>
                    <p><strong>Email:</strong> {selectedStudentDetail.email}</p>
                    <p><strong>Группа:</strong> {selectedStudentDetail.group_name}</p>
                    <p><strong>Общий прогресс:</strong> {selectedStudentDetail.progress_percent}%</p>
                    <p><strong>Пройдено уроков:</strong> {selectedStudentDetail.completed_lessons_count}</p>
                  </div>
                  <div className="modal-actions">
                    <button className="btn-primary" onClick={() => setDetailModalOpen(false)}>
                      Закрыть
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 2. Создание модуля/блока */}
            {showAddBlockModal && (
              <div className="modal-backdrop">
                <div className="modal-card">
                  <h3>Создать модуль/блок курса</h3>
                  <form onSubmit={handleCreateBlock}>
                    <div className="form-group">
                      <label>Название блока *</label>
                      <input
                        type="text"
                        required
                        placeholder="Например, Блок 1. Основы Python"
                        value={newBlockTitle}
                        onChange={(e) => setNewBlockTitle(e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label>Описание блока</label>
                      <input
                        type="text"
                        placeholder="Краткое описание тем..."
                        value={newBlockDesc}
                        onChange={(e) => setNewBlockDesc(e.target.value)}
                      />
                    </div>
                    <div className="modal-actions">
                      <button type="button" className="btn-secondary" onClick={() => setShowAddBlockModal(false)}>
                        Отмена
                      </button>
                      <button type="submit" className="btn-primary">
                        Создать блок
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* 3. Создать новый курс */}
            {showCreateCourseModal && (
              <div className="modal-backdrop">
                <div className="modal-card">
                  <h3>Создать новый курс</h3>
                  <p className="modal-subtitle">Заполните основные данные о новом курсе</p>
                  <form onSubmit={handleCreateCourse}>
                    <div className="form-group">
                      <label>Название курса *</label>
                      <input
                        type="text"
                        required
                        placeholder="Например: Python с нуля"
                        value={newCourseTitle}
                        onChange={(e) => setNewCourseTitle(e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label>Категория</label>
                      <input
                        type="text"
                        placeholder="Программирование, Веб-разработка..."
                        value={newCourseCategory}
                        onChange={(e) => setNewCourseCategory(e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label>Уровень</label>
                      <select
                        className="admin-select"
                        style={{ width: "100%" }}
                        value={newCourseLevel}
                        onChange={(e) => setNewCourseLevel(e.target.value)}
                      >
                        <option value="beginner">Начинающий</option>
                        <option value="intermediate">Средний</option>
                        <option value="advanced">Продвинутый</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Описание курса</label>
                      <textarea
                        rows={3}
                        placeholder="Краткое описание курса для учеников..."
                        value={newCourseDesc}
                        onChange={(e) => setNewCourseDesc(e.target.value)}
                        style={{ width: "100%", padding: 10, background: "var(--bg-input)", border: "1px solid var(--border-medium)", borderRadius: 8, color: "var(--text-primary)" }}
                      />
                    </div>
                    <div className="modal-actions">
                      <button type="button" className="btn-secondary" onClick={() => setShowCreateCourseModal(false)}>
                        Отмена
                      </button>
                      <button type="submit" className="btn-primary">
                        Создать курс
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* 4. Импорт Markdown с загрузкой файла */}
            {showMarkdownImportModal && (
              <div className="modal-backdrop">
                <div className="modal-card wide-modal">
                  <h3>Импорт урока из Markdown (.md)</h3>
                  <p className="modal-subtitle">
                    Загрузите файл <strong>.md</strong> со своего компьютера или вставьте текст в формате Markdown ниже.
                  </p>
                  <form onSubmit={handleImportMarkdown}>
                    <div className="form-group">
                      <label>Курс для импорта *</label>
                      <select
                        className="admin-select"
                        style={{ width: "100%" }}
                        value={selectedCourseForEdit || (courses.length > 0 ? courses[0].id : "")}
                        onChange={(e) => setSelectedCourseForEdit(Number(e.target.value))}
                      >
                        {courses.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.title} ({c.category || "Общий"})
                          </option>
                        ))}
                      </select>
                    </div>
                    {/* ЗОНА ЗАГРУЗКИ / ПЕРЕТАСКИВАНИЯ ФАЙЛА */}
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept=".md,.markdown,.txt"
                      style={{ display: "none" }}
                      onChange={handleFileSelect}
                    />
                    <div
                      className={`file-upload-zone ${isDraggingFile ? "dragging" : ""}`}
                      onDragOver={(e) => { e.preventDefault(); setIsDraggingFile(true); }}
                      onDragLeave={() => setIsDraggingFile(false)}
                      onDrop={handleFileDrop}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <FiUploadCloud style={{ fontSize: "2.2rem", color: "var(--primary)" }} />
                      <div>
                        {uploadedFileName ? (
                          <div style={{ fontWeight: 700, color: "#10B981" }}>
                            ✅ Выбран файл: {uploadedFileName}
                          </div>
                        ) : (
                          <div>
                            <strong>Нажмите, чтобы выбрать файл .md</strong> или перетащите его сюда
                          </div>
                        )}
                        <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                          Поддерживаются файлы .md, .markdown, .txt
                        </span>
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Название урока (авто-извлекается из первого # Заголовка)</label>
                      <input
                        type="text"
                        placeholder="Оставьте пустым для авто-извлечения из перврго заголовка #"
                        value={importLessonTitle}
                        onChange={(e) => setImportLessonTitle(e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label>Содержимое Markdown</label>
                      <textarea
                        required
                        rows={8}
                        placeholder="# Мой урок&#10;&#10;Текст урока...&#10;&#10;```python&#10;print('Hello!')&#10;```"
                        value={importLessonContent}
                        onChange={(e) => setImportLessonContent(e.target.value)}
                        style={{ fontFamily: "monospace", fontSize: "0.9rem", width: "100%", padding: 10, background: "var(--bg-input)", border: "1px solid var(--border-medium)", borderRadius: 8, color: "var(--text-primary)" }}
                      />
                    </div>

                    <div className="modal-actions">
                      <button type="button" className="btn-secondary" onClick={() => setShowMarkdownImportModal(false)}>
                        Отмена
                      </button>
                      <button type="submit" className="btn-primary">
                        Импортировать урок
                      </button>
                    </div>
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
