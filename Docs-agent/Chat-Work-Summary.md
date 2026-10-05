# Итоги работы над StepLearn

Обновлено: 2026-10-05

## Реализовано в текущем чате

- Создан ученический экран Certificates с защищённым route и ссылками из бокового
  меню и Dashboard. Экран использует только назначенные ученику курсы и агрегированный
  progress API, отображает завершённые курсы, ошибку/пустое состояние и печатную
  версию сертификата-предпросмотра.
- Уточнено ограничение: постоянная модель и официальный backend API выдачи
  сертификатов пока отсутствуют; печатный экран не является проверяемым
  сертификатом платформы.
- Для Profile и Course Page добавлены состояния загрузки, сообщения ошибок и retry.
  Ошибки начала обучения и завершения уроков показываются на странице вместо
  браузерных `alert()`. Контент состояний помечен `status`/`alert` для assistive
  technology.
- Исправлена причина CORS preflight ошибки на Dashboard: удалены лишние
  Cache-Control request headers; актуальность запроса сохраняется query-параметром.
- В Axios добавлен автоматический refresh access token по refresh token, повтор
  исходного запроса после `401`, объединение параллельных refresh-запросов и
  очистка локальной сессии при истёкшем refresh token. Защищённые routes слушают
  изменения сессии.
- Исправлен запуск backend-контейнера в Windows/Linux сценарии: `entrypoint.sh`
  нормализуется из CRLF в LF при сборке Docker image. Docker Compose был запущен
  с временными локальными настройками вне репозитория; PostgreSQL volume сохранён.
- Добавлены Vitest 4.1.11, jsdom, React Testing Library и команды `npm test` /
  `npm run test:watch`. После обновления `npm audit` сообщает 0 уязвимостей.
- Добавлены 8 тестов: 4 для Certificates, 2 для My Courses и 2 integration-теста
  JWT refresh/retry и обработки недействительного refresh token.
- Добавлены Dashboard и создание ученика в teacher panel; курсы преподавателя
  запрашиваются с авторизацией. Исправлено соответствие полей прогресса backend/API
  и убраны фиктивные успешные ответы при ошибках создания/сброса/импорта.
- Для teacher dashboard и создания ученика добавлены 2 frontend-теста. Настроен
  отсутствовавший `frontend-teacher/tsconfig.json`.
- По запросу приложение преподавателя физически отделено от student frontend:
  teacher API client, login/register, AdminPanel и полный редактор курсов находятся
  в `frontend-teacher`; межпроектные импорты удалены. Student сайт больше не
  содержит teacher routes, а ссылки ведут на `VITE_TEACHER_APP_URL`.
- Docker Compose теперь поднимает отдельный `frontend-teacher` на порту `3001`;
  его Nginx проксирует `/auth`, `/api`, `/v1` и `/users` в тот же Django backend,
  который подключён к общей PostgreSQL базе.
- Добавлена вкладка мониторинга отправленных работ: ответы собраны из заданий
  собственных курсов преподавателя, вложения скачиваются через защищённый API,
  текстовые/кодовые ответы можно оценить и оставить feedback. Для 401/403
  показываются отдельные сообщения сессии и разрешений.
- В текущей локальной базе создана и проверена учётная запись преподавателя;
  логин/email задокументированы в `backend/README.md`, пароль хранится только в
  игнорируемом Git файле `teacher-account.local.txt`.
- Публичная регистрация преподавателей отключена в Teacher и Student UI; legacy
  адреса регистрации перенаправляют на страницу входа. API создания преподавателя
  разрешён только role=admin/superuser; staff-флаг у teacher не даёт права,
  это проверено backend-тестом.
- Teacher может редактировать имя, фамилию и email student-профиля. Backend
  разрешает PATCH только ученическим аккаунтам и валидирует уникальность данных;
  hard delete аккаунта не добавлялся, чтобы не терять учебные результаты.
- Вкладка курсов получила редактор заданий: create/update/delete для типов Text,
  Short Answer, File Upload, Quiz, Multiple Choice и Code; у тестов редактируются
  вопросы/варианты/правильные ответы, у Code — язык, starter code, подсказки,
  ресурсы и hidden test cases. Удаление с ответами отклоняется backend-ом;
  изолированный runner добавлен в продолжении работы ниже.
- Добавлен TeacherCourseContentPanel: редактирование основных данных курса;
  создание/редактирование разделов и уроков, включая Markdown, тип, порядок,
  обязательность и привязку к разделу. Можно удалять пустой раздел и урок без
  прогресса/заданий; API проверяет автора курса, порядок и валидность данных.
  Физическое удаление курса не добавлено: используйте публикацию/архивирование,
  чтобы сохранить историю обучения.
- Добавлены 5 тестов редактора курса и backend regression test на управление
  курсом/разделами/уроками, ownership и защиту учебной истории.
- Добавлено обратимое архивирование учеников отдельным состоянием `is_archived`.
  По умолчанию архивные аккаунты отсутствуют в teacher list; `include_archived=1`
  включает их. Архив блокирует login, refresh и действующие access tokens, но не
  меняет флаг временной блокировки и сохраняет курсы, группы, отправки и прогресс.
  Восстановление сохраняет исходный `is_active`; для сброса пароля/прогресса и
  переключения блокировки сначала требуется восстановить аккаунт. Добавлена
  миграция `0013_user_is_archived.py`.
- Ошибки действий с учениками отображаются inline с backend detail и
  различением 401/403/409/offline, доступной семантикой alert/status и
  сохранением причины отказа; ошибка загрузки списка поддерживает повтор запроса.
  Добавлены frontend проверки архивного фильтра, подтверждения архивации и API
  permission error.
