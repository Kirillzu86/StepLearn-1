# StepLearn — передача проекта другому ИИ

**Срез состояния:** 2026-10-05  
**Назначение:** дать следующему ИИ краткий, но достаточный контекст для безопасного продолжения разработки.

## 1. Что это за проект

StepLearn — платформа онлайн-обучения. У неё один Django API и общая PostgreSQL база, но два независимых frontend приложения:

- **Student Frontend** — `frontend/`
- **Teacher Frontend** — `frontend-teacher/`

Преподавательские аккаунты не создаются публичной регистрацией: их создание предназначено для администратора. Ученика создаёт преподаватель. Пользовательский код запускается только через отдельный Code Runner; запрещено запускать его в Django, Celery worker или браузере.

Технологии: Django 5.2+, DRF, PostgreSQL, JWT, React 19, TypeScript, Vite, Monaco, Celery, Redis, Docker Compose. Code Runner — отдельный FastAPI сервис для выделенной Linux VM.

## 2. Структура репозитория

```text
backend/                 Django API, модели, миграции, тесты, Celery worker
frontend/                Student React/TypeScript/Vite приложение
frontend-teacher/        независимое Teacher React/TypeScript/Vite приложение
code-runner/             runner API, sandbox, unit и Docker integration tests
Docs-agent/
  PROJECT_SPEC.md        целевые требования и продуктовый контекст
  Task.md                проверяемый список задач и прогресс
  Plan.md                фазы реализации и архитектурный план
  Chat-Work-Summary.md   журнал предыдущих этапов
  AI-Handoff.md          этот handoff
docker-compose.yml       app stack: PostgreSQL, Redis, backend, worker, 2 frontends
.env.example             шаблон настроек app stack
.github/workflows/ci.yml backend, frontend, runner CI jobs
```

Основные backend файлы: `backend/api/models.py`, `serializers.py`, `views.py`, `urls.py`, `tasks.py`, `code_runner.py`; Django и Celery конфигурация находится в `backend/steplearn/`.

## 3. Реализованные основные области

### Backend, пользователи и обучение

- Пользовательские роли `student`, `teacher`, `admin`, JWT authentication и проверки permissions на backend.
- Публичная регистрация студента и преподавателя отключена. Учитель может создавать учеников, задавать временные пароли; есть блокировка/архивация и обязательная смена временного пароля.
- Курсы, разделы/blocks, lessons, группы, назначение курсов и ограничение доступа к неназначенным курсам/закрытым урокам.
- Assignments: текстовые ответы, short answer, quiz/multiple choice, file upload и code assignment.
- Попытки, оценки, feedback и агрегированный progress. Файлы выдаются приватно через API.
- Ученические serializers не раскрывают правильные ответы, hidden tests и solution code.

### Student Frontend

- Отдельный React/TypeScript/Vite проект с login, dashboard, курсами, lessons, assignment workflows и профилем.
- Monaco Editor загружается лениво для Python/JavaScript; лимит исходного кода — 50 000 символов.
- Отображаются submissions, попытки и результат выполнения; результат code runner ограничен агрегатами.
- У UI есть основные loading/error/empty состояния и тесты.
- Экран сертификата сейчас формирует печатный preview на основе progress; полноценной модели и API постоянной выдачи сертификатов нет.

### Teacher Frontend

- Отдельный frontend проект, не просто маршрут в Student SPA; запускается отдельным Compose service.
- Login и защищённая навигация; публичная регистрация преподавателя отсутствует.
- Реализованы dashboard, управление учениками/группами, курсами, разделами, уроками, назначениями, progress и submissions.
- Для code assignments показываются агрегаты runner; ручная оценка code submission запрещена backend.
- Admin frontend в текущем объёме отдельным приложением не создан.
- В `Docs-agent/Task.md` некоторые крупные пункты teacher workflows всё ещё помечены `[-]`; перед изменением сверить файл и текущее поведение.

### Безопасный асинхронный Code Runner

Pipeline:

```text
Student → Django API → Submission(PENDING) → Celery/Redis
        → worker → HTTPS Code Runner → одноразовый изолированный контейнер
        → агрегированный результат → Submission → Student/Teacher UI
```

- В очередь передаётся только ID submission; runner вызывается backend worker-ом по HTTPS и bearer token.
- Отдельный контейнер на каждый hidden test; Python/Node runtime images закреплены digest.
- Sandbox ограничивает CPU, RAM, swap/PID/time/filesystem, отключает сеть, работает с read-only rootfs, без capabilities, privileged режима и host mounts.
- Docker socket доступен только Code Runner на выделенной машине. Не добавлять его в backend/worker.
- Статусы: `pending`, `running`, `passed`, `failed`, `timeout`, `runtime_error`, `compile_error`, `system_error`.
- Клиентам возвращаются status, агрегированные баллы/число пройденных тестов и ресурсные метрики; не возвращаются тестовые входы/ожидаемые ответы, stdout/stderr или реализация hidden tests.
- Новое code submission расходует отдельную попытку. Проверка лимита сериализована блокировкой задания. Повтор существующей записи доступен только после `system_error` и не расходует новую попытку.
- Параметры выполнения и hidden tests задания блокируются от изменения после первой code submission.
- Публикация code assignment и отправка кода отклоняются, если hidden tests отсутствуют.
- Добавлен host-level systemd timer для удаления осиротевших sandbox containers.

## 4. Инфраструктура

