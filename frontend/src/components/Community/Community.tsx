import React, { useState } from "react";
import Header from "../Header/Header";
import Sidebar from "../Sidebar/sidebar";
import { FiMessageSquare, FiThumbsUp, FiUser, FiPlus, FiSearch, FiTag } from "react-icons/fi";
import "../HomePage/StyleHomePage.css";
import "../Sidebar/StyleSidebar.css";
import "./StyleCommunity.css";

interface Post {
  id: number;
  author: string;
  avatar?: string;
  title: string;
  preview: string;
  category: string;
  likes: number;
  comments: number;
  date: string;
}

const initialPosts: Post[] = [
  {
    id: 1,
    author: "Алексей Смирнов",
    title: "Как лучше сочетать изучение React и TypeScript?",
    preview: "Привет всем! Начинаю учить TypeScript после базового JS. Посоветуйте, лучше сначала написать проект на чистом TS или сразу переходить к React + TS?",
    category: "React / Frontend",
    likes: 18,
    comments: 7,
    date: "2 часа назад",
  },
  {
    id: 2,
    author: "Елена Ковалева",
    title: "Поделитесь практикой работы с Django REST Framework",
    preview: "Делаю учебный API для каталога курсов. Возник вопрос по оптимизации select_related и prefetch_related в сериализаторах...",
    category: "Python / Backend",
    likes: 12,
    comments: 4,
    date: "5 часов назад",
  },
  {
    id: 3,
    author: "Дмитрий Волков",
    title: "Группа для совместной подготовки к собеседованиям Frontend",
    preview: "Ищу напарников для проведения live-coding mock интервью 2 раза в неделю. Пишите в личные сообщения!",
    category: "Карьера",
    likes: 24,
    comments: 11,
    date: "Вчера",
  },
];

export default function Community({ theme, toggleTheme }: { theme: "dark" | "light"; toggleTheme: () => void }) {
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState("Все темы");

  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("React / Frontend");
  const [newPreview, setNewPreview] = useState("");

  const handleCreatePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newPreview.trim()) return;

    const userRaw = localStorage.getItem("currentUser");
    const user = userRaw ? JSON.parse(userRaw) : null;
    const authorName = user?.username || user?.name || "Пользователь";

    const newPostItem: Post = {
      id: Date.now(),
      author: authorName,
      title: newTitle,
      preview: newPreview,
      category: newCategory,
      likes: 1,
      comments: 0,
      date: "Только что",
    };

    setPosts([newPostItem, ...posts]);
    setNewTitle("");
    setNewPreview("");
    setShowModal(false);
  };

  const handleLike = (id: number) => {
    setPosts(posts.map((p) => (p.id === id ? { ...p, likes: p.likes + 1 } : p)));
  };

  const categories = ["Все темы", "React / Frontend", "Python / Backend", "Карьера", "Вопросы по курсам"];

  const filteredPosts = posts.filter((p) => {
    const matchesCategory = activeCategory === "Все темы" || p.category === activeCategory;
    const matchesSearch = p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.preview.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="sl-app">
      <Header />
      <div className="sl-layout">
        <Sidebar />
        <main className="sl-main">
          <div className="sl-comm-container">
            {/* Header */}
            <div className="sl-comm-header">
              <div>
                <h1 className="sl-comm-title">Сообщество и форум</h1>
                <p className="sl-comm-subtitle">
                  Задавайте вопросы, делитесь опытом и общайтесь с другими студентами.
                </p>
              </div>

              <button className="sl-comm-create-btn" onClick={() => setShowModal(true)}>
                <FiPlus /> Создать тему
              </button>
            </div>

            {/* Toolbar */}
            <div className="sl-comm-toolbar">
              <div className="sl-comm-search">
                <FiSearch className="sl-comm-search-icon" />
                <input
                  type="text"
                  placeholder="Поиск по темам и обсуждениям..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="sl-comm-search-input"
                />
              </div>

              <div className="sl-comm-categories">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    className={`sl-comm-cat-btn ${activeCategory === cat ? "sl-comm-cat-btn--active" : ""}`}
                    onClick={() => setActiveCategory(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Posts List */}
            <div className="sl-comm-posts">
              {filteredPosts.length > 0 ? (
                filteredPosts.map((post) => (
                  <div key={post.id} className="sl-comm-post-card">
                    <div className="sl-comm-post-header">
                      <div className="sl-comm-author">
                        <div className="sl-comm-avatar">{post.author[0].toUpperCase()}</div>
                        <div>
                          <div className="sl-comm-author-name">{post.author}</div>
                          <div className="sl-comm-post-date">{post.date}</div>
                        </div>
                      </div>
                      <span className="sl-comm-tag"><FiTag /> {post.category}</span>
                    </div>

                    <h2 className="sl-comm-post-title">{post.title}</h2>
                    <p className="sl-comm-post-preview">{post.preview}</p>

                    <div className="sl-comm-post-footer">
                      <button className="sl-comm-stat-btn" onClick={() => handleLike(post.id)}>
                        <FiThumbsUp /> {post.likes}
                      </button>
                      <span className="sl-comm-stat">
                        <FiMessageSquare /> {post.comments} ответов
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="sl-empty">Темы по данному запросу не найдены</div>
              )}
            </div>

            {/* Create Post Modal */}
            {showModal && (
              <div className="sl-modal-overlay" onClick={() => setShowModal(false)}>
                <div className="sl-modal-card" onClick={(e) => e.stopPropagation()}>
                  <h2 className="sl-modal-title">Создать новую тему</h2>
                  <form onSubmit={handleCreatePost} className="sl-modal-form">
                    <div className="sl-modal-group">
                      <label>Заголовок вопроса или темы</label>
                      <input
                        type="text"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        placeholder="Например: Как настроить CORS в FastAPI?"
                        required
                      />
                    </div>

                    <div className="sl-modal-group">
                      <label>Категория</label>
                      <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)}>
                        <option value="React / Frontend">React / Frontend</option>
                        <option value="Python / Backend">Python / Backend</option>
                        <option value="Карьера">Карьера</option>
                        <option value="Вопросы по курсам">Вопросы по курсам</option>
                      </select>
                    </div>

                    <div className="sl-modal-group">
                      <label>Описание / текст сообщения</label>
                      <textarea
                        value={newPreview}
                        onChange={(e) => setNewPreview(e.target.value)}
                        rows={4}
                        placeholder="Подробно опишите проблему или ваш вопрос..."
                        required
                      />
                    </div>

                    <div className="sl-modal-actions">
                      <button type="submit" className="sl-comm-create-btn">
                        Опубликовать
                      </button>
                      <button type="button" className="sl-modal-cancel" onClick={() => setShowModal(false)}>
                        Отмена
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
