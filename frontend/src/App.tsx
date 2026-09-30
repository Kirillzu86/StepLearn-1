import { useEffect, useState } from "react";
import { API_URL } from "./api/api";
import { Routes, Route } from "react-router-dom";

import HomePage from "./components/HomePage/Homepage";
import LogPage from "./components/LogPage/LogPage";
import RegPage from "./components/RegPage/RegPage";
import Catalog from "./components/Catalog/Catalog";
import CourseDetail from './components/CourseDetail/courseDetail';
import CreateCourse from './components/CreateCourse/CreateCourse';
import Profile from './components/Profile/Profile';
import AdminPanel from './components/AdminPanel/AdminPanel';
import TeacherLogin from './components/TeacherAuth/TeacherLogin';
import TeacherRegister from './components/TeacherAuth/TeacherRegister';
import Notifications from './components/Notifications/Notifications';
import Settings from './components/Settings/Settings';
import Professions from './components/Professions/Professions';
import LearningPath from './components/LearningPath/LearningPath';
import Community from './components/Community/Community';
import Assignments from './components/Assignments/Assignments';
import Calendar from './components/Calendar/Calendar';
import MyCourses from './components/MyCourses/MyCourses';
import Help from './components/Help/Help';

function App() {
  const [, setUsers] = useState<{ id: number; name: string }[]>([]);
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
    const base = API_URL.replace(/\/$/, '');
    fetch(`${base}/users`)
      .then(res => res.json())
      .then(data => setUsers(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    document.body.dataset.theme = theme;
    // Сохраняем тему при изменении
    localStorage.setItem("theme", theme);
  }, [theme]);

  return (
    <Routes>
      <Route path="/" element={<HomePage theme={theme} toggleTheme={toggleTheme} />} />
      <Route path="/login" element={<LogPage theme={theme} toggleTheme={toggleTheme} />} />
      <Route path="/register" element={<RegPage theme={theme} toggleTheme={toggleTheme} />} />
      <Route path="/catalog" element={<Catalog theme={theme} toggleTheme={toggleTheme} />} />
      <Route path="/create-course" element={<CreateCourse theme={theme} toggleTheme={toggleTheme} />} />
      <Route path="/course/:id" element={<CourseDetail theme={theme} toggleTheme={toggleTheme} />} />
      <Route path="/profile" element={<Profile theme={theme} toggleTheme={toggleTheme} />} />
      <Route path="/admin-panel" element={<AdminPanel theme={theme} toggleTheme={toggleTheme} />} />
      <Route path="/teacher-login" element={<TeacherLogin theme={theme} toggleTheme={toggleTheme} />} />
      <Route path="/teacher-register" element={<TeacherRegister theme={theme} toggleTheme={toggleTheme} />} />
      <Route path="/notifications" element={<Notifications theme={theme} toggleTheme={toggleTheme} />} />
      <Route path="/settings" element={<Settings theme={theme} toggleTheme={toggleTheme} />} />
      <Route path="/professions" element={<Professions theme={theme} toggleTheme={toggleTheme} />} />
      <Route path="/learning-path" element={<LearningPath theme={theme} toggleTheme={toggleTheme} />} />
      <Route path="/community" element={<Community theme={theme} toggleTheme={toggleTheme} />} />
      <Route path="/assignments" element={<Assignments theme={theme} toggleTheme={toggleTheme} />} />
      <Route path="/calendar" element={<Calendar theme={theme} toggleTheme={toggleTheme} />} />
      <Route path="/my-courses" element={<MyCourses theme={theme} toggleTheme={toggleTheme} />} />
      <Route path="/help" element={<Help theme={theme} toggleTheme={toggleTheme} />} />
    </Routes>
  );
}

export default App;