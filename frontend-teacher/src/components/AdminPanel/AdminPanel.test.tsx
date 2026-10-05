import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminPanel from "./AdminPanel";
import {
  fetchGroups,
  fetchTeacherCourses,
  fetchTeacherDashboard,
  fetchTeacherStudents,
  fetchTeacherStudentDetail,
  fetchGroupProgressMatrix,
  fetchCourseBlocks,
  fetchCourseDetail,
  fetchTeacherAssignments,
  quickCreateStudent,
  setStudentArchived,
  toggleGroupLessonAccess,
  updateCourse,
  updateTeacherStudent,
} from "../../api/api";

vi.mock("../../api/api", () => ({
  fetchGroups: vi.fn(),
  createGroup: vi.fn(),
  addStudentToGroup: vi.fn(),
  removeStudentFromGroup: vi.fn(),
  assignCourseToGroup: vi.fn(),
  fetchGroupProgressMatrix: vi.fn(),
  fetchCourseBlocks: vi.fn(),
  fetchCourseDetail: vi.fn(),
  fetchTeacherAssignments: vi.fn(),
  createTeacherAssignment: vi.fn(),
  updateTeacherAssignment: vi.fn(),
  deleteTeacherAssignment: vi.fn(),
  toggleGroupLessonAccess: vi.fn(),
  fetchTeacherCourses: vi.fn(),
  fetchTeacherDashboard: vi.fn(),
  fetchTeacherStudents: vi.fn(),
  fetchTeacherStudentDetail: vi.fn(),
  updateTeacherStudent: vi.fn(),
  fetchCourseAssignments: vi.fn(),
  fetchAssignmentSubmissions: vi.fn(),
  quickCreateStudent: vi.fn(),
  resetStudentPassword: vi.fn(),
  resetStudentProgress: vi.fn(),
  toggleStudentStatus: vi.fn(),
  setStudentArchived: vi.fn(),
  createCourseBlock: vi.fn(),
  importCourseMarkdown: vi.fn(),
  createCourse: vi.fn(),
  updateCourse: vi.fn(),
}));

function renderPanel() {
  return render(
    <MemoryRouter>
      <AdminPanel theme="dark" toggleTheme={vi.fn()} />
    </MemoryRouter>,
  );
}

