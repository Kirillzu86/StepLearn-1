# AI-GENERATED: Antigravity
import uuid
from pathlib import Path
from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    STUDENT = 'student'
    TEACHER = 'teacher'
    ADMIN = 'admin'
    ROLE_CHOICES = [
        (STUDENT, 'Студент'),
        (TEACHER, 'Преподаватель'),
        (ADMIN, 'Администратор'),
    ]
    email = models.EmailField(unique=True)
    avatar_url = models.TextField(blank=True, null=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='student')
    must_change_password = models.BooleanField(default=False)
    last_activity = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['id']

    @property
    def name(self):
        return self.get_full_name() or self.username

    @property
    def is_teacher_or_admin(self):
        return self.role in ['teacher', 'admin'] or self.is_staff or self.is_superuser

    def __str__(self):
        return f'{self.username} ({self.get_role_display()})'


def assignment_upload_path(instance, filename):
    extension = Path(filename).suffix.lower()
    return f'assignment-submissions/{instance.assignment_id}/{instance.student_id}/{uuid.uuid4().hex}{extension}'


class StudentProfile(models.Model):
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='student_profile',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'Профиль ученика: {self.user.username}'


class TeacherProfile(models.Model):
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='teacher_profile',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'Профиль преподавателя: {self.user.username}'


class Course(models.Model):
    STATUS_CHOICES = [
        ('draft', 'Черновик'),
        ('published', 'Опубликован'),
        ('archived', 'Архив'),
    ]
    LEVEL_CHOICES = [
        ('beginner', 'Начинающий'),
        ('intermediate', 'Средний'),
        ('advanced', 'Продвинутый'),
    ]
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    price = models.PositiveIntegerField(default=0)
    rating = models.FloatField(default=4.8)
    category = models.CharField(max_length=100, default='Программирование')
    level = models.CharField(max_length=20, choices=LEVEL_CHOICES, default='beginner')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='published')
    cover_image = models.TextField(blank=True, null=True)
    author = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='authored_courses',
    )
    students = models.ManyToManyField(
        User,
        through='Enrollment',
        related_name='enrolled_courses',
        blank=True,
    )
    content = models.TextField(blank=True, null=True)
    course_type = models.CharField(max_length=20, default='programming')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['id']

    def __str__(self):
        return self.title

    @property
    def lessons_count(self):
        return self.lessons.count()

    @property
    def blocks_count(self):
        return self.blocks.count()


class CourseBlock(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='blocks')
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    order = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order', 'id']
        constraints = [
            models.UniqueConstraint(fields=['course', 'order'], name='unique_course_block_order'),
        ]

    def __str__(self):
        return f'{self.course.title} - Блок #{self.order}: {self.title}'


