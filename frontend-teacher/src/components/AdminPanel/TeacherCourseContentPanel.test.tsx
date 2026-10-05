import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TeacherCourseContentPanel from "./TeacherCourseContentPanel";
import {
  createCourseBlock,
  createCourseLesson,
  deleteLesson,
  fetchCourseBlocks,
  fetchCourseDetail,
  updateCourse,
  updateCourseLesson,
} from "../../api/api";

vi.mock("../../api/api", () => ({
  createCourseBlock: vi.fn(),
  createCourseLesson: vi.fn(),
  deleteCourseBlock: vi.fn(),
  deleteLesson: vi.fn(),
  fetchCourseBlocks: vi.fn(),
  fetchCourseDetail: vi.fn(),
  updateCourse: vi.fn(),
  updateCourseBlock: vi.fn(),
  updateCourseLesson: vi.fn(),
}));

const lesson = {
  id: 21,
  course_id: 7,
  block_id: 3,
  title: "Основы",
  description: "Описание",
  content: "# Тема",
  lesson_type: "theory" as const,
  is_mandatory: true,
  order: 1,
};

const block = {
  id: 3,
  course_id: 7,
  title: "Введение",
  description: "Первый раздел",
  order: 1,
  lessons: [lesson],
};

describe("TeacherCourseContentPanel", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.mocked(fetchCourseDetail).mockResolvedValue({
      id: 7,
      title: "Python",
      description: "Курс",
      category: "Программирование",
      level: "beginner",
      price: 0,
      lessons: [lesson],
    });
    vi.mocked(fetchCourseBlocks).mockResolvedValue([block]);
    vi.mocked(createCourseBlock).mockResolvedValue(block);
    vi.mocked(createCourseLesson).mockResolvedValue(lesson);
    vi.mocked(updateCourse).mockResolvedValue({});
    vi.mocked(updateCourseLesson).mockResolvedValue(lesson);
  });

  it("updates course details through the teacher API", async () => {
    render(<TeacherCourseContentPanel courseId={7} />);
    fireEvent.change(await screen.findByLabelText("Название курса *"), {
      target: { value: "Python для начинающих" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить курс" }));

    await waitFor(() => {
      expect(updateCourse).toHaveBeenCalledWith(7, expect.objectContaining({
        title: "Python для начинающих",
        category: "Программирование",
        level: "beginner",
        price: 0,
      }));
    });
  });

  it("creates a course section", async () => {
    render(<TeacherCourseContentPanel courseId={7} />);
    fireEvent.click(await screen.findByRole("button", { name: "Добавить раздел" }));
    fireEvent.change(screen.getByLabelText("Название раздела *"), {
      target: { value: "Новый раздел" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить раздел" }));

    await waitFor(() => {
      expect(createCourseBlock).toHaveBeenCalledWith(7, {
        title: "Новый раздел",
        description: "",
      });
    });
  });

  it("updates a lesson with edited Markdown content", async () => {
    render(<TeacherCourseContentPanel courseId={7} />);
    fireEvent.click(await screen.findByRole("button", { name: "Изменить урок" }));
    fireEvent.change(screen.getByLabelText("Название урока *"), {
      target: { value: "Обновлённые основы" },
    });
    fireEvent.change(screen.getByLabelText("Содержимое (Markdown)"), {
      target: { value: "# Практика" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить урок" }));

    await waitFor(() => {
      expect(updateCourseLesson).toHaveBeenCalledWith(21, expect.objectContaining({
        title: "Обновлённые основы",
        content: "# Практика",
        block_id: 3,
      }));
    });
  });

  it("creates a lesson assigned to its section", async () => {
    render(<TeacherCourseContentPanel courseId={7} />);
    fireEvent.click(await screen.findByRole("button", { name: "Добавить урок" }));
    fireEvent.change(screen.getByLabelText("Название урока *"), {
      target: { value: "Новый урок" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить урок" }));

    await waitFor(() => {
      expect(createCourseLesson).toHaveBeenCalledWith(7, expect.objectContaining({
        title: "Новый урок",
        block_id: 3,
      }));
    });
  });

  it("requires confirmation before deleting a lesson", async () => {
    vi.stubGlobal("confirm", vi.fn(() => false));
    render(<TeacherCourseContentPanel courseId={7} />);
    fireEvent.click(await screen.findByRole("button", { name: "Удалить урок" }));
    expect(deleteLesson).not.toHaveBeenCalled();
  });
});
