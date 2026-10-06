# StepLearn — Образовательная платформа

StepLearn — полнофункциональная платформа онлайн-обучения с поддержкой интерактивных заданий, тестов и безопасной проверки программного кода в изолированных sandbox-контейнерах.

Платформа спроектирована по модульной архитектуре с единым backend API и базой данных, но с **двумя независимыми frontend-приложениями**:
- **Student Frontend** — компактный интерфейс обучающегося с поддержкой Monaco Editor.
- **Teacher Frontend** — панель преподавателя для управления курсами, уроками, заданиями, группами и проверки решений.

---

## 1. Архитектура системы

```text
                               ┌────────────────────────────────┐
                               │       Student Frontend         │
                               │    (React 19 + TypeScript)     │
                               └───────────────┬────────────────┘
                                               │
                                               ▼
┌───────────────────────────┐      HTTP / JWT Auth      ┌──────────────────────────┐
│     Teacher Frontend      │ ────────────────────────> │      Django REST API     │
│  (React 19 + TypeScript)  │                           │       (Django 5.2+)      │
└───────────────────────────┘                           └──────┬────────────┬──────┘
                                                               │            │
                                     ORM Queries               ▼            ▼  Enqueues ID
                                 ┌──────────────────────────────┐      ┌─────────────────┐
                                 │     PostgreSQL Database      │      │  Redis Queue    │
                                 └──────────────────────────────┘      └────────┬────────┘
                                                                                │
                                                                                ▼
                                                                       ┌─────────────────┐
                                                                       │  Celery Worker  │
                                                                       └────────┬────────┘
                                                                                │ HTTPS + Token
                                                                                ▼
                                                                       ┌─────────────────┐
                                                                       │   Code Runner   │
                                                                       │ (FastAPI Host)  │
                                                                       └────────┬────────┘
                                                                                │
                                                                                ▼ Spawns per-test
                                                                       ┌─────────────────┐
                                                                       │ Sandbox (Docker)│
                                                                       │ (No Net, Drop   │
                                                                       │  Caps, Limits)  │
                                                                       └─────────────────┘
```

### Ключевые архитектурные правила
1. **Единый backend и БД**: оба frontend обращаются к единому Django REST API.
2. **Изоляция кода**: пользовательский код **никогда** не исполняется внутри Django-процесса, Celery worker или браузера. Выполнение происходит только в выделенном сервисе Code Runner в одноразовых sandbox-контейнерах.
3. **Защита hidden tests и solution code**: тесты и эталонные решения не возвращаются в student serializers и не попадают в бандл ученика.
4. **Контроль доступа (RBAC)**:
   - Студенты не могут регистрироваться самостоятельно (публичная регистрация отключена).
   - Преподаватель создаёт аккаунты студентов с временным паролем и обязательной сменой при первом входе.
   - Преподавательские аккаунты создаются только администратором.

---

## 2. Структура репозитория

```text
StepLearn-1/
├── backend/                     # Django REST API, модели, миграции, тесты, Celery
│   ├── api/                     # Основное приложение: models, views, serializers, tasks
│   ├── steplearn/               # Настройки проекта, wsgi, celery
│   ├── Dockerfile               # Production Dockerfile (Gunicorn)
│   └── entrypoint.sh            # Скрипт миграций, сбора статики и запуска
├── frontend/                    # Student Frontend (React 19, Vite, Tailwind/CSS, Monaco)
├── frontend-teacher/            # Teacher Frontend (React 19, Vite, самостоятельный UI)
├── code-runner/                 # Изолированный сервис запуска кода (FastAPI, Docker sandbox)
│   ├── main.py                  # API Code Runner и управление контейнерами
│   ├── docker-compose.yml       # Runner stack для выделенного хоста
│   └── .env.example             # Переменные runner
├── Docs-agent/                  # Техническая документация, ТЗ и планы
│   ├── PROJECT_SPEC.md          # Полное ТЗ проекта
│   ├── Plan.md                  # Дорожная карта и архитектурный план
│   └── Task.md                  # Чек-лист реализации и Definition of Done
├── docker-compose.yml           # Основной Application Compose
├── .env.example                 # Шаблон переменных окружения основного стека
└── .github/workflows/ci.yml     # GitHub Actions CI пайплайн
```

---

## 3. Быстрый запуск для разработки

### 3.1. Предварительные требования
- Python 3.11+
- Node.js 20+ / 22+ и npm
- (Опционально) PostgreSQL 16+ и Redis 7+

### 3.2. Бэкенд (локальный запуск)
```powershell
cd backend
python -m pip install -r requirements.txt

# Локальный запуск с использованием встроенного SQLite и режима отладки:
$env:USE_SQLITE = "1"
$env:DJANGO_DEBUG = "1"
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```

### 3.3. Student Frontend
```powershell
cd frontend
npm install # или npm ci
npm run dev
# Доступен по адресу: http://localhost:5173
```

### 3.4. Teacher Frontend
```powershell
cd frontend-teacher
npm install # или npm ci
npm run dev -- --port 3001
# Доступен по адресу: http://localhost:3001
```

---

## 4. Развёртывание в Production (Docker Compose)

### 4.1. Основной стек приложений (Application Host)
Основной стек включает PostgreSQL, Redis, Django API (Gunicorn), Celery worker, Student Frontend и Teacher Frontend.

1. Скопируйте файл конфигурации:
   ```bash
   cp .env.example .env
   ```
