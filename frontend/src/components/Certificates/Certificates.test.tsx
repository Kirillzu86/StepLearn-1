import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Certificates from "./Certificates";
import { fetchCourseLearningProgress, fetchStudentCourses } from "../../api/api";

vi.mock("../../api/api", () => ({
  fetchCourseLearningProgress: vi.fn(),
  fetchStudentCourses: vi.fn(),
}));

vi.mock("../Header/Header", () => ({ default: () => <header /> }));
vi.mock("../Sidebar/sidebar", () => ({ default: () => <nav /> }));

const completedProgress = {
  learning_progress: {
    is_completed: true,
    sections: [{
      id: 1,
      title: "Основы",
      completed_items: 1,
      total_items: 1,
      progress_percentage: 100,
      lessons: [{
        id: 11,
        title: "Введение",
        is_completed: true,
        completed_at: "2026-09-30T12:00:00Z",
        assignments: [],
      }],
      assignments: [],
    }],
  },
};

function renderPage() {
  return render(
    <MemoryRouter>
      <Certificates />
    </MemoryRouter>,
  );
}

describe("Certificates", () => {
  beforeEach(() => {
    localStorage.setItem("currentUser", JSON.stringify({
      id: 7,
      role: "student",
      username: "student",
      first_name: "Ada",
      last_name: "Lovelace",
    }));
  });

  it("shows a printable certificate only for a completed course", async () => {
    vi.mocked(fetchStudentCourses).mockResolvedValue([
      { id: 10, title: "Python", description: "" },
      { id: 11, title: "React", description: "" },
    ]);
    vi.mocked(fetchCourseLearningProgress)
      .mockResolvedValueOnce(completedProgress as never)
      .mockResolvedValueOnce({
        learning_progress: { ...completedProgress.learning_progress, is_completed: false },
      } as never);
    const print = vi.spyOn(window, "print").mockImplementation(() => {});

    renderPage();

    expect(await screen.findByText("Python")).toBeInTheDocument();
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.queryByText("React")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /распечатать/i }));
    expect(print).toHaveBeenCalledOnce();
  });

  it("distinguishes no certificates from a loading error", async () => {
    vi.mocked(fetchStudentCourses).mockResolvedValue([]);

    renderPage();

    expect(await screen.findByRole("heading", { name: "Сертификатов пока нет" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /перейти к моим курсам/i })).toHaveAttribute("href", "/my-courses");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows permission errors and retries the API request", async () => {
    vi.mocked(fetchStudentCourses)
      .mockRejectedValueOnce({
        isAxiosError: true,
        response: { status: 403, data: { detail: "Нет доступа." } },
      })
      .mockResolvedValueOnce([]);

    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("У вас нет доступа к сертификатам.");
    fireEvent.click(screen.getByRole("button", { name: "Повторить" }));
    expect(await screen.findByRole("heading", { name: "Сертификатов пока нет" })).toBeInTheDocument();
    expect(fetchStudentCourses).toHaveBeenCalledTimes(2);
  });

  it("does not call student APIs without an authenticated student session", async () => {
    localStorage.clear();

    renderPage();

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Войдите в аккаунт ученика"));
    expect(fetchStudentCourses).not.toHaveBeenCalled();
  });
});
