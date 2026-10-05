import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Assignments from "./Assignments";
import {
  fetchAssignmentSubmissions,
  fetchCourseAssignments,
  fetchStudentCourses,
  retryCodeSubmission,
  submitStudentAssignment,
} from "../../api/api";

vi.mock("../../api/api", () => ({
  fetchAssignmentSubmissions: vi.fn(),
  fetchCourseAssignments: vi.fn(),
  fetchStudentCourses: vi.fn(),
  retryCodeSubmission: vi.fn(),
  submitStudentAssignment: vi.fn(),
}));

vi.mock("../Header/Header", () => ({ default: () => <header /> }));
vi.mock("../Sidebar/sidebar", () => ({ default: () => <nav /> }));
vi.mock("@monaco-editor/react", () => ({
  loader: { config: vi.fn() },
  default: ({
    language,
    onChange,
    options,
    theme,
    value,
  }: {
    language: string;
    onChange: (value: string) => void;
    options: { ariaLabel: string; lineNumbers: string; quickSuggestions: boolean };
    theme: string;
    value: string;
  }) => (
    <textarea
      aria-label={options.ariaLabel}
      data-language={language}
      data-theme={theme}
      data-line-numbers={options.lineNumbers}
      data-autocomplete={String(options.quickSuggestions)}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));
vi.mock("monaco-editor/esm/vs/editor/editor.api", () => ({}));
vi.mock("monaco-editor/esm/vs/editor/editor.worker?worker", () => ({ default: vi.fn() }));
vi.mock("monaco-editor/esm/vs/language/typescript/ts.worker?worker", () => ({ default: vi.fn() }));
vi.mock("monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution", () => ({}));
vi.mock("monaco-editor/esm/vs/basic-languages/python/python.contribution", () => ({}));

const starterCode = "print('hello')";
const codeAssignment = {
  id: 11,
  course_id: 2,
  lesson_id: null,
  title: "First program",
  description: "Write a short program.",
  assignment_type: "code" as const,
  points: 10,
  max_attempts: 3,
  due_at: null,
  programming_language: "python" as const,
  starter_code: starterCode,
  hints: [],
  questions: [],
};

function renderPage() {
  return render(
    <MemoryRouter>
      <Assignments />
    </MemoryRouter>,
  );
}

describe("Assignments code editor", () => {
  beforeEach(() => {
    localStorage.setItem("currentUser", JSON.stringify({ id: 7, role: "student" }));
    document.body.dataset.theme = "light";
    vi.mocked(fetchStudentCourses).mockResolvedValue([{
      id: 2,
      title: "Python basics",
      description: "",
    }]);
    vi.mocked(fetchCourseAssignments).mockResolvedValue([codeAssignment]);
    vi.mocked(fetchAssignmentSubmissions).mockResolvedValue([]);
    vi.mocked(submitStudentAssignment).mockResolvedValue({
      id: 9,
      assignment_id: 11,
      student_id: 7,
      answer_text: "",
      response_data: {},
      status: "submitted",
      score: null,
      feedback: "",
      has_file: false,
      original_file_name: "",
      submitted_at: "2026-10-02T10:00:00Z",
      graded_at: null,
    });
  });

  it("loads a Python editor, resets to starter code, and submits source_code", async () => {
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Сдать работу" }));
    const editor = await screen.findByRole("textbox", { name: "Исходный код" });
    expect(editor).toHaveAttribute("data-language", "python");
    expect(editor).toHaveAttribute("data-theme", "light");
    expect(editor).toHaveAttribute("data-line-numbers", "on");
    expect(editor).toHaveAttribute("data-autocomplete", "true");

    document.body.dataset.theme = "dark";
    await waitFor(() => expect(editor).toHaveAttribute("data-theme", "vs-dark"));

    fireEvent.click(screen.getByRole("button", { name: "Сбросить к начальному коду" }));
    expect(editor).toHaveValue(starterCode);

    fireEvent.change(editor, { target: { value: "print('student answer')" } });
    fireEvent.click(screen.getByRole("button", { name: "Отправить" }));

    await waitFor(() => {
      expect(submitStudentAssignment).toHaveBeenCalledWith(11, {
        source_code: "print('student answer')",
      });
    });
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Решение отправлено в изолированный runner.",
    );
  });

  it("enforces the existing 50,000-character limit", async () => {
    vi.mocked(fetchCourseAssignments).mockResolvedValue([{
      ...codeAssignment,
      programming_language: "javascript",
    }]);
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Сдать работу" }));
    const editor = await screen.findByRole("textbox", { name: "Исходный код" });
    expect(editor).toHaveAttribute("data-language", "javascript");
    fireEvent.change(editor, { target: { value: "x".repeat(50001) } });

    expect(screen.getByText(/50\s?000 \/ 50\s?000 символов/)).toBeInTheDocument();
    expect(editor).toHaveValue("x".repeat(50000));
  });

  it("clears code when the assignment has no starter code", async () => {
    vi.mocked(fetchCourseAssignments).mockResolvedValue([{
      ...codeAssignment,
      starter_code: "",
    }]);
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Сдать работу" }));
    const editor = await screen.findByRole("textbox", { name: "Исходный код" });
    fireEvent.change(editor, { target: { value: "student code" } });
    fireEvent.click(screen.getByRole("button", { name: "Очистить код" }));

    expect(editor).toHaveValue("");
  });

  it("shows aggregate runner results without exposing hidden test data", async () => {
    vi.mocked(fetchAssignmentSubmissions).mockResolvedValue([{
      id: 15,
      assignment_id: 11,
      student_id: 7,
      answer_text: starterCode,
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
      submitted_at: "2026-10-02T10:00:00Z",
      graded_at: null,
    }]);
    renderPage();

    expect(await screen.findByText("Результат: Не все тесты пройдены")).toBeInTheDocument();
    expect(screen.getByText(/Тесты пройдены: 1 \/ 2/)).toBeInTheDocument();
    expect(screen.queryByText(/expected_output|hidden test/i)).not.toBeInTheDocument();
  });

  it("retries a system error without creating another attempt", async () => {
    vi.mocked(fetchAssignmentSubmissions).mockResolvedValue([{
      id: 15,
      assignment_id: 11,
      student_id: 7,
      answer_text: starterCode,
      response_data: {},
      status: "system_error",
      score: null,
      error_message: "Изолированный runner временно недоступен.",
      feedback: "",
      has_file: false,
      original_file_name: "",
      submitted_at: "2026-10-02T10:00:00Z",
      graded_at: null,
    }]);
    vi.mocked(retryCodeSubmission).mockResolvedValue({
      id: 15,
      assignment_id: 11,
      student_id: 7,
      answer_text: starterCode,
      response_data: {},
      status: "pending",
      score: null,
      feedback: "",
      has_file: false,
      original_file_name: "",
      submitted_at: "2026-10-02T10:00:00Z",
      graded_at: null,
    });
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Повторить запуск" }));
    await waitFor(() => expect(retryCodeSubmission).toHaveBeenCalledWith(15));
    expect(screen.getByText("Результат: В очереди на запуск")).toBeInTheDocument();
    expect(screen.getByText(/Попыток осталось: 2/)).toBeInTheDocument();
  });

  it("refreshes the displayed result after a queued run completes", async () => {
    vi.mocked(fetchAssignmentSubmissions)
      .mockResolvedValueOnce([])
      .mockResolvedValue([{
        id: 16,
        assignment_id: 11,
        student_id: 7,
        answer_text: starterCode,
        response_data: {},
        status: "passed",
        score: 10,
        tests_passed: 2,
        tests_total: 2,
        execution_time_ms: 20,
        memory_used_mb: 10,
        error_message: "",
        feedback: "",
        has_file: false,
        original_file_name: "",
        submitted_at: "2026-10-02T10:00:00Z",
        graded_at: null,
      }]);
    vi.mocked(submitStudentAssignment).mockResolvedValue({
      id: 16,
      assignment_id: 11,
      student_id: 7,
      answer_text: starterCode,
      response_data: {},
      status: "pending",
      score: null,
      feedback: "",
      has_file: false,
      original_file_name: "",
      submitted_at: "2026-10-02T10:00:00Z",
      graded_at: null,
    });
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Сдать работу" }));
    const editor = await screen.findByRole("textbox", { name: "Исходный код" });
    fireEvent.change(editor, { target: { value: "print('run me')" } });
    fireEvent.click(screen.getByRole("button", { name: "Отправить" }));

    expect(await screen.findByText("Результат: В очереди на запуск")).toBeInTheDocument();
    expect(await screen.findByText("Результат: Все тесты пройдены", {}, {
      timeout: 5000,
    })).toBeInTheDocument();
  });
});
