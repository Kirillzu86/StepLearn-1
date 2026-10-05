// AI-GENERATED: Antigravity
import axios from "axios";

declare module "axios" {
  interface AxiosRequestConfig {
    _skipSessionAuth?: boolean;
  }

  interface InternalAxiosRequestConfig {
    _authRetry?: boolean;
    _skipSessionAuth?: boolean;
  }
}

interface StoredSession {
  access?: string;
  refresh?: string;
  [key: string]: unknown;
}

interface RefreshResponse {
  access?: string;
  refresh?: string;
}

interface CustomCourse {
  id?: number | string;
  [key: string]: unknown;
}

type CourseRecord = CustomCourse & {
  id: number | string;
};

let refreshRequest: Promise<string> | null = null;

axios.interceptors.request.use((config) => {
  if (config._skipSessionAuth) {
    return config;
  }
  if (typeof window !== "undefined") {
    const storedUser = window.localStorage.getItem("currentUser");
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser) as { access?: string };
        if (user.access) {
          config.headers.Authorization = `Bearer ${user.access}`;
        }
      } catch (error) {
        console.error("Unable to read the saved user session:", error);
      }
    }
  }
  return config;
});

// Если VITE_API_URL задан (например, при деплое в Coolify), используем его.
// Если нет — в браузере берем текущий origin (window.location.origin).
export const API_URL = (() => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && typeof window !== 'undefined') {
    const isLocalhostEnv = envUrl.includes('localhost') || envUrl.includes('127.0.0.1');
    const isRemoteBrowser = !['localhost', '127.0.0.1'].includes(window.location.hostname);
    if (isLocalhostEnv && isRemoteBrowser) {
      return window.location.origin;
    }
    return envUrl;
  }
  return envUrl || (typeof window !== 'undefined' ? window.location.origin : '');
})();

export const getBase = () => API_URL.replace(/\/$/, '');

axios.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error) || error.response?.status !== 401) {
      return Promise.reject(error);
    }

    const request = error.config;
    const requestUrl = request?.url ?? "";
    if (
      !request ||
      request._authRetry ||
      /\/auth\/(refresh|login|teacher\/login)(?:\/|$|\?)/.test(requestUrl)
    ) {
      return Promise.reject(error);
    }

    let session: StoredSession;
    try {
      const savedSession = window.localStorage.getItem("currentUser");
      session = savedSession ? JSON.parse(savedSession) as StoredSession : {};
    } catch (storageError) {
      console.error("Unable to read the saved user session:", storageError);
      return Promise.reject(error);
    }

    if (!session.access || !session.refresh) {
      return Promise.reject(error);
    }

    request._authRetry = true;
    let access: string;
    try {
      if (!refreshRequest) {
        refreshRequest = axios
          .post<RefreshResponse>(`${getBase()}/auth/refresh`, {
            refresh: session.refresh,
          }, { _skipSessionAuth: true })
          .then(({ data }) => {
            if (!data.access) {
              throw new Error("Token refresh response did not include an access token.");
            }
            const updatedSession = {
              ...session,
              access: data.access,
              ...(data.refresh ? { refresh: data.refresh } : {}),
            };
            window.localStorage.setItem("currentUser", JSON.stringify(updatedSession));
            window.dispatchEvent(
              new CustomEvent("currentUserChanged", { detail: updatedSession }),
            );
            return data.access;
          })
          .finally(() => {
            refreshRequest = null;
          });
      }

      access = await refreshRequest;
    } catch (refreshError) {
      if (axios.isAxiosError(refreshError) && refreshError.response?.status === 401) {
        window.localStorage.removeItem("currentUser");
        window.dispatchEvent(new Event("currentUserChanged"));
      }
      return Promise.reject(refreshError);
    }

    request.headers.set("Authorization", `Bearer ${access}`);
    return axios(request);
  },
);

// ==========================================
// Пользователи и курсы
// ==========================================

