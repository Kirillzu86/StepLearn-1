# AI-GENERATED: Antigravity
import datetime
import re
import secrets
import uuid

from django.http import FileResponse
from django.db import IntegrityError, connection, transaction
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.decorators import permission_classes
from rest_framework.decorators import parser_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from .models import (
    Answer,
    Assignment,
    AssignmentSubmission,
    Course,
    CourseBlock,
    Enrollment,
    Exam,
    ExamAttempt,
    GroupCourse,
    GroupLessonAccess,
    Lesson,
    Question,
    StudentLessonProgress,
    StudyGroup,
    User,
)
from .permissions import IsSelfOrTeacherOrAdmin, IsTeacherOrAdmin
from .tasks import enqueue_code_submission
from .serializers import (
    AssignmentSerializer,
    AssignmentCreateSerializer,
    AssignmentStudentSerializer,
    AssignmentSubmissionCreateSerializer,
    AssignmentSubmissionGradeSerializer,
    AssignmentSubmissionSerializer,
    AssignmentTeacherSerializer,
    CourseBlockSerializer,
    CourseCreateSerializer,
    CourseSerializer,
    CourseUpdateSerializer,
    CourseWithDetailsSerializer,
    ChangePasswordSerializer,
    ExamAttemptSerializer,
    ExamDetailSerializer,
    ExamSerializer,
    GroupCreateSerializer,
    GroupLessonAccessSerializer,
    LessonSerializer,
    LoginSerializer,
    QuickCreateStudentSerializer,
    RegisterSerializer,
    StudyGroupSerializer,
    QuestionSerializer,
    StudentQuestionSerializer,
    UserSerializer,
    UserUpdateSerializer,
)


def course_list_item(course, enrollment=None, *, enrolled=False):
    students_count = getattr(course, 'students_count', None)
    if students_count is None:
        students_count = course.enrollments.count()

    total_lessons = getattr(course, 'total_lessons', None)
    if total_lessons is None or total_lessons == 0:
        lessons_count = course.lessons.count()
        if lessons_count > 0:
            total_lessons = lessons_count
        else:
            total_questions = course.questions.count()
            if total_questions > 0:
                total_lessons = total_questions
            elif course.content:
                sections = len(re.findall(r'^#{1,3}\s+', course.content, re.MULTILINE))
                total_lessons = max(1, sections)
            else:
                total_lessons = 0

    is_enrolled = enrolled or (enrollment is not None)
    if is_enrolled:
        price_status = 'Enrolled'
    elif course.price and course.price > 0:
        price_status = 'Paid'
    else:
        price_status = 'Free'

    completed_lessons = enrollment.completed_lessons if enrollment else 0
    progress_percentage = enrollment.progress_percentage if enrollment else 0

    return {
        'id': course.id,
        'title': course.title,
        'description': course.description or '',
        'category': course.category,
        'level': course.level,
        'status': course.status,
        'cover_image': course.cover_image,
        'price': course.price,
        'rating': getattr(course, 'rating', 4.8) or 4.8,
        'course_type': getattr(course, 'course_type', 'programming'),
        'has_content': bool(course.content),
        'students_count': students_count,
        'price_status': price_status,
        'total_lessons': total_lessons,
        'blocks_count': course.blocks.count(),
        'completed_lessons': completed_lessons,
        'progress_percentage': progress_percentage,
    }


@api_view(['GET'])
def health_check(request):
    with connection.cursor() as cursor:
        cursor.execute('SELECT 1')
        cursor.fetchone()
    return Response({'status': 'ok', 'database': 'ok'})


def course_learning_progress(user, course):
    lesson_records = {
        progress.lesson_id: progress
        for progress in StudentLessonProgress.objects.filter(
            user=user,
            lesson__course=course,
        )
    }
    latest_submissions = {}
    attempt_counts = {}
    submissions = AssignmentSubmission.objects.filter(
        student=user,
        assignment__course=course,
    ).order_by('-submitted_at', '-id')
    for submission in submissions:
        attempt_counts[submission.assignment_id] = (
            attempt_counts.get(submission.assignment_id, 0) + 1
        )
        latest_submissions.setdefault(submission.assignment_id, submission)

    def assignment_progress(assignment):
        latest = latest_submissions.get(assignment.id)
        is_completed = bool(
            latest
            and latest.status in {
                AssignmentSubmission.STATUS_GRADED,
                AssignmentSubmission.STATUS_PASSED,
            }
        )
        return {
            'id': assignment.id,
            'title': assignment.title,
            'assignment_type': assignment.assignment_type,
            'is_completed': is_completed,
            'status': (
                'completed' if is_completed
                else 'in_progress' if latest
                else 'not_started'
            ),
            'attempts_used': attempt_counts.get(assignment.id, 0),
            'score': latest.score if latest else None,
            'submitted_at': latest.submitted_at if latest else None,
        }

    def lesson_progress(lesson):
        record = lesson_records.get(lesson.id)
        assignments = [
            assignment_progress(assignment)
            for assignment in assignments_by_lesson.get(lesson.id, [])
        ]
        return {
            'id': lesson.id,
            'title': lesson.title,
            'is_completed': bool(record and record.is_completed),
            'completed_at': record.completed_at if record else None,
            'assignments': assignments,
        }

    lessons = list(course.lessons.select_related('block').order_by('order', 'id'))
    assignments = list(
        course.assignments.filter(is_published=True)
        .select_related('lesson__block')
        .order_by('id')
    )
    assignments_by_lesson = {}
    for assignment in assignments:
        if assignment.lesson_id:
            assignments_by_lesson.setdefault(assignment.lesson_id, []).append(assignment)

    sections = []
    all_item_states = []
    for block in course.blocks.all():
        block_lessons = [lesson for lesson in lessons if lesson.block_id == block.id]
        section_lessons = [lesson_progress(lesson) for lesson in block_lessons]
        section_item_states = [
            lesson['is_completed'] for lesson in section_lessons
        ] + [
            item['is_completed']
            for lesson in section_lessons
            for item in lesson['assignments']
        ]
        all_item_states.extend(section_item_states)
        sections.append({
            'id': block.id,
            'title': block.title,
            'completed_items': sum(section_item_states),
            'total_items': len(section_item_states),
            'progress_percentage': (
                round(sum(section_item_states) * 100 / len(section_item_states))
                if section_item_states else 0
            ),
            'lessons': section_lessons,
            'assignments': [],
        })

    unsectioned_lessons = [
        lesson_progress(lesson) for lesson in lessons if lesson.block_id is None
    ]
    unsectioned_assignments = [
        assignment_progress(assignment)
        for assignment in assignments
        if assignment.lesson_id is None
    ]
    unsectioned_assignment_states = [
        item['is_completed']
        for lesson in unsectioned_lessons
        for item in lesson['assignments']
    ]
    unsectioned_item_states = [
        lesson['is_completed'] for lesson in unsectioned_lessons
    ] + unsectioned_assignment_states + [
        item['is_completed'] for item in unsectioned_assignments
    ]
    all_item_states.extend(unsectioned_item_states)
    if unsectioned_lessons or unsectioned_assignments:
        section_item_states = unsectioned_item_states
        sections.append({
            'id': None,
            'title': 'Без раздела',
            'completed_items': sum(section_item_states),
            'total_items': len(section_item_states),
            'progress_percentage': (
                round(sum(section_item_states) * 100 / len(section_item_states))
                if section_item_states else 0
            ),
            'lessons': unsectioned_lessons,
            'assignments': unsectioned_assignments,
        })

    total_items = len(all_item_states)
    completed_items = sum(all_item_states)
    return {
        'completed_items': completed_items,
        'total_items': total_items,
        'progress_percentage': (
            round(completed_items * 100 / total_items) if total_items else 0
        ),
        'is_completed': bool(total_items and completed_items == total_items),
        'sections': sections,
    }


# ==========================================
# 1. ПОЛЬЗОВАТЕЛИ И АУТЕНТИФИКАЦИЯ
# ==========================================

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsTeacherOrAdmin])
def users(request):
    qs = User.objects.all().order_by('id')
    role_filter = request.query_params.get('role')
    if role_filter:
        qs = qs.filter(role=role_filter)
    return Response(UserSerializer(qs, many=True).data)


def user_auth_response(user):
    refresh = RefreshToken.for_user(user)
    refresh['username'] = user.username
    refresh['role'] = user.role
    data = UserSerializer(user).data
    data.update({
        'access': str(refresh.access_token),
        'refresh': str(refresh),
    })
    return Response(data)