describe("AdminPanel", () => {
  beforeEach(() => {
    localStorage.setItem(
      "currentUser",
      JSON.stringify({ id: 7, role: "teacher", access: "access-token" }),
    );
    vi.mocked(fetchGroups).mockResolvedValue([]);
    vi.mocked(fetchTeacherCourses).mockResolvedValue([]);
    vi.mocked(fetchTeacherDashboard).mockResolvedValue({
      total_students: 4,
      total_groups: 2,
      total_courses: 3,
      active_students: 1,
      completed_courses_count: 5,
    });
    vi.mocked(fetchTeacherStudents).mockResolvedValue([]);
    vi.mocked(fetchCourseDetail).mockResolvedValue({
      id: 7,
      title: "Python",
      description: "",
      category: "Программирование",
      level: "beginner",
      price: 0,
      lessons: [],
    });
    vi.mocked(fetchCourseBlocks).mockResolvedValue([]);
    vi.mocked(fetchTeacherAssignments).mockResolvedValue([]);
  });

  it("shows teacher dashboard statistics from the API", async () => {
    renderPanel();

    expect(await screen.findByText("Обзор обучения")).toBeInTheDocument();
    expect(screen.getByText("Активные за неделю")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("opens the submissions monitoring tab", async () => {
    renderPanel();

    fireEvent.click(await screen.findByRole("button", { name: "Работы на проверку" }));

    expect(await screen.findByText("Отправленных работ пока нет.")).toBeInTheDocument();
  });

  it("edits the selected student's profile", async () => {
    vi.mocked(updateTeacherStudent).mockResolvedValue({
      id: 19,
      first_name: "Ирина2",
      last_name: "Сидорова",
      email: "new@example.com",
    });
    vi.mocked(fetchTeacherStudents).mockResolvedValue([
      { id: 19, first_name: "Ирина", last_name: "Петрова", email: "old@example.com", username: "student_19" },
    ]);
    vi.mocked(fetchTeacherStudentDetail).mockResolvedValue({
      id: 19,
      first_name: "Ирина",
      last_name: "Петрова",
      email: "old@example.com",
      group: null,
      courses: [],
    });
    renderPanel();

    fireEvent.click(await screen.findByRole("button", { name: /Мониторинг учеников/ }));
    fireEvent.click(await screen.findByTitle("Профиль"));
    fireEvent.click(await screen.findByRole("button", { name: "Редактировать профиль" }));
    fireEvent.change(screen.getByLabelText("Имя"), { target: { value: "Ирина2" } });
    fireEvent.change(screen.getByLabelText("Фамилия"), { target: { value: "Сидорова" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "new@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() => {
      expect(updateTeacherStudent).toHaveBeenCalledWith(19, {
        first_name: "Ирина2",
        last_name: "Сидорова",
        email: "new@example.com",
      });
    });
  });

  it("creates a student and displays the returned temporary credentials", async () => {
    vi.mocked(quickCreateStudent).mockResolvedValue({
      user: {
        id: 19,
        username: "student_19",
        first_name: "Ирина",
        last_name: "Петрова",
        email: "student-19@example.com",
        role: "student",
        must_change_password: true,
      },
      username: "student_19",
      password: "temporary-password",
      group_id: null,
      group_name: null,
    });
    renderPanel();

    fireEvent.click(await screen.findByRole("button", { name: /Мониторинг учеников/ }));
    fireEvent.click(screen.getByRole("button", { name: /Добавить ученика/ }));
    fireEvent.change(screen.getByLabelText("Имя *"), { target: { value: "Ирина" } });
    fireEvent.change(screen.getByLabelText("Фамилия *"), { target: { value: "Петрова" } });
    fireEvent.click(screen.getByRole("button", { name: "Создать ученика" }));

    expect(await screen.findByText(/@student_19/)).toBeInTheDocument();
    expect(screen.getByText("temporary-password")).toBeInTheDocument();
    expect(quickCreateStudent).toHaveBeenCalledWith({
      first_name: "Ирина",
      last_name: "Петрова",
    });
  });

  it("archives a student only after confirmation and reloads the active list", async () => {
    vi.mocked(fetchTeacherStudents)
      .mockResolvedValueOnce([
        { id: 42, first_name: "Архивируемый", last_name: "Ученик", username: "student_42", is_active: true },
      ])
      .mockResolvedValueOnce([]);
    vi.mocked(setStudentArchived).mockResolvedValue({ student_id: 42, is_archived: true });
    vi.stubGlobal("confirm", vi.fn(() => true));
    renderPanel();

    fireEvent.click(await screen.findByRole("button", { name: /Мониторинг учеников/ }));
    expect(await screen.findByText("Архивируемый Ученик")).toBeInTheDocument();
    fireEvent.click(screen.getByTitle("Архивировать"));

    await waitFor(() => {
      expect(setStudentArchived).toHaveBeenCalledWith(42, true);
      expect(fetchTeacherStudents).toHaveBeenLastCalledWith({ q: "" });
    });
  });

  it("shows archived students only when the archive filter is enabled", async () => {
    vi.mocked(fetchTeacherStudents)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 42,
          first_name: "Архивируемый",
          last_name: "Ученик",
          username: "student_42",
          is_active: true,
          is_archived: true,
        },
      ]);
    renderPanel();

    fireEvent.click(await screen.findByRole("button", { name: /Мониторинг учеников/ }));
    fireEvent.click(screen.getByLabelText("Показать архив"));
    expect(await screen.findByText("В архиве")).toBeInTheDocument();
    expect(fetchTeacherStudents).toHaveBeenLastCalledWith({ q: "", include_archived: true });
    expect(screen.queryByTitle("Сбросить пароль")).not.toBeInTheDocument();
  });

  it("shows the API permission error when archiving is forbidden", async () => {
    vi.mocked(fetchTeacherStudents).mockResolvedValueOnce([
      { id: 42, first_name: "Ученик", last_name: "Тест", username: "student_42", is_active: true },
    ]);
    vi.mocked(setStudentArchived).mockRejectedValue(
      Object.assign(new Error("Forbidden"), {
        isAxiosError: true,
        response: { status: 403, data: { detail: "Архивирование запрещено." } },
      }),
    );
    vi.stubGlobal("confirm", vi.fn(() => true));
    renderPanel();

    fireEvent.click(await screen.findByRole("button", { name: /Мониторинг учеников/ }));
    fireEvent.click(await screen.findByTitle("Архивировать"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Архивирование запрещено.");
  });

  it("shows the API permission detail when manually changing lesson access is forbidden", async () => {
    vi.mocked(fetchGroups).mockResolvedValue([
      { id: 9, name: "Группа", students: [], courses: [{ id: 7, title: "Python" }] },
    ]);
    vi.mocked(fetchTeacherCourses).mockResolvedValue([{ id: 7, title: "Python" }]);
    vi.mocked(fetchGroupProgressMatrix).mockResolvedValue({
      lessons: [{
        lesson_id: 21,
        order: 1,
        title: "Урок",
        completed_students_count: 0,
        total_students_count: 1,
        completion_rate: 0,
        is_unlocked: false,
      }],
      students: [],
    });
    vi.mocked(toggleGroupLessonAccess).mockRejectedValue(
      Object.assign(new Error("Forbidden"), {
        isAxiosError: true,
        response: { status: 403, data: { detail: "Управлять доступом может только владелец группы." } },
      }),
    );
    renderPanel();

    fireEvent.click(await screen.findByRole("button", { name: /Мониторинг учеников/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Открыть вручную/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Недостаточно прав: Управлять доступом может только владелец группы.",
    );
  });

  it("shows the API permission detail when a course status update is denied", async () => {
    vi.mocked(fetchTeacherCourses).mockResolvedValue([
      { id: 7, title: "Python", category: "Программирование", status: "published" },
    ]);
    vi.mocked(updateCourse).mockRejectedValue(
      Object.assign(new Error("Forbidden"), {
        isAxiosError: true,
        response: { status: 403, data: { detail: "Изменять курс может только автор." } },
      }),
    );
    renderPanel();

    fireEvent.click(await screen.findByRole("button", { name: /Загрузка и создание курсов/ }));
    fireEvent.change(await screen.findByLabelText("Статус:"), { target: { value: "archived" } });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Недостаточно прав: Изменять курс может только автор.",
    );
  });
});
