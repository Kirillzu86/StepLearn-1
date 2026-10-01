# StepLearn — Implementation Plan

План реализации составлен по требованиям
[PROJECT_SPEC.md](./PROJECT_SPEC.md). Он рассчитан на постепенное развитие
существующего проекта, а не на переписывание системы с нуля.

## Принципы

1. Перед каждой фазой изучать текущий код и сохранять совместимость.
2. Сначала реализовывать backend-контракт и permissions, затем UI.
3. Не считать UI готовым без API-, permission- и интеграционных тестов.
4. Не выполнять пользовательский код внутри Django-процесса.
5. Не хранить секреты, hidden tests и solution code во frontend.
6. После каждой фазы запускать минимальный набор соответствующих проверок.

## Phase 0 — Repository audit

**Цель:** понять текущее состояние проекта и выбрать точки интеграции.

### Шаги

1. Зафиксировать структуру каталогов и текущие приложения.
2. Найти модели, serializers, views/viewsets, URLs и permissions.
3. Найти authentication, frontend routes и state management.
4. Проверить Docker, `.env`-файлы, миграции, тесты и CI.
5. Составить карту «существует / отсутствует / требует изменения».
6. Уточнить зависимости и не дублировать уже существующие helpers.

**Результат:** технический baseline и список минимальных изменений.

### Результаты аудита repository (2026-10-01)

| Область | Уже есть | Отличия и следующий шаг |
|---|---|---|
| Backend | Django 5.2 + DRF в приложении `backend/api`; кастомный `User`; курсы, блоки, уроки, экзамены, группы, enrollment и прогресс. | Не создавать повторно `Course`/`Lesson`; сопоставить `CourseBlock` с разделом курса и постепенно добавлять недостающие доменные модели. |
| Authentication | JWT login/refresh/logout, роль и базовый профиль; запрещена регистрация студентов; teacher создаёт student с временным паролем и first-login password change. | Публичная регистрация преподавателя остаётся и требует отдельного решения по политике. |
| API и permissions | DRF views используют JWT/RBAC, ownership групп преподавателем, запись студентов только по назначению учителя; не назначенные курсы и закрытые уроки не отдают учебный контент. | Продолжать проверять object-level permissions у новых API и расширять CRUD-тесты; не переводить views на viewsets ради переписывания. |
| Student frontend | React 19 + TypeScript + Vite в `frontend`; основные страницы уже подключены в `frontend/src/App.tsx`. | Реальные backend-маршруты и доступ студента требуют постепенного согласования с JWT API. |
| Teacher frontend | Teacher UI переиспользует `AdminPanel`; есть отдельный проект `frontend-teacher` и ещё один wrapper в `frontend/teacher`. | Структура дублирована/неоднозначна; определить основной teacher build. Текущий `docker-compose.yml` запускает только общий `frontend`. |
| Данные | 13 моделей в `api/models.py`, миграции до `0005`; PostgreSQL настроен, SQLite доступен для локальных тестов. | `StudentProfile`, `TeacherProfile`, `Assignment`, `TestCase`, `Submission`, `Certificate` и `Notification` отсутствуют. Сначала проектировать только необходимые модели и миграции. |
| Инфраструктура | Docker Compose: PostgreSQL, backend и один frontend; backend запускается через Gunicorn, entrypoint выполняет миграции. | В Compose/requirements пока нет Redis, Celery и Code Runner. CORS/production secrets и production значения по умолчанию необходимо проверить до развёртывания. |
| Code execution | — | Нет Monaco, submission pipeline и изолированного runner. Реализацию начинать только после assignment/submission контрактов; никогда не исполнять код внутри Django. |
| Проверки | Один файл API-тестов, 14 тестов в текущем состоянии; Django check и migration consistency check проходят. npm build frontend проходит после установки зависимостей. | В текущем полном прогоне 11 тестов прошли, 3 теста деталей/создания курса завершились `KeyError: 'questions'`; это существующая область поведения для отдельного расследования. CI workflow в `.github` не найден. |

### Выбранные точки интеграции

- Backend-функции и URL оставить в текущем `api` приложении; permissions и JWT helpers держать в отдельных модулях.
- Использовать существующие `Course`, `CourseBlock`, `Lesson`, `StudyGroup`,
  `Enrollment` и `StudentLessonProgress`, расширяя только при необходимости.
- Student UI сохранять в `frontend/src`; для отдельного teacher deployment
  сначала выбрать один из уже существующих teacher entry points, не создавать третий.
