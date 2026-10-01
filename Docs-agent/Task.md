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

- [ ] Создать или адаптировать React + TypeScript + Vite приложение преподавателя.
- [ ] Реализовать teacher login и защищённую навигацию.
- [ ] Реализовать Dashboard со статистикой.
- [ ] Реализовать поиск, фильтрацию и CRUD студентов.
- [ ] Реализовать блокировку, архивирование, пароль и профиль студента.
- [ ] Реализовать CRUD курсов, sections, lessons и assignments.
- [ ] Реализовать публикацию, архивирование и назначение курса.
- [ ] Реализовать просмотр submissions и progress.
- [ ] Обработать loading, empty, error и permission denied-состояния.
- [ ] Добавить frontend-тесты ключевых teacher workflows.

## 6. Monaco и submission flow

- [ ] Подключить Monaco Editor к Code Assignment.
- [ ] Реализовать syntax highlighting, autocomplete, line numbers и темы.
- [ ] Реализовать run, submit и reset code.
- [ ] Не отправлять solution code на клиент.
- [ ] Реализовать Submission со статусами PENDING, RUNNING, PASSED,
  FAILED, TIMEOUT, RUNTIME_ERROR, COMPILE_ERROR и SYSTEM_ERROR.
- [ ] Реализовать отображение результата без hidden test implementation.
- [ ] Добавить обработку повторной отправки и allowed attempts.

## 7. Code Runner и sandbox

- [ ] Создать отдельный Code Runner service.
- [ ] Связать Django, Celery и Redis в submission pipeline.
- [ ] Реализовать запуск каждого submission в одноразовом sandbox-контейнере.
- [ ] Ограничить CPU, RAM, execution time, процессы и filesystem.
- [ ] Отключить network и запретить privileged containers.
- [ ] Исключить arbitrary Docker commands и доступ к host filesystem.
- [ ] Уничтожать sandbox после завершения или timeout.
- [ ] Добавить sandbox-тесты для timeout, memory, malicious code и network.
- [ ] Добавить явную обработку системных ошибок и повторяемость результата.

## 8. Infrastructure и production

- [ ] Создать `.env.example` и вынести секреты из repository.
- [ ] Настроить Docker Compose для nginx, backend, frontends, postgres,
  redis, celery и code-runner.
- [ ] Настроить production startup без Django development server.
- [ ] Настроить migrations, health checks, logs и service dependencies.
- [ ] Настроить CORS, CSRF, rate limiting и secure cookie/token policy.
- [ ] Добавить CI для lint, type-check, backend, frontend и sandbox tests.

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
