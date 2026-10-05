import { useEffect, useState, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import AdminPanel from "./components/AdminPanel/AdminPanel";
import CreateCourse from "./components/CreateCourse/CreateCourse";
import TeacherLogin from "./components/TeacherAuth/TeacherLogin";

type TeacherSession = {
  access?: string;
  role?: string;
  is_staff?: boolean;
  is_superuser?: boolean;
  must_change_password?: boolean;
};

function readTeacherSession(): TeacherSession | null {
  try {
    const saved = localStorage.getItem("currentUser");
    return saved ? JSON.parse(saved) as TeacherSession : null;
  } catch (error) {
    console.error("Unable to read teacher session:", error);
    localStorage.removeItem("currentUser");
    return null;
  }
}

function TeacherGuard({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [session, setSession] = useState(readTeacherSession);

  useEffect(() => {
    const syncSession = () => setSession(readTeacherSession());
    window.addEventListener("currentUserChanged", syncSession);
    window.addEventListener("storage", syncSession);
    return () => {
      window.removeEventListener("currentUserChanged", syncSession);
      window.removeEventListener("storage", syncSession);
    };
  }, []);

  const isTeacher = session?.role === "teacher"
    || session?.role === "admin"
    || session?.is_staff
    || session?.is_superuser;
  if (!session?.access || !isTeacher || session.must_change_password) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return children;
}

export default function App() {
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const savedTheme = localStorage.getItem("teacher-theme");
    return savedTheme === "light" ? "light" : "dark";
  });

  useEffect(() => {
    document.body.dataset.theme = theme;
    localStorage.setItem("teacher-theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme((previous) => previous === "dark" ? "light" : "dark");

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/admin-panel" replace />} />
      <Route path="/login" element={<TeacherLogin />} />
      <Route path="/teacher-login" element={<Navigate to="/login" replace />} />
      <Route path="/register" element={<Navigate to="/login" replace />} />
      <Route path="/teacher-register" element={<Navigate to="/login" replace />} />
      <Route
        path="/admin-panel"
        element={
          <TeacherGuard>
            <AdminPanel theme={theme} toggleTheme={toggleTheme} />
          </TeacherGuard>
        }
      />
      <Route
        path="/create-course"
        element={
          <TeacherGuard>
            <CreateCourse theme={theme} toggleTheme={toggleTheme} />
          </TeacherGuard>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