- Добавлять тесты рядом с существующим `backend/api/tests/test_api.py`;
  локально использовать `USE_SQLITE=1`, если PostgreSQL не запущен.
- Перед наращиванием учебного функционала закрыть ownership и role checks у API,
  доступ которых сейчас задаётся через переданные `user_id`/`author_id`.

### Foundation status (2026-10-01)

- Django 5.2, DRF, PostgreSQL backend и переменные `POSTGRES_*` уже настроены;
  добавлена загрузка `backend/.env` для локального запуска.
- `User` хранит роли `student`, `teacher`, `admin`; значения оставлены
  lowercase для совместимости с API и frontend. Добавлены `StudentProfile` и
  `TeacherProfile`, автоматическое создание и миграционный backfill существующих
  пользователей.
- Django checks, migration consistency и целевые role-profile tests проходят.
- Подключение к локальному PostgreSQL пока не подтверждено: сервер доступен на
  localhost:5432, но отклоняет настроенный пароль пользователя `postgres`.

## Phase 1 — Backend foundation и роли

**Цель:** получить безопасный backend с ролями и управлением студентами.

### Реализация

- User, StudentProfile, TeacherProfile.
- Роли ADMIN, TEACHER, STUDENT.
- JWT endpoints: login, refresh, logout.
- Запрет публичной регистрации и student self-registration.
- Teacher CRUD для студентов.
- Временный пароль, обязательная смена пароля и блокировка.
- DRF permissions с backend-проверкой роли и объекта.

### Проверка

- Authentication tests.
- Permission tests для каждой роли.
- API tests создания студента преподавателем.
- Проверка, что student не получает teacher endpoints.

**Результат:** преподаватель может создавать студентов, а студент —
безопасно входить без возможности самостоятельной регистрации.

## Phase 2 — Course domain

**Цель:** реализовать структуру курсов и доступ к ним.

### Реализация

- Course, Section, Lesson, Enrollment.
- Порядок элементов курса.
- Draft/published/archived состояния.
- Назначение курса студенту или группе.
- API для teacher CRUD и student read-only доступа.

### Проверка

- Проверить изоляцию курсов между студентами.
- Проверить publish/archive workflow.
- Проверить порядок sections и lessons.
- Добавить API и permission tests.

**Результат:** преподаватель создаёт и назначает курс, студент видит только
разрешённый контент.

## Phase 3 — Assignments и progress

**Цель:** добавить учебные задания и отслеживание прогресса.

### Реализация

- Базовый Assignment и типы Text, Quiz, Multiple Choice, File Upload,
  Short Answer.
- Code Assignment: язык, starter code, лимиты, attempts, points, hints,
  solution и visibility.
- TestCase с разделением public/hidden данных.
- Progress для course, section, lesson и assignment.

### Проверка

- Student не может создавать или изменять assignments.
- Hidden tests не попадают в student serializers.
- Progress корректно обновляется при завершении задания.
- Проверить валидацию файлов и входных данных.

**Результат:** существует полный backend-контракт курсов, заданий и прогресса.

## Phase 4 — Student Frontend

**Цель:** дать студенту минимальный полный учебный workflow.

### Реализация

1. Login и token lifecycle.
2. Dashboard и список назначенных курсов.
3. Course Page и Lesson Page.
4. Assignment Page.
5. Progress, Profile и Certificates.
6. Единые loading, empty, error, offline и permission denied состояния.

### Проверка

- Защищённые routes.
- Корректное обновление access token.
- Отсутствие teacher UI и чужих submissions.
- Vitest/React Testing Library для основных пользовательских сценариев.

### Текущий прогресс (2026-10-01)

- Axios повторяет запрос после обновления access token по refresh token; параллельные
  ответы `401` используют общий запрос обновления. При недействительном refresh
  локальная сессия очищается, а защищённый маршрут переоценивает доступ.
- Экран сертификатов использует только завершённость, рассчитанную backend progress
  API, и печатает сертификат-предпросмотр. Постоянная модель и API выдачи сертификатов
  не добавлялись; это необходимо для официальной/повторно скачиваемой выдачи.
- Dashboard, My Courses, Profile и Course Page показывают раздельные loading/error
  состояния; Profile и Course Page поддерживают retry, а ошибки действий Course Page
  объявляются inline через доступные alert-области, без браузерных `alert()`.
- Подключены Vitest, jsdom и Testing Library. Восемь component/integration тестов
  проверяют Certificate card/empty/permission/retry, My Courses empty/error и
  Axios JWT refresh/retry/expired-refresh logout.
