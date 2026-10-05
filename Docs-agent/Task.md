# StepLearn — Task List

Рабочий список задач по реализации платформы согласно
[PROJECT_SPEC.md](./PROJECT_SPEC.md).

## Как использовать этот файл

- `[ ]` — задача не начата.
- `[-]` — задача выполняется.
- `[x]` — задача завершена и проверена.
- Каждая задача должна иметь проверяемый результат.
- Перед началом реализации необходимо изучить текущий repository и не
  переписывать существующий функционал без необходимости.

## 0. Анализ существующего проекта

- [x] Зафиксировать текущую структуру backend, frontend и infrastructure.
- [x] Найти существующие модели, миграции, API и permissions.
- [x] Найти текущую authentication-схему и frontend routes.
- [x] Найти Docker-конфигурацию, environment variables и CI.
- [x] Составить список уже реализованных функций и технического долга.
- [x] Определить точки интеграции новых компонентов с существующим кодом.

## 1. Backend foundation и authentication

- [x] Настроить Django, DRF, PostgreSQL и базовую конфигурацию окружений; подключение к локальному PostgreSQL требует корректных локальных реквизитов и отдельно не подтверждено.
- [x] Реализовать модели User, StudentProfile и TeacherProfile.
- [x] Реализовать роли ADMIN, TEACHER и STUDENT.
- [x] Подключить JWT login, refresh и logout.
- [x] Добавить в JWT user id, username и role.
- [x] Защитить API списка пользователей и профили: доступ только владельцу или teacher/admin; запрет изменения роли через профиль.
- [x] Защитить запись на курс, список курсов ученика и прогресс от чтения/изменения по подменённому user_id.
- [x] Ограничить изменение курсов, блоков и уроков ролью teacher/admin; автора курса брать из JWT.
- [x] Защитить teacher dashboard и управление учениками JWT permission для teacher/admin.
- [x] Удалить публичную регистрацию студентов и endpoint `/register`.
- [x] Реализовать и проверить создание студента преподавателем с рабочими временными учётными данными.
- [x] Добавить временный пароль, обязательную смену пароля и блокировку.
- [x] Добавить тесты authentication, ролей и запрета самостоятельной регистрации.

## 2. Courses и enrollment

- [x] Использовать модели Course, CourseBlock (section), Lesson и Enrollment.
- [x] Сохранять и выдавать порядок sections и lessons.
- [x] Добавить draft/published/archived lifecycle курса.
- [x] Назначать опубликованный курс ученику или группе; учитель назначает только собственный курс, администратор — любой.
- [x] Ограничить доступ ученика назначенными опубликованными курсами и открытыми уроками.
- [x] Реализовать API serializers, views и permissions для курсов, блоков, уроков и enrollment.
- [x] Добавить backend-тесты CRUD, ownership и границ доступа.

## 3. Assignments и progress

- [x] Создать базовые модели Assignment и AssignmentSubmission для текстового и краткого ответа.
- [x] Реализовать teacher CRUD, публикацию задания, student read/submit и ручное оценивание с проверкой ролей и лимита попыток.
- [x] Добавить backend-тесты доступа, создания заданий, отправки и оценки ответа.
- [x] Запретить ученику самостоятельно изменять серверные значения прогресса курса.
- [x] Сохранять результат проверки quiz на сервере и прогресс текстового курса через отдельные проверяемые действия.
- [x] Добавить API-тесты на право коррекции прогресса и завершение назначенного текстового курса.
- [x] Расширить Assignment типами Quiz и Multiple Choice с серверной проверкой без раскрытия правильных вариантов.
- [x] Добавить безопасную загрузку PDF/TXT/PNG/JPEG до 10 МБ и приватную выдачу только ученику-владельцу или автору/администратору.
- [x] Добавить Code Assignment для Python/JavaScript с шаблоном, подсказками, лимитами исходного кода и конфигурацией ресурсов (без выполнения до появления отдельного sandbox).
- [x] Добавить отдельную модель скрытых тест-кейсов Code Assignment; CRUD ограничен автором/администратором, ученические serializers их не возвращают (выполнение — отдельный sandbox этап).
- [x] Возвращать агрегированный Progress на уровнях course, section, lesson и assignment; задания завершаются по последней оценённой отправке.
- [x] Сохранять результат каждого submission и учитывать последнюю оценённую отправку в assignment progress.
- [x] Реализовать API для teacher CRUD и student read/submit для поддерживаемых типов Text, Short Answer, Quiz и Multiple Choice.
- [x] Добавить backend-тесты заданий, сохранения результата, попыток и permission boundaries.