export async function getUsers() {
  const res = await fetch(`${getBase()}/users`);
  if (!res.ok) {
    throw new Error("Failed to fetch users");
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export function getCustomCourses(): CustomCourse[] {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem("custom_created_courses") : null;
    return raw ? JSON.parse(raw) as CustomCourse[] : [];
  } catch {
    return [];
  }
}

export function saveCustomCourse(course: CustomCourse) {
  try {
    if (typeof window === 'undefined') return;
    const existing = getCustomCourses();
    const updated = [course, ...existing.filter((c) => c.id !== course.id)];
    localStorage.setItem("custom_created_courses", JSON.stringify(updated));
    try {
      window.dispatchEvent(new CustomEvent('coursesChanged', { detail: course }));
    } catch {
      window.dispatchEvent(new Event('coursesChanged'));
    }
  } catch (e) {
    console.error("Error saving custom course:", e);
  }
}

export async function fetchCourses(query?: string, timestamp?: number) {
  const urlStr = `${getBase()}/v1/courses`;
  let apiCourses: CourseRecord[] = [];
  try {
    const url = new URL(urlStr, typeof window !== 'undefined' ? window.location.origin : 'http://127.0.0.1:8000');
    if (timestamp) url.searchParams.set('_t', String(timestamp));
    if (query?.trim()) url.searchParams.set('q', query.trim());

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url.toString(), { signal: controller.signal });
    clearTimeout(id);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) apiCourses = data;
      else if (data && Array.isArray(data.data)) apiCourses = data.data;
      else if (data && Array.isArray(data.results)) apiCourses = data.results;
      else if (data && Array.isArray(data.courses)) apiCourses = data.courses;
    }
  } catch (e) {
    console.error("Fetch courses API error, using local/custom courses:", e);
  }

  const customCourses = getCustomCourses();
  const mergedMap = new Map<number | string, CourseRecord>();
  // Merge custom courses first, then API courses
  [...customCourses, ...apiCourses].forEach((c) => {
    if (c && c.id !== undefined && c.id !== null) mergedMap.set(c.id, c as CourseRecord);
  });

  return Array.from(mergedMap.values());
}

export async function fetchCourseDetail(courseId: number) {
  const base = getBase();
  const res = await axios.get(`${base}/v1/course/${courseId}`);
  return res.data;
}

export interface StudentAssignmentOption {
  id: number;
  text: string;
}

export interface StudentAssignmentQuestion {
  id: number;
  text: string;
  options: StudentAssignmentOption[];
}

export interface StudentAssignment {
  id: number;
  course_id: number;
  lesson_id: number | null;
  title: string;
  description: string;
  assignment_type: "text" | "short_answer" | "quiz" | "multiple_choice" | "file_upload" | "code";
  points: number;
  max_attempts: number;
  due_at: string | null;
  programming_language: "python" | "javascript";
  starter_code: string;
  hints: string[];
  questions: StudentAssignmentQuestion[];
}

export interface StudentAssignmentSubmission {
  id: number;
  assignment_id: number;
  student_id: number;
  answer_text: string;
  language?: "python" | "javascript" | "";
  response_data: Record<string, number[]>;
  status:
    | "pending"
    | "running"
    | "passed"
    | "failed"
    | "timeout"
    | "runtime_error"
    | "compile_error"
    | "system_error"
    | "submitted"
    | "graded";
  score: number | null;
  tests_passed?: number | null;
  tests_total?: number | null;
  execution_time_ms?: number | null;
  memory_used_mb?: number | null;
  error_message?: string;
  feedback: string;
  has_file: boolean;
  original_file_name: string;
  submitted_at: string;
  graded_at: string | null;
}

export interface StudentCourseSummary {
  id: number;
  title: string;
  description: string;
  progress_percentage?: number;
  completed_lessons?: number;
  total_lessons?: number;
  category?: string;
}

