// StepLearn Teacher Panel (Панель преподавателя)
import axios from "axios";
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
  FiUserPlus,
  FiRefreshCw,
  FiActivity,
  FiAward,
  FiKey,
  FiUploadCloud,
  FiEye,
  FiFileText,
  FiArchive,
} from "react-icons/fi";
import {
  fetchGroups,
  createGroup,
  addStudentToGroup,
  removeStudentFromGroup,
  assignCourseToGroup,
  fetchGroupProgressMatrix,
  toggleGroupLessonAccess,
  fetchTeacherCourses,
  fetchTeacherDashboard,
  fetchTeacherStudents,
  quickCreateStudent,
  fetchTeacherStudentDetail,
  resetStudentPassword,
  resetStudentProgress,
  toggleStudentStatus,
  setStudentArchived,
  updateTeacherStudent,
  importCourseMarkdown,
  createCourse,
  updateCourse,
} from "../../api/api";
import type { TeacherDashboardSummary } from "../../api/api";
import TeacherSubmissionsPanel from "./TeacherSubmissionsPanel";
import TeacherAssignmentsPanel from "./TeacherAssignmentsPanel";
import TeacherCourseContentPanel from "./TeacherCourseContentPanel";
import "../../styles/StyleHomePage.css";
import "./StyleAdminPanel.css";

interface AdminPanelProps {
  theme: "dark" | "light";
  toggleTheme: () => void;
}

function getStudentActionError(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const responseStatus = error.response?.status;
    if (responseStatus === 401) return "Сессия истекла. Войдите в систему повторно.";
    if (responseStatus === 403) {
      const detail = error.response?.data?.detail;
      return typeof detail === "string"
        ? `Недостаточно прав: ${detail}`
        : "Недостаточно прав для этого действия.";
    }
    if (responseStatus === 409) {
      const detail = error.response?.data?.detail;
      return typeof detail === "string" ? detail : "Действие невозможно в текущем состоянии ученика.";
    }
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (!error.response) return "Сервер недоступен. Проверьте соединение и повторите попытку.";
  }
  return fallback;
}