## 4. Student Frontend

- [x] Использовать существующее React + TypeScript + Vite приложение студента и интегрировать новые API без создания дублирующего приложения.
- [x] Использовать существующий login/logout и добавить клиентскую защиту student, teacher/admin и profile routes с учётом обязательной смены пароля.
- [x] Использовать существующие Dashboard и My Courses; список курсов получает агрегированный learning progress с API.
- [x] Использовать существующую Course Page с отображением модульных lessons, gating и фиксацией их завершения через API.
- [x] Подключить страницу заданий ученика к API для текста, тестов, файлов и исходного кода; показывать последние отправки, оценки, feedback и попытки.
- [x] Обработать loading, empty, permission denied, offline и повтор отправки для страницы заданий.
- [x] Использовать только student API serializers; скрытые тесты и solution code не запрашиваются и не отображаются.
- [x] Использовать существующий Profile и отображать course/section/lesson/assignment progress в My Courses.
- [x] Реализовать экран Certificates: завершённые курсы берутся из student progress API, доступна печать сертификата-предпросмотра; постоянная backend-модель/выдача сертификатов остаётся отдельной задачей.
- [x] Dashboard, My Courses, Profile и Course Page различают пустые/успешные данные и ошибки загрузки; Profile/Course Page показывают доступные loading/error states с retry, а завершение уроков использует inline-сообщения вместо системных alert.
- [x] Не запрашивать hidden tests или solution code в student интерфейсе; backend student serializers также их не возвращают.
- [x] Добавить Vitest/Testing Library и базовые компонентные/integration-тесты: Certificates, My Courses и Axios JWT refresh flow (8 тестов).

## 5. Teacher Frontend

- [x] Разделить Student и Teacher на два независимых React + TypeScript + Vite приложения.
- [x] Реализовать teacher login и защищённую навигацию; отключить публичную регистрацию и оставить создание учётных записей преподавателя администраторам.
- [x] Реализовать Dashboard со статистикой и состояниями загрузки/ошибки.
- [-] Реализовать поиск, создание, чтение и редактирование студентов; добавлено обратимое архивирование с сохранением прогресса и блокировкой входа, физическое удаление аккаунтов не предоставляется.
- [x] Реализовать блокировку/разблокировку, сброс пароля и просмотр профиля студента.
- [-] Реализовать CRUD курсов, sections, lessons и assignments; добавлены редактирование основных данных курса и создание/редактирование/безопасное удаление разделов и уроков. Удаление раздела с уроками/экзаменом и урока с прогрессом/заданиями запрещено API; публикация и архивирование курса доступны. Физическое удаление курсов намеренно не добавлено во избежание потери истории обучения.
- [x] Реализовать публикацию, архивирование и назначение курса группе.
- [x] Реализовать просмотр progress и мониторинг submissions с проверкой/оценкой ответов преподавателем.
- [x] Обработать loading, empty, error и permission denied-состояния в teacher workflows: списки учеников/групп/курсов, dashboard, course/assignment editors, submissions и matrix показывают состояния загрузки, пустоты и ошибки; API detail, 401/403/409 и сетевые сбои показываются явно, критичные списки/матрица поддерживают повтор запроса.
- [x] Добавить frontend-тесты Dashboard, создания/редактирования студента и просмотра/оценки submissions.
- [x] Добавить редактор основных данных курса, разделов и Markdown-уроков; покрыть create/update/delete сценарии и защиту истории обучения целевыми тестами.
- [x] Показывать inline-сообщения и конкретные API ошибки (401/403/409/offline) при просмотре и управлении аккаунтами учеников; покрыть отказ архивации тестом.
- [x] Показывать конкретные ошибки и empty/retry-состояния в действиях с группами, статусом курса и доступом к уроку в матрице; проверить API-denied случаи компонентными тестами.

## 6. Monaco и submission flow

