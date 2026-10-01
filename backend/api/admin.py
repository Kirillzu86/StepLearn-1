# AI-GENERATED: Antigravity
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import (
    Answer,
    Assignment,
    AssignmentTestCase,
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
    StudentProfile,
    StudyGroup,
    TeacherProfile,
    User,
)


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ('id', 'username', 'email', 'role', 'last_activity', 'is_staff', 'is_active')
    list_filter = ('role', 'is_staff', 'is_active')
    search_fields = ('username', 'email', 'first_name', 'last_name')
    fieldsets = UserAdmin.fieldsets + (
        ('StepLearn', {'fields': ('avatar_url', 'role', 'must_change_password')}),
    )


@admin.register(StudentProfile)
class StudentProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'created_at', 'updated_at')
    search_fields = ('user__username', 'user__first_name', 'user__last_name')


@admin.register(TeacherProfile)
class TeacherProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'created_at', 'updated_at')
    search_fields = ('user__username', 'user__first_name', 'user__last_name')


class AnswerInline(admin.TabularInline):
    model = Answer
    extra = 1


class QuestionInline(admin.StackedInline):
    model = Question
    extra = 1


class LessonInline(admin.TabularInline):
    model = Lesson
    extra = 1
    fields = ('order', 'block', 'title', 'lesson_type', 'is_mandatory')


class CourseBlockInline(admin.TabularInline):
    model = CourseBlock
    extra = 1
    fields = ('order', 'title', 'description')


@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ('id', 'title', 'category', 'level', 'status', 'rating')
    list_filter = ('category', 'level', 'status')
    search_fields = ('title', 'description')
    inlines = [CourseBlockInline, LessonInline]


@admin.register(CourseBlock)
class CourseBlockAdmin(admin.ModelAdmin):
    list_display = ('id', 'course', 'order', 'title', 'created_at')
    list_filter = ('course',)
    search_fields = ('title', 'description')


@admin.register(Lesson)
class LessonAdmin(admin.ModelAdmin):
    list_display = ('id', 'course', 'block', 'order', 'title', 'lesson_type', 'is_mandatory', 'created_at')
    list_filter = ('course', 'block', 'lesson_type', 'is_mandatory')
    search_fields = ('title', 'description', 'content')


class AssignmentTestCaseInline(admin.TabularInline):
    model = AssignmentTestCase
    extra = 0


@admin.register(Assignment)
class AssignmentAdmin(admin.ModelAdmin):
    list_display = ('id', 'title', 'course', 'assignment_type', 'is_published')
    list_filter = ('assignment_type', 'is_published', 'course')
    search_fields = ('title', 'description', 'course__title')
    inlines = [AssignmentTestCaseInline]


@admin.register(Exam)
class ExamAdmin(admin.ModelAdmin):
    list_display = ('id', 'title', 'course', 'block', 'passing_score', 'max_attempts', 'created_at')
    list_filter = ('course',)
    search_fields = ('title', 'description')
    inlines = [QuestionInline]


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ('id', 'course', 'lesson', 'exam', 'text')
    search_fields = ('text',)
    list_filter = ('course', 'exam')
    inlines = [AnswerInline]


@admin.register(Answer)
class AnswerAdmin(admin.ModelAdmin):
    list_display = ('id', 'question', 'text', 'is_correct')
    list_filter = ('is_correct',)


@admin.register(ExamAttempt)
class ExamAttemptAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'exam', 'score', 'passed', 'completed_at')
    list_filter = ('passed', 'exam')
    search_fields = ('user__username', 'exam__title')


@admin.register(Enrollment)
class EnrollmentAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'course', 'completed_lessons', 'progress_percentage', 'created_at')
    list_filter = ('course',)
    search_fields = ('user__username', 'user__email', 'course__title')


@admin.register(StudyGroup)
class StudyGroupAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'code', 'teacher', 'created_at')
    search_fields = ('name', 'code', 'teacher__username')
    filter_horizontal = ('students',)


@admin.register(GroupCourse)
class GroupCourseAdmin(admin.ModelAdmin):
    list_display = ('id', 'group', 'course', 'assigned_at')
    list_filter = ('group', 'course')


@admin.register(GroupLessonAccess)
class GroupLessonAccessAdmin(admin.ModelAdmin):
    list_display = ('id', 'group', 'lesson', 'is_unlocked', 'auto_unlock_when_all_pass', 'unlocked_at')
    list_filter = ('is_unlocked', 'auto_unlock_when_all_pass', 'group')


@admin.register(StudentLessonProgress)
class StudentLessonProgressAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'lesson', 'is_completed', 'completed_at')
    list_filter = ('is_completed', 'lesson__course')
    search_fields = ('user__username', 'lesson__title')
