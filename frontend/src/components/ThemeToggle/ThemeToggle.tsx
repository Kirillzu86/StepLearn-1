import React from 'react';
import { FiSun, FiMoon } from 'react-icons/fi';
import './ThemeToggle.css';

type ThemeToggleProps = {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
};

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ theme, toggleTheme }) => {
  const isDark = theme === 'dark';
  return (
    <button
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label={isDark ? "Переключить на светлую тему" : "Переключить на тёмную тему"}
      title={isDark ? "Переключить на светлую тему" : "Переключить на тёмную тему"}
    >
      <span className="theme-toggle__icon-wrap">
        {isDark ? <FiSun className="theme-icon sun" /> : <FiMoon className="theme-icon moon" />}
      </span>
      <span className="theme-toggle__label">
        {isDark ? 'Светлая тема' : 'Тёмная тема'}
      </span>
    </button>
  );
};