- [x] Подключить Monaco Editor к Code Assignment с ленивой загрузкой.
- [x] Реализовать language mode для Python/JavaScript, autocomplete, line numbers и светлую/тёмную тему.
- [x] Реализовать отправку исходного кода через существующий submission API и сброс к starter code; покрыть кодовый workflow тестом.
- [x] Ограничить редактор лимитом 50 000 символов и показывать счётчик.
- [x] Сохранить безопасное поведение: код не запускается, а hidden tests и solution code не запрашиваются student UI.
- [x] Реализовать безопасный async run только через отдельный Code Runner на runner host/VM; Django, Celery worker и браузер не исполняют пользовательский код.
- [x] Добавить статусы PENDING, RUNNING, PASSED, FAILED, TIMEOUT, RUNTIME_ERROR, COMPILE_ERROR и SYSTEM_ERROR, агрегированные результаты и безопасное отображение без hidden test implementation.
- [x] Считать каждую новую submission отдельной попыткой, сериализовать проверку `max_attempts` и разрешить повторный запуск той же записи только после системной ошибки.
- [x] Зафиксировать Code Assignment points/language/resource limits/hidden tests после первой отправки, сохраняя контракт уже поставленных в очередь запусков.

## 7. Code Runner и sandbox

- [x] Создать отдельный Code Runner service для развёртывания на выделенном runner host/VM.
- [x] Связать Django, Celery и Redis в submission pipeline; в broker передаётся только submission ID.
- [x] Реализовать запуск каждого hidden test в новом контейнере фиксированного runtime image.
- [x] Ограничить CPU, RAM, execution time, процессы и filesystem.
- [x] Отключить network, capabilities и privileged execution в sandbox containers.
- [x] Исключить произвольные команды и host mounts из sandbox; backend не получает Docker socket.
- [x] Уничтожать sandbox после завершения или timeout.
- [x] Добавить unit-тесты конфигурации sandbox для timeout, ресурсов, отключённой сети, отсутствия host mounts и очистки контейнера.
- [x] Добавить и проверить на локальном Linux-container engine интеграционные sandbox-тесты для фактического ограничения памяти, timeout, fork/PID, сетевого доступа, host Docker socket и Python/JavaScript execution.
- [ ] Повторить интеграционные тесты на целевом выделенном Linux runner host перед production включением.
- [x] Добавить явную обработку системных ошибок и безопасный повтор запуска.

## 8. Infrastructure и production

- [x] Создать корневой и runner `.env.example`; секреты задаются окружением.
- [x] Настроить application Compose для backend, двух frontends, postgres,
  redis и celery; Code Runner Compose развёртывается отдельно на runner VM.
- [x] Добавить Redis/Celery worker в application Compose, изолировать broker
  отдельной внутренней сетью; Code Runner разворачивается отдельно на runner VM.
- [x] Настроить production startup через Gunicorn, migrations и collectstatic.
- [x] Настроить migrations, health checks и service dependencies; обе Compose
  конфигурации валидируются с `.env.example`. Полный clean deployment ещё не
  проверен.
- [x] Сделать очередь Redis persistent и включить late-ack/requeue, task-ID idempotency и восстановление Celery delivery после потери worker.
- [ ] Настроить CORS, CSRF, rate limiting и secure cookie/token policy.
- [x] Добавить CI для backend tests/migration checks, Student/Teacher type-check/build/tests и runner unit/sandbox integration tests; existing full-repo ESLint issues are not gated yet.

## 9. Финальная проверка Definition of Done

- [ ] Backend запускается и подключается к PostgreSQL.
- [ ] JWT login, refresh и logout работают.
- [ ] Студент не может зарегистрироваться самостоятельно.
- [ ] Преподаватель может создать и заблокировать студента.
- [ ] Преподаватель может создать курс, lesson и code assignment.
- [ ] Студент видит назначенное задание и работает в Monaco.
- [ ] Submission выполняется только в sandbox.
- [ ] Hidden tests и solution code защищены.
- [ ] Результат submission и progress сохраняются.
- [ ] Docker Compose поднимает всю систему.
- [ ] Все обязательные тесты проходят.
- [ ] Обновлена документация по запуску, окружению и архитектуре.