class Lesson(models.Model):
    LESSON_TYPE_CHOICES = [
        ('theory', 'Теория'),
        ('practice', 'Практика'),
        ('test', 'Тест'),
        ('homework', 'Домашнее задание'),
    ]
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='lessons')
    block = models.ForeignKey(
        CourseBlock,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='lessons',
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    content = models.TextField(blank=True, default='', help_text='Текст урока в формате Markdown')
    lesson_type = models.CharField(max_length=20, choices=LESSON_TYPE_CHOICES, default='theory')
    is_mandatory = models.BooleanField(default=True)
    order = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order', 'id']
        constraints = [
            models.UniqueConstraint(fields=['course', 'order'], name='unique_course_lesson_order'),
        ]

    def __str__(self):
        return f'{self.course.title} - #{self.order} {self.title}'


class Assignment(models.Model):
    TYPE_TEXT = 'text'
    TYPE_QUIZ = 'quiz'
    TYPE_MULTIPLE_CHOICE = 'multiple_choice'
    TYPE_FILE_UPLOAD = 'file_upload'
    TYPE_SHORT_ANSWER = 'short_answer'
    TYPE_CODE = 'code'
    TYPE_CHOICES = [
        (TYPE_TEXT, 'Текстовый ответ'),
        (TYPE_QUIZ, 'Тест с одним правильным ответом'),
        (TYPE_MULTIPLE_CHOICE, 'Тест с несколькими правильными ответами'),
        (TYPE_FILE_UPLOAD, 'Загрузка файла'),
        (TYPE_SHORT_ANSWER, 'Краткий ответ'),
        (TYPE_CODE, 'Решение кодом'),
    ]
    LANGUAGE_PYTHON = 'python'
    LANGUAGE_JAVASCRIPT = 'javascript'
    LANGUAGE_CHOICES = [
        (LANGUAGE_PYTHON, 'Python'),
        (LANGUAGE_JAVASCRIPT, 'JavaScript'),
    ]

    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='assignments')
    lesson = models.ForeignKey(
        Lesson,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='assignments',
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    assignment_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default=TYPE_TEXT)
    points = models.PositiveIntegerField(default=100)
    max_attempts = models.PositiveIntegerField(default=3)
    is_published = models.BooleanField(default=False)
    due_at = models.DateTimeField(null=True, blank=True)
    programming_language = models.CharField(
        max_length=20,
        choices=LANGUAGE_CHOICES,
        default=LANGUAGE_PYTHON,
    )
    starter_code = models.TextField(blank=True)
    hints = models.JSONField(default=list, blank=True)
    time_limit_seconds = models.PositiveSmallIntegerField(default=5)
    memory_limit_mb = models.PositiveIntegerField(default=128)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['id']

    def __str__(self):
        return f'{self.course.title}: {self.title}'


class AssignmentQuestion(models.Model):
    assignment = models.ForeignKey(Assignment, on_delete=models.CASCADE, related_name='questions')
    text = models.TextField()
    order = models.PositiveIntegerField(default=1)

    class Meta:
        ordering = ['order', 'id']

    def __str__(self):
        return f'{self.assignment.title}: {self.text[:80]}'


class AssignmentOption(models.Model):
    question = models.ForeignKey(AssignmentQuestion, on_delete=models.CASCADE, related_name='options')
    text = models.TextField()
    is_correct = models.BooleanField(default=False)

    class Meta:
        ordering = ['id']

    def __str__(self):
        return self.text[:80]


class AssignmentTestCase(models.Model):
    assignment = models.ForeignKey(
        Assignment,
        on_delete=models.CASCADE,
        related_name='test_cases',
    )
    input_data = models.TextField(blank=True)
    expected_output = models.TextField()
    order = models.PositiveIntegerField(default=1)

    class Meta:
        ordering = ['order', 'id']

    def __str__(self):
        return f'{self.assignment.title}: hidden test #{self.order}'


class AssignmentSubmission(models.Model):
    STATUS_SUBMITTED = 'submitted'
    STATUS_GRADED = 'graded'
    STATUS_CHOICES = [
        (STATUS_SUBMITTED, 'Отправлено'),
        (STATUS_GRADED, 'Проверено'),
    ]

    assignment = models.ForeignKey(Assignment, on_delete=models.CASCADE, related_name='submissions')
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='assignment_submissions')
    answer_text = models.TextField(blank=True)
    response_data = models.JSONField(default=dict, blank=True)
    uploaded_file = models.FileField(upload_to=assignment_upload_path, blank=True, null=True)
    original_file_name = models.CharField(max_length=255, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_SUBMITTED)
    score = models.PositiveIntegerField(null=True, blank=True)
    feedback = models.TextField(blank=True)
    submitted_at = models.DateTimeField(auto_now_add=True)
    graded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-submitted_at', '-id']

    def __str__(self):
        return f'{self.student.username}: {self.assignment.title} ({self.status})'


class Exam(models.Model):
    block = models.OneToOneField(
        CourseBlock,
        on_delete=models.CASCADE,
        related_name='exam',
        null=True,
        blank=True,
    )
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='exams')
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    passing_score = models.PositiveIntegerField(default=70, help_text='Минимальный процент для сдачи')
    max_attempts = models.PositiveIntegerField(default=3, help_text='Максимум попыток сдачи')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['id']

    def __str__(self):
        return f'Экзамен: {self.title} ({self.course.title})'