@api_view(['POST'])
def login(request):
    serializer = LoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.validated_data['user']
    user.last_activity = timezone.now()
    user.save(update_fields=['last_activity'])
    return user_auth_response(user)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def teacher_register(request):
    """Create a teacher account for administrators; public teacher signup is disabled."""
    if not (
        request.user.role == User.ADMIN
        or request.user.is_superuser
    ):
        return Response(
            {'detail': 'Создавать учётные записи преподавателей может только администратор.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    data = request.data.copy()
    data['role'] = 'teacher'
    serializer = RegisterSerializer(data=data)
    serializer.is_valid(raise_exception=True)
    user = serializer.save()
    return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


@api_view(['POST'])
def teacher_login(request):
    """Вход для преподавателей — проверяет что пользователь имеет роль teacher/admin"""
    serializer = LoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.validated_data['user']
    if not user.is_teacher_or_admin:
        return Response(
            {'detail': 'Данный аккаунт не является преподавательским. Используйте обычный вход.'},
            status=status.HTTP_403_FORBIDDEN
        )
    user.last_activity = timezone.now()
    user.save(update_fields=['last_activity'])
    return user_auth_response(user)


@api_view(['POST'])
def refresh_token(request):
    serializer = TokenRefreshSerializer(data=request.data)
    try:
        refresh = RefreshToken(request.data.get('refresh', ''))
        user_id = refresh.get('user_id')
        if User.objects.filter(pk=user_id, is_archived=True).exists():
            return Response(
                {'detail': 'Эта учётная запись архивирована.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        serializer.is_valid(raise_exception=True)
    except (TokenError, TypeError, ValueError):
        return Response(
            {'detail': 'Invalid or expired refresh token.'},
            status=status.HTTP_401_UNAUTHORIZED,
        )
    return Response(serializer.validated_data)


@api_view(['POST'])
def logout(request):
    refresh = request.data.get('refresh')
    if not refresh:
        return Response(
            {'detail': 'Refresh token is required.'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    try:
        RefreshToken(refresh).blacklist()
    except TokenError:
        return Response(
            {'detail': 'Invalid or expired refresh token.'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    return Response(status=status.HTTP_205_RESET_CONTENT)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_password(request):
    serializer = ChangePasswordSerializer(
        data=request.data,
        context={'request': request},
    )
    serializer.is_valid(raise_exception=True)
    user = request.user
    user.set_password(serializer.validated_data['new_password'])
    user.must_change_password = False
    user.save(update_fields=['password', 'must_change_password'])
    return Response({'detail': 'Пароль успешно изменён.', 'must_change_password': False})


@api_view(['GET', 'PUT', 'PATCH'])
@permission_classes([IsAuthenticated])
def user_detail(request, user_id):
    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return Response({'detail': 'Пользователь не найден'}, status=status.HTTP_404_NOT_FOUND)

    if not IsSelfOrTeacherOrAdmin().has_object_permission(request, None, user):
        return Response({'detail': 'Нет доступа к этому профилю.'}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'GET':
        return Response(UserSerializer(user).data)

    serializer = UserUpdateSerializer(user, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(UserSerializer(user).data)


# ==========================================
# 2. КУРСЫ, БЛОКИ, УРОКИ И ИМПОРТ MARKDOWN
# ==========================================

@api_view(['GET', 'POST'])
def course_list(request):
    if request.method == 'POST':
        if not IsTeacherOrAdmin().has_permission(request, None):
            return Response(
                {'detail': 'Создавать курсы может только преподаватель или администратор.'},
                status=status.HTTP_401_UNAUTHORIZED if not request.user.is_authenticated else status.HTTP_403_FORBIDDEN,
            )
        serializer = CourseCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        course = serializer.save(author=request.user)
        return Response(CourseSerializer(course).data, status=status.HTTP_200_OK)

    query = (request.query_params.get('q') or '').strip()
    category = request.query_params.get('category')
    level = request.query_params.get('level')

    qs = Course.objects.annotate(
        students_count=Count('enrollments', distinct=True),
        total_lessons=Count('lessons', distinct=True),
    ).order_by('id')
    if getattr(request.user, 'is_authenticated', False) and request.user.is_teacher_or_admin:
        if request.user.role == User.TEACHER and not request.user.is_staff and not request.user.is_superuser:
            qs = qs.filter(author=request.user)
    else:
        qs = qs.filter(status='published')

    if query:
        qs = qs.filter(Q(title__icontains=query) | Q(description__icontains=query))
    if category:
        qs = qs.filter(category=category)
    if level:
        qs = qs.filter(level=level)

    return Response([course_list_item(course, enrolled=False) for course in qs])


def student_has_course_access(user, course):
    return (
        course.status == 'published'
        and Enrollment.objects.filter(user=user, course=course).exists()
    )


def can_manage_course(user, course):
    if not user or not user.is_authenticated:
        return False
    if user.role == User.ADMIN or user.is_staff or user.is_superuser:
        return True
    return user.role == User.TEACHER and course.author_id == user.id


def student_can_access_lesson(user, lesson):
    if not student_has_course_access(user, lesson.course):
        return False

    group_accesses = GroupLessonAccess.objects.filter(
        group__students=user,
        group__group_courses__course=lesson.course,
        lesson=lesson,
    )
    if group_accesses.exists():
        return group_accesses.filter(is_unlocked=True).exists()

    previous_lesson = Lesson.objects.filter(
        course=lesson.course,
    ).filter(
        Q(order__lt=lesson.order) | Q(order=lesson.order, id__lt=lesson.id)
    ).order_by('-order', '-id').first()
    if previous_lesson is None:
        return True
    return StudentLessonProgress.objects.filter(
        user=user,
        lesson=previous_lesson,
        is_completed=True,
    ).exists()


@api_view(['GET', 'PATCH'])
def course_detail(request, course_id):
    try:
        course = Course.objects.prefetch_related(
            'blocks__lessons',
            'blocks__exam',
            'lessons__questions__answers',
            'questions__answers',
        ).get(pk=course_id)
    except Course.DoesNotExist:
        return Response({'detail': 'Курс не найден'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'PATCH':
        if not can_manage_course(request.user, course):
            return Response(
                {'detail': 'Изменять курс может только его автор или администратор.'},
                status=status.HTTP_403_FORBIDDEN if request.user.is_authenticated else status.HTTP_401_UNAUTHORIZED,
            )
        serializer = CourseUpdateSerializer(course, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(CourseSerializer(course).data)

    current_user = request.user if request.user.is_authenticated else None
    is_course_editor = can_manage_course(current_user, course)
    if course.status != 'published' and not is_course_editor:
        return Response({'detail': 'Курс не найден'}, status=status.HTTP_404_NOT_FOUND)
    is_enrolled = bool(
        is_course_editor
        or (
            current_user
            and course.status == 'published'
            and Enrollment.objects.filter(user=current_user, course=course).exists()
        )
    )

    data = CourseSerializer(course).data
    data['is_enrolled'] = is_enrolled
    if not is_enrolled:
        data['content'] = ''
        data['questions'] = []
        data['lessons'] = []
        data['blocks'] = []
        return Response(data)

    course_questions = course.questions.filter(lesson__isnull=True, exam__isnull=True)
    if is_course_editor:
        data['questions'] = QuestionSerializer(course_questions, many=True).data
    else:
        data['questions'] = StudentQuestionSerializer(course_questions, many=True).data

    # Формируем уроки с последовательной проверкой блокировки (Stepik sequential gating)
    lessons = list(course.lessons.all().order_by('order', 'id'))
    completed_ids = set()
    if current_user:
        completed_ids = set(
            StudentLessonProgress.objects.filter(
                user=current_user,
                lesson__in=lessons,
                is_completed=True
            ).values_list('lesson_id', flat=True)
        )

    lessons_data = []
    for idx, lesson in enumerate(lessons):
        lesson_dict = LessonSerializer(
            lesson,
            context={'request': request, 'can_view_answers': is_course_editor},
        ).data
        is_completed = lesson.id in completed_ids
        lesson_dict['is_completed'] = is_completed

        if is_course_editor:
            is_locked = False
            lock_reason = None
        else:
            is_locked = not student_can_access_lesson(current_user, lesson)
            previous_lesson = lessons[idx - 1] if idx else None
            lock_reason = (
                f'🔒 Завершите урок "{previous_lesson.title}", чтобы открыть этот материал.'
                if is_locked and previous_lesson
                else '🔒 Этот материал пока не открыт преподавателем.'
                if is_locked
                else None
            )

        if is_locked:
            lesson_dict['content'] = ''
            lesson_dict['questions'] = []

        lesson_dict['is_locked'] = is_locked
        lesson_dict['lock_reason'] = lock_reason
        lessons_data.append(lesson_dict)

    data['lessons'] = lessons_data

    # Блоки с экзаменами
    blocks_data = []
    for block in course.blocks.all().order_by('order', 'id'):
        b_dict = CourseBlockSerializer(
            block,
            context={'request': request, 'can_view_answers': is_course_editor},
        ).data
        b_lessons = [l for l in lessons_data if l.get('block_id') == block.id]
        b_dict['lessons'] = b_lessons

        # Проверка блокировки экзамена
        exam = getattr(block, 'exam', None)
        if exam:
            exam_dict = ExamSerializer(exam).data
            # Экзамен открыт только когда все обязательные уроки блока завершены
            mandatory_ids = [l['id'] for l in b_lessons if l.get('is_mandatory', True)]
            all_done = all(lid in completed_ids for lid in mandatory_ids)
            exam_dict['is_locked'] = not all_done
            exam_dict['lock_reason'] = '🔒 Экзамен закрыт. Сначала завершите все уроки этого блока.' if not all_done else None
            
            # Результаты попыток студента
            if current_user:
                attempts = ExamAttempt.objects.filter(user=current_user, exam=exam).order_by('-completed_at')
                exam_dict['attempts_count'] = attempts.count()
                exam_dict['best_score'] = max([a.score for a in attempts], default=None)
                exam_dict['passed'] = any(a.passed for a in attempts)
            b_dict['exam'] = exam_dict
        else:
            b_dict['exam'] = None

        blocks_data.append(b_dict)

    data['blocks'] = blocks_data
    return Response(data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def submit_course_quiz(request, course_id):
    if request.user.role != User.STUDENT:
        return Response(
            {'detail': 'Сдавать тест курса может только ученик.'},
            status=status.HTTP_403_FORBIDDEN,
        )
    try:
        course = Course.objects.get(pk=course_id)
    except Course.DoesNotExist:
        return Response({'detail': 'Курс не найден'}, status=status.HTTP_404_NOT_FOUND)
    if not student_has_course_access(request.user, course):
        return Response({'detail': 'Курс вам не назначен преподавателем.'}, status=status.HTTP_403_FORBIDDEN)

    questions = list(
        Question.objects.filter(course=course, lesson__isnull=True, exam__isnull=True)
        .prefetch_related('answers')
        .order_by('id')
    )
    if not questions:
        return Response({'detail': 'В курсе нет тестовых вопросов.'}, status=status.HTTP_400_BAD_REQUEST)

    selections = request.data.get('answers')
    if not isinstance(selections, list) or len(selections) != len(questions):
        return Response(
            {'detail': 'Для каждого вопроса требуется выбрать один ответ.'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if any(
        not isinstance(selection, dict)
        or 'question_id' not in selection
        or 'answer_id' not in selection
        for selection in selections
    ):
        return Response(
            {'detail': 'Каждый ответ должен содержать question_id и answer_id.'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    try:
        selections_by_question = {
            int(selection['question_id']): int(selection['answer_id'])
            for selection in selections
        }
    except (TypeError, ValueError):
        return Response({'detail': 'Идентификаторы ответов должны быть целыми числами.'}, status=status.HTTP_400_BAD_REQUEST)

    question_ids = {question.id for question in questions}
    if len(selections_by_question) != len(selections) or set(selections_by_question) != question_ids:
        return Response(
            {'detail': 'Ответы должны соответствовать всем вопросам этого курса.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    correct_count = 0
    for question in questions:
        answer = next(
            (answer for answer in question.answers.all() if answer.id == selections_by_question[question.id]),
            None,
        )
        if answer is None:
            return Response(
                {'detail': 'Выбранный ответ не относится к вопросу.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        correct_count += int(answer.is_correct)

    enrollment = Enrollment.objects.filter(user=request.user, course=course).first()
    if enrollment is None:
        return Response(
            {'detail': 'Курс вам не назначен преподавателем.'},
            status=status.HTTP_403_FORBIDDEN,
        )
    enrollment.correct_answers = correct_count
    if not course.lessons.exists():
        enrollment.progress_percentage = 100
    enrollment.save(update_fields=['correct_answers', 'progress_percentage', 'updated_at'])

    return Response({
        'correct_answers': correct_count,
        'total_questions': len(questions),
        'percentage': round(correct_count * 100 / len(questions)),
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def complete_text_course(request, course_id):
    if request.user.role != User.STUDENT:
        return Response(
            {'detail': 'Завершать курс может только ученик.'},
            status=status.HTTP_403_FORBIDDEN,
        )
    course = Course.objects.filter(pk=course_id, status='published').first()
    if course is None:
        return Response({'detail': 'Курс не найден'}, status=status.HTTP_404_NOT_FOUND)
    if not course.content or not course.content.strip():
        return Response(
            {'detail': 'Отмечать завершение можно только для текстового курса.'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if (
        course.lessons.exists()
        or course.questions.filter(lesson__isnull=True, exam__isnull=True).exists()
        or course.blocks.filter(exam__isnull=False).exists()
    ):
        return Response(
            {'detail': 'Курс содержит отдельные уроки или тесты; завершайте их по соответствующим действиям.'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    enrollment = Enrollment.objects.filter(user=request.user, course=course).first()
    if enrollment is None:
        return Response(
            {'detail': 'Курс вам не назначен преподавателем.'},
            status=status.HTTP_403_FORBIDDEN,
        )
    enrollment.progress_percentage = 100
    enrollment.save(update_fields=['progress_percentage', 'updated_at'])
    return Response({'status': 'ok', 'progress_percentage': enrollment.progress_percentage})


@api_view(['POST'])
def course_create(request):
    if not IsTeacherOrAdmin().has_permission(request, None):
        return Response(
            {'detail': 'Создавать курсы может только преподаватель или администратор.'},
            status=status.HTTP_401_UNAUTHORIZED if not request.user.is_authenticated else status.HTTP_403_FORBIDDEN,
        )
    serializer = CourseCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    course = serializer.save(author=request.user)
    return Response(CourseSerializer(course).data, status=status.HTTP_200_OK)


@api_view(['GET', 'POST'])
def course_blocks(request, course_id):
    try:
        course = Course.objects.get(pk=course_id)
    except Course.DoesNotExist:
        return Response({'detail': 'Курс не найден'}, status=status.HTTP_404_NOT_FOUND)
    if request.method == 'GET' and not can_manage_course(request.user, course):
        if not request.user.is_authenticated:
            return Response({'detail': 'Authentication credentials were not provided.'}, status=status.HTTP_401_UNAUTHORIZED)
        if not student_has_course_access(request.user, course):
            return Response(
                {'detail': 'Курс вам не назначен преподавателем.'},
                status=status.HTTP_403_FORBIDDEN,
            )

    if request.method == 'POST':
        if not IsTeacherOrAdmin().has_permission(request, None):
            return Response(
                {'detail': 'Изменять содержимое курса может только преподаватель или администратор.'},
                status=status.HTTP_401_UNAUTHORIZED if not request.user.is_authenticated else status.HTTP_403_FORBIDDEN,
            )
        if not can_manage_course(request.user, course):
            return Response(
                {'detail': 'Изменять содержимое курса может только его автор или администратор.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        title = request.data.get('title', '')
        if not isinstance(title, str) or not title.strip():
            return Response({'detail': 'Название блока обязательно'}, status=status.HTTP_400_BAD_REQUEST)
        title = title.strip()
        description = request.data.get('description', '')
        if not isinstance(description, str):
            return Response({'detail': 'Описание блока должно быть текстом.'}, status=status.HTTP_400_BAD_REQUEST)
        order = request.data.get('order')
        if order is None:
            last = course.blocks.order_by('-order').first()
            order = (last.order + 1) if last else 1
        try:
            if isinstance(order, bool):
                raise ValueError
            order = int(order)
        except (TypeError, ValueError):
            return Response({'detail': 'Порядок блока должен быть целым числом.'}, status=status.HTTP_400_BAD_REQUEST)
        if order < 1:
            return Response({'detail': 'Порядок блока должен быть положительным числом.'}, status=status.HTTP_400_BAD_REQUEST)
        if course.blocks.filter(order=order).exists():
            return Response({'detail': 'В курсе уже есть блок с таким порядком.'}, status=status.HTTP_400_BAD_REQUEST)
        block = CourseBlock.objects.create(course=course, title=title, description=description, order=order)
        return Response(
            CourseBlockSerializer(block, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )

    blocks = course.blocks.prefetch_related('lessons', 'exam').all().order_by('order')
    blocks_data = CourseBlockSerializer(blocks, many=True, context={'request': request}).data
    if request.user.is_authenticated and request.user.role == User.STUDENT:
        for block_data in blocks_data:
            for lesson_data in block_data['lessons']:
                lesson = Lesson.objects.get(pk=lesson_data['id'])
                is_locked = not student_can_access_lesson(request.user, lesson)
                lesson_data['is_locked'] = is_locked
                if is_locked:
                    lesson_data['content'] = ''
                    lesson_data['questions'] = []
    return Response(blocks_data)


@api_view(['PATCH', 'DELETE'])
def block_detail(request, block_id):
    block = CourseBlock.objects.select_related('course').filter(pk=block_id).first()
    if block is None:
        return Response({'detail': 'Блок курса не найден'}, status=status.HTTP_404_NOT_FOUND)
    if not can_manage_course(request.user, block.course):
        return Response(
            {'detail': 'Изменять блоки может только автор курса или администратор.'},
            status=status.HTTP_403_FORBIDDEN if request.user.is_authenticated else status.HTTP_401_UNAUTHORIZED,
        )

    if request.method == 'DELETE':
        if block.lessons.exists() or Exam.objects.filter(block=block).exists():
            return Response(
                {'detail': 'Сначала переместите или удалите уроки и экзамен этого блока.'},
                status=status.HTTP_409_CONFLICT,
            )
        block.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    title = request.data.get('title', block.title)
    if not isinstance(title, str) or not title.strip():
        return Response({'detail': 'Название блока обязательно.'}, status=status.HTTP_400_BAD_REQUEST)
    description = request.data.get('description', block.description)
    if not isinstance(description, str):
        return Response({'detail': 'Описание блока должно быть текстом.'}, status=status.HTTP_400_BAD_REQUEST)
    order = block.order
    if 'order' in request.data:
        try:
            if isinstance(request.data['order'], bool):
                raise ValueError
            order = int(request.data['order'])
        except (TypeError, ValueError):
            return Response({'detail': 'Порядок блока должен быть целым числом.'}, status=status.HTTP_400_BAD_REQUEST)
        if order < 1:
            return Response({'detail': 'Порядок блока должен быть положительным числом.'}, status=status.HTTP_400_BAD_REQUEST)
        if CourseBlock.objects.filter(course=block.course, order=order).exclude(pk=block.pk).exists():
            return Response({'detail': 'В курсе уже есть блок с таким порядком.'}, status=status.HTTP_400_BAD_REQUEST)

    block.title = title.strip()
    block.description = description
    block.order = order
    block.save()
    return Response(CourseBlockSerializer(block, context={'request': request}).data)


@api_view(['POST'])
def course_lessons_create(request, course_id):
    if not IsTeacherOrAdmin().has_permission(request, None):
        return Response(
            {'detail': 'Создавать уроки может только преподаватель или администратор.'},
            status=status.HTTP_401_UNAUTHORIZED if not request.user.is_authenticated else status.HTTP_403_FORBIDDEN,
        )
    try:
        course = Course.objects.get(pk=course_id)
    except Course.DoesNotExist:
        return Response({'detail': 'Курс не найден'}, status=status.HTTP_404_NOT_FOUND)
    if not can_manage_course(request.user, course):
        return Response(
            {'detail': 'Изменять содержимое курса может только его автор или администратор.'},
            status=status.HTTP_403_FORBIDDEN if request.user.is_authenticated else status.HTTP_401_UNAUTHORIZED,
        )

    title = request.data.get('title', '')
    if not isinstance(title, str) or not title.strip():
        return Response({'detail': 'Название урока обязательно'}, status=status.HTTP_400_BAD_REQUEST)
    title = title.strip()

    description = request.data.get('description', '')
    content = request.data.get('content', '')
    if not isinstance(description, str) or not isinstance(content, str):
        return Response({'detail': 'Описание и содержимое урока должны быть текстом.'}, status=status.HTTP_400_BAD_REQUEST)
    block_id = request.data.get('block_id')
    order = request.data.get('order')

    if order is None:
        last_lesson = course.lessons.order_by('-order').first()
        order = (last_lesson.order + 1) if last_lesson else 1
    else:
        try:
            if isinstance(order, bool):
                raise ValueError
            order = int(order)
        except (TypeError, ValueError):
            return Response({'detail': 'Порядок урока должен быть целым числом.'}, status=status.HTTP_400_BAD_REQUEST)
    if order < 1:
        return Response({'detail': 'Порядок урока должен быть положительным числом.'}, status=status.HTTP_400_BAD_REQUEST)
    if course.lessons.filter(order=order).exists():
        return Response({'detail': 'В курсе уже есть урок с таким порядком.'}, status=status.HTTP_400_BAD_REQUEST)

    block = None
    if block_id:
        try:
            block_id = int(block_id)
        except (TypeError, ValueError):
            return Response({'detail': 'Некорректный идентификатор блока.'}, status=status.HTTP_400_BAD_REQUEST)
        block = CourseBlock.objects.filter(pk=block_id, course=course).first()
        if block is None:
            return Response({'detail': 'Блок не принадлежит этому курсу.'}, status=status.HTTP_400_BAD_REQUEST)
    lesson_type = request.data.get('lesson_type', 'theory')
    if not isinstance(lesson_type, str) or lesson_type not in dict(Lesson.LESSON_TYPE_CHOICES):
        return Response({'detail': 'Недопустимый тип урока.'}, status=status.HTTP_400_BAD_REQUEST)
    is_mandatory = request.data.get('is_mandatory', True)
    if not isinstance(is_mandatory, bool):
        return Response({'detail': 'Поле обязательности урока должно быть логическим значением.'}, status=status.HTTP_400_BAD_REQUEST)

    lesson = Lesson.objects.create(
        course=course,
        block=block,
        title=title,
        description=description,
        content=content,
        lesson_type=lesson_type,
        is_mandatory=is_mandatory,
        order=order,
    )

    return Response(
        LessonSerializer(lesson, context={'request': request}).data,
        status=status.HTTP_201_CREATED,
    )


@api_view(['POST'])
def course_import_markdown(request, course_id):
    """
    Создание урока из Markdown-текста или загруженного .md файла (Раздел 28 плана).
    Автоматически извлекает первый заголовок # в качестве названия, если не указано явно.
    """
    if not IsTeacherOrAdmin().has_permission(request, None):
        return Response(
            {'detail': 'Импортировать содержимое курса может только преподаватель или администратор.'},
            status=status.HTTP_401_UNAUTHORIZED if not request.user.is_authenticated else status.HTTP_403_FORBIDDEN,
        )
    try:
        course = Course.objects.get(pk=course_id)
    except Course.DoesNotExist:
        return Response({'detail': 'Курс не найден'}, status=status.HTTP_404_NOT_FOUND)
    if not can_manage_course(request.user, course):
        return Response(
            {'detail': 'Изменять содержимое курса может только его автор или администратор.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    content = request.data.get('content') or ''
    title = request.data.get('title', '').strip()
    block_id = request.data.get('block_id')

    if 'file' in request.FILES:
        uploaded_file = request.FILES['file']
        content = uploaded_file.read().decode('utf-8', errors='ignore')
        if not title:
            title = uploaded_file.name.replace('.md', '').replace('_', ' ')

    if not content:
        return Response({'detail': 'Содержимое Markdown не может быть пустым'}, status=status.HTTP_400_BAD_REQUEST)

    if not title:
        match = re.search(r'^#\s+(.+)$', content, re.MULTILINE)
        if match:
            title = match.group(1).strip()
        else:
            title = 'Новый урок'

    block = CourseBlock.objects.filter(pk=block_id, course=course).first() if block_id else None
    last_lesson = course.lessons.order_by('-order').first()
    order = (last_lesson.order + 1) if last_lesson else 1

    lesson = Lesson.objects.create(
        course=course,
        block=block,
        title=title,
        content=content,
        order=order,
        lesson_type='theory',
        is_mandatory=True,
    )
    return Response(
        LessonSerializer(lesson, context={'request': request}).data,
        status=status.HTTP_201_CREATED,
    )


@api_view(['PUT', 'PATCH', 'DELETE'])
def lesson_detail(request, lesson_id):
    if not IsTeacherOrAdmin().has_permission(request, None):
        return Response(
            {'detail': 'Изменять уроки может только преподаватель или администратор.'},
            status=status.HTTP_401_UNAUTHORIZED if not request.user.is_authenticated else status.HTTP_403_FORBIDDEN,
        )
    try:
        lesson = Lesson.objects.get(pk=lesson_id)
    except Lesson.DoesNotExist:
        return Response({'detail': 'Урок не найден'}, status=status.HTTP_404_NOT_FOUND)
    if not can_manage_course(request.user, lesson.course):
        return Response(
            {'detail': 'Изменять уроки может только автор курса или администратор.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    if request.method == 'DELETE':
        if lesson.student_progresses.exists() or lesson.assignments.exists():
            return Response(
                {'detail': 'Нельзя удалить урок с прогрессом учеников или связанными заданиями.'},
                status=status.HTTP_409_CONFLICT,
            )
        lesson.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    title = request.data.get('title', lesson.title)
    if not isinstance(title, str) or not title.strip():
        return Response({'detail': 'Название урока обязательно.'}, status=status.HTTP_400_BAD_REQUEST)
    lesson.title = title.strip()
    if 'description' in request.data:
        if not isinstance(request.data['description'], str):
            return Response({'detail': 'Описание урока должно быть текстом.'}, status=status.HTTP_400_BAD_REQUEST)
        lesson.description = request.data['description']
    if 'content' in request.data:
        if not isinstance(request.data['content'], str):
            return Response({'detail': 'Содержимое урока должно быть текстом.'}, status=status.HTTP_400_BAD_REQUEST)
        lesson.content = request.data['content']
    if 'order' in request.data:
        try:
            if isinstance(request.data['order'], bool):
                raise ValueError
            order = int(request.data['order'])
        except (TypeError, ValueError):
            return Response({'detail': 'Порядок урока должен быть целым числом.'}, status=status.HTTP_400_BAD_REQUEST)
        if order < 1:
            return Response({'detail': 'Порядок урока должен быть положительным числом.'}, status=status.HTTP_400_BAD_REQUEST)
        if Lesson.objects.filter(course=lesson.course, order=order).exclude(pk=lesson.pk).exists():
            return Response({'detail': 'В курсе уже есть урок с таким порядком.'}, status=status.HTTP_400_BAD_REQUEST)
        lesson.order = order
    if 'lesson_type' in request.data:
        lesson_type = request.data['lesson_type']
        if not isinstance(lesson_type, str) or lesson_type not in dict(Lesson.LESSON_TYPE_CHOICES):
            return Response({'detail': 'Недопустимый тип урока.'}, status=status.HTTP_400_BAD_REQUEST)
        lesson.lesson_type = lesson_type
    if 'is_mandatory' in request.data:
        if not isinstance(request.data['is_mandatory'], bool):
            return Response({'detail': 'Поле обязательности урока должно быть логическим значением.'}, status=status.HTTP_400_BAD_REQUEST)
        lesson.is_mandatory = request.data['is_mandatory']
    if 'block_id' in request.data:
        b_id = request.data['block_id']
        if b_id in (None, ''):
            lesson.block = None
        else:
            try:
                b_id = int(b_id)
            except (TypeError, ValueError):
                return Response({'detail': 'Некорректный идентификатор блока.'}, status=status.HTTP_400_BAD_REQUEST)
            lesson.block = CourseBlock.objects.filter(pk=b_id, course=lesson.course).first()
            if lesson.block is None:
                return Response({'detail': 'Блок не принадлежит этому курсу.'}, status=status.HTTP_400_BAD_REQUEST)

    lesson.save()
    return Response(LessonSerializer(lesson, context={'request': request}).data)


@api_view(['GET', 'POST'])
def course_assignments(request, course_id):
    course = Course.objects.filter(pk=course_id).first()
    if course is None:
        return Response({'detail': 'Курс не найден'}, status=status.HTTP_404_NOT_FOUND)

    can_manage = can_manage_course(request.user, course)
    if request.method == 'POST':
        if not request.user.is_authenticated:
            return Response({'detail': 'Authentication credentials were not provided.'}, status=status.HTTP_401_UNAUTHORIZED)
        if not can_manage:
            return Response({'detail': 'Создавать задания может только автор курса или администратор.'}, status=status.HTTP_403_FORBIDDEN)
        serializer = AssignmentCreateSerializer(
            data=request.data,
            context={'course': course},
        )
        serializer.is_valid(raise_exception=True)
        assignment = serializer.save(course=course)
        return Response(
            AssignmentTeacherSerializer(assignment).data,
            status=status.HTTP_201_CREATED,
        )

    if can_manage:
        assignments = course.assignments.all()
    elif request.user.is_authenticated and request.user.role == User.STUDENT:
        if not student_has_course_access(request.user, course):
            return Response({'detail': 'Курс вам не назначен преподавателем.'}, status=status.HTTP_403_FORBIDDEN)
        assignments = course.assignments.filter(is_published=True)
    else:
        return Response(
            {'detail': 'Просматривать задания курса может его автор, администратор или записанный ученик.'},
            status=status.HTTP_401_UNAUTHORIZED if not request.user.is_authenticated else status.HTTP_403_FORBIDDEN,
        )

    if request.user.role == User.STUDENT:
        assignments = [
            assignment for assignment in assignments
            if assignment.lesson_id is None or student_can_access_lesson(request.user, assignment.lesson)
        ]
        serializer = AssignmentStudentSerializer
    else:
        serializer = AssignmentTeacherSerializer
    return Response(serializer(assignments, many=True).data)


@api_view(['GET', 'PATCH', 'DELETE'])
def assignment_detail(request, assignment_id):
    assignment = Assignment.objects.select_related('course', 'lesson').filter(pk=assignment_id).first()
    if assignment is None:
        return Response({'detail': 'Задание не найдено'}, status=status.HTTP_404_NOT_FOUND)

    can_manage = can_manage_course(request.user, assignment.course)
    if request.method == 'GET':
        if can_manage:
            return Response(AssignmentTeacherSerializer(assignment).data)
        if not request.user.is_authenticated:
            return Response({'detail': 'Authentication credentials were not provided.'}, status=status.HTTP_401_UNAUTHORIZED)
        if (
            request.user.role != User.STUDENT
            or not assignment.is_published
            or not student_has_course_access(request.user, assignment.course)
            or (
                assignment.lesson_id
                and not student_can_access_lesson(request.user, assignment.lesson)
            )
        ):
            return Response({'detail': 'Задание недоступно.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(AssignmentStudentSerializer(assignment).data)

    if not request.user.is_authenticated:
        return Response({'detail': 'Authentication credentials were not provided.'}, status=status.HTTP_401_UNAUTHORIZED)
    if not can_manage:
        return Response({'detail': 'Изменять задания может только автор курса или администратор.'}, status=status.HTTP_403_FORBIDDEN)
    if request.method == 'DELETE':
        if assignment.submissions.exists():
            return Response(
                {'detail': 'Нельзя удалить задание, по которому уже есть ответы учеников.'},
                status=status.HTTP_409_CONFLICT,
            )
        assignment.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    serializer = AssignmentCreateSerializer(
        assignment,
        data=request.data,
        partial=True,
        context={'course': assignment.course},
    )
    serializer.is_valid(raise_exception=True)
    updated = serializer.save()
    return Response(AssignmentTeacherSerializer(updated).data)


@api_view(['GET', 'POST'])
@parser_classes([JSONParser, MultiPartParser, FormParser])
@transaction.atomic
def assignment_submissions(request, assignment_id):
    assignment = Assignment.objects.select_related('course', 'lesson').filter(pk=assignment_id).first()
    if assignment is None:
        return Response({'detail': 'Задание не найдено'}, status=status.HTTP_404_NOT_FOUND)

    can_manage = can_manage_course(request.user, assignment.course)
    if request.method == 'GET':
        if can_manage:
            submissions = assignment.submissions.select_related('student').all()
        elif (
            request.user.is_authenticated
            and request.user.role == User.STUDENT
            and assignment.is_published
            and student_has_course_access(request.user, assignment.course)
            and (
                assignment.lesson_id is None
                or student_can_access_lesson(request.user, assignment.lesson)
            )
        ):
            submissions = assignment.submissions.filter(student=request.user)
        else:
            return Response({'detail': 'Просматривать ответы может автор курса, администратор или их автор.'}, status=status.HTTP_403_FORBIDDEN)
        return Response(AssignmentSubmissionSerializer(submissions, many=True).data)

    if not request.user.is_authenticated:
        return Response({'detail': 'Authentication credentials were not provided.'}, status=status.HTTP_401_UNAUTHORIZED)
    if request.user.role != User.STUDENT:
        return Response({'detail': 'Отправлять ответы может только ученик.'}, status=status.HTTP_403_FORBIDDEN)
    assignment = Assignment.objects.select_for_update().select_related(
        'course',
        'lesson',
    ).get(pk=assignment_id)
    if (
        not assignment.is_published
        or not student_has_course_access(request.user, assignment.course)
        or (
            assignment.lesson_id
            and not student_can_access_lesson(request.user, assignment.lesson)
        )
    ):
        return Response({'detail': 'Задание недоступно.'}, status=status.HTTP_403_FORBIDDEN)
    if assignment.due_at and assignment.due_at < timezone.now():
        return Response({'detail': 'Срок сдачи задания истёк.'}, status=status.HTTP_400_BAD_REQUEST)
    if (
        assignment.assignment_type == Assignment.TYPE_CODE
        and not assignment.test_cases.exists()
    ):
        return Response(
            {'detail': 'Для запуска этого задания преподаватель должен добавить hidden tests.'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if assignment.submissions.filter(student=request.user).count() >= assignment.max_attempts:
        return Response({'detail': 'Достигнут лимит попыток.'}, status=status.HTTP_400_BAD_REQUEST)

    serializer = AssignmentSubmissionCreateSerializer(
        data=request.data,
        context={'assignment': assignment},
    )
    serializer.is_valid(raise_exception=True)
    uploaded_file = serializer.validated_data.get('file')
    if assignment.assignment_type == Assignment.TYPE_FILE_UPLOAD:
        submission = AssignmentSubmission.objects.create(
            assignment=assignment,
            student=request.user,
            uploaded_file=uploaded_file,
            original_file_name=uploaded_file.name,
        )
        return Response(
            AssignmentSubmissionSerializer(submission).data,
            status=status.HTTP_201_CREATED,
        )
    response_data = {}
    score = None
    submission_status = AssignmentSubmission.STATUS_SUBMITTED
    graded_at = None
    if assignment.assignment_type in {
        Assignment.TYPE_QUIZ,
        Assignment.TYPE_MULTIPLE_CHOICE,
    }:
        answers = serializer.validated_data['answers']
        questions = list(assignment.questions.prefetch_related('options').all())
        expected_questions = {question.id: question for question in questions}
        answer_map = {}
        for answer in answers:
            question_id = answer['question_id']
            option_ids = answer['option_ids']
            if question_id in answer_map or question_id not in expected_questions:
                return Response(
                    {'detail': 'Каждый ответ должен соответствовать уникальному вопросу этого задания.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if len(option_ids) != len(set(option_ids)):
                return Response(
                    {'detail': 'Нельзя отправлять повторяющиеся варианты ответа.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            question_options = {
                option.id: option
                for option in expected_questions[question_id].options.all()
            }
            if any(option_id not in question_options for option_id in option_ids):
                return Response(
                    {'detail': 'Выбранный вариант не относится к вопросу.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            answer_map[question_id] = set(option_ids)
        if set(answer_map) != set(expected_questions):
            return Response(
                {'detail': 'Необходимо ответить на каждый вопрос задания.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        correct_count = 0
        for question_id, question in expected_questions.items():
            correct_ids = {
                option.id for option in question.options.all()
                if option.is_correct
            }
            if answer_map[question_id] == correct_ids:
                correct_count += 1
        score = round(assignment.points * correct_count / len(expected_questions))
        submission_status = AssignmentSubmission.STATUS_GRADED
        graded_at = timezone.now()
        response_data = {
            str(question_id): sorted(option_ids)
            for question_id, option_ids in answer_map.items()
        }
    submission = AssignmentSubmission.objects.create(
        assignment=assignment,
        student=request.user,
        answer_text=serializer.validated_data.get(
            'source_code',
            serializer.validated_data.get('answer_text', ''),
        ),
        source_code=serializer.validated_data.get('source_code', ''),
        language=(
            assignment.programming_language
            if assignment.assignment_type == Assignment.TYPE_CODE
            else ''
        ),
        response_data=response_data,
        score=score,
        status=(
            AssignmentSubmission.STATUS_PENDING
            if assignment.assignment_type == Assignment.TYPE_CODE
            else submission_status
        ),
        graded_at=graded_at,
    )
    if assignment.assignment_type == Assignment.TYPE_CODE:
        transaction.on_commit(
            lambda: enqueue_code_submission(submission.id),
            robust=True,
        )
    return Response(
        AssignmentSubmissionSerializer(submission).data,
        status=status.HTTP_201_CREATED,
    )


@api_view(['POST'])
@transaction.atomic
def run_submission(request, submission_id):
    if not request.user.is_authenticated:
        return Response(
            {'detail': 'Authentication credentials were not provided.'},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    submission = AssignmentSubmission.objects.select_related(
        'assignment__course',
        'assignment__lesson',
        'student',
    ).filter(pk=submission_id).first()
    if submission is None:
        return Response({'detail': 'Ответ не найден.'}, status=status.HTTP_404_NOT_FOUND)

    is_submission_owner = (
        request.user.role == User.STUDENT
        and request.user.id == submission.student_id
    )
    if not is_submission_owner:
        return Response({'detail': 'Нет доступа к запуску кода.'}, status=status.HTTP_403_FORBIDDEN)

    if submission.assignment.assignment_type != Assignment.TYPE_CODE:
        return Response(
            {'detail': 'Запуск кода доступен только для Code Assignment.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    submission = AssignmentSubmission.objects.select_for_update().get(pk=submission_id)
    if submission.status != AssignmentSubmission.STATUS_SYSTEM_ERROR:
        return Response(
            {'detail': 'Повторно запустить можно только ответ с системной ошибкой.'},
            status=status.HTTP_409_CONFLICT,
        )
    if (
        not submission.assignment.is_published
        or not student_has_course_access(request.user, submission.assignment.course)
        or (
            submission.assignment.lesson_id
            and not student_can_access_lesson(request.user, submission.assignment.lesson)
        )
    ):
        return Response({'detail': 'Задание больше недоступно.'}, status=status.HTTP_403_FORBIDDEN)

    submission.status = AssignmentSubmission.STATUS_PENDING
    submission.error_message = ''
    submission.finished_at = None
    submission.tests_passed = None
    submission.tests_total = None
    submission.execution_time_ms = None
    submission.memory_used_mb = None
    submission.score = None
    submission.save(update_fields=[
        'status',
        'error_message',
        'finished_at',
        'tests_passed',
        'tests_total',
        'execution_time_ms',
        'memory_used_mb',
        'score',
    ])
    transaction.on_commit(
        lambda: enqueue_code_submission(submission.id),
        robust=True,
    )
    return Response(
        AssignmentSubmissionSerializer(submission).data,
        status=status.HTTP_202_ACCEPTED,
    )


@api_view(['GET'])
def assignment_submission_file(request, submission_id):
    if not request.user.is_authenticated:
        return Response(
            {'detail': 'Authentication credentials were not provided.'},
            status=status.HTTP_401_UNAUTHORIZED,
        )
    submission = AssignmentSubmission.objects.select_related(
        'assignment__course',
        'assignment__lesson',
        'student',
    ).filter(pk=submission_id).first()
    if submission is None or not submission.uploaded_file:
        return Response({'detail': 'Файл ответа не найден.'}, status=status.HTTP_404_NOT_FOUND)
    can_manage = can_manage_course(request.user, submission.assignment.course)
    is_submission_owner = (
        request.user.role == User.STUDENT
        and request.user.id == submission.student_id
        and submission.assignment.is_published
        and student_has_course_access(request.user, submission.assignment.course)
        and (
            submission.assignment.lesson_id is None
            or student_can_access_lesson(request.user, submission.assignment.lesson)
        )
    )
    if not can_manage and not is_submission_owner:
        return Response({'detail': 'Нет доступа к файлу ответа.'}, status=status.HTTP_403_FORBIDDEN)
    return FileResponse(
        submission.uploaded_file.open('rb'),
        as_attachment=True,
        filename=submission.original_file_name,
        content_type='application/octet-stream',
    )


@api_view(['PATCH'])
def grade_assignment_submission(request, submission_id):
    submission = AssignmentSubmission.objects.select_related('assignment__course').filter(
        pk=submission_id,
    ).first()
    if submission is None:
        return Response({'detail': 'Ответ не найден'}, status=status.HTTP_404_NOT_FOUND)
    if not request.user.is_authenticated:
        return Response({'detail': 'Authentication credentials were not provided.'}, status=status.HTTP_401_UNAUTHORIZED)
    if not can_manage_course(request.user, submission.assignment.course):
        return Response({'detail': 'Проверять ответы может только автор курса или администратор.'}, status=status.HTTP_403_FORBIDDEN)
    if submission.assignment.assignment_type == Assignment.TYPE_CODE:
        return Response(
            {'detail': 'Code Assignment оценивается автоматически изолированным runner.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    serializer = AssignmentSubmissionGradeSerializer(
        submission,
        data=request.data,
        partial=True,
    )
    serializer.is_valid(raise_exception=True)
    if 'score' not in serializer.validated_data:
        return Response({'detail': 'Для проверки необходимо указать score.'}, status=status.HTTP_400_BAD_REQUEST)
    graded_submission = serializer.save(
        status=AssignmentSubmission.STATUS_GRADED,
        graded_at=timezone.now(),
    )
    return Response(AssignmentSubmissionSerializer(graded_submission).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def complete_lesson(request, lesson_id):
    """
    Завершение урока студентом (Разделы 10-12 плана).
    Открывает следующий урок и пересчитывает общий прогресс курса.
    """
    try:
        lesson = Lesson.objects.select_related('course').get(pk=lesson_id)
    except Lesson.DoesNotExist:
        return Response({'detail': 'Урок не найден'}, status=status.HTTP_404_NOT_FOUND)

    user = request.user
    if user.role != User.STUDENT:
        return Response({'detail': 'Завершать уроки может только ученик.'}, status=status.HTTP_403_FORBIDDEN)
    if not student_can_access_lesson(user, lesson):
        return Response(
            {'detail': 'Урок не назначен вам или пока не открыт.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    requested_user_id = request.data.get('user_id') or request.data.get('userId')
    if requested_user_id and str(requested_user_id) != str(user.id):
        return Response({'detail': 'Нельзя отмечать урок завершённым от имени другого пользователя.'}, status=status.HTTP_403_FORBIDDEN)

    progress, _ = StudentLessonProgress.objects.get_or_create(user=user, lesson=lesson)
    progress.is_completed = True
    progress.completed_at = timezone.now()
    progress.save()

    # Обновляем активность
    user.last_activity = timezone.now()
    user.save(update_fields=['last_activity'])

    # Обновляем общий прогресс курса
    enrollment, _ = Enrollment.objects.get_or_create(user=user, course=lesson.course)
    total_lessons = lesson.course.lessons.count() or 1
    completed_count = StudentLessonProgress.objects.filter(
        user=user,
        lesson__course=lesson.course,
        is_completed=True,
    ).count()

    enrollment.completed_lessons = completed_count
    enrollment.progress_percentage = min(100, int((completed_count / total_lessons) * 100))
    enrollment.save()

    # Следующий урок
    next_lesson = Lesson.objects.filter(course=lesson.course, order__gt=lesson.order).order_by('order').first()

    return Response({
        'status': 'ok',
        'is_completed': True,
        'unlocked_next': next_lesson is not None,
        'next_lesson': {
            'id': next_lesson.id,
            'title': next_lesson.title,
            'order': next_lesson.order,
        } if next_lesson else None,
        'completed_lessons': enrollment.completed_lessons,
        'total_lessons': total_lessons,
        'progress_percentage': enrollment.progress_percentage,
    })


# ==========================================
# 3. ЭКЗАМЕНЫ И ТЕСТИРОВАНИЕ
# ==========================================

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def block_exam(request, block_id):
    try:
        block = CourseBlock.objects.select_related('course').get(pk=block_id)
    except CourseBlock.DoesNotExist:
        return Response({'detail': 'Блок не найден'}, status=status.HTTP_404_NOT_FOUND)

    exam = getattr(block, 'exam', None)
    if request.method == 'POST' and not can_manage_course(request.user, block.course):
        return Response(
            {'detail': 'Управлять экзаменом может только автор курса или администратор.'},
            status=status.HTTP_403_FORBIDDEN,
        )
    if request.method == 'GET' and request.user.role == User.STUDENT:
        if not student_has_course_access(request.user, block.course):
            return Response(
                {'detail': 'Курс вам не назначен преподавателем.'},
                status=status.HTTP_403_FORBIDDEN,
            )

    if request.method == 'POST':
        if not IsTeacherOrAdmin().has_permission(request, None):
            return Response(
                {'detail': 'Управлять экзаменами может только преподаватель или администратор.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        title = request.data.get('title', '').strip() or f'Экзамен: {block.title}'
        description = request.data.get('description', '')
        passing_score = int(request.data.get('passing_score', 70))
        max_attempts = int(request.data.get('max_attempts', 3))
        questions_data = request.data.get('questions', [])

        if exam:
            exam.title = title
            exam.description = description
            exam.passing_score = passing_score
            exam.max_attempts = max_attempts
            exam.save()
        else:
            exam = Exam.objects.create(
                block=block,
                course=block.course,
                title=title,
                description=description,
                passing_score=passing_score,
                max_attempts=max_attempts,
            )

        if questions_data:
            exam.questions.all().delete()
            for q_item in questions_data:
                q_text = q_item.get('text', '').strip()
                if not q_text:
                    continue
                q = Question.objects.create(course=block.course, exam=exam, text=q_text)
                for a_item in q_item.get('answers', []):
                    Answer.objects.create(
                        question=q,
                        text=a_item.get('text', ''),
                        is_correct=bool(a_item.get('is_correct', False))
                    )

        return Response(ExamDetailSerializer(exam, context={'request': request}).data, status=status.HTTP_201_CREATED)

    if not exam:
        return Response({'detail': 'В данном блоке нет экзамена'}, status=status.HTTP_404_NOT_FOUND)

    # Проверка условий блокировки экзамена для студента (Раздел 14 плана)
    user = request.user
    is_locked = False
    lock_reason = None
    if user.role == User.STUDENT:
        if not student_has_course_access(user, exam.course):
            return Response(
                {'detail': 'Курс вам не назначен преподавателем.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        block_mandatory_lessons = block.lessons.filter(is_mandatory=True)
        completed_count = StudentLessonProgress.objects.filter(
            user=user,
            lesson__in=block_mandatory_lessons,
            is_completed=True
        ).count()
        if completed_count < block_mandatory_lessons.count():
            return Response(
                {'detail': 'Экзамен закрыт. Сначала завершите все обязательные уроки этого блока.'},
                status=status.HTTP_403_FORBIDDEN,
            )

    data = ExamDetailSerializer(exam, context={'request': request}).data
    data['is_locked'] = is_locked
    data['lock_reason'] = lock_reason
    return Response(data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def exam_detail(request, exam_id):
    try:
        exam = Exam.objects.prefetch_related('questions__answers').get(pk=exam_id)
    except Exam.DoesNotExist:
        return Response({'detail': 'Экзамен не найден'}, status=status.HTTP_404_NOT_FOUND)

    user = request.user
    is_locked = False
    lock_reason = None
    if user.role == User.STUDENT and exam.block:
        if not student_has_course_access(user, exam.course):
            return Response(
                {'detail': 'Курс вам не назначен преподавателем.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        block_mandatory_lessons = exam.block.lessons.filter(is_mandatory=True)
        completed_count = StudentLessonProgress.objects.filter(
            user=user,
            lesson__in=block_mandatory_lessons,
            is_completed=True
        ).count()
        if completed_count < block_mandatory_lessons.count():
            return Response(
                {'detail': 'Экзамен закрыт. Сначала завершите все обязательные уроки этого блока.'},
                status=status.HTTP_403_FORBIDDEN,
            )
    elif user.role == User.STUDENT and not student_has_course_access(user, exam.course):
        return Response(
            {'detail': 'Курс вам не назначен преподавателем.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    data = ExamDetailSerializer(exam, context={'request': request}).data
    data['is_locked'] = is_locked
    data['lock_reason'] = lock_reason
    return Response(data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def exam_submit(request, exam_id):
    """Сдача экзамена студентом с подсчетом процента и фиксацией попытки"""
    try:
        exam = Exam.objects.prefetch_related('questions__answers').get(pk=exam_id)
    except Exam.DoesNotExist:
        return Response({'detail': 'Экзамен не найден'}, status=status.HTTP_404_NOT_FOUND)

    user = request.user
    if user.role != User.STUDENT:
        return Response({'detail': 'Сдавать экзамен может только ученик.'}, status=status.HTTP_403_FORBIDDEN)
    if not student_has_course_access(user, exam.course):
        return Response(
            {'detail': 'Курс вам не назначен преподавателем.'},
            status=status.HTTP_403_FORBIDDEN,
        )
    if exam.block:
        mandatory_lessons = exam.block.lessons.filter(is_mandatory=True)
        completed_count = StudentLessonProgress.objects.filter(
            user=user,
            lesson__in=mandatory_lessons,
            is_completed=True,
        ).count()
        if completed_count < mandatory_lessons.count():
            return Response(
                {'detail': 'Экзамен закрыт. Сначала завершите все обязательные уроки этого блока.'},
                status=status.HTTP_403_FORBIDDEN,
            )

    requested_user_id = request.data.get('user_id')
    if requested_user_id and str(requested_user_id) != str(user.id):
        return Response({'detail': 'Нельзя сдавать экзамен от имени другого пользователя.'}, status=status.HTTP_403_FORBIDDEN)

    prev_attempts = ExamAttempt.objects.filter(user=user, exam=exam).count()
    if prev_attempts >= exam.max_attempts:
        return Response({
            'detail': f'Вы исчерпали лимит попыток ({exam.max_attempts}). Обратитесь к преподавателю.',
            'limit_reached': True
        }, status=status.HTTP_400_BAD_REQUEST)

    submitted_answers = request.data.get('answers', [])
    answers_map = {item.get('question_id'): item.get('answer_id') for item in submitted_answers}

    questions = list(exam.questions.all())
    total_questions = len(questions)
    correct_count = 0

    for q in questions:
        chosen_id = answers_map.get(q.id)
        if chosen_id:
            correct_ans = q.answers.filter(is_correct=True).first()
            if correct_ans and correct_ans.id == chosen_id:
                correct_count += 1

    score = round((correct_count / max(1, total_questions)) * 100) if total_questions else 100
    passed = score >= exam.passing_score

    attempt = ExamAttempt.objects.create(
        user=user,
        exam=exam,
        score=score,
        passed=passed,
        answers_data={'answers': submitted_answers},
    )

    return Response({
        'attempt_id': attempt.id,
        'score': score,
        'passed': passed,
        'correct_count': correct_count,
        'total_questions': total_questions,
        'passing_score': exam.passing_score,
        'attempts_used': prev_attempts + 1,
        'max_attempts': exam.max_attempts,
        'attempts_left': max(0, exam.max_attempts - (prev_attempts + 1)),
        'message': '✅ Экзамен успешно сдан!' if passed else '❌ Экзамен не пройден. Попробуйте еще раз.',
    })


# ==========================================
# 4. КАБИНЕТ ПРЕПОДАВАТЕЛЯ & УПРАВЛЕНИЕ СТУДЕНТАМИ
# ==========================================

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsTeacherOrAdmin])
def teacher_dashboard(request):
    """Сводный дашборд преподавателя (Раздел 20 плана)"""
    students = User.objects.filter(role='student')
    total_students = students.count()
    total_groups = StudyGroup.objects.count()
    total_courses = Course.objects.count()
    week_ago = timezone.now() - datetime.timedelta(days=7)
    active_students = students.filter(last_activity__gte=week_ago).count()
    completed_enrollments = Enrollment.objects.filter(progress_percentage=100).count()

    return Response({
        'total_students': total_students,
        'total_groups': total_groups,
        'total_courses': total_courses,
        'active_students': active_students,
        'completed_courses_count': completed_enrollments,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsTeacherOrAdmin])
def teacher_students_list(request):
    """Список студентов для преподавателя с фильтрами и прогрессом (Раздел 21 плана)"""
    query = request.query_params.get('q', '').strip()
    group_id = request.query_params.get('group_id')
    include_archived = request.query_params.get('include_archived') == '1'

    qs = User.objects.filter(role='student')
    if not include_archived:
        qs = qs.filter(is_archived=False)
    qs = qs.annotate(
        completed_lessons_count=Count(
            'lesson_progresses',
            filter=Q(lesson_progresses__is_completed=True),
            distinct=True,
        )
    ).prefetch_related('study_groups', 'enrollments').order_by('id')
    if query:
        qs = qs.filter(
            Q(username__icontains=query) |
            Q(first_name__icontains=query) |
            Q(last_name__icontains=query) |
            Q(email__icontains=query)
        )
    if group_id:
        qs = qs.filter(study_groups__id=group_id)

    result = []
    for student in qs:
        primary_group = student.study_groups.first()
        enrollments = student.enrollments.all()
        avg_progress = 0
        if enrollments:
            avg_progress = round(sum(e.progress_percentage for e in enrollments) / len(enrollments))

        result.append({
            'id': student.id,
            'username': student.username,
            'name': student.name,
            'first_name': student.first_name,
            'last_name': student.last_name,
            'email': student.email,
            'is_active': student.is_active,
            'is_archived': student.is_archived,
            'group_id': primary_group.id if primary_group else None,
            'group_name': primary_group.name if primary_group else 'Без группы',
            'courses_count': len(enrollments),
            'avg_progress': avg_progress,
            'progress_percent': avg_progress,
            'completed_lessons': student.completed_lessons_count,
            'last_activity': student.last_activity,
            'date_joined': student.date_joined,
        })
    return Response(result)


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated, IsTeacherOrAdmin])
def teacher_student_detail(request, student_id):
    """Подробная карточка студента для преподавателя (Раздел 22 плана)"""
    try:
        student = User.objects.prefetch_related(
            'study_groups',
            'enrollments__course',
            'lesson_progresses__lesson__course',
            'exam_attempts__exam'
        ).get(pk=student_id)
    except User.DoesNotExist:
        return Response({'detail': 'Студент не найден'}, status=status.HTTP_404_NOT_FOUND)
    if student.role != User.STUDENT:
        return Response({'detail': 'Указанная учётная запись не является ученической.'}, status=status.HTTP_404_NOT_FOUND)
    if request.method == 'PATCH':
        serializer = UserUpdateSerializer(
            student,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        updated_student = serializer.save()
        return Response(UserSerializer(updated_student).data)

    primary_group = student.study_groups.first()

    courses_data = []
    for en in student.enrollments.select_related('course').all():
        course = en.course
        total_lessons = course.lessons.count()
        last_progress = StudentLessonProgress.objects.filter(
            user=student,
            lesson__course=course,
            is_completed=True
        ).order_by('-completed_at').first()

        current_lesson = None
        if last_progress:
            next_l = course.lessons.filter(order__gt=last_progress.lesson.order).order_by('order').first()
            current_lesson = next_l.title if next_l else 'Курс завершен'
        else:
            first_l = course.lessons.order_by('order').first()
            current_lesson = first_l.title if first_l else 'Нет уроков'

        courses_data.append({
            'course_id': course.id,
            'course_title': course.title,
            'progress_percentage': en.progress_percentage,
            'completed_lessons': en.completed_lessons,
            'total_lessons': total_lessons,
            'current_lesson': current_lesson,
        })

    exams_data = []
    for attempt in student.exam_attempts.select_related('exam').all():
        exams_data.append({
            'exam_id': attempt.exam.id,
            'exam_title': attempt.exam.title,
            'score': attempt.score,
            'passed': attempt.passed,
            'completed_at': attempt.completed_at,
        })

    history = []
    for lp in student.lesson_progresses.filter(is_completed=True).select_related('lesson__course').order_by('-completed_at')[:20]:
        history.append({
            'lesson_id': lp.lesson.id,
            'lesson_title': lp.lesson.title,
            'course_title': lp.lesson.course.title,
            'completed_at': lp.completed_at,
        })

    return Response({
        'id': student.id,
        'username': student.username,
        'name': student.name,
        'first_name': student.first_name,
        'last_name': student.last_name,
        'email': student.email,
        'is_active': student.is_active,
        'is_archived': student.is_archived,
        'date_joined': student.date_joined,
        'last_activity': student.last_activity,
        'group': {'id': primary_group.id, 'name': primary_group.name} if primary_group else None,
        'courses': courses_data,
        'exams': exams_data,
        'learning_history': history,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsTeacherOrAdmin])
@transaction.atomic
def quick_create_student(request):
    """Быстрое создание студента преподавателем (логин student_XXXX + авто-пароль, Раздел 3 плана)"""
    group_id = request.data.get('group_id')
    if isinstance(group_id, int) or (isinstance(group_id, str) and group_id.isdecimal()):
        StudyGroup.objects.select_for_update().filter(pk=int(group_id)).first()
    serializer = QuickCreateStudentSerializer(data=request.data, context={'request': request})
    serializer.is_valid(raise_exception=True)
    result = serializer.save()
    return Response(result, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsTeacherOrAdmin])
def reset_student_password(request, student_id):
    """Сброс пароля студента с выдачей нового (Раздел 21 плана)"""
    try:
        student = User.objects.get(pk=student_id)
    except User.DoesNotExist:
        return Response({'detail': 'Студент не найден'}, status=status.HTTP_404_NOT_FOUND)

    if student.is_archived:
        return Response(
            {'detail': 'Сначала восстановите ученика из архива.'},
            status=status.HTTP_409_CONFLICT,
        )
    new_password = secrets.token_urlsafe(12)
    student.set_password(new_password)
    student.must_change_password = True
    student.save(update_fields=['password', 'must_change_password'])
    return Response({
        'username': student.username,
        'new_password': new_password,
        'message': f'Новый пароль для {student.username} успешно создан',
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsTeacherOrAdmin])
def reset_student_progress(request, student_id):
    """Сброс прогресса студента по курсу (Раздел 21 плана)"""
    try:
        student = User.objects.get(pk=student_id)
    except User.DoesNotExist:
        return Response({'detail': 'Студент не найден'}, status=status.HTTP_404_NOT_FOUND)

    if student.is_archived:
        return Response(
            {'detail': 'Сначала восстановите ученика из архива.'},
            status=status.HTTP_409_CONFLICT,
        )
    course_id = request.data.get('course_id')
    if course_id:
        StudentLessonProgress.objects.filter(user=student, lesson__course_id=course_id).delete()
        Enrollment.objects.filter(user=student, course_id=course_id).update(
            completed_lessons=0,
            progress_percentage=0,
            current_index=0,
            correct_answers=0
        )
    else:
        StudentLessonProgress.objects.filter(user=student).delete()
        Enrollment.objects.filter(user=student).update(
            completed_lessons=0,
            progress_percentage=0,
            current_index=0,
            correct_answers=0
        )
    return Response({'status': 'progress_reset', 'student_id': student.id})


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsTeacherOrAdmin])
def toggle_student_status(request, student_id):
    """Блокировка / разблокировка студента (Раздел 21 плана)"""
    try:
        student = User.objects.get(pk=student_id)
    except User.DoesNotExist:
        return Response({'detail': 'Студент не найден'}, status=status.HTTP_404_NOT_FOUND)

    if student.is_archived:
        return Response(
            {'detail': 'Сначала восстановите ученика из архива.'},
            status=status.HTTP_409_CONFLICT,
        )
    student.is_active = not student.is_active
    student.save()
    return Response({
        'student_id': student.id,
        'is_active': student.is_active,
        'status_text': 'Активен' if student.is_active else 'Заблокирован'
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsTeacherOrAdmin])
def set_student_archived(request, student_id):
    try:
        student = User.objects.get(pk=student_id, role=User.STUDENT)
    except User.DoesNotExist:
        return Response({'detail': 'Студент не найден'}, status=status.HTTP_404_NOT_FOUND)

    archived = request.data.get('is_archived')
    if not isinstance(archived, bool):
        return Response(
            {'detail': 'Поле is_archived должно быть логическим значением.'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if student.is_archived == archived:
        return Response({'student_id': student.id, 'is_archived': student.is_archived})

    student.is_archived = archived
    student.save(update_fields=['is_archived'])
    return Response({
        'student_id': student.id,
        'is_archived': student.is_archived,
        'status_text': 'Архивирован' if archived else 'Восстановлен из архива',
    })


# ==========================================
# 5. СИСТЕМА ГРУПП И НАЗНАЧЕНИЕ КУРСОВ
# ==========================================

def group_management_forbidden(request, group):
    user = request.user
    can_manage = (
        user.is_authenticated
        and (
            user.is_superuser
            or user.is_staff
            or user.role == User.ADMIN
            or (user.role == User.TEACHER and group.teacher_id == user.id)
        )
    )
    if can_manage:
        return None
    return Response(
        {'detail': 'Управлять этой группой может только её преподаватель или администратор.'},
        status=status.HTTP_403_FORBIDDEN,
    )


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated, IsTeacherOrAdmin])
@transaction.atomic
def groups_list(request):
    if request.method == 'POST':
        serializer = GroupCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        group_data = serializer.validated_data
        group = StudyGroup.objects.create(
            name=group_data['name'],
            description=group_data['description'],
            capacity=group_data.get('capacity'),
            code=StudyGroup.generate_code(),
            teacher=request.user,
        )
        credentials = []
        for student_data in group_data['students']:
            student_serializer = QuickCreateStudentSerializer(
                data={
                    **student_data,
                    'group_id': group.id,
                },
                context={'request': request},
            )
            student_serializer.is_valid(raise_exception=True)
            credentials.append(student_serializer.save())
        group = StudyGroup.objects.prefetch_related(
            'students',
            'group_courses__course',
        ).get(pk=group.pk)
        result = StudyGroupSerializer(group).data
        result['created_students'] = credentials
        return Response(result, status=status.HTTP_201_CREATED)

    teacher_id = request.query_params.get('teacher_id')
    qs = StudyGroup.objects.select_related('teacher').prefetch_related('students', 'group_courses__course').all()
    if request.user.role == User.TEACHER and not request.user.is_superuser:
        qs = qs.filter(teacher=request.user)
    elif teacher_id:
        qs = qs.filter(teacher_id=teacher_id)

    return Response(StudyGroupSerializer(qs, many=True).data)


@api_view(['GET', 'DELETE'])
@permission_classes([IsAuthenticated, IsTeacherOrAdmin])
@transaction.atomic
def group_detail(request, group_id):
    try:
        group = StudyGroup.objects.select_related('teacher').prefetch_related('students', 'group_courses__course').get(pk=group_id)
    except StudyGroup.DoesNotExist:
        return Response({'detail': 'Группа не найдена'}, status=status.HTTP_404_NOT_FOUND)

    forbidden = group_management_forbidden(request, group)
    if forbidden:
        return forbidden

    if request.method == 'DELETE':
        student_ids = list(group.students.values_list('id', flat=True))
        course_ids = list(group.group_courses.values_list('course_id', flat=True))
        group.delete()
        for student_id in student_ids:
            for course_id in course_ids:
                remaining_group_assignment = GroupCourse.objects.filter(
                    course_id=course_id,
                    group__students__id=student_id,
                ).exists()
                if not remaining_group_assignment:
                    Enrollment.objects.filter(
                        user_id=student_id,
                        course_id=course_id,
                    ).delete()
        return Response({'status': 'deleted'})

    return Response(StudyGroupSerializer(group).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsTeacherOrAdmin])
@transaction.atomic
def group_add_student(request, group_id):
    try:
        group = StudyGroup.objects.select_for_update().get(pk=group_id)
    except StudyGroup.DoesNotExist:
        return Response({'detail': 'Группа не найдена'}, status=status.HTTP_404_NOT_FOUND)

    forbidden = group_management_forbidden(request, group)
    if forbidden:
        return forbidden

    student_id = request.data.get('student_id')
    username = request.data.get('username')

    student = None
    if student_id:
        try:
            student_id = int(student_id)
        except (TypeError, ValueError):
            return Response({'detail': 'student_id должен быть целым числом.'}, status=status.HTTP_400_BAD_REQUEST)
        student = User.objects.filter(pk=student_id).first()
    elif username:
        student = User.objects.filter(username__iexact=username.strip()).first()

    if not student:
        return Response({'detail': 'Студент не найден'}, status=status.HTTP_404_NOT_FOUND)
    if student.role != User.STUDENT:
        return Response({'detail': 'В группу можно добавлять только учеников.'}, status=status.HTTP_400_BAD_REQUEST)
    if (
        not group.students.filter(pk=student.pk).exists()
        and group.capacity is not None
        and group.students.count() >= group.capacity
    ):
        return Response({'detail': 'В группе больше нет свободных мест.'}, status=status.HTTP_400_BAD_REQUEST)

    group.students.add(student)

    # Авто-запись на курсы группы
    for gc in group.group_courses.all():
        Enrollment.objects.get_or_create(user=student, course=gc.course)

    return Response(StudyGroupSerializer(group).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsTeacherOrAdmin])
@transaction.atomic
def group_remove_student(request, group_id, student_id):
    try:
        group = StudyGroup.objects.get(pk=group_id)
        student = User.objects.get(pk=student_id)
    except (StudyGroup.DoesNotExist, User.DoesNotExist):
        return Response({'detail': 'Группа или студент не найдены'}, status=status.HTTP_404_NOT_FOUND)

    forbidden = group_management_forbidden(request, group)
    if forbidden:
        return forbidden

    assigned_courses = list(group.group_courses.values_list('course_id', flat=True))
    group.students.remove(student)
    for course_id in assigned_courses:
        remaining_group_assignment = GroupCourse.objects.filter(
            course_id=course_id,
            group__students=student,
        ).exists()
        if not remaining_group_assignment:
            Enrollment.objects.filter(user=student, course_id=course_id).delete()
    return Response({'status': 'removed', 'group_id': group.id, 'student_id': student.id})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def group_join_by_code(request):
    code = (request.data.get('code') or '').strip().upper()
    if not code:
        return Response({'detail': 'code обязателен'}, status=status.HTTP_400_BAD_REQUEST)

    if request.user.role != User.STUDENT:
        return Response({'detail': 'В группу по коду может вступить только ученик.'}, status=status.HTTP_403_FORBIDDEN)
    return Response(
        {'detail': 'В группу учеников добавляет преподаватель.'},
        status=status.HTTP_403_FORBIDDEN,
    )


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsTeacherOrAdmin])
def group_assign_course(request, group_id):
    try:
        group = StudyGroup.objects.prefetch_related('students').get(pk=group_id)
    except StudyGroup.DoesNotExist:
        return Response({'detail': 'Группа не найдена'}, status=status.HTTP_404_NOT_FOUND)

    forbidden = group_management_forbidden(request, group)
    if forbidden:
        return forbidden

    course_id = request.data.get('course_id') or request.data.get('courseId')
    if not course_id:
        return Response({'detail': 'course_id обязателен'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        course = Course.objects.prefetch_related('lessons').get(pk=int(course_id))
    except Course.DoesNotExist:
        return Response({'detail': 'Курс не найден'}, status=status.HTTP_404_NOT_FOUND)
    if not can_manage_course(request.user, course):
        return Response(
            {'detail': 'Назначать можно только свой курс или курс, доступный администратору.'},
            status=status.HTTP_403_FORBIDDEN,
        )
    if course.status != 'published':
        return Response(
            {'detail': 'Группе можно назначить только опубликованный курс.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    GroupCourse.objects.get_or_create(group=group, course=course)

    for student in group.students.all():
        Enrollment.objects.get_or_create(user=student, course=course)

    return Response({
        'status': 'assigned',
        'group_id': group.id,
        'course_id': course.id,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsTeacherOrAdmin])
def group_progress_matrix(request, group_id, course_id):
    """
    Матрица успеваемости группы для преподавателя (Раздел 23 плана):
    - список уроков
    - процент сдачи каждым студентом
    """
    try:
        group = StudyGroup.objects.prefetch_related('students').get(pk=group_id)
        course = Course.objects.prefetch_related('lessons').get(pk=course_id)
    except (StudyGroup.DoesNotExist, Course.DoesNotExist):
        return Response({'detail': 'Группа или курс не найдены'}, status=status.HTTP_404_NOT_FOUND)

    forbidden = group_management_forbidden(request, group)
    if forbidden:
        return forbidden
    if not group.group_courses.filter(course=course).exists():
        return Response(
            {'detail': 'Этот курс ещё не назначен группе.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    students = list(group.students.all().order_by('id'))
    total_students = len(students)
    lessons = list(course.lessons.all().order_by('order', 'id'))
    group_access = {
        access.lesson_id: access.is_unlocked
        for access in GroupLessonAccess.objects.filter(
            group=group,
            lesson__in=lessons,
        )
    }

    progress_records = StudentLessonProgress.objects.filter(
        user__in=students,
        lesson__in=lessons,
        is_completed=True,
    ).values_list('user_id', 'lesson_id')

    completed_set = set(progress_records)

    lessons_stats = []
    for idx, lesson in enumerate(lessons):
        completed_count = sum(1 for s in students if (s.id, lesson.id) in completed_set)
        completion_rate = round((completed_count / max(1, total_students)) * 100) if total_students > 0 else 0

        lessons_stats.append({
            'lesson_id': lesson.id,
            'title': lesson.title,
            'order': lesson.order,
            'is_unlocked': group_access.get(lesson.id, False),
            'completed_students_count': completed_count,
            'total_students_count': total_students,
            'completion_rate': completion_rate,
        })

    students_matrix = []
    for s in students:
        s_lessons_progress = {}
        s_completed_count = 0
        for l in lessons:
            done = (s.id, l.id) in completed_set
            s_lessons_progress[l.id] = done
            if done:
                s_completed_count += 1

        overall_pct = round((s_completed_count / max(1, len(lessons))) * 100) if lessons else 0
        students_matrix.append({
            'id': s.id,
            'username': s.username,
            'name': s.name,
            'avatar_url': s.avatar_url,
            'lessons': s_lessons_progress,
            'completed_lessons_count': s_completed_count,
            'overall_progress': overall_pct,
        })

    return Response({
        'group': {'id': group.id, 'name': group.name, 'code': group.code},
        'course': {'id': course.id, 'title': course.title},
        'total_students': total_students,
        'lessons': lessons_stats,
        'students': students_matrix,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsTeacherOrAdmin])
def group_toggle_lesson_access(request, group_id, lesson_id):
    try:
        group = StudyGroup.objects.get(pk=group_id)
        lesson = Lesson.objects.get(pk=lesson_id)
    except (StudyGroup.DoesNotExist, Lesson.DoesNotExist):
        return Response({'detail': 'Группа или урок не найдены'}, status=status.HTTP_404_NOT_FOUND)

    forbidden = group_management_forbidden(request, group)
    if forbidden:
        return forbidden
    if lesson.course_id not in group.group_courses.values_list('course_id', flat=True):
        return Response(
            {'detail': 'Сначала назначьте группе курс, содержащий этот материал.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if not group.group_courses.filter(course_id=lesson.course_id).exists():
        return Response(
            {'detail': 'Сначала назначьте группе курс, содержащий этот материал.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    access, _ = GroupLessonAccess.objects.get_or_create(group=group, lesson=lesson)

    if 'is_unlocked' in request.data:
        access.is_unlocked = bool(request.data['is_unlocked'])
    else:
        access.is_unlocked = not access.is_unlocked

    if access.is_unlocked:
        access.unlocked_at = timezone.now()

    access.save()
    return Response({
        'status': 'updated',
        'access': GroupLessonAccessSerializer(access).data,
    })


# ==========================================
# 6. ЗАПИСЬ НА КУРС И СТУДЕНЧЕСКИЙ ПРОГРЕСС
# ==========================================

@api_view(['POST'])
@permission_classes([IsAuthenticated, IsTeacherOrAdmin])
def enroll(request):
    user_id = request.data.get('user_id') or request.data.get('userId')
    course_id = request.data.get('course_id') or request.data.get('courseId')
    if not user_id or not course_id:
        return Response({'detail': 'user_id и course_id обязательны'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        user_id = int(user_id)
        course_id = int(course_id)
    except (TypeError, ValueError):
        return Response({'detail': 'user_id и course_id должны быть целыми числами.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        user = User.objects.get(pk=user_id)
        course = Course.objects.get(pk=course_id)
    except User.DoesNotExist:
        return Response({'detail': 'Пользователь не найден'}, status=status.HTTP_404_NOT_FOUND)
    except Course.DoesNotExist:
        return Response({'detail': 'Курс не найден'}, status=status.HTTP_404_NOT_FOUND)

    if user.role != User.STUDENT:
        return Response({'detail': 'Назначать курс можно только ученику.'}, status=status.HTTP_400_BAD_REQUEST)
    if course.status != 'published':
        return Response(
            {'detail': 'Назначать можно только опубликованный курс.'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if not can_manage_course(request.user, course):
        return Response(
            {'detail': 'Назначать можно только свой курс или курс, доступный администратору.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    enrollment, _ = Enrollment.objects.get_or_create(user=user, course=course)
    return Response({'message': 'Enrolled successfully', 'enrolled': True})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_courses(request, user_id):
    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return Response([])

    if not IsSelfOrTeacherOrAdmin().has_object_permission(request, None, user):
        return Response({'detail': 'Нет доступа к курсам другого пользователя.'}, status=status.HTTP_403_FORBIDDEN)

    enrollments = (
        Enrollment.objects.filter(user=user)
        .select_related('course')
        .prefetch_related('course__lessons', 'course__blocks')
        .order_by('id')
    )
    return Response([course_list_item(en.course, enrollment=en, enrolled=True) for en in enrollments])


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def course_progress(request, user_id, course_id):
    user = User.objects.filter(pk=user_id).first()
    course = Course.objects.filter(pk=course_id).first()

    if not user:
        return Response({'detail': 'Пользователь не найден'}, status=status.HTTP_404_NOT_FOUND)
    if not course:
        return Response({'detail': 'Курс не найден'}, status=status.HTTP_404_NOT_FOUND)
    if not IsSelfOrTeacherOrAdmin().has_object_permission(request, None, user):
        return Response({'detail': 'Нет доступа к прогрессу другого пользователя.'}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'GET':
        enrollment = Enrollment.objects.filter(user=user, course=course).first()
        if not enrollment:
            return Response({
                'enrolled': False,
                'current_index': 0,
                'progress_percentage': 0,
                'completed_lessons': 0,
                'correct_answers': 0,
            })
        return Response({
            'enrolled': True,
            'current_index': enrollment.current_index,
            'progress_percentage': enrollment.progress_percentage,
            'completed_lessons': enrollment.completed_lessons,
            'correct_answers': enrollment.correct_answers,
            'learning_progress': course_learning_progress(user, course),
        })

    enrollment = Enrollment.objects.filter(user=user, course=course).first()
    if enrollment is None:
        return Response(
            {'detail': 'Курс вам не назначен преподавателем.'},
            status=status.HTTP_403_FORBIDDEN,
        )
    if not can_manage_course(request.user, course):
        return Response(
            {'detail': 'Изменять прогресс может только автор курса или администратор.'},
            status=status.HTTP_403_FORBIDDEN,
        )
    if user.role != User.STUDENT:
        return Response(
            {'detail': 'Прогресс можно изменять только для ученика.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    progress_fields = (
        ('current_index', ('current_index', 'currentIndex'), 0, None),
        ('completed_lessons', ('completed_lessons',), 0, None),
        ('progress_percentage', ('progress_percentage',), 0, 100),
        ('correct_answers', ('correct_answers', 'correctAnswers'), 0, None),
    )
    for field, aliases, minimum, maximum in progress_fields:
        value = next((request.data[key] for key in aliases if key in request.data), None)
        if value is None:
            continue
        try:
            parsed_value = int(value)
        except (TypeError, ValueError):
            return Response(
                {'detail': f'{field} должен быть целым числом.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if parsed_value < minimum or (maximum is not None and parsed_value > maximum):
            return Response(
                {'detail': f'{field} вне допустимого диапазона.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        setattr(enrollment, field, parsed_value)

    enrollment.save()

    return Response({
        'status': 'ok',
        'current_index': enrollment.current_index,
        'progress_percentage': enrollment.progress_percentage,
        'completed_lessons': enrollment.completed_lessons,
    })
