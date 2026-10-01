# StepLearn — техническое задание для AI-агента

Ты работаешь над образовательной платформой StepLearn, похожей по логике на Stepik.

## 1. Цель проекта

Разработать полноценную образовательную платформу с двумя отдельными frontend-приложениями:

1. Student Frontend — интерфейс ученика.
2. Teacher Frontend — интерфейс преподавателя.

Backend является единым для обоих приложений.

Основной стек:

* Backend: Django 5.2+
* API: Django REST Framework
* Database: PostgreSQL
* Authentication: JWT
* Frontend: React + TypeScript + Vite
* Code editor: Monaco Editor
* Async tasks: Celery
* Queue/cache: Redis
* Reverse proxy: Nginx
* Infrastructure: Docker / Docker Compose
* Code execution: isolated sandbox containers

---

# 2. Пользователи

В системе существуют следующие роли:

* ADMIN
* TEACHER
* STUDENT

## STUDENT

Ученик НЕ МОЖЕТ самостоятельно зарегистрироваться.

Необходимо полностью убрать:

* `/register`
* регистрацию Student через API
* публичную регистрацию
* регистрацию через email

Ученика создаёт преподаватель.

Преподаватель должен иметь возможность:

* создать ученика;
* указать имя;
* username;
* группу;
* временный пароль;
* при необходимости изменить пароль;
* заблокировать ученика;
* удалить/архивировать ученика.

После первого входа ученик может быть обязан изменить временный пароль.

---

# 3. Authentication

Использовать JWT.

Endpoints:

POST /api/auth/login/
POST /api/auth/refresh/
POST /api/auth/logout/

После login backend возвращает access/refresh tokens.

JWT должен содержать:

* user id;
* role;
* username.

RBAC должен проверяться на backend.

Нельзя полагаться только на frontend permissions.

---

# 4. Student Frontend

Student Frontend должен содержать:

* Login
* Dashboard
* My Courses
* Course Page
* Lesson Page
* Assignment Page
* Code Editor
* Submission Result
* Progress
* Profile
* Certificates

Student видит только те курсы и задания, к которым ему предоставлен доступ.

---

# 5. Teacher Frontend

Teacher Frontend должен содержать:

## Dashboard

Показывать:

* количество учеников;
* количество курсов;
* активность;
* submissions;
* средний прогресс;
* проблемные задания.

## Students

Функции:

* список учеников;
* поиск;
* фильтрация;
* создание ученика;
* редактирование;
* блокировка;
* просмотр профиля;
* просмотр прогресса;
* просмотр submissions.

## Courses

Преподаватель может:

* создавать курс;
* редактировать курс;
* публиковать курс;
* архивировать курс;
* добавлять учеников;
* назначать курс группе;
* просматривать статистику курса.

## Lessons

Курс состоит из:

* sections;
* lessons;
* assignments;
* tests.

Преподаватель может менять порядок элементов.

---

# 6. Assignment System

Типы заданий:

1. Text
2. Quiz
3. Multiple Choice
4. Code
5. File Upload
6. Short Answer

Основной приоритет — Code Assignment.

Code Assignment должен содержать:

* title;
* description;
* language;
* starter_code;
* tests;
* time_limit;
* memory_limit;
* allowed_attempts;
* points;
* hints;
* solution;
* visibility.

---

# 7. Code Editor

Использовать Monaco Editor.

Для Student:

* подсветка синтаксиса;
* autocomplete;
* line numbers;
* dark/light theme;
* run;
* submit;
* reset code.

Не хранить solution code в frontend.

---

# 8. Code Runner

Код пользователя НЕЛЬЗЯ выполнять внутри Django процесса.

Создать отдельный Code Runner service.

Architecture:

Student
→ Django API
→ Submission
→ Celery
→ Redis
→ Code Runner
→ isolated container
→ tests
→ result
→ Django
→ Student

Каждый запуск должен выполняться в изолированном окружении.

Необходимо ограничить:

* CPU;
* RAM;
* execution time;
* processes;
* network;
* filesystem;
* container lifetime.

По умолчанию network внутри sandbox должен быть отключён.

После выполнения sandbox должен уничтожаться.

---

# 9. Submission

Создать модель Submission.

Примерные поля:

* id
* student
* assignment
* source_code
* language
* status
* score
* execution_time
* memory_used
* tests_passed
* tests_total
* error_message
* created_at
* finished_at

Statuses:

PENDING
RUNNING
PASSED
FAILED
TIMEOUT
RUNTIME_ERROR
COMPILE_ERROR
SYSTEM_ERROR

---

# 10. Tests

Каждое code assignment содержит набор hidden tests.

Пример:

Input:

[1, 2, 3]

Expected:

6

Student должен видеть результат тестирования, но НЕ должен видеть hidden test implementation.

Нельзя отправлять hidden tests в Student Frontend.

---

# 11. Database

Основные модели:

User
StudentProfile
TeacherProfile
Course
Section
Lesson
Assignment
TestCase
Enrollment
Submission
Progress
Certificate
Notification

Связи должны быть нормализованы.

Не хранить сложные структуры в JSON без необходимости.

---

# 12. Course structure

Использовать структуру:

Course
└── Section
└── Lesson
├── Text
├── Video
├── Quiz
└── Assignment

Student должен иметь progress на уровне:

* course;
* section;
* lesson;
* assignment.

---