- Корневой `docker-compose.yml`: PostgreSQL, Redis с persistence, backend, Celery worker, Student frontend и Teacher frontend.
- Broker Redis подключён через отдельную internal сеть. Backend/worker не имеют Docker socket.
- Backend запускается через Gunicorn; entrypoint выполняет migrations и collectstatic.
- Runner Compose находится в `code-runner/docker-compose.yml`; API привязан к loopback `127.0.0.1:8081`. Перед runner требуется TLS reverse proxy, firewall/VPN и доступ только с backend worker.
- Root `.env.example` и `code-runner/.env.example` содержат только шаблонные значения. Реальные секреты должны быть только в локальном окружении/секрет-хранилище.
- Основной Compose использует внешнюю сеть `coolify`; перед запуском в Docker окружении убедиться, что сеть создана, либо использовать согласованную deployment-конфигурацию.
- Runner VM должна быть выделенной и не содержать production DB, secrets или другие ценные данные: доступ к Docker socket означает контроль над runner host при компрометации runner.

## 5. Проверки на последнем известном срезе

Прогнано 2026-10-05:

- Backend API: `45` тестов прошли.
- `python manage.py check` — прошёл.
- `python manage.py makemigrations --check --dry-run` — миграции согласованы.
- Code Runner suite: `10` тестов прошли (unit + sandbox integration на имеющемся Linux container engine).
- App Compose и runner Compose конфигурации валидированы с соответствующими `.env.example`.
- `git diff --check` и `git diff --cached --check` — чистые.
- В более раннем полном прогоне прошли сборки и тесты обоих frontend: Student — 14 тестов, Teacher — 21 тест. Повторить при существенных frontend изменениях.
- Полный ESLint обоих frontend **не проходит**: есть накопившиеся ошибки `no-explicit-any`, unused imports/variables, React set-state-in-effect и empty catches в API-клиентах и компонентах. Lint не включён в CI.

Backend локально запускать с соответствующими env vars. Пример для SQLite:

```powershell
Push-Location .\backend
$env:USE_SQLITE = "1"
$env:DJANGO_DEBUG = "1"
python manage.py test api.tests.test_api
Pop-Location
```

Runner suite локально требует Docker engine; integration tests включать явно:

```powershell
Push-Location .\code-runner
$env:RUN_SANDBOX_INTEGRATION = "1"
python -m unittest -v
Pop-Location
```

Для фронтендов из соответствующей папки:

```powershell
npm test
npm run build
```

CI в `.github/workflows/ci.yml` запускает backend checks/tests, оба frontend build/tests, runner unit tests и runner sandbox integration tests на Linux.

## 6. Что остаётся сделать

### Обязательное до production запуска code execution

1. Поднять Code Runner на отдельной Linux VM, настроить Docker/runtime images, random token, TLS, firewall/VPN и systemd cleanup timer.
2. Выполнить runner integration suite на целевой VM, а не только на локальном Linux engine.
3. Настроить `CODE_RUNNER_URL` и одинаковый `CODE_RUNNER_TOKEN` backend/runner через secrets; не публиковать runner API в интернет.
4. Проверить сквозной submission через настоящие PostgreSQL, Redis, Celery worker и runner.

### Инфраструктура и качество

- Выполнить чистый `docker compose up` всей application системы и проверить end-to-end login/course/submission. Compose config validation сама по себе не означает, что сервисы поднялись.
- Проверить CORS/CSRF, rate limiting и production token/security settings.
- Разобрать backlog полного ESLint отдельно: ошибки охватывают множество старых компонентов и не должны «лечиться» отключением правил или нецелевым массовым рефакторингом.
- Исправлять чек-листы `Task.md`/`Plan.md` по фактической реализации, не полагаться на старые audit-таблицы в начале `Plan.md` — их исторические строки могут быть устаревшими.
- Проанализировать полный project Definition of Done из `Docs-agent/PROJECT_SPEC.md`.

### Продуктовые пункты

- Постоянная backend-модель/API сертификатов, если требуется вместо печатного preview.
- Отдельный admin frontend — если он остаётся в актуальном продуктовом scope.
- Пройтись по незавершённым teacher workflow пунктам (`[-]`) и отметить выполненное только после проверки.

## 7. Важное состояние Git и правила продолжения

- На момент handoff рабочее дерево **не чистое**: есть staged и unstaged изменения, удаления/добавления и новые untracked файлы по нескольким областям.
- Изменения не коммичены. В списке есть как уже staged, так и unstaged версии одних файлов.
- **Не выполнять** `git reset`, `git checkout`, массовое восстановление/удаление файлов и не переписывать большие изменения, пока не изучены `git status`, `git diff` и `git diff --cached`.
- Часть крупных удалений в `frontend/` соответствует переносу teacher UI в `frontend-teacher`; пользователь ранее явно опасался потери кода. Перед любыми действиями с этими файлами сначала сверить содержимое нового Teacher frontend и diff.
- При работе читать текущий код и существующие тесты; не реализовывать повторно то, что уже есть.
- Сохранять архитектурное правило: общий backend и БД, два независимых frontend; никакого выполнения student code внутри Django или браузера.
- После изменения запускать минимальный подходящий набор тестов; для API/runner изменений обновлять документацию и `Docs-agent/Task.md`/`Plan.md`.
- Локальные development credentials могут присутствовать в документационных/локальных файлах; не переносить их значения в prompt, отчёты, коммиты или сторонние сервисы. Секреты для deployment создавать заново через secret manager.

## 8. Инструкция для следующего ИИ

Сначала проверь актуальные `git status`, staged/unstaged diff, относящиеся к задаче файлы и тесты. Считай все существующие незакоммиченные изменения пользовательской работой: не удаляй и не перезаписывай их. Затем выбери один ближайший незавершённый пункт из раздела 6, реализуй его небольшими согласованными изменениями, прогони проверку и обнови документацию. Не считай приложение production-ready, пока отдельный runner host и сквозное deployment-проверки не выполнены.
