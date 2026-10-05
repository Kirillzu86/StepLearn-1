import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TeacherAssignmentsPanel from "./TeacherAssignmentsPanel";
import {
  createTeacherAssignment,
  deleteTeacherAssignment,
  fetchTeacherAssignments,
  updateTeacherAssignment,
} from "../../api/api";

vi.mock("../../api/api", () => ({
  createTeacherAssignment: vi.fn(),
  deleteTeacherAssignment: vi.fn(),
  fetchTeacherAssignments: vi.fn(),
  updateTeacherAssignment: vi.fn(),
}));

describe("TeacherAssignmentsPanel", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.mocked(fetchTeacherAssignments).mockResolvedValue([]);
    vi.mocked(createTeacherAssignment).mockResolvedValue({
      id: 31,
      course_id: 7,
      lesson_id: null,
      title: "Циклы",
      description: "",
      assignment_type: "code",
      points: 100,
      max_attempts: 3,
      is_published: false,
      due_at: null,
      programming_language: "python",
      starter_code: "",
      hints: [],
      time_limit_seconds: 5,
      memory_limit_mb: 128,
      questions: [],
      test_cases: [{ input_data: "3", expected_output: "6" }],
    });
  });

  it("creates a code assignment with hidden test cases through the teacher API", async () => {
    render(<TeacherAssignmentsPanel courseId={7} />);
    fireEvent.click(await screen.findByRole("button", { name: "Создать задание" }));
    fireEvent.change(screen.getByLabelText("Тип задания"), {
      target: { value: "code" },
    });
    fireEvent.change(screen.getByLabelText("Название"), {
      target: { value: "Циклы" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Добавить скрытый тест" }));
    fireEvent.change(screen.getByLabelText("Ожидаемый результат"), {
      target: { value: "6" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить задание" }));

    await waitFor(() => {
      expect(createTeacherAssignment).toHaveBeenCalledWith(7, expect.objectContaining({
        title: "Циклы",
        assignment_type: "code",
        test_cases: [{ input_data: "", expected_output: "6" }],
      }));
    });
  });

  it("requires a correct option before creating a quiz", async () => {
    render(<TeacherAssignmentsPanel courseId={7} />);
    fireEvent.click(await screen.findByRole("button", { name: "Создать задание" }));
    fireEvent.change(screen.getByLabelText("Название"), {
      target: { value: "Проверка" },
    });
    fireEvent.change(screen.getByLabelText("Тип задания"), {
      target: { value: "quiz" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Добавить вопрос" }));
    fireEvent.change(screen.getByLabelText("Текст вопроса"), {
      target: { value: "Сколько будет 2 + 2?" },
    });
    fireEvent.change(screen.getByLabelText("Вариант 1 вопроса 1"), {
      target: { value: "4" },
    });
    fireEvent.change(screen.getByLabelText("Вариант 2 вопроса 1"), {
      target: { value: "5" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить задание" }));

    expect(await screen.findByText(
      "Для вопроса 1 отметьте ровно один правильный вариант.",
    )).toBeInTheDocument();
    expect(createTeacherAssignment).not.toHaveBeenCalled();
  });

  it("updates an existing assignment without changing its type", async () => {
    vi.mocked(fetchTeacherAssignments).mockResolvedValueOnce([{
      id: 31,
      course_id: 7,
      lesson_id: null,
      title: "Краткий ответ",
      description: "Старое описание",
      assignment_type: "short_answer",
      points: 10,
      max_attempts: 2,
      is_published: false,
      due_at: null,
      programming_language: "python",
      starter_code: "",
      hints: [],
      time_limit_seconds: 5,
      memory_limit_mb: 128,
      questions: [],
      test_cases: [],
    }]);
    render(<TeacherAssignmentsPanel courseId={7} />);
    fireEvent.click(await screen.findByRole("button", { name: "Редактировать" }));
    expect(screen.getByLabelText("Тип задания")).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Описание"), {
      target: { value: "Обновлённое описание" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить задание" }));

    await waitFor(() => {
      expect(updateTeacherAssignment).toHaveBeenCalledWith(31, expect.objectContaining({
        assignment_type: "short_answer",
        description: "Обновлённое описание",
      }));
    });
  });

  it("sends delete requests only after confirmation", async () => {
    vi.mocked(fetchTeacherAssignments)
      .mockResolvedValueOnce([{
        id: 31,
        course_id: 7,
        lesson_id: null,
        title: "Удаляемое",
        description: "",
        assignment_type: "text",
        points: 10,
        max_attempts: 2,
        is_published: false,
        due_at: null,
        programming_language: "python",
        starter_code: "",
        hints: [],
        time_limit_seconds: 5,
        memory_limit_mb: 128,
        questions: [],
        test_cases: [],
      }])
      .mockResolvedValueOnce([]);
    vi.mocked(deleteTeacherAssignment).mockResolvedValue(undefined);
    vi.stubGlobal("confirm", vi.fn(() => true));
    render(<TeacherAssignmentsPanel courseId={7} />);
    fireEvent.click(await screen.findByRole("button", { name: "Удалить" }));

    await waitFor(() => {
      expect(deleteTeacherAssignment).toHaveBeenCalledWith(31);
    });
  });
});
