import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MyCourses from "./MyCourses";
import { fetchCourseLearningProgress, fetchStudentCourses } from "../../api/api";

vi.mock("../../api/api", () => ({
  fetchCourseLearningProgress: vi.fn(),
  fetchStudentCourses: vi.fn(),
}));

vi.mock("../Header/Header", () => ({ default: () => <header /> }));
vi.mock("../Sidebar/sidebar", () => ({ default: () => <nav /> }));

function renderPage() {
  return render(
    <MemoryRouter>
      <MyCourses />
    </MemoryRouter>,
  );
}

describe("MyCourses", () => {
  beforeEach(() => {
    localStorage.setItem("currentUser", JSON.stringify({ id: 3, role: "student" }));
  });

  it("shows an empty state when the API returns no courses", async () => {
    vi.mocked(fetchStudentCourses).mockResolvedValue([]);

    renderPage();

    expect(await screen.findByText("Вы пока не записаны ни на один курс")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows a retryable network/permission error instead of an empty state", async () => {
    vi.mocked(fetchStudentCourses).mockRejectedValue({
      isAxiosError: true,
      response: { status: 403, data: { detail: "Доступ запрещён." } },
    });

    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("У вас нет доступа к списку курсов.");
    expect(screen.getByRole("button", { name: "Повторить" })).toBeInTheDocument();
    expect(screen.queryByText("Вы пока не записаны ни на один курс")).not.toBeInTheDocument();
    expect(fetchCourseLearningProgress).not.toHaveBeenCalled();
  });
});