export default function AdminPanel({ theme, toggleTheme }: AdminPanelProps) {
  const navigate = useNavigate();
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const [activeTab, setActiveTab] = useState<"dashboard" | "students" | "submissions" | "courses" | "groups">("dashboard");

  // Студенты и Мониторинг
  const [students, setStudents] = useState<any[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentsError, setStudentsError] = useState<string | null>(null);
  const [studentActionMessage, setStudentActionMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [dataLoadError, setDataLoadError] = useState<string | null>(null);
  const [workflowMessage, setWorkflowMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showArchivedStudents, setShowArchivedStudents] = useState(false);
  const [selectedStudentDetail, setSelectedStudentDetail] = useState<any>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(false);
  const [studentEditForm, setStudentEditForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
  });
  const [studentEditError, setStudentEditError] = useState<string | null>(null);
  const [studentEditLoading, setStudentEditLoading] = useState(false);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [quickCreateFirstName, setQuickCreateFirstName] = useState("");
  const [quickCreateLastName, setQuickCreateLastName] = useState("");
  const [quickCreateGroupId, setQuickCreateGroupId] = useState<number | "">("");
  const [quickCreateLoading, setQuickCreateLoading] = useState(false);
  const [dashboard, setDashboard] = useState<TeacherDashboardSummary | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

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
  const [groupCourseSelections, setGroupCourseSelections] = useState<Record<number, number | "">>({});
  const [matrixData, setMatrixData] = useState<any>(null);
  const [matrixError, setMatrixError] = useState<string | null>(null);
  const [matrixLoading, setMatrixLoading] = useState(false);

  // Редактор курсов и Markdown импорт
  const [selectedCourseForEdit, setSelectedCourseForEdit] = useState<number | null>(null);

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
  const [newGroupCapacity, setNewGroupCapacity] = useState(6);
  const [newGroupStudents, setNewGroupStudents] = useState(
    Array.from({ length: 6 }, () => ({ first_name: "", last_name: "" }))
  );
  const [createdGroupCredentials, setCreatedGroupCredentials] = useState<any[] | null>(null);
  const [selectedGroupForStudentAdd, setSelectedGroupForStudentAdd] = useState<number | "">("");
  const [selectedStudentToAssign, setSelectedStudentToAssign] = useState<number | "">("");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const showWorkflowError = (error: unknown, fallback: string) => {
    setWorkflowMessage({ kind: "error", text: getStudentActionError(error, fallback) });
  };

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
        fetchGroups(userId),
        fetchTeacherCourses(),
      ]);
      const loadedGroups = Array.isArray(groupsData) ? groupsData : [];
      const loadedCourses = Array.isArray(coursesData) ? coursesData : [];
      setGroups(loadedGroups);
      setCourses(loadedCourses);
      if (loadedGroups.length > 0) {
        setSelectedGroupId(loadedGroups[0].id);
        setSelectedGroupForStudentAdd(loadedGroups[0].id);
        if (loadedGroups[0].courses?.length > 0) {
          setSelectedCourseId(loadedGroups[0].courses[0].id);
        }
      }
      if (loadedCourses.length > 0) {
        setSelectedCourseForEdit(loadedCourses[0].id);
      }

      setDataLoadError(null);
      void loadStudents();
      void loadDashboard();
    } catch (e) {
      console.error("Ошибка инициализации панели:", e);
      setDataLoadError(getStudentActionError(e, "Не удалось загрузить группы и курсы."));
    } finally {
      setLoading(false);
    }
  };

  const loadStudents = async (includeArchived = showArchivedStudents): Promise<boolean> => {
    setStudentsLoading(true);
    try {
      const data = await fetchTeacherStudents({
        q: searchQuery,
        ...(includeArchived ? { include_archived: true } : {}),
      });
      setStudents(Array.isArray(data) ? data : []);
      setStudentsError(null);
      return true;
    } catch (e) {
      console.error("Ошибка загрузки студентов:", e);
      setStudents([]);
      setStudentsError(getStudentActionError(e, "Не удалось загрузить список учеников."));
      return false;
    } finally {
      setStudentsLoading(false);
    }
  };

  const loadDashboard = async () => {
    setDashboardLoading(true);
    try {
      setDashboard(await fetchTeacherDashboard());
      setDashboardError(null);
    } catch (e) {
      console.error("Не удалось загрузить сводку преподавателя", e);
      setDashboardError(getStudentActionError(e, "Не удалось загрузить статистику."));
    } finally {
      setDashboardLoading(false);
    }
  };

  const handleQuickCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setStudentActionMessage(null);
    setQuickCreateLoading(true);
    try {
      const created = await quickCreateStudent({
        first_name: quickCreateFirstName.trim(),
        last_name: quickCreateLastName.trim(),
        ...(quickCreateGroupId ? { group_id: Number(quickCreateGroupId) } : {}),
      });
      const createdStudent = {
        ...created.user,
        username: created.username,
        group_id: created.group_id,
        group_name: created.group_name,
        progress_percent: 0,
        completed_lessons: 0,
      };
      setStudents((previous) => [createdStudent, ...previous]);
      if (created.group_id) {
        setGroups((previous) => previous.map((group) => group.id === created.group_id
          ? {
            ...group,
            students: [...(group.students || []), created.user],
            students_count: (group.students_count || 0) + 1,
          }
          : group));
      }
      setNewPasswordAlert({ username: created.username, pass: created.password });
      setQuickCreateFirstName("");
      setQuickCreateLastName("");
      setQuickCreateGroupId("");
      setQuickCreateOpen(false);
    } catch (e) {
      console.error("Не удалось создать ученика", e);
      setStudentActionMessage({
        kind: "error",
        text: getStudentActionError(e, "Не удалось создать ученика. Проверьте введённые данные."),
      });
    } finally {
      setQuickCreateLoading(false);
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
    setMatrixData(null);
    setMatrixError(null);
    try {
      const data = await fetchGroupProgressMatrix(groupId, courseId);
      setMatrixData(data);
      setMatrixError(null);
    } catch (e) {
      console.error("Не удалось загрузить матрицу группы", e);
      setMatrixData(null);
      setMatrixError(getStudentActionError(e, "Не удалось загрузить матрицу. Проверьте, назначен ли этот курс группе."));
    } finally {
      setMatrixLoading(false);
    }
  };

  const handleToggleAccess = async (lessonId: number, currentUnlocked: boolean) => {
    if (!selectedGroupId) return;
    setWorkflowMessage(null);
    try {
      await toggleGroupLessonAccess(selectedGroupId, lessonId, {
        is_unlocked: !currentUnlocked,
      });
      if (selectedCourseId) await loadMatrix(selectedGroupId, selectedCourseId);
      setWorkflowMessage({ kind: "success", text: "Доступ к уроку обновлён." });
    } catch (e) {
      console.error("Не удалось изменить доступ к модулю", e);
      showWorkflowError(e, "Не удалось изменить доступ к уроку.");
    }
  };

  const handleAssignCourseToGroup = async (groupId: number) => {
    const courseId = groupCourseSelections[groupId];
    if (!courseId) {
      setWorkflowMessage({ kind: "error", text: "Выберите курс для назначения группе." });
      return;
    }
    setWorkflowMessage(null);
    try {
      await assignCourseToGroup(groupId, courseId);
      const course = courses.find((item) => item.id === courseId);
      setGroups((previous) =>
        previous.map((group) =>
          group.id === groupId && course
            ? { ...group, courses: [...(group.courses || []), course] }
            : group
        )
      );
      setGroupCourseSelections((previous) => ({ ...previous, [groupId]: "" }));
      setWorkflowMessage({ kind: "success", text: "Курс назначен группе." });
    } catch (e) {
      console.error("Не удалось назначить курс группе", e);
      showWorkflowError(e, "Не удалось назначить курс группе.");
    }
  };

  const handleCourseStatusChange = async (courseId: number, status: "draft" | "published" | "archived") => {
    setWorkflowMessage(null);
    try {
      const updated = await updateCourse(courseId, { status });
      setCourses((previous) =>
        previous.map((course) => course.id === courseId ? { ...course, ...updated } : course)
      );
      setWorkflowMessage({ kind: "success", text: "Статус курса обновлён." });
    } catch (e) {
      console.error("Не удалось изменить статус курса", e);
      showWorkflowError(e, "Не удалось изменить статус курса.");
    }
  };

  // Действия над студентами
  const handleResetPassword = async (studentId: number) => {
    if (!window.confirm("Сгенерировать новый пароль для студента?")) return;
    setStudentActionMessage(null);
    try {
      const res = await resetStudentPassword(studentId);
      setNewPasswordAlert({ username: res.username || "Студент", pass: res.new_password });
    } catch (e) {
      setStudentActionMessage({ kind: "error", text: getStudentActionError(e, "Не удалось сбросить пароль.") });
    }
  };

  const handleResetProgress = async (studentId: number) => {
    if (!window.confirm("Сбросить весь прогресс обучения студента?")) return;
    setStudentActionMessage(null);
    try {
      await resetStudentProgress(studentId);
      if (await loadStudents()) {
        setStudentActionMessage({ kind: "success", text: "Прогресс ученика сброшен." });
      }
    } catch (e) {
      setStudentActionMessage({ kind: "error", text: getStudentActionError(e, "Не удалось сбросить прогресс.") });
    }
  };

  const handleToggleStudentStatus = async (studentId: number) => {
    setStudentActionMessage(null);
    try {
      const res = await toggleStudentStatus(studentId);
      setStudentActionMessage({ kind: "success", text: `Статус ученика: ${res.status_text}.` });
      setStudents((prev) =>
        prev.map((s) => (s.id === studentId ? { ...s, is_active: res.is_active } : s))
      );
    } catch (e) {
      setStudentActionMessage({ kind: "error", text: getStudentActionError(e, "Не удалось изменить статус ученика.") });
    }
  };

  const handleSetStudentArchived = async (studentId: number, isArchived: boolean) => {
    const message = isArchived
      ? "Переместить ученика в архив? Данные и прогресс сохранятся, но вход в аккаунт будет заблокирован."
      : "Восстановить ученика из архива? Доступ к аккаунту вернётся с прежним статусом блокировки.";
    if (!window.confirm(message)) return;
    setStudentActionMessage(null);
    try {
      await setStudentArchived(studentId, isArchived);
      if (await loadStudents()) {
        setStudentActionMessage({
          kind: "success",
          text: isArchived ? "Ученик архивирован. Его учебные данные сохранены." : "Ученик восстановлен из архива.",
        });
      }
    } catch (error) {
      console.error("Не удалось изменить состояние архива ученика", error);
      setStudentActionMessage({
        kind: "error",
        text: getStudentActionError(error, "Не удалось изменить состояние архива ученика."),
      });
    }
  };

  const handleViewStudentDetail = async (studentId: number) => {
    setStudentActionMessage(null);
    try {
      const data = await fetchTeacherStudentDetail(studentId);
      setSelectedStudentDetail(data);
      setStudentEditForm({
        first_name: data.first_name || "",
        last_name: data.last_name || "",
        email: data.email || "",
      });
      setEditingStudent(false);
      setStudentEditError(null);
      setDetailModalOpen(true);
    } catch (e) {
      setStudentActionMessage({ kind: "error", text: getStudentActionError(e, "Не удалось загрузить профиль ученика.") });
    }
  };

  const handleUpdateStudent = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedStudentDetail) return;

    setStudentEditLoading(true);
    setStudentEditError(null);
    try {
      const updated = await updateTeacherStudent(selectedStudentDetail.id, studentEditForm);
      setSelectedStudentDetail((previous: any) => ({ ...previous, ...updated }));
      setStudents((previous) => previous.map((student) => (
        student.id === updated.id
          ? { ...student, ...updated, name: `${updated.first_name} ${updated.last_name}`.trim() }
          : student
      )));
      setEditingStudent(false);
    } catch (error) {
      console.error("Не удалось обновить профиль ученика:", error);
      setStudentEditError(getStudentActionError(error, "Не удалось сохранить профиль. Проверьте введённые данные."));
    } finally {
      setStudentEditLoading(false);
    }
  };

  // Добавление существующего ученика в группу
  const handleAddExistingStudentToGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroupForStudentAdd || !selectedStudentToAssign) {
      setWorkflowMessage({ kind: "error", text: "Выберите группу и существующего ученика." });
      return;
    }
    const groupId = Number(selectedGroupForStudentAdd);
    const studentId = Number(selectedStudentToAssign);
    const studentObj = students.find((s) => s.id === studentId);
    const targetGroup = groups.find((g) => g.id === groupId);

    try {
      setWorkflowMessage(null);
      const updatedGroup = await addStudentToGroup(groupId, { student_id: studentId });

      setGroups((prevGroups) =>
        prevGroups.map((g) => {
          if (g.id === groupId) {
            if (updatedGroup?.students) return updatedGroup;
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

      setWorkflowMessage({
        kind: "success",
        text: `Ученик ${studentObj ? `${studentObj.first_name} ${studentObj.last_name}` : ""} добавлен в группу «${targetGroup?.name}».`,
      });
      setSelectedStudentToAssign("");
    } catch (err) {
      showWorkflowError(err, "Не удалось добавить ученика в группу.");
    }
  };

  // Удаление ученика из группы
  const handleRemoveStudentFromGroup = async (groupId: number, studentId: number) => {
    if (!window.confirm("Удалить этого ученика из группы?")) return;
    try {
      setWorkflowMessage(null);
      await removeStudentFromGroup(groupId, studentId);
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
      setWorkflowMessage({ kind: "success", text: "Ученик удалён из группы." });
    } catch (e) {
      showWorkflowError(e, "Не удалось удалить ученика из группы.");
    }
  };

  // Создание группы
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    if (
      newGroupStudents.length !== newGroupCapacity ||
      newGroupStudents.some((student) => !student.first_name.trim() || !student.last_name.trim())
    ) {
      setWorkflowMessage({ kind: "error", text: "Заполните имя и фамилию каждого ученика в группе." });
      return;
    }
    try {
      setWorkflowMessage(null);
      const g = await createGroup({
        name: newGroupName.trim(),
        description: newGroupDesc.trim(),
        teacher_id: currentUser?.id,
        capacity: newGroupCapacity,
        students: newGroupStudents.map((student) => ({
          first_name: student.first_name.trim(),
          last_name: student.last_name.trim(),
        })),
      });

      setGroups((prev) => [...prev, g]);
      setSelectedGroupId(g.id);
      setSelectedGroupForStudentAdd(g.id);
      setCreatedGroupCredentials(g.created_students || []);
      setStudents((prev) => [
        ...prev,
        ...(g.created_students || []).map((item: any) => ({
          ...item.user,
          group_name: g.name,
        })),
      ]);
      setShowCreateGroupModal(false);
      setNewGroupName("");
      setNewGroupDesc("");
      setNewGroupCapacity(6);
      setNewGroupStudents(Array.from({ length: 6 }, () => ({ first_name: "", last_name: "" })));
      setWorkflowMessage({ kind: "success", text: "Группа и учётные записи учеников созданы." });
    } catch (e) {
      console.error("Не удалось создать группу и учётные записи учеников", e);
      showWorkflowError(e, "Не удалось создать группу.");
    }
  };

  // Создание нового курса
  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourseTitle.trim()) {
      setWorkflowMessage({ kind: "error", text: "Укажите название курса." });
      return;
    }
    try {
      setWorkflowMessage(null);
      const created = await createCourse({
        title: newCourseTitle.trim(),
        description: newCourseDesc.trim(),
        category: newCourseCategory,
        level: newCourseLevel,
        price: Number(newCoursePrice) || 0,
      });

      setCourses((prev) => [created, ...prev]);
      setSelectedCourseForEdit(created.id);
      setShowCreateCourseModal(false);
      setNewCourseTitle("");
      setNewCourseDesc("");
      setNewCoursePrice(0);
      setWorkflowMessage({ kind: "success", text: `Курс «${created.title}» создан. Теперь добавьте разделы, уроки и задания.` });
    } catch (e) {
      showWorkflowError(e, "Не удалось создать курс.");
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
      setWorkflowMessage({ kind: "error", text: "Сначала создайте курс, затем импортируйте урок." });
      return;
    }
    if (!importLessonContent.trim()) {
      setWorkflowMessage({ kind: "error", text: "Выберите файл .md или вставьте текст в формате Markdown." });
      return;
    }
    try {
      setWorkflowMessage(null);
      const newLesson = await importCourseMarkdown(targetCourseId, {
        title: importLessonTitle.trim() || undefined,
        content: importLessonContent.trim(),
        block_id: importBlockId ? Number(importBlockId) : undefined,
      });

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
      setWorkflowMessage({ kind: "success", text: "Урок из Markdown импортирован в курс." });
    } catch (e) {
      showWorkflowError(e, "Не удалось импортировать урок из Markdown.");
    }
  };

  return (
    <div className="sl-app">
      <header className="teacher-site-header">
        <Link to="/admin-panel" className="teacher-site-brand">StepLearn <span>TEACHER</span></Link>
        <div className="teacher-site-header__actions">
          <span>{currentUser?.first_name ? `${currentUser.first_name} ${currentUser.last_name || ""}` : currentUser?.username}</span>
          <button className="btn-secondary" onClick={toggleTheme}>
            {theme === "dark" ? "Светлая тема" : "Тёмная тема"}
          </button>
          <button
            className="btn-secondary"
            onClick={() => {
              localStorage.removeItem("currentUser");
              window.dispatchEvent(new Event("currentUserChanged"));
              navigate("/login");
            }}
          >
            Выйти
          </button>
        </div>
      </header>
      <div className="sl-layout sl-layout--full">
        <main className="sl-main" style={{ marginLeft: 0, padding: "24px 32px", width: "100%", maxWidth: "1400px", margin: "0 auto" }}>
          <div className="admin-container">
            {/* ТИТУЛЬНЫЙ ЗАГОЛОВОК ПРЕПОДАВАТЕЛЯ */}
            <div className="admin-header-bar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid var(--border-light)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <h1 style={{ fontSize: "1.5rem", margin: 0, fontWeight: 800 }}>Панель преподавателя StepLearn</h1>
                <span style={{ background: "linear-gradient(135deg, #1E1B4B 0%, #312E81 100%)", color: "#fff", padding: "4px 12px", borderRadius: 20, fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase" }}>
                  Преподаватель
                </span>
              </div>
              <div style={{ fontSize: "0.95rem", color: "var(--text-secondary)", fontWeight: 600 }}>
                {currentUser?.first_name ? `${currentUser.first_name} ${currentUser.last_name || ""}` : currentUser?.username || "Преподаватель"}
              </div>
            </div>

            {loading && <div role="status">Загружаем группы и курсы...</div>}
            {dataLoadError && (
              <div className="error-state" role="alert">
                {dataLoadError}{" "}
                <button
                  className="btn-secondary"
                  onClick={() => currentUser && loadInitialData(currentUser.id)}
                >
                  Повторить
                </button>
              </div>
            )}

            {/* Основные разделы кабинета преподавателя */}
            <nav className="admin-nav-tabs">
              <button
                className={`admin-tab-btn ${activeTab === "dashboard" ? "active" : ""}`}
                onClick={() => setActiveTab("dashboard")}
              >
                <FiActivity /> Сводка
              </button>
              <button
                className={`admin-tab-btn ${activeTab === "students" ? "active" : ""}`}
                onClick={() => setActiveTab("students")}
              >
                <FiActivity /> 📊 1. Мониторинг учеников
              </button>
              <button
                className={`admin-tab-btn ${activeTab === "submissions" ? "active" : ""}`}
                onClick={() => setActiveTab("submissions")}
              >
                <FiFileText /> Работы на проверку
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
                <FiUsers /> 👥 3. Группы и доступ к материалам
              </button>
            </nav>

            {/* КОНТЕНТ ВКЛАДОК */}
            <div className="admin-content">
              {workflowMessage && (
                <div
                  className={workflowMessage.kind === "error" ? "error-state" : "alert-success-banner"}
                  role={workflowMessage.kind === "error" ? "alert" : "status"}
                >
                  {workflowMessage.text}
                  <button
                    type="button"
                    className="teacher-notice-dismiss"
                    aria-label="Скрыть уведомление"
                    onClick={() => setWorkflowMessage(null)}
                  >
                    ×
                  </button>
                </div>
              )}
              {activeTab === "dashboard" && (
                <section aria-labelledby="teacher-dashboard-title">
                  <div className="section-header-row" style={{ marginBottom: 20 }}>
                    <h2 id="teacher-dashboard-title" style={{ fontSize: "1.4rem", margin: 0 }}>Обзор обучения</h2>
                    <button className="btn-secondary" onClick={loadDashboard} disabled={dashboardLoading}>
                      <FiRefreshCw /> Обновить
                    </button>
                  </div>
                  {dashboardError && <div className="error-state" role="alert">{dashboardError}</div>}
                  {dashboardLoading && !dashboard && <div role="status">Загружаем статистику...</div>}
                  {!dashboardLoading && dashboard && (
                    <div className="dashboard-stats-grid">
                      {[
                        { label: "Ученики", value: dashboard.total_students, icon: <FiUsers /> },
                        { label: "Активные за неделю", value: dashboard.active_students, icon: <FiActivity /> },
                        { label: "Группы", value: dashboard.total_groups, icon: <FiUserPlus /> },
                        { label: "Курсы", value: dashboard.total_courses, icon: <FiBookOpen /> },
                        { label: "Завершённые курсы", value: dashboard.completed_courses_count, icon: <FiAward /> },
                      ].map((stat) => (
                        <article className="stat-card" key={stat.label}>
                          <div className="stat-icon" aria-hidden="true">{stat.icon}</div>
                          <div>
                            <span className="stat-label">{stat.label}</span>
                            <p className="stat-value">{stat.value}</p>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {activeTab === "submissions" && <TeacherSubmissionsPanel />}

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
                    <button className="btn-primary" onClick={() => void loadStudents()}>
                      <FiRefreshCw /> Обновить список
                    </button>
                    <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={showArchivedStudents}
                        onChange={(event) => {
                          const includeArchived = event.target.checked;
                          setShowArchivedStudents(includeArchived);
                          void loadStudents(includeArchived);
                        }}
                      />
                      Показать архив
                    </label>
                    <button className="btn-primary" onClick={() => setQuickCreateOpen((open) => !open)}>
                      <FiUserPlus /> Добавить ученика
                    </button>
                  </div>
                  {studentActionMessage && (
                    <div
                      className={studentActionMessage.kind === "error" ? "error-state" : "alert-success-banner"}
                      role={studentActionMessage.kind === "error" ? "alert" : "status"}
                    >
                      {studentActionMessage.text}
                      <button
                        type="button"
                        className="teacher-notice-dismiss"
                        aria-label="Скрыть уведомление"
                        onClick={() => setStudentActionMessage(null)}
                      >
                        ×
                      </button>
                    </div>
                  )}
                  {quickCreateOpen && (
                    <form className="quick-actions-box" onSubmit={handleQuickCreateStudent}>
                      <h3>Создать учётную запись ученика</h3>
                      <div className="form-group">
                        <label htmlFor="quick-student-first-name">Имя *</label>
                        <input
                          id="quick-student-first-name"
                          required
                          maxLength={150}
                          value={quickCreateFirstName}
                          onChange={(e) => setQuickCreateFirstName(e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="quick-student-last-name">Фамилия *</label>
                        <input
                          id="quick-student-last-name"
                          required
                          maxLength={150}
                          value={quickCreateLastName}
                          onChange={(e) => setQuickCreateLastName(e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="quick-student-group">Группа (необязательно)</label>
                        <select
                          id="quick-student-group"
                          value={quickCreateGroupId}
                          onChange={(e) => setQuickCreateGroupId(e.target.value ? Number(e.target.value) : "")}
                        >
                          <option value="">Без группы</option>
                          {groups.map((group) => (
                            <option key={group.id} value={group.id}>{group.name}</option>
                          ))}
                        </select>
                      </div>
                      <button className="btn-primary" type="submit" disabled={quickCreateLoading}>
                        {quickCreateLoading ? "Создаём..." : "Создать ученика"}
                      </button>
                    </form>
                  )}

                  {newPasswordAlert && (
                    <div className="alert-success-banner">
                      <FiCheckCircle /> Новый пароль для <strong>{newPasswordAlert.username}</strong>:{" "}
                      <code>{newPasswordAlert.pass}</code>
                      <button onClick={() => setNewPasswordAlert(null)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer" }}>
                        ✕
                      </button>
                    </div>
                  )}
                  {studentsError && <div className="error-state" role="alert">{studentsError}</div>}
                  {studentsLoading && <div role="status">Загружаем учеников...</div>}
                  {!studentsLoading && !studentsError && students.length === 0 && (
                    <div className="empty-state">Ученики не найдены. Создайте учётную запись или измените поисковый запрос.</div>
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
                              <span className={`lesson-status-badge ${st.is_archived ? "closed" : st.is_active !== false ? "open" : "closed"}`}>
                                {st.is_archived ? "В архиве" : st.is_active !== false ? "Активен" : "Заблокирован"}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: "flex", gap: 6 }}>
                                <button className="btn-secondary" title="Профиль" onClick={() => handleViewStudentDetail(st.id)}>
                                  <FiEye />
                                </button>
                                {!st.is_archived && (
                                  <>
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
                                  </>
                                )}
                                <button
                                  className={st.is_archived ? "btn-secondary" : "btn-danger"}
                                  title={st.is_archived ? "Восстановить из архива" : "Архивировать"}
                                  onClick={() => handleSetStudentArchived(st.id, !st.is_archived)}
                                >
                                  <FiArchive />
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
                    <h3 style={{ margin: "0 0 16px 0", fontSize: "1.2rem" }}>🎓 Матрица успеваемости и ручной доступ к материалам</h3>
                    <div className="selectors-row">
                      <div>
                        <label style={{ marginRight: 8, fontWeight: 600 }}>Группа:</label>
                        <select
                          className="admin-select"
                          value={selectedGroupId || ""}
                          onChange={(e) => {
                            const groupId = Number(e.target.value);
                            const group = groups.find((item) => item.id === groupId);
                            setSelectedGroupId(groupId);
                            setSelectedCourseId(group?.courses?.[0]?.id || null);
                            setMatrixData(null);
                            setMatrixError(
                              group?.courses?.length
                                ? null
                                : "Сначала назначьте группе курс."
                            );
                          }}
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
                          onChange={(e) => setSelectedCourseId(e.target.value ? Number(e.target.value) : null)}
                        >
                          {(groups.find((group) => group.id === selectedGroupId)?.courses || []).map((c: any) => (
                            <option key={c.id} value={c.id}>{c.title}</option>
                          ))}
                          {!(groups.find((group) => group.id === selectedGroupId)?.courses || []).length && (
                            <option value="">Сначала назначьте группе курс</option>
                          )}
                        </select>
                      </div>
                    </div>
                  </div>

                  {matrixLoading ? (
                    <div style={{ padding: 20, textAlign: "center" }}>Загрузка успеваемости...</div>
                  ) : groups.length === 0 ? (
                    <div className="empty-state">Создайте группу, чтобы просматривать успеваемость.</div>
                  ) : selectedGroupId && !selectedCourseId ? (
                    <div className="empty-state">Назначьте курс выбранной группе, чтобы открыть матрицу успеваемости.</div>
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
                                  {l.is_unlocked ? "🔓 Закрыть вручную" : "🔒 Открыть вручную"}
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
                  ) : matrixError ? (
                    <div className="error-state" role="alert">
                      {matrixError}{" "}
                      {selectedGroupId && selectedCourseId && (
                        <button
                          className="btn-secondary"
                          onClick={() => void loadMatrix(selectedGroupId, selectedCourseId)}
                        >
                          Повторить
                        </button>
                      )}
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
                      <button className="btn-primary" onClick={() => navigate("/create-course")}>
                        Расширенный редактор
                      </button>
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
                    {selectedCourseForEdit && (
                      <label style={{ marginLeft: 16, fontWeight: 700 }}>
                        Статус:
                        <select
                          className="admin-select"
                          style={{ marginLeft: 8 }}
                          value={courses.find((course) => course.id === selectedCourseForEdit)?.status || "published"}
                          onChange={(e) =>
                            handleCourseStatusChange(
                              selectedCourseForEdit,
                              e.target.value as "draft" | "published" | "archived"
                            )
                          }
                        >
                          <option value="draft">Черновик</option>
                          <option value="published">Опубликован</option>
                          <option value="archived">Архив</option>
                        </select>
                      </label>
                    )}
                  </div>

                  <div className="quick-actions-box">
                    {courses.length === 0 && (
                      <div className="empty-state">Курсов пока нет. Создайте курс, чтобы начать добавлять разделы и уроки.</div>
                    )}
                    {selectedCourseForEdit && (
                      <>
                      <TeacherCourseContentPanel
                        key={selectedCourseForEdit}
                        courseId={selectedCourseForEdit}
                      />
                      <TeacherAssignmentsPanel courseId={selectedCourseForEdit} />
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* --- ВКЛАДКА 3: СОЗДАНИЕ ГРУПП ИЗ СУЩЕСТВУЮЩИХ УЧЕНИКОВ --- */}
              {activeTab === "groups" && (
                <div className="groups-view animate-fade-in">
                  <div className="section-header-row" style={{ marginBottom: 20 }}>
                    <h2 style={{ fontSize: "1.4rem", margin: 0 }}>👥 Создание групп и учётных записей учеников</h2>
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
                        <div className="form-group">
                          <label>Количество учеников *</label>
                          <input
                            type="number"
                            required
                            min={1}
                            max={100}
                            value={newGroupCapacity}
                            onChange={(e) => {
                              const capacity = Math.max(1, Math.min(100, Number(e.target.value) || 1));
                              setNewGroupCapacity(capacity);
                              setNewGroupStudents((students) =>
                                Array.from(
                                  { length: capacity },
                                  (_, index) => students[index] || { first_name: "", last_name: "" }
                                )
                              );
                            }}
                          />
                        </div>
                        <div style={{ maxHeight: 320, overflowY: "auto", marginBottom: 14 }}>
                          {newGroupStudents.map((student, index) => (
                            <div
                              key={index}
                              style={{
                                display: "grid",
                                gridTemplateColumns: "1fr 1fr",
                                gap: 8,
                                marginBottom: 8,
                              }}
                            >
                              <input
                                type="text"
                                required
                                maxLength={150}
                                placeholder={`Имя ученика ${index + 1}`}
                                value={student.first_name}
                                onChange={(e) =>
                                  setNewGroupStudents((students) =>
                                    students.map((item, itemIndex) =>
                                      itemIndex === index ? { ...item, first_name: e.target.value } : item
                                    )
                                  )
                                }
                              />
                              <input
                                type="text"
                                required
                                maxLength={150}
                                placeholder="Фамилия"
                                value={student.last_name}
                                onChange={(e) =>
                                  setNewGroupStudents((students) =>
                                    students.map((item, itemIndex) =>
                                      itemIndex === index ? { ...item, last_name: e.target.value } : item
                                    )
                                  )
                                }
                              />
                            </div>
                          ))}
                        </div>
                        <button type="submit" className="btn-primary" style={{ width: "100%" }}>
                          <FiPlus /> Создать группу и учётные записи
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

                  {createdGroupCredentials && (
                    <div className="quick-actions-box" style={{ marginBottom: 24 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <h3 style={{ marginTop: 0 }}>Учётные данные созданных учеников</h3>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => setCreatedGroupCredentials(null)}
                        >
                          Скрыть
                        </button>
                      </div>
                      <p>Сохраните и передайте эти данные ученикам. При первом входе потребуется сменить пароль.</p>
                      {createdGroupCredentials.map((item, index) => (
                        <div key={item.user.id || index} style={{ padding: "8px 0", borderTop: "1px solid var(--border-light)" }}>
                          <strong>{item.first_name} {item.last_name}</strong>
                          <div>Логин: <code>{item.username}</code></div>
                          <div>Временный пароль: <code>{item.password}</code></div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* СПИСОК ВСЕХ ГРУПП С УЧЕНИКАМИ */}
                  <h3 style={{ marginBottom: 16, fontSize: "1.2rem" }}>Список созданных учебных групп</h3>
                  <div className="admin-grid">
                    {groups.length === 0 && (
                      <div className="empty-state">Групп пока нет. Создайте группу с помощью формы выше.</div>
                    )}
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

                        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                          <select
                            className="admin-select"
                            style={{ flex: 1, minWidth: 0 }}
                            value={groupCourseSelections[g.id] || ""}
                            onChange={(e) =>
                              setGroupCourseSelections((previous) => ({
                                ...previous,
                                [g.id]: e.target.value ? Number(e.target.value) : "",
                              }))
                            }
                          >
                            <option value="">Назначить курс...</option>
                            {courses
                              .filter((course) => !(g.courses || []).some((assigned: any) => assigned.id === course.id))
                              .map((course) => (
                                <option key={course.id} value={course.id}>{course.title}</option>
                              ))}
                          </select>
                          <button
                            type="button"
                            className="btn-primary"
                            onClick={() => handleAssignCourseToGroup(g.id)}
                          >
                            Назначить
                          </button>
                        </div>

                        <div style={{ padding: "10px 0", borderTop: "1px solid var(--border-light)", marginBottom: 12 }}>
                          <strong style={{ fontSize: "0.9rem", display: "block", marginBottom: 8 }}>
                            👥 Ученики в группе ({g.students?.length || g.students_count || 0}
                            {g.capacity ? ` / ${g.capacity}` : ""}):
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
                              setSelectedCourseId(g.courses?.[0]?.id || null);
                              setMatrixData(null);
                              setMatrixError(
                                g.courses?.length
                                  ? null
                                  : "Сначала назначьте группе курс."
                              );
                              setActiveTab("students");
                            }}
                          >
                            Мониторинг
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {groups.length === 0 && (
                    <p>Групп пока нет. Создайте группу и добавьте учеников, чтобы назначить им материалы.</p>
                  )}
                </div>
              )}
            </div>

            {/* МОДАЛЬНЫЕ ОКНА */}
            {/* 1. Детальный профиль студента */}
            {detailModalOpen && selectedStudentDetail && (
              <div className="modal-overlay">
                <div className="modal-content">
                  <h3>Профиль ученика: {selectedStudentDetail.first_name} {selectedStudentDetail.last_name}</h3>
                  {studentEditError && <div className="error-state" role="alert">{studentEditError}</div>}
                  {editingStudent ? (
                    <form onSubmit={handleUpdateStudent}>
                      <div className="form-group">
                        <label htmlFor="edit-student-first-name">Имя</label>
                        <input
                          id="edit-student-first-name"
                          required
                          maxLength={150}
                          value={studentEditForm.first_name}
                          onChange={(event) => setStudentEditForm((form) => ({
                            ...form,
                            first_name: event.target.value,
                          }))}
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="edit-student-last-name">Фамилия</label>
                        <input
                          id="edit-student-last-name"
                          required
                          maxLength={150}
                          value={studentEditForm.last_name}
                          onChange={(event) => setStudentEditForm((form) => ({
                            ...form,
                            last_name: event.target.value,
                          }))}
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="edit-student-email">Email</label>
                        <input
                          id="edit-student-email"
                          type="email"
                          required
                          value={studentEditForm.email}
                          onChange={(event) => setStudentEditForm((form) => ({
                            ...form,
                            email: event.target.value,
                          }))}
                        />
                      </div>
                      <div className="modal-actions">
                        <button className="btn-primary" type="submit" disabled={studentEditLoading}>
                          {studentEditLoading ? "Сохраняем..." : "Сохранить"}
                        </button>
                        <button
                          className="btn-secondary"
                          type="button"
                          onClick={() => {
                            setEditingStudent(false);
                            setStudentEditError(null);
                          }}
                          disabled={studentEditLoading}
                        >
                          Отмена
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div style={{ margin: "16px 0", lineHeight: 1.6 }}>
                        <p><strong>Email:</strong> {selectedStudentDetail.email}</p>
                        <p><strong>Группа:</strong> {selectedStudentDetail.group?.name || "Без группы"}</p>
                        <p>
                          <strong>Курсов завершено:</strong>{" "}
                          {selectedStudentDetail.courses?.filter((course: any) => course.progress_percentage === 100).length || 0}
                        </p>
                      </div>
                      {selectedStudentDetail.courses?.length > 0 && (
                        <ul>
                          {selectedStudentDetail.courses.map((course: any) => (
                            <li key={course.course_id}>
                              {course.course_title}: {course.progress_percentage}% ({course.completed_lessons}/{course.total_lessons} уроков)
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}
                  <div className="modal-actions">
                    {!editingStudent && (
                      <button className="btn-secondary" onClick={() => setEditingStudent(true)}>
                        Редактировать профиль
                      </button>
                    )}
                    <button
                      className="btn-primary"
                      onClick={() => {
                        setDetailModalOpen(false);
                        setEditingStudent(false);
                      }}
                    >
                      Закрыть
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Создать новый курс */}
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
