import React, { useState } from "react";
import Header from "../Header/Header";
import Sidebar from "../Sidebar/sidebar";
import { FiSearch, FiChevronDown, FiChevronUp, FiSend, FiMessageCircle } from "react-icons/fi";
import "../HomePage/StyleHomePage.css";
import "../Sidebar/StyleSidebar.css";
import "./StyleHelp.css";

interface FAQItem {
  question: string;
  answer: string;
}

const faqList: FAQItem[] = [
  {
    question: "Как проходит обучение на StepLearn?",
    answer: "Обучение состоит из видеоуроков, лекций в формате Markdown, практических заданий и итоговых экзаменационных тестов. Вы учитесь в удобном для себя темпе.",
  },
  {
    question: "Как получить сертификат об окончании курса?",
    answer: "Сертификат выдается автоматически после того, как вы пройдете 100% уроков курса и успешно сдадите все обязательные экзамены с результатом от 70%.",
  },
  {
    question: "Что делать, если возникла ошибка при прохождении урока?",
    answer: "Попробуйте обновить страницу. Если ошибка сохраняется, напишите в службу поддержки через форму ниже или опубликуйте вопрос в сообществе.",
  },
  {
    question: "Могу ли я совмещать несколько курсов одновременно?",
    answer: "Да, вы можете одновременно проходить неограниченное количество курсов. Все они доступны на вкладке 'Мои курсы'.",
  },
];

export default function Help() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [supportMessage, setSupportMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const toggleAccordion = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  const handleSupportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportMessage.trim()) return;
    setSubmitted(true);
    setSupportMessage("");
    setTimeout(() => setSubmitted(false), 4000);
  };

  const filteredFaq = faqList.filter(
    (item) =>
      item.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="sl-app">
      <Header />
      <div className="sl-layout">
        <Sidebar />
        <main className="sl-main sl-page-shell">
          <div className="sl-help-container">
            <div className="sl-help-header">
              <h1 className="sl-help-title">Центр помощи и поддержки</h1>
              <p className="sl-help-subtitle">
                Найдите ответы на частые вопросы или свяжитесь с командой поддержки StepLearn.
              </p>
            </div>

            {/* Search */}
            <div className="sl-help-search">
              <FiSearch className="sl-help-search-icon" />
              <input
                type="text"
                placeholder="Поиск по Базе Знаний..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="sl-help-search-input"
              />
            </div>

            {/* FAQ Accordion */}
            <div className="sl-help-section">
              <h2 className="sl-help-section-title">Часто задаваемые вопросы (FAQ)</h2>
              <div className="sl-help-faq-list">
                {filteredFaq.length > 0 ? (
                  filteredFaq.map((item, idx) => {
                    const isOpen = openIndex === idx;
                    return (
                      <div key={idx} className={`sl-help-faq-item ${isOpen ? "sl-help-faq-item--open" : ""}`}>
                        <button className="sl-help-faq-q" onClick={() => toggleAccordion(idx)}>
                          <span>{item.question}</span>
                          {isOpen ? <FiChevronUp /> : <FiChevronDown />}
                        </button>
                        {isOpen && <div className="sl-help-faq-a">{item.answer}</div>}
                      </div>
                    );
                  })
                ) : (
                  <div className="sl-empty">Вопросов по вашему запросу не найдено</div>
                )}
              </div>
            </div>

            {/* Support Request Form */}
            <div className="sl-help-support-card">
              <h2 className="sl-help-section-title"><FiMessageCircle /> Задать вопрос поддержке</h2>
              <p className="sl-help-desc">Если вы не нашли ответ, опишите проблему ниже — мы ответим в течение 24 часов.</p>

              {submitted && (
                <div className="sl-settings-alert sl-settings-alert--success">
                  Ваше сообщение успешно отправлено! Мы ответим на ваш email.
                </div>
              )}

              <form onSubmit={handleSupportSubmit} className="sl-help-form">
                <textarea
                  placeholder="Опишите подробнее ваш вопрос или проблему..."
                  value={supportMessage}
                  onChange={(e) => setSupportMessage(e.target.value)}
                  rows={4}
                  required
                />
                <button type="submit" className="sl-help-submit-btn">
                  <FiSend /> Отправить обращение
                </button>
              </form>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