- Сборка frontend и тесты проходят. Проверки Profile/Course Page и защищённых
  маршрутов отдельными компонентными тестами остаются возможным расширением покрытия.

**Результат:** студент может войти, открыть назначенный курс и проходить
материалы.

## Phase 5 — Teacher Frontend

**Цель:** дать преподавателю рабочую административную панель.

### Реализация

- Dashboard: students, courses, activity, submissions и progress.
- Students: поиск, фильтр, создание, редактирование, блокировка и профиль.
- Courses: CRUD, sections, lessons, assignments, publish/archive.
- Enrollment: назначение отдельным студентам и группам.
- Monitoring: progress и submissions.

### Проверка

- Все действия сверяются с backend permissions.
- Ошибки API показываются явно, без silent fallback.
- Проверить teacher workflows компонентными и интеграционными тестами.

**Результат:** преподаватель управляет учебным контентом и студентами без
ручного обращения к API.

## Phase 6 — Monaco и submissions

**Цель:** реализовать полный путь отправки программного решения.

### Реализация

- Monaco Editor с language mode, autocomplete, line numbers и темами.
- Run, Submit и Reset.
- Submission model и статусы выполнения.
- Ограничение allowed attempts и хранение результата.
- UI для pending/running/completed/error состояний.

### Проверка

- Solution code не загружается в frontend bundle или student response.
- Hidden test implementation не возвращается API.
- Повторная отправка и ошибки отображаются предсказуемо.

**Результат:** студент может написать код и отправить его через backend.

## Phase 7 — Code Runner

**Цель:** безопасно выполнять пользовательский код вне Django.

### Архитектура

`Student → Django API → Submission → Celery → Redis → Code Runner →
isolated container → tests → result → Django → Student`

### Реализация

- Отдельный Code Runner service.
- Очередь Celery/Redis и идемпотентная обработка submission.
- Одноразовый sandbox-контейнер на каждый запуск.
- CPU, RAM, time, process, filesystem и lifetime limits.
- Network disabled, без privileged mode и host mounts.
- Уничтожение sandbox после завершения или timeout.

### Проверка

- Passed/failed/compile/runtime/timeout/system statuses.
- Timeout и memory limit tests.
- Malicious code и fork/process tests.
- Network isolation tests.
- Проверка, что runner не принимает arbitrary Docker commands.

**Результат:** code assignment работает через изолированный runner с
защищёнными hidden tests.

## Phase 8 — Docker и production configuration

**Цель:** воспроизводимый запуск всей системы.

### Реализация

- Services: nginx, backend, student-frontend, teacher-frontend, postgres,
  redis, celery, code-runner.
- `.env.example` для DATABASE_URL, SECRET_KEY, JWT_SECRET и сервисных URL.
- Health checks, migrations, startup order и logging.
- Production server вместо Django development server.
- CORS, CSRF, rate limiting и secure token/cookie settings.

### Проверка

- Чистый запуск через Docker Compose.
- PostgreSQL и Redis доступны backend/Celery.
- Code Runner не имеет доступа к host filesystem и сети.
- Секреты отсутствуют в tracked files.

## Phase 9 — CI, hardening и документация

**Цель:** закрепить качество и эксплуатацию.

### Реализация

- CI для lint, type-check, backend/frontend tests и sandbox tests.
- Документация запуска, env variables, API и архитектуры.
- Health/error monitoring и понятные логи.
- Аудит SQL injection, XSS, file upload и permission boundaries.

### Проверка

- Полный test suite проходит в CI.
- Проверен Definition of Done из PROJECT_SPEC.md.
- Обновлены Task.md и Plan.md по фактическому состоянию.

## Зависимости фаз

```text
Phase 0
  └── Phase 1
        └── Phase 2
              └── Phase 3
                    ├── Phase 4
                    ├── Phase 5
                    └── Phase 6
                          └── Phase 7
                                └── Phase 8
                                      └── Phase 9
```

Phase 4 и Phase 5 можно выполнять параллельно после стабилизации API
Phase 3. Phase 6 требует готового Code Assignment API. Phase 7 начинается
после определения Submission-контракта и не должна обходить backend
permissions.

## Критерии завершения проекта

Проект считается готовым только после выполнения всех фаз, прохождения
тестов и подтверждения всех пунктов Definition of Done в
[PROJECT_SPEC.md](./PROJECT_SPEC.md), включая безопасное выполнение кода,
защиту hidden tests и запуск через Docker Compose.