class Question(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='questions')
    lesson = models.ForeignKey(Lesson, on_delete=models.SET_NULL, null=True, blank=True, related_name='questions')
    exam = models.ForeignKey(Exam, on_delete=models.CASCADE, null=True, blank=True, related_name='questions')
    text = models.TextField()

    class Meta:
        ordering = ['id']

    def __str__(self):
        return self.text[:80]


class Answer(models.Model):
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name='answers')
    text = models.TextField()
    is_correct = models.BooleanField(default=False)

    class Meta:
        ordering = ['id']

    def __str__(self):
        return self.text[:80]


class ExamAttempt(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='exam_attempts')
    exam = models.ForeignKey(Exam, on_delete=models.CASCADE, related_name='attempts')
    score = models.PositiveIntegerField(default=0)  # процент 0-100
    passed = models.BooleanField(default=False)
    answers_data = models.JSONField(default=dict, blank=True)
    completed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-completed_at']

    def __str__(self):
        status = 'Сдан' if self.passed else 'Не сдан'
        return f'{self.user.username} -> {self.exam.title}: {self.score}% ({status})'


class Enrollment(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='enrollments')
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='enrollments')
    current_index = models.PositiveIntegerField(default=0)
    progress_percentage = models.PositiveIntegerField(default=0)
    completed_lessons = models.PositiveIntegerField(default=0)
    correct_answers = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['user', 'course'], name='unique_user_course'),
        ]
        ordering = ['id']

    def __str__(self):
        return f'{self.user} -> {self.course}'


class StudyGroup(models.Model):
    name = models.CharField(max_length=150)
    description = models.TextField(blank=True, null=True)
    code = models.CharField(max_length=20, unique=True, db_index=True)
    capacity = models.PositiveIntegerField(null=True, blank=True, default=None)
    teacher = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='teaching_groups',
    )
    students = models.ManyToManyField(
        User,
        related_name='study_groups',
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.name} ({self.code})'

    @classmethod
    def generate_code(cls):
        import random, string
        chars = string.ascii_uppercase + string.digits
        for _ in range(10):
            code = 'GRP-' + ''.join(random.choices(chars, k=5))
            if not cls.objects.filter(code=code).exists():
                return code
        return f'GRP-{uuid.uuid4().hex[:6].upper()}'


class GroupCourse(models.Model):
    group = models.ForeignKey(StudyGroup, on_delete=models.CASCADE, related_name='group_courses')
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='group_courses')
    assigned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-assigned_at']
        constraints = [
            models.UniqueConstraint(fields=['group', 'course'], name='unique_group_course'),
        ]

    def __str__(self):
        return f'{self.group.name} -> {self.course.title}'


class GroupLessonAccess(models.Model):
    group = models.ForeignKey(StudyGroup, on_delete=models.CASCADE, related_name='lesson_accesses')
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name='group_accesses')
    is_unlocked = models.BooleanField(default=False)
    unlocked_at = models.DateTimeField(null=True, blank=True)
    auto_unlock_when_all_pass = models.BooleanField(
        default=True,
        help_text='Автоматически открыть этот урок, когда вся группа пройдет предыдущий',
    )

    class Meta:
        ordering = ['lesson__order', 'id']
        constraints = [
            models.UniqueConstraint(fields=['group', 'lesson'], name='unique_group_lesson_access'),
        ]

    def __str__(self):
        status = 'OPEN' if self.is_unlocked else 'LOCKED'
        return f'[{status}] {self.group.name} - {self.lesson.title}'


class StudentLessonProgress(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='lesson_progresses')
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name='student_progresses')
    is_completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-completed_at', 'id']
        constraints = [
            models.UniqueConstraint(fields=['user', 'lesson'], name='unique_user_lesson_progress'),
        ]

    def __str__(self):
        return f'{self.user.username} -> {self.lesson.title}: {"Done" if self.is_completed else "In progress"}'
