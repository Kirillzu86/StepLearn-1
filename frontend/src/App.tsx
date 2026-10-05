import { useEffect, useState } from "react";
import { Navigate, Routes, Route, useLocation } from "react-router-dom";
import type { ReactNode } from "react";

import HomePage from "./components/HomePage/Homepage";
import LogPage from "./components/LogPage/LogPage";
import Catalog from "./components/Catalog/Catalog";
import CourseDetail from './components/CourseDetail/courseDetail';
import Profile from './components/Profile/Profile';
import Notifications from './components/Notifications/Notifications';
import Settings from './components/Settings/Settings';
import Professions from './components/Professions/Professions';
import LearningPath from './components/LearningPath/LearningPath';
import Community from './components/Community/Community';
import Assignments from './components/Assignments/Assignments';
import Calendar from './components/Calendar/Calendar';
import MyCourses from './components/MyCourses/MyCourses';
import Certificates from './components/Certificates/Certificates';
import Help from './components/Help/Help';

type UserRole = "student" | "teacher" | "admin";

interface RouteUser {
  access?: string;
  role?: UserRole;
  must_change_password?: boolean;
  is_staff?: boolean;
  is_superuser?: boolean;
}

function readRouteUser(): RouteUser | null {
  try {
    const savedUser = localStorage.getItem("currentUser");
    return savedUser ? JSON.parse(savedUser) as RouteUser : null;
  } catch (error) {
    console.error("Unable to read the saved user session:", error);
    localStorage.removeItem("currentUser");
    return null;
  }
}

function RouteGuard({
  children,
  roles,
}: {
  children: ReactNode;
  roles?: UserRole[];
}) {
  const location = useLocation();
  const [user, setUser] = useState(readRouteUser);

  useEffect(() => {
    const syncUser = () => setUser(readRouteUser());
    window.addEventListener("currentUserChanged", syncUser);
    window.addEventListener("storage", syncUser);
    return () => {
      window.removeEventListener("currentUserChanged", syncUser);
      window.removeEventListener("storage", syncUser);
    };
  }, []);

  if (!user?.access || user.must_change_password) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  const hasElevatedRole = Boolean(user.is_staff || user.is_superuser);
  if (
    roles &&
    (!user.role || !roles.includes(user.role)) &&
    !(roles.includes("admin") && hasElevatedRole)
  ) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function App() {
  // Загружаем тему из localStorage при инициализации
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const savedTheme = localStorage.getItem("theme") as "dark" | "light" | null;
    return savedTheme || "dark";
  });

  const toggleTheme = () => {
    setTheme((prev) => {
      const newTheme = prev === "dark" ? "light" : "dark";
      // Сохраняем тему в localStorage
      localStorage.setItem("theme", newTheme);
      return newTheme;
    });
  };

  useEffect(() => {
    document.body.dataset.theme = theme;
    // Сохраняем тему при изменении
    localStorage.setItem("theme", theme);
  }, [theme]);

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LogPage theme={theme} toggleTheme={toggleTheme} />} />
      <Route path="/catalog" element={<Catalog theme={theme} toggleTheme={toggleTheme} />} />
      <Route path="/course/:id" element={<CourseDetail theme={theme} toggleTheme={toggleTheme} />} />
      <Route path="/profile" element={
        <RouteGuard>
          <Profile theme={theme} toggleTheme={toggleTheme} />
        </RouteGuard>
      } />
      <Route path="/notifications" element={<Notifications theme={theme} toggleTheme={toggleTheme} />} />
      <Route path="/settings" element={<Settings theme={theme} toggleTheme={toggleTheme} />} />
      <Route path="/professions" element={<Professions theme={theme} toggleTheme={toggleTheme} />} />
      <Route path="/learning-path" element={<LearningPath theme={theme} toggleTheme={toggleTheme} />} />
      <Route path="/community" element={<Community theme={theme} toggleTheme={toggleTheme} />} />
      <Route path="/assignments" element={
        <RouteGuard roles={["student"]}>
          <Assignments />
        </RouteGuard>
      } />
      <Route path="/calendar" element={<Calendar theme={theme} toggleTheme={toggleTheme} />} />
      <Route path="/my-courses" element={
        <RouteGuard roles={["student"]}>
          <MyCourses />
        </RouteGuard>
      } />
      <Route path="/certificates" element={
        <RouteGuard roles={["student"]}>
          <Certificates />
        </RouteGuard>
      } />
      <Route path="/help" element={<Help theme={theme} toggleTheme={toggleTheme} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;