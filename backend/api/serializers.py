# AI-GENERATED: Antigravity
import base64
import binascii

from django.db import transaction
import secrets

from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import (
    Answer,
    Assignment,
    AssignmentOption,
    AssignmentQuestion,
    AssignmentTestCase,
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


def can_view_course_answers(user, course):
    return bool(
        user
        and user.is_authenticated
        and (
            user.role == User.ADMIN
            or user.is_staff
            or user.is_superuser
            or (user.role == User.TEACHER and course.author_id == user.id)
        )
    )


class UserSerializer(serializers.ModelSerializer):
    name = serializers.CharField(read_only=True)
    is_teacher_or_admin = serializers.BooleanField(read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'name', 'first_name', 'last_name', 'email',
            'avatar_url', 'role', 'is_teacher_or_admin', 'is_staff',
            'must_change_password', 'last_activity'
        ]


class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=6)
    first_name = serializers.CharField(max_length=150, required=False, default='')
    last_name = serializers.CharField(max_length=150, required=False, default='')
    role = serializers.ChoiceField(choices=User.ROLE_CHOICES, default='student', required=False)

    def validate_username(self, value):
        value = value.strip()
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError('Пользователь с таким именем уже существует')
        return value

    def validate_email(self, value):
        value = value.strip().lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('Пользователь с таким email уже существует')
        return value

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


class LoginSerializer(serializers.Serializer):
    login = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        login = attrs['login'].strip()
        password = attrs['password']
        user = User.objects.filter(email__iexact=login).first() or User.objects.filter(username__iexact=login).first()
        if not user or not user.check_password(password) or not user.is_active:
            raise serializers.ValidationError('Неверный логин или пароль')
        attrs['user'] = user
        return attrs


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        user = self.context['request'].user
        if not user.check_password(attrs['current_password']):
            raise serializers.ValidationError({
                'current_password': 'Текущий пароль указан неверно.'
            })
        validate_password(attrs['new_password'], user)
        return attrs


class UserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['username', 'first_name', 'last_name', 'email', 'avatar_url']
        extra_kwargs = {
            'username': {'required': False},
            'first_name': {'required': False},
            'last_name': {'required': False},
            'email': {'required': False},
            'avatar_url': {'required': False, 'allow_null': True},
        }

    def validate_username(self, value):
        value = value.strip()
        qs = User.objects.filter(username__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError('Пользователь с таким именем уже существует')
        return value

    def validate_email(self, value):
        value = value.strip().lower()
        qs = User.objects.filter(email__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError('Пользователь с таким email уже существует')
        return value

    def validate_avatar_url(self, value):
        if not value:
            return value
        if isinstance(value, str) and value.startswith('data:') and ';base64,' in value:
            try:
                decoded = base64.b64decode(value.split(',', 1)[1], validate=True)
            except (IndexError, binascii.Error):
                raise serializers.ValidationError('Неверный формат изображения')
            if len(decoded) > 5 * 1024 * 1024:
                raise serializers.ValidationError('Размер аватара не должен превышать 5MB')
        return value


class AnswerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Answer
        fields = ['id', 'text', 'is_correct']


class StudentAnswerSerializer(serializers.ModelSerializer):
    """Скрывает правильный ответ для студента во время тестирования"""
    class Meta:
        model = Answer
        fields = ['id', 'text']


class AnswerInputSerializer(serializers.Serializer):
    text = serializers.CharField()
    is_correct = serializers.BooleanField(default=False)


class QuestionSerializer(serializers.ModelSerializer):
    answers = AnswerSerializer(many=True, read_only=True)

    class Meta:
        model = Question
        fields = ['id', 'text', 'answers', 'lesson_id', 'exam_id']


class StudentQuestionSerializer(serializers.ModelSerializer):
    answers = StudentAnswerSerializer(many=True, read_only=True)

    class Meta:
        model = Question
        fields = ['id', 'text', 'answers']


class QuestionInputSerializer(serializers.Serializer):
    text = serializers.CharField()
    lesson_id = serializers.IntegerField(required=False, allow_null=True)
    exam_id = serializers.IntegerField(required=False, allow_null=True)
    answers = AnswerInputSerializer(many=True, required=False, default=list)


class CourseQuestionInputSerializer(serializers.Serializer):
    text = serializers.CharField()
    answers = AnswerInputSerializer(many=True, required=False, default=list)

    def validate_answers(self, answers):
        if len(answers) < 2:
            raise serializers.ValidationError('Для вопроса нужны как минимум два варианта ответа.')
        if not any(answer['is_correct'] for answer in answers):
            raise serializers.ValidationError('Для вопроса нужен хотя бы один правильный ответ.')
        return answers


class ExamSerializer(serializers.ModelSerializer):
    questions_count = serializers.IntegerField(source='questions.count', read_only=True)
    block_title = serializers.CharField(source='block.title', read_only=True, default='')

    class Meta:
        model = Exam
        fields = [
            'id', 'course_id', 'block_id', 'block_title', 'title',
            'description', 'passing_score', 'max_attempts', 'questions_count', 'created_at'
        ]


class ExamDetailSerializer(serializers.ModelSerializer):
    questions = serializers.SerializerMethodField()
    block_title = serializers.CharField(source='block.title', read_only=True, default='')

    class Meta:
        model = Exam
        fields = [
            'id', 'course_id', 'block_id', 'block_title', 'title',
            'description', 'passing_score', 'max_attempts', 'questions', 'created_at'
        ]

    def get_questions(self, obj):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if can_view_course_answers(user, obj.course):
            return QuestionSerializer(obj.questions.all(), many=True).data
        return StudentQuestionSerializer(obj.questions.all(), many=True).data


class ExamAttemptSerializer(serializers.ModelSerializer):
    exam_title = serializers.CharField(source='exam.title', read_only=True)
    user_name = serializers.CharField(source='user.name', read_only=True)

    class Meta:
        model = ExamAttempt
        fields = ['id', 'user_id', 'user_name', 'exam_id', 'exam_title', 'score', 'passed', 'completed_at']


class LessonSerializer(serializers.ModelSerializer):
    course_id = serializers.IntegerField(source='course.id', read_only=True)
    block_title = serializers.CharField(source='block.title', read_only=True, default=None)
    questions = serializers.SerializerMethodField()

    class Meta:
        model = Lesson
        fields = [
            'id', 'course_id', 'block_id', 'block_title', 'title', 'description',
            'content', 'lesson_type', 'is_mandatory', 'order', 'questions', 'created_at'
        ]

    def get_questions(self, obj):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if can_view_course_answers(user, obj.course):
            return QuestionSerializer(obj.questions.all(), many=True).data
        return StudentQuestionSerializer(obj.questions.all(), many=True).data


class CourseBlockSerializer(serializers.ModelSerializer):
    lessons = LessonSerializer(many=True, read_only=True)
    exam = ExamSerializer(read_only=True)
    lessons_count = serializers.IntegerField(source='lessons.count', read_only=True)

    class Meta:
        model = CourseBlock
        fields = ['id', 'course_id', 'title', 'description', 'order', 'lessons_count', 'lessons', 'exam', 'created_at']


class CourseSerializer(serializers.ModelSerializer):
    author_id = serializers.IntegerField(source='author.id', read_only=True, allow_null=True)
    author_name = serializers.CharField(source='author.name', read_only=True, default='')
    lessons_count = serializers.IntegerField(source='lessons.count', read_only=True)
    blocks_count = serializers.IntegerField(source='blocks.count', read_only=True)

    class Meta:
        model = Course
        fields = [
            'id', 'title', 'description', 'price', 'rating', 'category', 'level',
            'status', 'cover_image', 'author_id', 'author_name', 'content', 'course_type',
            'blocks_count', 'lessons_count', 'created_at'
        ]


class CourseWithDetailsSerializer(serializers.ModelSerializer):
    blocks = CourseBlockSerializer(many=True, read_only=True)
    lessons = LessonSerializer(many=True, read_only=True)
    author_id = serializers.IntegerField(source='author.id', read_only=True, allow_null=True)
    author_name = serializers.CharField(source='author.name', read_only=True, default='')

    class Meta:
        model = Course
        fields = [
            'id', 'title', 'description', 'price', 'rating', 'category', 'level',
            'status', 'cover_image', 'author_id', 'author_name', 'content', 'course_type',
            'blocks', 'lessons'
        ]


class CourseCreateSerializer(serializers.ModelSerializer):
    author_id = serializers.IntegerField(read_only=True)
    category = serializers.CharField(required=False, default='Программирование')
    level = serializers.CharField(required=False, default='beginner')
    status = serializers.CharField(required=False, default='published')
    cover_image = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    questions = CourseQuestionInputSerializer(many=True, required=False, write_only=True)

    class Meta:
        model = Course
        fields = [
            'id', 'title', 'description', 'price', 'author_id', 'category',
            'level', 'status', 'cover_image', 'content', 'course_type', 'questions'
        ]
        read_only_fields = ['id']

    @transaction.atomic
    def create(self, validated_data):
        questions_data = validated_data.pop('questions', [])
        course = Course.objects.create(**validated_data)
        for question_data in questions_data:
            answers_data = question_data.pop('answers', [])
            question = Question.objects.create(course=course, text=question_data['text'])
            Answer.objects.bulk_create([
                Answer(question=question, text=answer_data['text'], is_correct=answer_data['is_correct'])
                for answer_data in answers_data
            ])
        return course


class CourseUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Course
        fields = [
            'title', 'description', 'price', 'category', 'level',
            'status', 'cover_image', 'content', 'course_type',
        ]


class AssignmentSerializer(serializers.ModelSerializer):
    max_attempts = serializers.IntegerField(min_value=1, default=3)
    course_id = serializers.IntegerField(read_only=True)
    lesson_id = serializers.PrimaryKeyRelatedField(
        source='lesson',
        queryset=Lesson.objects.all(),
        required=False,
        allow_null=True,
    )

    class Meta:
        model = Assignment
        fields = [
            'id', 'course_id', 'lesson_id', 'title', 'description',
            'assignment_type', 'points', 'max_attempts', 'is_published',
            'due_at', 'programming_language', 'starter_code', 'hints',
            'time_limit_seconds', 'memory_limit_mb', 'created_at',
        ]
        read_only_fields = ['id', 'course_id', 'created_at', 'assignment_type']

    def validate_lesson_id(self, lesson):
        course = self.context.get('course') or getattr(self.instance, 'course', None)
        if lesson and course and lesson.course_id != course.id:
            raise serializers.ValidationError('Урок должен принадлежать этому курсу.')
        return lesson


class AssignmentOptionInputSerializer(serializers.Serializer):
    text = serializers.CharField(trim_whitespace=True, allow_blank=False)
    is_correct = serializers.BooleanField()


class AssignmentQuestionInputSerializer(serializers.Serializer):
    text = serializers.CharField(trim_whitespace=True, allow_blank=False)
    options = AssignmentOptionInputSerializer(many=True, min_length=2)


class AssignmentOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AssignmentOption
        fields = ['id', 'text', 'is_correct']


class AssignmentQuestionTeacherSerializer(serializers.ModelSerializer):
    options = AssignmentOptionSerializer(many=True, read_only=True)

    class Meta:
        model = AssignmentQuestion
        fields = ['id', 'text', 'order', 'options']


class AssignmentQuestionStudentSerializer(serializers.ModelSerializer):
    options = serializers.SerializerMethodField()

    class Meta:
        model = AssignmentQuestion
        fields = ['id', 'text', 'order', 'options']

    def get_options(self, obj):
        return [
            {'id': option.id, 'text': option.text}
            for option in obj.options.all()
        ]


class AssignmentTestCaseSerializer(serializers.ModelSerializer):
    class Meta:
        model = AssignmentTestCase
        fields = ['id', 'input_data', 'expected_output', 'order']


class AssignmentTeacherSerializer(AssignmentSerializer):
    questions = AssignmentQuestionTeacherSerializer(many=True, read_only=True)
    test_cases = AssignmentTestCaseSerializer(many=True, read_only=True)

    class Meta(AssignmentSerializer.Meta):
        fields = AssignmentSerializer.Meta.fields + ['questions', 'test_cases']


class AssignmentStudentSerializer(AssignmentSerializer):
    questions = AssignmentQuestionStudentSerializer(many=True, read_only=True)

    class Meta(AssignmentSerializer.Meta):
        fields = AssignmentSerializer.Meta.fields + ['questions']


class AssignmentTestCaseInputSerializer(serializers.Serializer):
    input_data = serializers.CharField(
        required=False,
        allow_blank=True,
        trim_whitespace=False,
        max_length=10000,
    )
    expected_output = serializers.CharField(
        allow_blank=True,
        trim_whitespace=False,
        max_length=10000,
    )


class AssignmentCreateSerializer(serializers.ModelSerializer):
    max_attempts = serializers.IntegerField(min_value=1, default=3)
    hints = serializers.ListField(
        child=serializers.CharField(
            max_length=1000,
            trim_whitespace=True,
            allow_blank=False,
        ),
        required=False,
        allow_empty=True,
        max_length=20,
    )
    time_limit_seconds = serializers.IntegerField(min_value=1, max_value=30, default=5)
    memory_limit_mb = serializers.IntegerField(min_value=16, max_value=512, default=128)
    test_cases = AssignmentTestCaseInputSerializer(
        many=True,
        required=False,
        allow_empty=True,
        max_length=100,
    )
    lesson_id = serializers.PrimaryKeyRelatedField(
        source='lesson',
        queryset=Lesson.objects.all(),
        required=False,
        allow_null=True,
    )
    questions = AssignmentQuestionInputSerializer(many=True, required=False, allow_empty=False)

    class Meta:
        model = Assignment
        fields = [
            'id', 'lesson_id', 'title', 'description', 'assignment_type',
            'points', 'max_attempts', 'is_published', 'due_at', 'questions',
            'programming_language', 'starter_code', 'hints',
            'time_limit_seconds', 'memory_limit_mb', 'test_cases',
        ]
        read_only_fields = ['id']

    def validate_lesson_id(self, lesson):
        course = self.context['course']
        if lesson and lesson.course_id != course.id:
            raise serializers.ValidationError('Урок должен принадлежать этому курсу.')
        return lesson

    def validate_assignment_type(self, assignment_type):
        if self.instance and assignment_type != self.instance.assignment_type:
            raise serializers.ValidationError('Тип задания нельзя изменить после его создания.')
        return assignment_type

    def validate(self, attrs):
        assignment_type = attrs.get(
            'assignment_type',
            self.instance.assignment_type if self.instance else Assignment.TYPE_TEXT,
        )
        questions = attrs.get(
            'questions',
            None if self.instance else [],
        )
        objective_types = {Assignment.TYPE_QUIZ, Assignment.TYPE_MULTIPLE_CHOICE}
        if assignment_type in objective_types and questions == []:
            raise serializers.ValidationError({
                'questions': 'Для тестового задания требуется хотя бы один вопрос.'
            })
        if assignment_type not in objective_types and questions:
            raise serializers.ValidationError({
                'questions': 'Вопросы с вариантами доступны только для тестовых заданий.'
            })
        test_cases = attrs.get('test_cases', None)
        if assignment_type != Assignment.TYPE_CODE and test_cases is not None:
            raise serializers.ValidationError({
                'test_cases': 'Скрытые тесты доступны только для Code Assignment.'
            })
        if test_cases is not None:
            test_case_serializer = AssignmentTestCaseInputSerializer(
                data=test_cases,
                many=True,
            )
            test_case_serializer.is_valid(raise_exception=True)
            attrs['test_cases'] = test_case_serializer.validated_data
        code_fields = {
            'programming_language',
            'starter_code',
            'hints',
            'time_limit_seconds',
            'memory_limit_mb',
        }
        if (
            assignment_type != Assignment.TYPE_CODE
            and code_fields.intersection(self.initial_data)
        ):
            raise serializers.ValidationError({
                'assignment_type': 'Параметры кода доступны только для Code Assignment.'
            })
        for question in questions or []:
            correct_count = sum(option['is_correct'] for option in question['options'])
            if correct_count == 0:
                raise serializers.ValidationError({
                    'questions': 'У каждого вопроса должен быть правильный вариант.'
                })
            if assignment_type == Assignment.TYPE_QUIZ and correct_count != 1:
                raise serializers.ValidationError({
                    'questions': 'В quiz у каждого вопроса должен быть ровно один правильный вариант.'
                })
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        questions_data = validated_data.pop('questions', [])
        test_cases_data = validated_data.pop('test_cases', [])
        course = validated_data.pop('course', self.context['course'])
        assignment = Assignment.objects.create(
            course=course,
            **validated_data,
        )
        self._replace_test_cases(assignment, test_cases_data)
        for question_order, question_data in enumerate(questions_data, start=1):
            options_data = question_data.pop('options')
            question = AssignmentQuestion.objects.create(
                assignment=assignment,
                order=question_order,
                **question_data,
            )
            AssignmentOption.objects.bulk_create([
                AssignmentOption(question=question, **option_data)
                for option_data in options_data
            ])
        return assignment

    @transaction.atomic
    def update(self, instance, validated_data):
        questions_data = validated_data.pop('questions', None)
        test_cases_data = validated_data.pop('test_cases', None)
        instance = super().update(instance, validated_data)
        if test_cases_data is not None:
            self._replace_test_cases(instance, test_cases_data)
        if questions_data is not None:
            instance.questions.all().delete()
            for question_order, question_data in enumerate(questions_data, start=1):
                options_data = question_data.pop('options')
                question = AssignmentQuestion.objects.create(
                    assignment=instance,
                    order=question_order,
                    **question_data,
                )
                AssignmentOption.objects.bulk_create([
                    AssignmentOption(question=question, **option_data)
                    for option_data in options_data
                ])
        return instance

    @staticmethod
    def _replace_test_cases(assignment, test_cases_data):
        assignment.test_cases.all().delete()
        AssignmentTestCase.objects.bulk_create([
            AssignmentTestCase(assignment=assignment, order=index, **test_case)
            for index, test_case in enumerate(test_cases_data, start=1)
        ])


class AssignmentSubmissionSerializer(serializers.ModelSerializer):
    assignment_id = serializers.IntegerField(read_only=True)
    student_id = serializers.IntegerField(read_only=True)
    response_data = serializers.JSONField(read_only=True)
    has_file = serializers.SerializerMethodField()

    class Meta:
        model = AssignmentSubmission
        fields = [
            'id', 'assignment_id', 'student_id', 'answer_text', 'response_data', 'status',
            'score', 'feedback', 'has_file', 'original_file_name', 'submitted_at', 'graded_at',
        ]
        read_only_fields = fields

    def get_has_file(self, obj):
        return bool(obj.uploaded_file)



class AssignmentAnswerInputSerializer(serializers.Serializer):
    question_id = serializers.IntegerField(min_value=1)
    option_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        min_length=1,
        allow_empty=False,
    )


class AssignmentSubmissionCreateSerializer(serializers.Serializer):
    answer_text = serializers.CharField(required=False, trim_whitespace=True, allow_blank=False)
    source_code = serializers.CharField(
        required=False,
        trim_whitespace=False,
        allow_blank=False,
        max_length=50000,
        write_only=True,
    )
    file = serializers.FileField(required=False, write_only=True)
    answers = AssignmentAnswerInputSerializer(many=True, required=False, allow_empty=False)

    def validate_file(self, uploaded_file):
        if uploaded_file.size > 10 * 1024 * 1024:
            raise serializers.ValidationError('Максимальный размер файла — 10 МБ.')
        suffix = uploaded_file.name.rsplit('.', 1)[-1].lower() if '.' in uploaded_file.name else ''
        uploaded_file.seek(0)
        header = uploaded_file.read(16)
        uploaded_file.seek(0)

        valid = (
            (suffix == 'pdf' and header.startswith(b'%PDF-'))
            or (suffix == 'png' and header.startswith(b'\x89PNG\r\n\x1a\n'))
            or (suffix in {'jpg', 'jpeg'} and header.startswith(b'\xff\xd8\xff'))
        )
        if suffix == 'txt':
            try:
                for chunk in uploaded_file.chunks():
                    chunk.decode('utf-8')
                valid = True
            except UnicodeDecodeError:
                valid = False
            finally:
                uploaded_file.seek(0)
        if not valid:
            raise serializers.ValidationError('Допустимы только корректные PDF, TXT, PNG или JPEG файлы.')
        return uploaded_file

    def validate(self, attrs):
        assignment = self.context['assignment']
        is_objective = assignment.assignment_type in {
            Assignment.TYPE_QUIZ,
            Assignment.TYPE_MULTIPLE_CHOICE,
        }
        if assignment.assignment_type == Assignment.TYPE_CODE:
            if 'source_code' not in attrs or {'answer_text', 'answers', 'file'}.intersection(attrs):
                raise serializers.ValidationError({
                    'source_code': 'Для Code Assignment отправьте исходный код.'
                })
            return attrs
        if assignment.assignment_type == Assignment.TYPE_FILE_UPLOAD:
            if 'file' not in attrs or {'answers', 'answer_text', 'source_code'}.intersection(attrs):
                raise serializers.ValidationError({
                    'file': 'Для этого задания приложите один файл.'
                })
            return attrs
        if is_objective:
            if 'answers' not in attrs or {'answer_text', 'file', 'source_code'}.intersection(attrs):
                raise serializers.ValidationError({
                    'answers': 'Для тестового задания отправьте выбранные варианты по каждому вопросу.'
                })
        elif (
            'answer_text' not in attrs
            or {'answers', 'file', 'source_code'}.intersection(attrs)
        ):
            raise serializers.ValidationError({
                'answer_text': 'Для этого задания требуется текстовый ответ.'
            })
        return attrs


class AssignmentSubmissionGradeSerializer(serializers.ModelSerializer):
    score = serializers.IntegerField(min_value=0, required=True)

    class Meta:
        model = AssignmentSubmission
        fields = ['score', 'feedback']

    def validate_score(self, score):
        if score > self.instance.assignment.points:
            raise serializers.ValidationError('Оценка не может превышать количество баллов задания.')
        return score


class QuickCreateStudentSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    group_id = serializers.IntegerField(required=False, allow_null=True)

    def validate_first_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Имя обязательно.')
        return value

    def validate_last_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Фамилия обязательна.')
        return value

    def validate_group_id(self, value):
        if value is None:
            return value
        request = self.context['request']
        groups = StudyGroup.objects.filter(pk=value)
        if request.user.role == User.TEACHER and not request.user.is_superuser:
            groups = groups.filter(teacher=request.user)
        group = groups.first()
        if group is None:
            raise serializers.ValidationError('Группа не найдена или недоступна.')
        if group.capacity is not None and group.students.count() >= group.capacity:
            raise serializers.ValidationError('В группе больше нет свободных мест.')
        return value

    def create(self, validated_data):
        first_name = validated_data['first_name'].strip()
        last_name = validated_data['last_name'].strip()
        group_id = validated_data.get('group_id')

        while True:
            username = f'student_{secrets.token_hex(4)}'
            email = f'{username}@steplearn.local'
            if not User.objects.filter(username=username).exists() and not User.objects.filter(email=email).exists():
                break

        password = secrets.token_urlsafe(12)

        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
            role='student',
            must_change_password=True,
        )

        group = None
        if group_id:
            group = StudyGroup.objects.filter(pk=group_id).first()
            group.students.add(user)
            for group_course in group.group_courses.all():
                Enrollment.objects.get_or_create(user=user, course=group_course.course)

        return {
            'user': UserSerializer(user).data,
            'username': username,
            'password': password,
            'first_name': first_name,
            'last_name': last_name,
            'group_id': group.id if group else None,
            'group_name': group.name if group else None,
        }


class GroupRosterStudentSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)

    def validate_first_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Имя обязательно.')
        return value

    def validate_last_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Фамилия обязательна.')
        return value


class GroupCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=150)
    description = serializers.CharField(required=False, allow_blank=True, default='')
    capacity = serializers.IntegerField(required=False, allow_null=True, min_value=1, max_value=100)
    students = GroupRosterStudentSerializer(many=True, required=False, default=list, max_length=100)

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Название группы обязательно.')
        return value

    def validate(self, attrs):
        capacity = attrs.get('capacity')
        students = attrs.get('students', [])
        if capacity is not None and len(students) > capacity:
            raise serializers.ValidationError({
                'students': 'Количество учеников превышает вместимость группы.'
            })
        return attrs


class EnrollmentProgressSerializer(serializers.Serializer):
    currentIndex = serializers.IntegerField(required=False)
    current_index = serializers.IntegerField(required=False)
    progress_percentage = serializers.IntegerField(required=False)
    correctAnswers = serializers.IntegerField(required=False)
    correct_answers = serializers.IntegerField(required=False)
    completed_lessons = serializers.IntegerField(required=False)


class GroupLessonAccessSerializer(serializers.ModelSerializer):
    lesson_id = serializers.IntegerField(source='lesson.id', read_only=True)
    lesson_title = serializers.CharField(source='lesson.title', read_only=True)
    lesson_order = serializers.IntegerField(source='lesson.order', read_only=True)

    class Meta:
        model = GroupLessonAccess
        fields = [
            'id', 'lesson_id', 'lesson_title', 'lesson_order',
            'is_unlocked', 'unlocked_at', 'auto_unlock_when_all_pass'
        ]


class StudyGroupSerializer(serializers.ModelSerializer):
    teacher_name = serializers.CharField(source='teacher.name', read_only=True)
    teacher_id = serializers.IntegerField(source='teacher.id', read_only=True)
    students_count = serializers.IntegerField(source='students.count', read_only=True)
    students = UserSerializer(many=True, read_only=True)
    courses = serializers.SerializerMethodField()

    class Meta:
        model = StudyGroup
        fields = [
            'id', 'name', 'description', 'code', 'teacher_id', 'teacher_name',
            'capacity', 'students_count', 'students', 'courses', 'created_at'
        ]

    def get_courses(self, obj):
        return [
            {
                'id': gc.course.id,
                'title': gc.course.title,
                'assigned_at': gc.assigned_at,
                'lessons_count': gc.course.lessons.count()
            }
            for gc in obj.group_courses.select_related('course').all()
        ]