2. Заполните секреты в `.env`:
   - `POSTGRES_PASSWORD`, `DJANGO_SECRET_KEY`, `JWT_SECRET`
   - `DJANGO_ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS`
   - `CODE_RUNNER_URL` (URL выделенного хоста Code Runner, например `https://runner.internal:8081`)
   - `CODE_RUNNER_TOKEN` (секретный токен взаимодействия с runner)
3. Создайте внешнюю сеть (если развёртывание под Coolify):
   ```bash
   docker network create coolify || true
   ```
4. Запустите сервисы:
   ```bash
   docker compose up -d --build
   ```

### 4.2. Сервис выполнения кода (Code Runner Host)
> **Важно:** Code Runner рекомендуется разворачивать на **отдельной изолированной Linux VM**, не содержащей производственных баз данных или секретов.

1. Перейдите в каталог `code-runner`:
   ```bash
   cd code-runner
   cp .env.example .env
   ```
2. Установите `CODE_RUNNER_TOKEN` в `.env` (тот же токен, что указан в бэкенде).
3. Запустите runner stack:
   ```bash
   docker compose up -d --build
   ```
   Сервис запускается с read-only rootfs, `no-new-privileges` и слушает `127.0.0.1:8081` (рекомендуется настроить Nginx reverse-proxy с TLS и доступом только по IP worker-а).

---

## 5. Переменные окружения

### Основной стек (`.env`)

| Переменная | Описание | Пример значения |
|---|---|---|
| `POSTGRES_DB` | Имя базы данных PostgreSQL | `steplearn` |
| `POSTGRES_USER` | Пользователь БД | `steplearn_user` |
| `POSTGRES_PASSWORD` | Пароль пользователя БД | `<секрет>` |
| `DJANGO_SECRET_KEY` | Секретный ключ Django | `<случайная_строка_64_симв>` |
| `JWT_SECRET` | Секретный ключ для подписи JWT | `<случайная_строка_64_симв>` |
| `DJANGO_DEBUG` | Режим отладки (0 в production) | `0` |
| `DJANGO_ALLOWED_HOSTS` | Разрешённые хосты Django | `localhost,127.0.0.1,api.example.com` |
| `CORS_ALLOWED_ORIGINS` | Разрешённые CORS origins | `http://localhost,http://localhost:3001` |
| `CSRF_TRUSTED_ORIGINS` | Доверенные origins для CSRF | `https://api.example.com,http://localhost` |
| `CODE_RUNNER_URL` | Адрес сервиса запуска кода | `https://runner.internal:8081` |
| `CODE_RUNNER_TOKEN` | Bearer-токен для обращения к runner | `<секретный_токен>` |
| `SEED_DEMO_DATA` | Загрузить демо-данные при старте | `0` (включить при необходимости) |

### Code Runner (`code-runner/.env`)

| Переменная | Описание | Пример значения |
|---|---|---|
| `CODE_RUNNER_TOKEN` | Bearer токен аутентификации запросов от бэкенда | `<секретный_токен>` |
| `DOCKER_SOCKET_PATH` | Путь к docker.sock на хосте | `/var/run/docker.sock` |

---

## 6. Безопасность и защита данных

- **JWT Security & Rotation**: Токены имеют ограниченный срок жизни (15 минут для access), refresh-токены ротируются с занесением старых в blacklist. Поддерживается эндпоинт отзыва `/api/auth/logout/`.
- **Защита от XSS и SQL Injection**:
  - Все SQL-запросы выполняются через ORM с параметризацией.
  - Во фронтенде не используется `dangerouslySetInnerHTML`.
  - HTTP-заголовки: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`.
- **Защита загрузки файлов**:
  - Проверка MIME-типов, сигнатур (magic bytes) и расширений (PDF, TXT, PNG, JPEG).
  - Лимит 10 МБ.
  - Хранение в защищённой директории, скачивание только через авторизованный эндпоинт с проверкой прав.
- **Изоляция Sandbox Code Runner**:
  - `network_disabled=True` (полное отключение сети у контейнера с пользовательским кодом).
  - `read_only=True` rootfs с одноразовым `tmpfs` для решения.
  - Лимиты CPU (quota), RAM (память + отключён swap), pids limit (защита от fork-бомб).
  - Принудительное уничтожение контейнера по таймауту.

---

## 7. Запуск тестов

### Тесты бэкенда (Django / DRF)
```powershell
cd backend
$env:USE_SQLITE = "1"
$env:DJANGO_DEBUG = "1"
python manage.py test api.tests.test_api
```

### Тесты Student Frontend
```powershell
cd frontend
npm test -- --run
npm run build
```

### Тесты Teacher Frontend
```powershell
cd frontend-teacher
npm test -- --run
npm run build
```

### Тесты Code Runner
```powershell
cd code-runner
# Unit-тесты:
python -m unittest -v test_main

# Интеграционные тесты sandbox (требуется Docker daemon):
$env:RUN_SANDBOX_INTEGRATION = "1"
python -m unittest -v test_sandbox_integration
```

---

## 8. Мониторинг и Health Checks

Бэкенд предоставляет эндпоинт проверки жизнеспособности:
- **`GET /health/`**:
  Возвращает HTTP 200 при доступности базы данных и статус очереди Redis:
  ```json
  {
    "status": "ok",
    "database": "ok",
    "redis": "ok"
  }
  ```
- Логирование: на бэкенде настроен структурированный вывод логов в консоль (`LOGGING`) с отслеживанием необработанных исключений и контекста представлений.