- Inline error/success уведомления охватывают также действия с группами и
  курсами: создание/назначение групп, изменение состава, создание/статус курса,
  Markdown import и ручное открытие уроков. Backend detail и 401/403/409/offline
  отражаются пользователю; матрица имеет явную пустую ошибку и retry, а списки
  без групп/курсов показывают empty state. Добавлены два теста для backend 403
  при смене статуса курса и доступности урока.
- Docker startup больше не создаёт и не сбрасывает известные demo-пароли по
  умолчанию; для тестовых данных seeding нужно явно включить `SEED_DEMO_DATA=1`.
  Уже существующие demo-аккаунты и данные БД сохранены без изменений; README
  объясняет создание initial superuser и необходимость сменить старые demo-пароли.
- В Student Code Assignment подключён Monaco с ленивой загрузкой, режимами
  Python/JavaScript, autocomplete, line numbers, переключением темы по текущему
  UI, лимитом 50 000 символов и кнопкой сброса к starter code. Отправка сохраняет
  прежний payload `source_code`; выполнение кода намеренно не добавлено.

## Проверки

- `frontend`: `npm test` — 11 тестов пройдены; `npm run build` — успешно.
- `frontend-teacher`: 20 тестов покрывают Dashboard, создание/редактирование
  ученика, submissions, оценивание, запрет доступа, создание Code Assignment и
  update/delete assignment, валидацию quiz и редактор курса; `npm run build` — успешно.
- `docker compose config -q` и сборки обоих frontend Docker images — успешно
  (валидация выполнена с временными непроизводственными переменными окружения).
- Backend `api.tests.test_api` — 38 тестов пройдены; после финального ограничения
  выдачи преподавательских аккаунтов повторно пройдены targeted registration и
  student-profile permission tests.
- В запущенном backend дополнительно проверен Code Assignment round-trip:
  teacher создал задание со скрытым тест-кейсом, прочитал его обратно и удалил
  временное задание (204).
- Teacher Docker image пересобран и контейнер обновлён; после обновления сайт
  отвечает на `http://localhost:3001`.
- ESLint для нового teacher workflow test и `git diff --check` — успешно. Полный
  ESLint student проекта пока падает на существующие lint issues в API и legacy UI.
- Для Monaco workflow добавлен Student компонентный тест: проверяются Python
  и JavaScript language modes, переключение темы и editor options, starter-code
  reset/очистка кода, ограничение длины и `source_code` submission. Monaco и workers
  загружаются из локальных npm-пакетов, редактор вынесен в ленивый chunk.
  Production build успешен; Vite предупреждает о крупных Monaco editor/TS worker
  chunks (около 2,3 МБ и 6 МБ до gzip соответственно). Targeted lint проходит;
  `npm audit` после добавления Monaco сообщает 0 уязвимостей.
- `git diff --check` — успешно.
- UI Certificates проверен в браузере для пустого состояния; Profile и Course Page
  проверены на успешную загрузку и `404`.
- Локальные контейнеры frontend/backend/PostgreSQL были проверены запущенными;
  frontend доступен на `http://localhost`.

## Не входит в сделанное

- Официальная и повторно скачиваемая выдача сертификатов: требует backend-модели,
  API и правил верификации.
- Полное покрытие тестами Profile, Course Page, всех routes и assignment workflows.
- Физическое удаление курса; отдельный admin
  frontend; унификация ошибок/permission states во всех Teacher workflows.
- Production-развёртывание runner host/VM, HTTPS/firewall и повтор integration suite
  на целевой VM перед включением выполнения для учеников.

## Code Runner и submission flow (2026-10-05)

- Добавлен отдельный `code-runner` service для выделенного Linux host/VM;
  каждому hidden test соответствует новый digest-pinned Python/Node контейнер.
- Sandbox отключает сеть, host mounts и capabilities, работает без privileged,
  с read-only rootfs, 1 CPU, пределом RAM/PID/time и принудительной очисткой.
- Django создаёт `pending` submission и отправляет в Celery/Redis только ID;
  worker передаёт исходник и hidden tests отдельному runner по HTTPS/token.
- Добавлены статусы `pending`, `running`, `passed`, `failed`, `timeout`,
  `runtime_error`, `compile_error`, `system_error`; в клиент возвращаются только
  агрегированные баллы/счётчики/ресурсы, без stdout/stderr и hidden test data.
- Новая code submission расходует allowed attempt; повторная отправка после
  `system_error` повторяет существующую запись без расхода новой попытки.
  Попытки сериализованы блокировкой задания.
- Student UI обновляет результат polling-ом и показывает ограниченный повтор
  запуска; Teacher UI отображает агрегаты без ручного grading кода.
- Ручная teacher-оценка Code Assignment закрыта backend permission boundary;
  timeout/runtime/compile errors не получают частичные баллы. Добавлены
  database-aware health endpoint, Redis persistence, Celery late-ack с повторной
  доставкой по task ID и systemd reaper для осиротевших sandbox containers.
- Публикация Code Assignment без hidden tests и отправка кода в задание без
  тестов отклоняются; execution contract остаётся неизменяемым после первой
  отправки.
- Verification (последний прогон): все 45 backend API тестов, `manage.py check`,
  `makemigrations --check --dry-run`, 3 runner unit tests и 7 Docker integration
  tests прошли. Обе Compose-конфигурации проверены с соответствующими
  `.env.example`; `git diff --check` чистый. Backend/Student/Teacher build и
  frontend tests прошли в предыдущем прогоне.
- До production остаются чистый запуск всего Compose stack, настройка и
  integration suite на фактической выделенной runner VM, а также полное
  ESLint-покрытие: полный lint обоих frontend находит накопившиеся ошибки
  `no-explicit-any`, unused imports/state-effect и empty catches в существующих
  API-клиентах и компонентах; lint не включён в CI gate.