export interface CourseLearningProgress {
  completed_items: number;
  total_items: number;
  progress_percentage: number;
  is_completed: boolean;
  sections: Array<{
    id: number | null;
    title: string;
    completed_items: number;
    total_items: number;
    progress_percentage: number;
    lessons: Array<{
      id: number;
      title: string;
      is_completed: boolean;
      completed_at: string | null;
      assignments: Array<{
        id: number;
        title: string;
        assignment_type: StudentAssignment["assignment_type"];
        is_completed: boolean;
        status: "not_started" | "in_progress" | "completed";
        attempts_used: number;
        score: number | null;
        submitted_at: string | null;
      }>;
    }>;
    assignments: Array<{
      id: number;
      title: string;
      assignment_type: StudentAssignment["assignment_type"];
      is_completed: boolean;
      status: "not_started" | "in_progress" | "completed";
      attempts_used: number;
      score: number | null;
      submitted_at: string | null;
    }>;
  }>;
}

export async function fetchStudentCourses(userId: number): Promise<StudentCourseSummary[]> {
  const base = getBase();
  const res = await axios.get(`${base}/v1/users/${userId}/courses`);
  if (!Array.isArray(res.data)) {
    throw new Error("Сервер вернул некорректный список курсов.");
  }
  return res.data as StudentCourseSummary[];
}

export async function fetchCourseLearningProgress(userId: number, courseId: number) {
  const base = getBase();
  const res = await axios.get(`${base}/v1/users/${userId}/courses/${courseId}/progress`);
  return res.data as { learning_progress?: CourseLearningProgress };
}

export async function fetchCourseAssignments(courseId: number) {
  const base = getBase();
  const res = await axios.get(`${base}/v1/courses/${courseId}/assignments`);
  return Array.isArray(res.data) ? res.data as StudentAssignment[] : [];
}

export async function fetchAssignmentSubmissions(assignmentId: number) {
  const base = getBase();
  const res = await axios.get(`${base}/v1/assignments/${assignmentId}/submissions`);
  return Array.isArray(res.data) ? res.data as StudentAssignmentSubmission[] : [];
}

export async function submitStudentAssignment(
  assignmentId: number,
  payload: { answer_text: string } | { source_code: string } |
    { answers: Array<{ question_id: number; option_ids: number[] }> } |
    { file: File },
) {
  const base = getBase();
  if ("file" in payload) {
    const formData = new FormData();
    formData.append("file", payload.file);
    const res = await axios.post(
      `${base}/v1/assignments/${assignmentId}/submissions`,
      formData,
    );
    return res.data as StudentAssignmentSubmission;
  }

  const res = await axios.post(
    `${base}/v1/assignments/${assignmentId}/submissions`,
    payload,
  );
  return res.data as StudentAssignmentSubmission;
}

export async function retryCodeSubmission(
  submissionId: number,
): Promise<StudentAssignmentSubmission> {
  const base = getBase();
  const res = await axios.post(`${base}/v1/submissions/${submissionId}/run`);
  return res.data as StudentAssignmentSubmission;
}

// ==========================================
// Группы (StudyGroups)
// ==========================================

export async function fetchGroups(teacherId?: number) {
  const base = getBase();
  const url = teacherId ? `${base}/v1/groups?teacher_id=${teacherId}` : `${base}/v1/groups`;
  const res = await axios.get(url);
  return Array.isArray(res.data) ? res.data : [];
}

export async function createGroup(data: {
  name: string;
  description?: string;
  teacher_id: number;
  capacity: number;
  students: Array<{ first_name: string; last_name: string }>;
}) {
  const base = getBase();
  const res = await axios.post(`${base}/v1/groups`, data);
  return res.data;
}

export async function deleteGroup(groupId: number) {
  const base = getBase();
  const res = await axios.delete(`${base}/v1/groups/${groupId}`);
  return res.data;
}

export async function addStudentToGroup(groupId: number, payload: { username?: string; student_id?: number }) {
  const base = getBase();
  const res = await axios.post(`${base}/v1/groups/${groupId}/add-student`, payload);
  return res.data;
}

export async function removeStudentFromGroup(groupId: number, studentId: number) {
  const base = getBase();
  const res = await axios.post(`${base}/v1/groups/${groupId}/remove-student/${studentId}`);
  return res.data;
}

