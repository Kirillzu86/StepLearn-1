import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TeacherSubmissionsPanel from "./TeacherSubmissionsPanel";
import {
  fetchAssignmentSubmissions,
  fetchCourseAssignments,
  fetchTeacherCourses,
  fetchTeacherStudents,
  gradeTeacherSubmission,
} from "../../api/api";

vi.mock("../../api/api", () => ({
  downloadTeacherSubmissionFile: vi.fn(),
  fetchAssignmentSubmissions: vi.fn(),
  fetchCourseAssignments: vi.fn(),
  fetchTeacherCourses: vi.fn(),
  fetchTeacherStudents: vi.fn(),
  gradeTeacherSubmission: vi.fn(),
}));

describe("TeacherSubmissionsPanel", () => {
  beforeEach(() => {
    vi.mocked(fetchTeacherCourses).mockResolvedValue([{ id: 3, title: "Python" }]);
    vi.mocked(fetchTeacherStudents).mockResolvedValue([
      { id: 9, first_name: "Анна", last_name: "Иванова", username: "anna" },
    ]);
    vi.mocked(fetchCourseAssignments).mockResolvedValue([
      {
        id: 12,
        course_id: 3,
        lesson_id: null,
        title: "Циклы",
        description: "",
        assignment_type: "text",
        points: 10,
        max_attempts: 3,
        due_at: null,
        programming_language: "python",
        starter_code: "",
        hints: [],
        questions: [],
      },
    ]);
    vi.mocked(fetchAssignmentSubmissions).mockResolvedValue([
      {
        id: 21,
        assignment_id: 12,
        student_id: 9,
        answer_text: "for item in items:",
        response_data: {},
        status: "submitted",
        score: null,
        feedback: "",
        has_file: false,
        original_file_name: "",
        submitted_at: "2026-10-01T10:00:00Z",
        graded_at: null,
      },
    ]);
    vi.mocked(gradeTeacherSubmission).mockResolvedValue({
      id: 21,
      assignment_id: 12,
      student_id: 9,
      answer_text: "for item in items:",
      response_data: {},
      status: "graded",
      score: 8,
      feedback: "Хорошо",
      has_file: false,
      original_file_name: "",
      submitted_at: "2026-10-01T10:00:00Z",
      graded_at: "2026-10-02T10:00:00Z",
    });
  });

  it("loads a submission and lets the teacher grade it", async () => {
    render(<TeacherSubmissionsPanel />);

    expect(await screen.findByText("for item in items:")).toBeInTheDocument();
    expect(screen.getByText(/Анна Иванова/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Проверить работу" }));
    fireEvent.change(screen.getByLabelText("Баллы для Циклы"), {
      target: { value: "8" },
    });
    fireEvent.change(screen.getByLabelText("Отзыв для Циклы"), {
      target: { value: "Хорошо" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить оценку" }));

    await waitFor(() => {
      expect(gradeTeacherSubmission).toHaveBeenCalledWith(21, {
        score: 8,
        feedback: "Хорошо",
      });
    });
  });

  it("shows an explicit permission error when the API denies access", async () => {
    vi.mocked(fetchTeacherCourses).mockRejectedValue(
      Object.assign(new Error("Forbidden"), {
        isAxiosError: true,
        response: { status: 403 },
      }),
    );
    render(<TeacherSubmissionsPanel />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Недостаточно прав для просмотра или изменения этих работ.",
    );
  });

  it("shows aggregate code results without a manual-grading control", async () => {
    vi.mocked(fetchCourseAssignments).mockResolvedValue([{
      id: 12,
      course_id: 3,
      lesson_id: null,
      title: "Циклы",
      description: "",
      assignment_type: "code",
      points: 10,
      max_attempts: 3,
      due_at: null,
      programming_language: "python",
      starter_code: "",
      hints: [],
      questions: [],
    }]);
    vi.mocked(fetchAssignmentSubmissions).mockResolvedValue([{
      id: 21,
      assignment_id: 12,
      student_id: 9,
      answer_text: "print('answer')",
      response_data: {},
      status: "failed",
      score: 5,
      tests_passed: 1,
      tests_total: 2,
      execution_time_ms: 18,
      memory_used_mb: 12,
      error_message: "Некоторые тесты не пройдены.",
      feedback: "",
      has_file: false,
      original_file_name: "",
      submitted_at: "2026-10-01T10:00:00Z",
      graded_at: null,
    }]);

    render(<TeacherSubmissionsPanel />);

    expect(await screen.findByText("Пройдено тестов: 1 / 2 · 18 мс")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Проверить работу" })).not.toBeInTheDocument();
    expect(screen.queryByText(/hidden test|expected_output/i)).not.toBeInTheDocument();
  });
});