# 13. Teacher workflow

Основной workflow:

Teacher login
→ Dashboard
→ Create Student
→ Create Course
→ Create Section
→ Create Lesson
→ Create Assignment
→ Add Tests
→ Publish Course
→ Assign Course to Students
→ Monitor Progress

---

# 14. Student workflow

Student login
→ Dashboard
→ Open Course
→ Open Lesson
→ Read material
→ Solve Assignment
→ Run Code
→ Submit
→ Receive Result
→ Continue Course

---

# 15. API

API должен быть RESTful.

Пример:

/api/auth/
/api/users/
/api/students/
/api/teachers/
/api/courses/
/api/sections/
/api/lessons/
/api/assignments/
/api/submissions/
/api/progress/
/api/certificates/

Использовать serializers, viewsets и permissions DRF там, где это уместно.

Не помещать бизнес-логику целиком во views.

---

# 16. Permissions

Teacher:

* CRUD students;
* CRUD courses;
* CRUD lessons;
* CRUD assignments;
* view submissions;
* view progress.

Student:

* read assigned courses;
* read lessons;
* create submissions;
* view own submissions;
* view own progress.

Student НЕ МОЖЕТ:

* создавать пользователей;
* создавать courses;
* создавать assignments;
* видеть hidden tests;
* видеть чужие submissions;
* видеть teacher endpoints.

---

# 17. Docker

Docker Compose должен содержать минимум:

services:

* nginx
* backend
* student-frontend
* teacher-frontend
* postgres
* redis
* celery
* code-runner

Для production не использовать Django development server.

---

# 18. Environment variables

Все секреты хранить в environment variables.

Например:

DATABASE_URL
SECRET_KEY
JWT_SECRET
POSTGRES_DB
POSTGRES_USER
POSTGRES_PASSWORD
REDIS_URL

Не помещать секреты в git.

Создать:

.env.example

---

# 19. Frontend architecture

Использовать TypeScript.

Структура:

src/
├── api/
├── components/
├── layouts/
├── pages/
├── hooks/
├── stores/
├── types/
├── utils/
└── routes/

Для server state можно использовать TanStack Query.

Для глобального состояния использовать Zustand только там, где это действительно необходимо.

Не создавать огромный global store.

---

# 20. UX

Student UI должен быть максимально простым.

Teacher UI должен быть похож на административную рабочую панель.

Важные состояния:

* loading;
* empty;
* error;
* success;
* permission denied;
* offline;
* submission pending;
* submission running;
* submission completed.

---

# 21. Security

Обязательно учитывать:

* CSRF;
* CORS;
* JWT security;
* password hashing;
* rate limiting;
* permission checks;
* SQL injection;
* XSS;
* file upload validation;
* sandbox isolation.

Особое внимание уделить Code Runner.

Нельзя позволять пользователю выполнять:

* arbitrary Docker commands;
* host filesystem access;
* network requests;
* privileged containers.

---

# 22. Development order

Не пытайся реализовать всё сразу.

Разработка должна идти по этапам.

### Phase 1

Backend:

* User;
* Teacher;
* Student;
* JWT;
* Student creation by Teacher.

### Phase 2

Course:

* Course;
* Section;
* Lesson;
* Enrollment.

### Phase 3

Assignments:

* Assignment;
* Quiz;
* Progress.

### Phase 4

Student Frontend.

### Phase 5

Teacher Frontend.

### Phase 6

Monaco Editor.

### Phase 7

Submission system.

### Phase 8

Code Runner.

### Phase 9

Docker production architecture.

### Phase 10

Testing and CI/CD.

---

# 23. Testing

Backend:

* pytest;
* pytest-django;
* API tests;
* permission tests;
* authentication tests;
* assignment tests.

Frontend:

* Vitest;
* React Testing Library.

Code Runner:

* sandbox tests;
* timeout tests;
* memory tests;
* malicious code tests;
* network isolation tests.

---

# 24. Главный принцип

Не ломать существующий функционал.

Перед изменением архитектуры:

1. Изучить существующий repository.
2. Определить текущую структуру.
3. Найти существующие модели.
4. Найти API.
5. Найти authentication.
6. Найти frontend routes.
7. Найти Docker configuration.
8. Только после этого предлагать изменения.

Не переписывать проект с нуля без необходимости.

Все изменения должны быть минимальными и совместимыми с существующим кодом.

Перед каждой крупной модификацией объяснять:

* что меняется;
* зачем;
* какие файлы будут изменены;
* какие зависимости добавятся;
* как проверить результат.

После изменения запускать соответствующие tests.

---

# 25. Definition of Done

Функциональность считается готовой только если:

* backend запускается;
* PostgreSQL подключается;
* JWT работает;
* Student нельзя зарегистрировать самостоятельно;
* Teacher может создать Student;
* Student может войти;
* Teacher может создать курс;
* Teacher может создать lesson;
* Teacher может создать code assignment;
* Student видит assignment;
* Monaco Editor работает;
* Student может отправить code;
* code выполняется в sandbox;
* hidden tests защищены;
* результат возвращается Student;
* progress сохраняется;
* Docker Compose запускает систему;
* tests проходят.

Не считать задачу выполненной только потому, что frontend визуально отображает нужную страницу.

# 26. Create Task
Создай для себя файл Task.md и Plan.md для того чтобы для самого себя организовать дорожную карту выполнение создание сайта