export async function joinGroupByCode(code: string, userId: number) {
  const base = getBase();
  const res = await axios.post(`${base}/v1/groups/join`, { code, user_id: userId });
  return res.data;
}

// ==========================================
// Назначение курсов и Cisco/Stepik Gating
// ==========================================

export async function assignCourseToGroup(groupId: number, courseId: number) {
  const base = getBase();
  const res = await axios.post(`${base}/v1/groups/${groupId}/assign-course`, { course_id: courseId });
  return res.data;
}

export async function fetchGroupProgressMatrix(groupId: number, courseId: number) {
  const base = getBase();
  const res = await axios.get(`${base}/v1/groups/${groupId}/progress/${courseId}`);
  return res.data;
}

export async function toggleGroupLessonAccess(
  groupId: number,
  lessonId: number,
  params: { is_unlocked?: boolean; auto_unlock_when_all_pass?: boolean }
) {
  const base = getBase();
  const res = await axios.post(`${base}/v1/groups/${groupId}/lessons/${lessonId}/toggle-access`, params);
  return res.data;
}

export async function completeLesson(lessonId: number) {
  const base = getBase();
  const res = await axios.post(`${base}/v1/lessons/${lessonId}/complete`);
  return res.data;
}

export async function createCourseLesson(courseId: number, data: {
  title: string;
  content?: string;
  description?: string;
  order?: number;
  block_id?: number;
  lesson_type?: string;
  is_mandatory?: boolean;
}) {
  const base = getBase();
  const res = await axios.post(`${base}/v1/courses/${courseId}/lessons`, data);
  return res.data;
}

export async function deleteLesson(lessonId: number) {
  const base = getBase();
  const res = await axios.delete(`${base}/v1/lessons/${lessonId}`);
  return res.data;
}

// ==========================================
// Блоки курса и импорт Markdown
// ==========================================

export async function fetchCourseBlocks(courseId: number) {
  const base = getBase();
  const res = await axios.get(`${base}/v1/courses/${courseId}/blocks`);
  return res.data;
}

export async function createCourseBlock(courseId: number, data: { title: string; description?: string; order?: number }) {
  const base = getBase();
  const res = await axios.post(`${base}/v1/courses/${courseId}/blocks`, data);
  return res.data;
}

export async function createCourse(data: {
  title: string;
  description?: string;
  category?: string;
  level?: string;
  price?: number;
}) {
  const base = getBase();
  const res = await axios.post(`${base}/v1/courses/create`, data);
  return res.data;
}

export async function updateCourse(
  courseId: number,
  data: { title?: string; description?: string; status?: "draft" | "published" | "archived" }
) {
  const base = getBase();
  const res = await axios.patch(`${base}/v1/course/${courseId}`, data);
  return res.data;
}

export async function importCourseMarkdown(courseId: number, data: { title?: string; content: string; block_id?: number }) {
  const base = getBase();
  const res = await axios.post(`${base}/v1/courses/${courseId}/import-markdown`, data);
  return res.data;
}

// ==========================================
// Экзамены
// ==========================================

export async function fetchBlockExam(blockId: number) {
  const base = getBase();
  const res = await axios.get(`${base}/v1/blocks/${blockId}/exam`);
  return res.data;
}

export async function createOrUpdateBlockExam(blockId: number, data: {
  title: string;
  description?: string;
  passing_score?: number;
  max_attempts?: number;
  questions?: Array<{ text: string; answers: Array<{ text: string; is_correct: boolean }> }>;
}) {
  const base = getBase();
  const res = await axios.post(`${base}/v1/blocks/${blockId}/exam`, data);
  return res.data;
}

export async function fetchExam(examId: number) {
  const base = getBase();
  const res = await axios.get(`${base}/v1/exams/${examId}`);
  return res.data;
}

export async function submitExam(examId: number, payload: {
  answers: Array<{ question_id: number; answer_id: number }>;
}) {
  const base = getBase();
  const res = await axios.post(`${base}/v1/exams/${examId}/submit`, payload);
  return res.data;
}
