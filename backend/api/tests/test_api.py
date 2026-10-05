import tempfile
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework.test import APITestCase

from api.models import (
    Answer,
    Assignment,
    AssignmentSubmission,
    AssignmentTestCase,
    Course,
    CourseBlock,
    Enrollment,
    Exam,
    ExamAttempt,
    GroupCourse,
    Lesson,
    Question,
    StudentProfile,
    StudentLessonProgress,
    StudyGroup,
    TeacherProfile,
    User,
)


class StepLearnAPITests(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username='student', email='student@example.com', password='secret123'
        )
        self.course = Course.objects.create(title='Python', description='Basics', price=0)
        question = Question.objects.create(course=self.course, text='2 + 2 = ?')
        Answer.objects.create(question=question, text='4', is_correct=True)
        Answer.objects.create(question=question, text='5', is_correct=False)

    def test_health_endpoint_checks_database(self):
        response = self.client.get('/health/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, {'status': 'ok', 'database': 'ok'})

    def test_role_profiles_are_created_for_student_and_teacher_accounts(self):
        self.assertEqual(
            set(value for value, _ in User.ROLE_CHOICES),
            {User.ADMIN, User.TEACHER, User.STUDENT},
        )
        self.assertTrue(StudentProfile.objects.filter(user=self.user).exists())
        self.assertFalse(TeacherProfile.objects.filter(user=self.user).exists())

        teacher = get_user_model().objects.create_user(
            username='profile_teacher',
            email='profile-teacher@example.com',
            password='secret123',
            role=User.TEACHER,
        )
        self.assertTrue(TeacherProfile.objects.filter(user=teacher).exists())
        self.assertFalse(StudentProfile.objects.filter(user=teacher).exists())

    def test_admin_role_can_access_teacher_api_and_is_in_jwt(self):
        admin = get_user_model().objects.create_user(
            username='role_admin',
            email='role-admin@example.com',
            password='secret123',
            role=User.ADMIN,
        )
        login_response = self.client.post('/api/auth/login', {
            'login': admin.username,
            'password': 'secret123',
        }, format='json')

        self.assertEqual(login_response.status_code, 200)
        self.assertEqual(login_response.data['role'], User.ADMIN)
        from rest_framework_simplejwt.tokens import AccessToken
        self.assertEqual(AccessToken(login_response.data['access'])['role'], User.ADMIN)

        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}"
        )
        self.assertEqual(self.client.get('/api/v1/teacher/dashboard').status_code, 200)

    def test_student_registration_is_disabled(self):
        response = self.client.post('/api/auth/register', {
            'username': 'newuser', 'email': 'new@example.com', 'password': 'secret123'
        }, format='json')
        self.assertEqual(response.status_code, 404)
        self.assertFalse(get_user_model().objects.filter(username='newuser').exists())

    def test_student_registration_is_disabled_without_api_prefix(self):
        response = self.client.post('/auth/register', {
            'username': 'student', 'email': 'other@example.com', 'password': 'secret123'
        }, format='json')
        self.assertEqual(response.status_code, 404)

    def test_teacher_registration_requires_admin(self):
        payload = {
            'username': 'new_teacher',
            'email': 'new-teacher@example.com',
            'password': 'secret123',
        }
        self.assertEqual(
            self.client.post('/api/auth/teacher/register', payload, format='json').status_code,
            401,
        )
        self.assertEqual(
            self.client.post('/auth/teacher/register', payload, format='json').status_code,
            401,
        )
        self.assertFalse(get_user_model().objects.filter(username='new_teacher').exists())

        teacher = get_user_model().objects.create_user(
            username='existing_teacher',
            email='existing-teacher@example.com',
            password='secret123',
            role=User.TEACHER,
            is_staff=True,
        )
        teacher_login = self.client.post('/api/auth/login', {
            'login': teacher.username,
            'password': 'secret123',
        }, format='json')
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {teacher_login.data['access']}"
        )
        forbidden = self.client.post(
            '/api/auth/teacher/register',
            payload,
            format='json',
        )
        self.assertEqual(forbidden.status_code, 403)
        self.assertFalse(get_user_model().objects.filter(username='new_teacher').exists())

        admin = get_user_model().objects.create_user(
            username='teacher_creator_admin',
            email='teacher-creator-admin@example.com',
            password='secret123',
            role=User.ADMIN,
        )
        admin_login = self.client.post('/api/auth/login', {
            'login': admin.username,
            'password': 'secret123',
        }, format='json')
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {admin_login.data['access']}"
        )
        created = self.client.post(
            '/api/auth/teacher/register',
            payload,
            format='json',
        )
        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.data['role'], User.TEACHER)
        self.assertTrue(
            get_user_model().objects.get(username='new_teacher').check_password('secret123')
        )

    def test_login_by_username_and_email(self):
        # Username
        resp1 = self.client.post('/auth/login', {
            'login': 'student', 'password': 'secret123'
        }, format='json')
        self.assertEqual(resp1.status_code, 200)
        self.assertEqual(resp1.data['username'], 'student')
        self.assertIn('access', resp1.data)
        self.assertIn('refresh', resp1.data)
        from rest_framework_simplejwt.tokens import AccessToken
        token = AccessToken(resp1.data['access'])
        self.assertEqual(token['user_id'], str(self.user.id))
        self.assertEqual(token['username'], self.user.username)
        self.assertEqual(token['role'], self.user.role)

        # Email
        resp2 = self.client.post('/api/auth/login', {
            'login': 'student@example.com', 'password': 'secret123'
        }, format='json')
        self.assertEqual(resp2.status_code, 200)
        self.assertEqual(resp2.data['email'], 'student@example.com')
        self.assertIn('access', resp2.data)

    def test_refresh_and_logout_tokens(self):
        login_response = self.client.post('/auth/login', {
            'login': 'student', 'password': 'secret123'
        }, format='json')
        refresh = login_response.data['refresh']

        refresh_response = self.client.post('/auth/refresh', {
            'refresh': refresh
        }, format='json')
        self.assertEqual(refresh_response.status_code, 200)
        self.assertIn('access', refresh_response.data)

        logout_response = self.client.post('/auth/logout', {
            'refresh': refresh
        }, format='json')
        self.assertEqual(logout_response.status_code, 205)

        rejected_refresh = self.client.post('/auth/refresh', {
            'refresh': refresh
        }, format='json')
        self.assertEqual(rejected_refresh.status_code, 401)

    def test_login_invalid_password_returns_detail(self):
        response = self.client.post('/auth/login', {
            'login': 'student', 'password': 'wrongpassword'
        }, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('detail', response.data)

    def test_teacher_management_requires_authentication_and_teacher_role(self):
        path = '/api/v1/teacher/dashboard'
        self.assertEqual(self.client.get(path).status_code, 401)

        token_response = self.client.post('/api/auth/login', {
            'login': 'student', 'password': 'secret123'
        }, format='json')
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token_response.data['access']}")
        self.assertEqual(self.client.get(path).status_code, 403)

    def test_teacher_can_access_student_management(self):
        teacher = get_user_model().objects.create_user(
            username='teacher', email='teacher@example.com',
            password='secret123', role='teacher',
        )
        token_response = self.client.post('/api/auth/login', {
            'login': teacher.username, 'password': 'secret123'
        }, format='json')
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token_response.data['access']}")

        dashboard_response = self.client.get('/api/v1/teacher/dashboard')
        students_response = self.client.get('/api/v1/teacher/students')
        self.assertEqual(dashboard_response.status_code, 200)
        self.assertEqual(students_response.status_code, 200)
        student_summary = next(
            item for item in students_response.data if item['id'] == self.user.id
        )
        self.assertEqual(student_summary['progress_percent'], 0)
        self.assertEqual(student_summary['completed_lessons'], 0)

    def test_teacher_can_edit_student_profile_but_not_teacher_account(self):
        teacher = get_user_model().objects.create_user(
            username='editing_teacher',
            email='editing-teacher@example.com',
            password='secret123',
            role=User.TEACHER,
        )
        other_teacher = get_user_model().objects.create_user(
            username='protected_teacher',
            email='protected-teacher@example.com',
            password='secret123',
            role=User.TEACHER,
        )
        login = self.client.post('/api/auth/login', {
            'login': teacher.username,
            'password': 'secret123',
        }, format='json')
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")

        updated = self.client.patch(
            f'/api/v1/teacher/students/{self.user.id}',
            {
                'first_name': 'Новое имя',
                'last_name': 'Новая фамилия',
                'email': 'updated-student@example.com',
            },
            format='json',
        )
        self.assertEqual(updated.status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, 'Новое имя')
        self.assertEqual(self.user.email, 'updated-student@example.com')

        forbidden_target = self.client.patch(
            f'/api/v1/teacher/students/{other_teacher.id}',
            {'first_name': 'Не должно измениться'},
            format='json',
        )
        self.assertEqual(forbidden_target.status_code, 404)
        other_teacher.refresh_from_db()
        self.assertEqual(other_teacher.first_name, '')

    def test_teacher_can_archive_and_restore_student_without_losing_history(self):
        teacher = get_user_model().objects.create_user(
            username='archive_teacher',
            email='archive-teacher@example.com',
            password='secret123',
            role=User.TEACHER,
        )
        lesson = Lesson.objects.create(course=self.course, title='Completed lesson', order=1)
        enrollment = Enrollment.objects.create(user=self.user, course=self.course)
        progress = StudentLessonProgress.objects.create(
            user=self.user,
            lesson=lesson,
            is_completed=True,
        )
        original_login = self.client.post('/api/auth/login', {
            'login': self.user.username,
            'password': 'secret123',
        }, format='json')
        self.assertEqual(original_login.status_code, 200)

        self.client.force_authenticate(user=teacher)
        invalid_payload = self.client.post(
            f'/api/v1/teacher/students/{self.user.id}/archive',
            {'is_archived': 'yes'},
            format='json',
        )
        self.assertEqual(invalid_payload.status_code, 400)

        archived = self.client.post(
            f'/api/v1/teacher/students/{self.user.id}/archive',
            {'is_archived': True},
            format='json',
        )
        self.assertEqual(archived.status_code, 200)
        self.assertTrue(archived.data['is_archived'])
        self.user.refresh_from_db()
        self.assertTrue(self.user.is_archived)
        self.assertTrue(self.user.is_active)
        self.assertTrue(Enrollment.objects.filter(pk=enrollment.pk).exists())
        self.assertTrue(StudentLessonProgress.objects.filter(pk=progress.pk).exists())

        self.assertEqual(
            self.client.post(
                f'/api/v1/teacher/students/{self.user.id}/toggle-status'
            ).status_code,
            409,
        )
        default_list = self.client.get('/api/v1/teacher/students')
        archived_list = self.client.get('/api/v1/teacher/students?include_archived=1')
        self.assertNotIn(self.user.id, [item['id'] for item in default_list.data])
        archived_student = next(item for item in archived_list.data if item['id'] == self.user.id)
        self.assertTrue(archived_student['is_archived'])

        self.client.force_authenticate(user=None)
        self.client.credentials(HTTP_AUTHORIZATION=f"******{original_login.data['access']}")
        self.assertEqual(self.client.get('/api/v1/teacher/dashboard').status_code, 401)
        self.client.credentials()
        self.assertEqual(
            self.client.post('/api/auth/login', {
                'login': self.user.username,
                'password': 'secret123',
            }, format='json').status_code,
            400,
        )
        self.assertEqual(
            self.client.post('/api/auth/refresh', {
                'refresh': original_login.data['refresh'],
            }, format='json').status_code,
            401,
        )

        self.client.force_authenticate(user=teacher)
        restored = self.client.post(
            f'/api/v1/teacher/students/{self.user.id}/archive',
            {'is_archived': False},
            format='json',
        )
        self.assertEqual(restored.status_code, 200)
        self.user.refresh_from_db()
        self.assertFalse(self.user.is_archived)
        self.assertTrue(self.user.is_active)
        self.assertTrue(Enrollment.objects.filter(pk=enrollment.pk).exists())
        self.assertTrue(StudentLessonProgress.objects.filter(pk=progress.pk).exists())

        blocked_student = get_user_model().objects.create_user(
            username='blocked_archived_student',
            email='blocked-archived-student@example.com',
            password='secret123',
        )
        blocked_student.is_active = False
        blocked_student.save(update_fields=['is_active'])
        self.assertEqual(
            self.client.post(
                f'/api/v1/teacher/students/{blocked_student.id}/archive',
                {'is_archived': True},
                format='json',
            ).status_code,
            200,
        )
        self.assertEqual(
            self.client.post(
                f'/api/v1/teacher/students/{blocked_student.id}/archive',
                {'is_archived': False},
                format='json',
            ).status_code,
            200,
        )
        blocked_student.refresh_from_db()
        self.assertFalse(blocked_student.is_active)

    def test_only_student_accounts_can_be_archived(self):
        teacher = get_user_model().objects.create_user(
            username='archive_role_teacher',
            email='archive-role-teacher@example.com',
            password='secret123',
            role=User.TEACHER,
        )
        self.client.force_authenticate(user=teacher)
        response = self.client.post(
            f'/api/v1/teacher/students/{teacher.id}/archive',
            {'is_archived': True},
            format='json',
        )
        self.assertEqual(response.status_code, 404)

    def test_teacher_can_create_student_with_working_temporary_credentials(self):
        teacher = get_user_model().objects.create_user(
            username='teacher', email='teacher@example.com',
            password='secret123', role='teacher',
        )
        token_response = self.client.post('/api/auth/login', {
            'login': teacher.username, 'password': 'secret123'
        }, format='json')
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token_response.data['access']}")

        response = self.client.post('/api/v1/teacher/students/quick-create', {
            'first_name': 'Иван',
            'last_name': 'Иванов',
        }, format='json')
        self.assertEqual(response.status_code, 201)
        student = get_user_model().objects.get(username=response.data['username'])
        self.assertEqual(student.role, 'student')
        self.assertTrue(student.check_password(response.data['password']))

        self.client.credentials()
        login_response = self.client.post('/api/auth/login', {
            'login': response.data['username'],
            'password': response.data['password'],
        }, format='json')
        self.assertEqual(login_response.status_code, 200)
        self.assertEqual(login_response.data['role'], 'student')
        self.assertTrue(login_response.data['must_change_password'])
        self.assertIn('access', login_response.data)

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}")
        blocked_response = self.client.get('/api/v1/teacher/dashboard')
        self.assertEqual(blocked_response.status_code, 401)

        change_response = self.client.post('/api/auth/change-password', {
            'current_password': response.data['password'],
            'new_password': 'A much stronger new password 739!',
        }, format='json')
        self.assertEqual(change_response.status_code, 200)
        self.assertFalse(get_user_model().objects.get(pk=student.pk).must_change_password)

        self.client.credentials()
        new_login = self.client.post('/api/auth/login', {
            'login': student.username,
            'password': 'A much stronger new password 739!',
        }, format='json')
        self.assertEqual(new_login.status_code, 200)
        self.assertFalse(new_login.data['must_change_password'])

    def test_users_list_and_detail(self):
        self.assertEqual(self.client.get('/users').status_code, 401)

        resp1 = self.client.post('/api/auth/login', {
            'login': 'student', 'password': 'secret123'
        }, format='json')
        self.assertEqual(self.client.get('/api/users').status_code, 401)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp1.data['access']}")
        self.assertEqual(self.client.get('/api/users').status_code, 403)

        teacher = get_user_model().objects.create_user(
            username='teacher', email='teacher@example.com',
            password='secret123', role='teacher',
        )
        teacher_login = self.client.post('/api/auth/login', {
            'login': teacher.username, 'password': 'secret123'
        }, format='json')
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {teacher_login.data['access']}")
        resp1 = self.client.get('/api/users')
        self.assertEqual(resp1.status_code, 200)
        self.assertTrue(len(resp1.data) >= 1)

        # A student can view and update their own profile, but cannot change roles.
        self.client.credentials()
        student_login = self.client.post('/api/auth/login', {
            'login': 'student', 'password': 'secret123'
        }, format='json')
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {student_login.data['access']}")
        resp2 = self.client.get(f'/v1/users/{self.user.id}')
        self.assertEqual(resp2.status_code, 200)
        self.assertEqual(resp2.data['username'], 'student')

        self.assertEqual(self.client.get(f'/v1/users/{teacher.id}').status_code, 403)
        resp3 = self.client.put(f'/api/v1/users/{self.user.id}', {
            'email': 'updated@example.com',
            'role': 'admin',
        }, format='json')
        self.assertEqual(resp3.status_code, 200)
        self.assertEqual(resp3.data['email'], 'updated@example.com')
        self.assertEqual(resp3.data['role'], 'student')

    def test_course_list_and_catalog_fields(self):
        Enrollment.objects.create(user=self.user, course=self.course)

        # Free course
        response = self.client.get('/api/v1/courses')
        self.assertEqual(response.status_code, 200)
        item = [c for c in response.data if c['id'] == self.course.id][0]
        self.assertEqual(item['students_count'], 1)
        self.assertEqual(item['price_status'], 'Free')
        self.assertEqual(item['total_lessons'], 1)
        self.assertIn('rating', item)

        # Paid course
        paid = Course.objects.create(title='Django Pro', description='Advanced', price=1500)
        resp_paid = self.client.get('/v1/courses')
        paid_item = [c for c in resp_paid.data if c['id'] == paid.id][0]
        self.assertEqual(paid_item['price_status'], 'Paid')

    def test_course_lifecycle_and_author_permissions(self):
        teacher = get_user_model().objects.create_user(
            username='lifecycle_teacher',
            email='lifecycle-teacher@example.com',
            password='secret123',
            role=User.TEACHER,
        )
        other_teacher = get_user_model().objects.create_user(
            username='lifecycle_other',
            email='lifecycle-other@example.com',
            password='secret123',
            role=User.TEACHER,
        )
        draft = Course.objects.create(
            title='Draft course',
            status='draft',
            author=teacher,
            content='private draft content',
        )
        other_course = Course.objects.create(
            title='Other teacher course',
            author=other_teacher,
        )
        other_course.blocks.create(title='Private block')
        teacher_login = self.client.post('/api/auth/login', {
            'login': teacher.username,
            'password': 'secret123',
        }, format='json')
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {teacher_login.data['access']}")

        teacher_catalog = self.client.get('/api/v1/courses')
        self.assertIn(draft.id, {item['id'] for item in teacher_catalog.data})
        self.assertNotIn(other_course.id, {item['id'] for item in teacher_catalog.data})
        self.assertEqual(self.client.get(f'/api/v1/course/{draft.id}').status_code, 200)
        self.assertEqual(self.client.patch(
            f'/api/v1/course/{draft.id}',
            {'status': 'published'},
            format='json',
        ).status_code, 200)
        self.assertEqual(self.client.patch(
            f'/api/v1/course/{other_course.id}',
            {'status': 'archived'},
            format='json',
        ).status_code, 403)
        self.assertEqual(self.client.post(
            f'/api/v1/courses/{other_course.id}/blocks',
            {'title': 'Not allowed'},
            format='json',
        ).status_code, 403)
        self.assertEqual(
            self.client.get(f'/api/v1/courses/{other_course.id}/blocks').status_code,
            403,
        )
        self.assertEqual(
            self.client.patch(
                f'/api/v1/course/{draft.id}',
                {'status': 'not-a-status'},
                format='json',
            ).status_code,
            400,
        )

        self.client.credentials()
        published_catalog = self.client.get('/api/v1/courses')
        self.assertIn(draft.id, {item['id'] for item in published_catalog.data})
        archived = self.client.patch(
            f'/api/v1/course/{draft.id}',
            {'status': 'archived'},
            format='json',
        )
        self.assertEqual(archived.status_code, 401)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {teacher_login.data['access']}")
        self.client.patch(f'/api/v1/course/{draft.id}', {'status': 'archived'}, format='json')
        self.client.credentials()
        self.assertNotIn(
            draft.id,
            {item['id'] for item in self.client.get('/api/v1/courses').data},
        )
        self.assertEqual(self.client.get(f'/api/v1/course/{draft.id}').status_code, 404)

    def test_course_writes_require_teacher_role(self):
        payload = {'title': 'Restricted course'}
        self.assertEqual(
            self.client.post('/api/v1/courses', payload, format='json').status_code,
            401,
        )

        student_login = self.client.post('/api/auth/login', {
            'login': 'student', 'password': 'secret123'
        }, format='json')
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {student_login.data['access']}")
        self.assertEqual(
            self.client.post('/api/v1/courses', payload, format='json').status_code,
            403,
        )
        self.assertEqual(
            self.client.post(
                f'/api/v1/courses/{self.course.id}/blocks',
                {'title': 'Unauthorized block'},
                format='json',
            ).status_code,
            403,
        )

    def test_teacher_course_creation_uses_authenticated_author(self):
        teacher = get_user_model().objects.create_user(
            username='author_teacher',
            email='author-teacher@example.com',
            password='secret123',
            role='teacher',
        )
        login_response = self.client.post('/api/auth/login', {
            'login': teacher.username, 'password': 'secret123'
        }, format='json')
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}")

        response = self.client.post('/api/v1/courses', {
            'title': 'Teacher owned course',
            'author_id': self.user.id,
        }, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['author_id'], teacher.id)

    def test_enrollment_requires_published_course_owned_by_teacher(self):
        teacher = get_user_model().objects.create_user(
            username='enrollment_owner',
            email='enrollment-owner@example.com',
            password='secret123',
            role=User.TEACHER,
        )
        other_teacher = get_user_model().objects.create_user(
            username='enrollment_other',
            email='enrollment-other@example.com',
            password='secret123',
            role=User.TEACHER,
        )
        self.course.author = teacher
        self.course.save(update_fields=['author'])
        foreign_course = Course.objects.create(
            title='Foreign published course',
            author=other_teacher,
        )
        draft_course = Course.objects.create(
            title='Teacher draft course',
            author=teacher,
            status='draft',
        )
        archived_course = Course.objects.create(
            title='Teacher archived course',
            author=teacher,
            status='archived',
        )
        login_response = self.client.post('/api/auth/login', {
            'login': teacher.username,
            'password': 'secret123',
        }, format='json')
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}"
        )

        own_enrollment = self.client.post('/api/v1/enroll', {
            'user_id': self.user.id,
            'course_id': self.course.id,
        }, format='json')
        foreign_enrollment = self.client.post('/api/v1/enroll', {
            'user_id': self.user.id,
            'course_id': foreign_course.id,
        }, format='json')
        draft_enrollment = self.client.post('/api/v1/enroll', {
            'user_id': self.user.id,
            'course_id': draft_course.id,
        }, format='json')
        archived_enrollment = self.client.post('/api/v1/enroll', {
            'user_id': self.user.id,
            'course_id': archived_course.id,
        }, format='json')

        self.assertEqual(own_enrollment.status_code, 200)
        self.assertEqual(foreign_enrollment.status_code, 403)
        self.assertEqual(draft_enrollment.status_code, 400)
        self.assertEqual(archived_enrollment.status_code, 400)
        group = StudyGroup.objects.create(
            name='Enrollment permissions group',
            code='GRP-ENROLL',
            teacher=teacher,
        )
        self.assertEqual(self.client.post(
            f'/api/v1/groups/{group.id}/assign-course',
            {'course_id': foreign_course.id},
            format='json',
        ).status_code, 403)
        self.assertEqual(self.client.post(
            f'/api/v1/groups/{group.id}/assign-course',
            {'course_id': draft_course.id},
            format='json',
        ).status_code, 400)
        self.assertEqual(self.client.post(
            f'/api/v1/groups/{group.id}/assign-course',
            {'course_id': self.course.id},
            format='json',
        ).status_code, 200)
        self.assertTrue(GroupCourse.objects.filter(group=group, course=self.course).exists())
        self.assertEqual(
            set(Enrollment.objects.filter(user=self.user).values_list('course_id', flat=True)),
            {self.course.id},
        )

    def test_assignment_creation_submission_and_grading_permissions(self):
        teacher = get_user_model().objects.create_user(
            username='assignment_owner',
            email='assignment-owner@example.com',
            password='secret123',
            role=User.TEACHER,
        )
        other_teacher = get_user_model().objects.create_user(
            username='assignment_other',
            email='assignment-other@example.com',
            password='secret123',
            role=User.TEACHER,
        )
        self.course.author = teacher
        self.course.save(update_fields=['author'])
        lesson = Lesson.objects.create(
            course=self.course,
            title='Assignment lesson',
            order=1,
        )
        Enrollment.objects.create(user=self.user, course=self.course)

        self.assertEqual(
            self.client.post(
                f'/api/v1/courses/{self.course.id}/assignments',
                {'title': 'No auth'},
                format='json',
            ).status_code,
            401,
        )
        teacher_login = self.client.post('/api/auth/login', {
            'login': teacher.username,
            'password': 'secret123',
        }, format='json')
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {teacher_login.data['access']}")
        created = self.client.post(
            f'/api/v1/courses/{self.course.id}/assignments',
            {
                'title': 'Explain the solution',
                'description': 'Write a short explanation.',
                'assignment_type': Assignment.TYPE_SHORT_ANSWER,
                'lesson_id': lesson.id,
                'points': 10,
                'max_attempts': 1,
                'is_published': True,
            },
            format='json',
        )
        self.assertEqual(created.status_code, 201)
        assignment_id = created.data['id']
        self.assertEqual(created.data['course_id'], self.course.id)
        self.assertEqual(created.data['lesson_id'], lesson.id)
        unpublished = self.client.post(
            f'/api/v1/courses/{self.course.id}/assignments',
            {'title': 'Teacher-only draft'},
            format='json',
        )
        self.assertEqual(unpublished.status_code, 201)
        unpublished_id = unpublished.data['id']

        foreign_course = Course.objects.create(title='Unrelated course')
        foreign_lesson = Lesson.objects.create(
            course=foreign_course,
            title='Foreign lesson',
        )
        wrong_lesson = self.client.post(
            f'/api/v1/courses/{self.course.id}/assignments',
            {'title': 'Wrong lesson', 'lesson_id': foreign_lesson.id},
            format='json',
        )
        self.assertEqual(wrong_lesson.status_code, 400)
        self.assertEqual(
            self.client.get(f'/api/v1/courses/{self.course.id}/assignments').status_code,
            200,
        )
        self.assertEqual(
            self.client.get(f'/api/v1/assignments/{unpublished_id}').status_code,
            200,
        )

        self.client.credentials()
        self.assertEqual(
            self.client.get(f'/api/v1/assignments/{assignment_id}').status_code,
            401,
        )
        student_login = self.client.post('/api/auth/login', {
            'login': self.user.username,
            'password': 'secret123',
        }, format='json')
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {student_login.data['access']}")
        student_detail = self.client.get(f'/api/v1/assignments/{assignment_id}')
        self.assertEqual(student_detail.status_code, 200)
        self.assertNotIn('correct_answer', student_detail.data)
        student_assignments = self.client.get(
            f'/api/v1/courses/{self.course.id}/assignments'
        )
        self.assertEqual(student_assignments.status_code, 200)
        self.assertEqual(
            {item['id'] for item in student_assignments.data},
            {assignment_id},
        )
        self.assertEqual(
            self.client.get(f'/api/v1/assignments/{unpublished_id}').status_code,
            404,
        )
        submission_response = self.client.post(
            f'/api/v1/assignments/{assignment_id}/submissions',
            {'answer_text': 'My explanation'},
            format='json',
        )
        self.assertEqual(submission_response.status_code, 201)
        submission_id = submission_response.data['id']
        self.assertEqual(submission_response.data['status'], AssignmentSubmission.STATUS_SUBMITTED)
        self.assertEqual(
            self.client.get(f'/api/v1/assignments/{assignment_id}/submissions').data[0]['id'],
            submission_id,
        )
        self.assertEqual(self.client.post(
            f'/api/v1/assignments/{assignment_id}/submissions',
            {'answer_text': 'Second attempt'},
            format='json',
        ).status_code, 400)
        self.assertEqual(self.client.patch(
            f'/api/v1/submissions/{submission_id}/grade',
            {'score': 10},
            format='json',
        ).status_code, 403)

        other_teacher_login = self.client.post('/api/auth/login', {
            'login': other_teacher.username,
            'password': 'secret123',
        }, format='json')
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {other_teacher_login.data['access']}")
        self.assertEqual(self.client.patch(
            f'/api/v1/submissions/{submission_id}/grade',
            {'score': 10},
            format='json',
        ).status_code, 403)
        self.assertEqual(
            self.client.get(f'/api/v1/assignments/{assignment_id}/submissions').status_code,
            403,
        )

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {teacher_login.data['access']}")
        self.assertEqual(self.client.patch(
            f'/api/v1/submissions/{submission_id}/grade',
            {'score': 11},
            format='json',
        ).status_code, 400)
        self.assertEqual(
            self.client.delete(f'/api/v1/assignments/{assignment_id}').status_code,
            409,
        )
        graded = self.client.patch(
            f'/api/v1/submissions/{submission_id}/grade',
            {'score': 8, 'feedback': 'Good work.'},
            format='json',
        )
        self.assertEqual(graded.status_code, 200)
        self.assertEqual(graded.data['status'], AssignmentSubmission.STATUS_GRADED)
        self.assertEqual(graded.data['score'], 8)
        self.assertEqual(
            self.client.get(f'/api/v1/assignments/{assignment_id}/submissions').data[0]['student_id'],
            self.user.id,
        )

    def test_quiz_assignment_grading_is_server_side_and_hides_correct_options(self):
        teacher = get_user_model().objects.create_user(
            username='quiz_assignment_teacher',
            email='quiz-assignment-teacher@example.com',
            password='secret123',
            role=User.TEACHER,
        )
        self.course.author = teacher
        self.course.save(update_fields=['author'])
        Enrollment.objects.create(user=self.user, course=self.course)
        teacher_login = self.client.post('/api/auth/login', {
            'login': teacher.username,
            'password': 'secret123',
        }, format='json')
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {teacher_login.data['access']}")

        quiz = self.client.post(
            f'/api/v1/courses/{self.course.id}/assignments',
            {
                'title': 'Python basics quiz',
                'assignment_type': Assignment.TYPE_QUIZ,
                'points': 10,
                'max_attempts': 2,
                'is_published': True,
                'questions': [{
                    'text': 'Which value is an integer?',
                    'options': [
                        {'text': '3', 'is_correct': True},
                        {'text': '"3"', 'is_correct': False},
                    ],
                }],
            },
            format='json',
        )
        self.assertEqual(quiz.status_code, 201)
        question = quiz.data['questions'][0]
        correct_option = next(option for option in question['options'] if option['is_correct'])
        incorrect_option = next(option for option in question['options'] if not option['is_correct'])

        invalid_quiz = self.client.post(
            f'/api/v1/courses/{self.course.id}/assignments',
            {
                'title': 'Invalid quiz',
                'assignment_type': Assignment.TYPE_QUIZ,
                'questions': [{
                    'text': 'Invalid correct-answer count',
                    'options': [
                        {'text': 'A', 'is_correct': True},
                        {'text': 'B', 'is_correct': True},
                    ],
                }],
            },
            format='json',
        )
        self.assertEqual(invalid_quiz.status_code, 400)

        self.client.credentials()
        student_login = self.client.post('/api/auth/login', {
            'login': self.user.username,
            'password': 'secret123',
        }, format='json')
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {student_login.data['access']}")
        student_quiz = self.client.get(f'/api/v1/assignments/{quiz.data["id"]}')
        self.assertEqual(student_quiz.status_code, 200)
        student_option = student_quiz.data['questions'][0]['options'][0]
        self.assertNotIn('is_correct', student_option)
        self.assertEqual(set(student_option), {'id', 'text'})

        quiz_url = f'/api/v1/assignments/{quiz.data["id"]}/submissions'
        invalid_answer = self.client.post(quiz_url, {
            'answers': [{'question_id': question['id'], 'option_ids': [999999]}],
        }, format='json')
        self.assertEqual(invalid_answer.status_code, 400)
        wrong_answer = self.client.post(quiz_url, {
            'answers': [{'question_id': question['id'], 'option_ids': [incorrect_option['id']]}],
        }, format='json')
        self.assertEqual(wrong_answer.status_code, 201)
        self.assertEqual(wrong_answer.data['score'], 0)
        self.assertEqual(wrong_answer.data['status'], AssignmentSubmission.STATUS_GRADED)
        correct_answer = self.client.post(quiz_url, {
            'answers': [{'question_id': question['id'], 'option_ids': [correct_option['id']]}],
        }, format='json')
        self.assertEqual(correct_answer.status_code, 201)
        self.assertEqual(correct_answer.data['score'], 10)
        self.assertNotIn('is_correct', correct_answer.data)
        self.assertEqual(self.client.post(quiz_url, {
            'answers': [{'question_id': question['id'], 'option_ids': [correct_option['id']]}],
        }, format='json').status_code, 400)

        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {teacher_login.data['access']}"
        )
        multiple_choice = self.client.post(
            f'/api/v1/courses/{self.course.id}/assignments',
            {
                'title': 'Select all even numbers',
                'assignment_type': Assignment.TYPE_MULTIPLE_CHOICE,
                'points': 8,
                'max_attempts': 3,
                'is_published': True,
                'questions': [{
                    'text': 'Select all even numbers.',
                    'options': [
                        {'text': '2', 'is_correct': True},
                        {'text': '3', 'is_correct': False},
                        {'text': '4', 'is_correct': True},
                    ],
                }],
            },
            format='json',
        )
        self.assertEqual(multiple_choice.status_code, 201)
        mc_question = multiple_choice.data['questions'][0]
        correct_ids = [
            option['id'] for option in mc_question['options']
            if option['is_correct']
        ]
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {student_login.data['access']}"
        )
        mc_response = self.client.post(
            f'/api/v1/assignments/{multiple_choice.data["id"]}/submissions',
            {'answers': [{
                'question_id': mc_question['id'],
                'option_ids': correct_ids,
            }]},
            format='json',
        )
        self.assertEqual(mc_response.status_code, 201)
        self.assertEqual(mc_response.data['score'], 8)

    def test_code_assignment_configuration_and_source_submission(self):
        teacher = get_user_model().objects.create_user(
            username='code_assignment_teacher',
            email='code-assignment-teacher@example.com',
            password='secret123',
            role=User.TEACHER,
        )
        self.course.author = teacher
        self.course.save(update_fields=['author'])
        Enrollment.objects.create(user=self.user, course=self.course)

        teacher_login = self.client.post('/api/auth/login', {
            'login': teacher.username,
            'password': 'secret123',
        }, format='json')
        self.client.credentials(
            HTTP_AUTHORIZATION='Bearer ' + teacher_login.data['access']
        )
        invalid_limits = self.client.post(
            f'/api/v1/courses/{self.course.id}/assignments',
            {
                'title': 'Bounded code task',
                'assignment_type': Assignment.TYPE_CODE,
                'time_limit_seconds': 31,
            },
            format='json',
        )
        self.assertEqual(invalid_limits.status_code, 400)

        missing_tests = self.client.post(
            f'/api/v1/courses/{self.course.id}/assignments',
            {
                'title': 'Missing hidden tests',
                'assignment_type': Assignment.TYPE_CODE,
                'is_published': True,
            },
            format='json',
        )
        self.assertEqual(missing_tests.status_code, 400)

        created = self.client.post(
            f'/api/v1/courses/{self.course.id}/assignments',
            {
                'title': 'Bounded code task',
                'assignment_type': Assignment.TYPE_CODE,
                'programming_language': Assignment.LANGUAGE_PYTHON,
                'starter_code': 'def add(a, b):\\n    pass',
                'max_attempts': 2,
                'hints': ['Return the sum.'],
                'time_limit_seconds': 3,
                'memory_limit_mb': 64,
                'test_cases': [
                    {'input_data': '2 3', 'expected_output': '5'},
                    {'input_data': '-1 1', 'expected_output': '0'},
                ],
                'is_published': True,
            },
            format='json',
        )
        self.assertEqual(created.status_code, 201)
        assignment_id = created.data['id']
        self.assertEqual(created.data['hints'], ['Return the sum.'])
        self.assertEqual(created.data['time_limit_seconds'], 3)
        self.assertEqual(len(created.data['test_cases']), 2)
        self.assertEqual(
            AssignmentTestCase.objects.filter(assignment_id=assignment_id).count(),
            2,
        )

        self.client.credentials()
        student_login = self.client.post('/api/auth/login', {
            'login': self.user.username,
            'password': 'secret123',
        }, format='json')
        self.client.credentials(
            HTTP_AUTHORIZATION='Bearer ' + student_login.data['access']
        )
        student_assignment = self.client.get(f'/api/v1/assignments/{assignment_id}')
        self.assertEqual(student_assignment.status_code, 200)
        self.assertNotIn('test_cases', student_assignment.data)
        self.assertNotIn('expected_output', str(student_assignment.data))
        submission = self.client.post(
            f'/api/v1/assignments/{assignment_id}/submissions',
            {'source_code': 'def add(a, b):\\n    return a + b\\n'},
            format='json',
        )
        self.assertEqual(submission.status_code, 201)
        self.assertEqual(submission.data['status'], AssignmentSubmission.STATUS_PENDING)
        self.assertIsNone(submission.data['score'])
        self.assertEqual(
            submission.data['source_code'],
            'def add(a, b):\\n    return a + b\\n',
        )
        self.assertEqual(submission.data['language'], Assignment.LANGUAGE_PYTHON)
        self.assertEqual(
            AssignmentSubmission.objects.get(pk=submission.data['id']).answer_text,
            'def add(a, b):\\n    return a + b\\n',
        )
        self.client.credentials(
            HTTP_AUTHORIZATION='Bearer ' + teacher_login.data['access']
        )
        immutable_tests = self.client.patch(
            f'/api/v1/assignments/{assignment_id}',
            {'test_cases': [{'input_data': '3 4', 'expected_output': '7'}]},
            format='json',
        )
        self.assertEqual(immutable_tests.status_code, 400)
        self.client.credentials(
            HTTP_AUTHORIZATION='Bearer ' + student_login.data['access']
        )
        oversized_source = self.client.post(
            f'/api/v1/assignments/{assignment_id}/submissions',
            {'source_code': 'x' * 50001},
            format='json',
        )
        self.assertEqual(oversized_source.status_code, 400)
        accepted_retry = self.client.post(
            f'/api/v1/assignments/{assignment_id}/submissions',
            {'source_code': 'def add(a, b):\\n    return a + b\\n'},
            format='json',
        )
        self.assertEqual(accepted_retry.status_code, 201)
        exhausted_attempt = self.client.post(
            f'/api/v1/assignments/{assignment_id}/submissions',
            {'source_code': 'def add(a, b):\\n    return a + b\\n'},
            format='json',
        )
        self.assertEqual(exhausted_attempt.status_code, 400)

    def test_code_submission_run_endpoint_retries_only_system_failures(self):
        teacher = get_user_model().objects.create_user(
            username='runner_teacher',
            email='runner-teacher@example.com',
            password='secret123',
            role=User.TEACHER,
        )
        self.course.author = teacher
        self.course.save(update_fields=['author'])
        Enrollment.objects.create(user=self.user, course=self.course)

        self.client.credentials()
        teacher_login = self.client.post('/api/auth/login', {
            'login': teacher.username,
            'password': 'secret123',
        }, format='json')
        self.client.credentials(
            HTTP_AUTHORIZATION='Bearer ' + teacher_login.data['access']
        )
        assignment = self.client.post(
            f'/api/v1/courses/{self.course.id}/assignments',
            {
                'title': 'Runner-safe task',
                'assignment_type': Assignment.TYPE_CODE,
                'programming_language': Assignment.LANGUAGE_PYTHON,
                'starter_code': 'print("hi")',
                'time_limit_seconds': 3,
                'memory_limit_mb': 64,
                'test_cases': [{'input_data': '', 'expected_output': 'hi'}],
                'is_published': True,
            },
            format='json',
        )
        self.assertEqual(assignment.status_code, 201)

        self.client.credentials()
        student_login = self.client.post('/api/auth/login', {
            'login': self.user.username,
            'password': 'secret123',
        }, format='json')
        self.client.credentials(
            HTTP_AUTHORIZATION='Bearer ' + student_login.data['access']
        )
        submission = self.client.post(
            f"/api/v1/assignments/{assignment.data['id']}/submissions",
            {'source_code': 'def add(a, b):\n    return a + b\n'},
            format='json',
        )
        self.assertEqual(submission.status_code, 201)
        self.assertEqual(submission.data['status'], AssignmentSubmission.STATUS_PENDING)

        run_response = self.client.post(
            f"/api/v1/submissions/{submission.data['id']}/run",
            format='json',
        )
        self.assertEqual(run_response.status_code, 409)

        code_submission = AssignmentSubmission.objects.get(pk=submission.data['id'])
        code_submission.status = AssignmentSubmission.STATUS_SYSTEM_ERROR
        code_submission.save(update_fields=['status'])
        with self.captureOnCommitCallbacks(execute=False) as callbacks:
            retry_response = self.client.post(
                f"/api/v1/submissions/{submission.data['id']}/run",
                format='json',
            )
        self.assertEqual(retry_response.status_code, 202)
        self.assertEqual(retry_response.data['status'], AssignmentSubmission.STATUS_PENDING)
        self.assertEqual(len(callbacks), 1)
        with patch('api.views.enqueue_code_submission') as enqueue:
            callbacks[0]()
        enqueue.assert_called_once_with(submission.data['id'])
        self.assertEqual(
            AssignmentSubmission.objects.filter(
                assignment_id=assignment.data['id'],
                student=self.user,
            ).count(),
            1,
        )
        self.assertEqual(
            AssignmentSubmission.objects.get(pk=submission.data['id']).status,
            AssignmentSubmission.STATUS_PENDING,
        )

    def test_code_submission_task_persists_only_aggregate_results(self):
        from api.tasks import run_code_submission

        teacher = get_user_model().objects.create_user(
            username='aggregate_runner_teacher',
            email='aggregate-runner-teacher@example.com',
            password='secret123',
            role=User.TEACHER,
        )
        self.course.author = teacher
        self.course.save(update_fields=['author'])
        assignment = Assignment.objects.create(
            course=self.course,
            title='Aggregate runner task',
            assignment_type=Assignment.TYPE_CODE,
            is_published=True,
        )
        AssignmentTestCase.objects.create(
            assignment=assignment,
            input_data='secret input',
            expected_output='secret expected output',
        )
        submission = AssignmentSubmission.objects.create(
            assignment=assignment,
            student=self.user,
            source_code='print(input())',
            status=AssignmentSubmission.STATUS_PENDING,
        )

        def execute_while_running(**kwargs):
            self.assertEqual(
                AssignmentSubmission.objects.get(pk=submission.id).status,
                AssignmentSubmission.STATUS_RUNNING,
            )
            self.assertEqual(kwargs['language'], Assignment.LANGUAGE_PYTHON)
            return {
                'status': AssignmentSubmission.STATUS_PASSED,
                'tests_passed': 1,
                'tests_total': 1,
                'execution_time_ms': 12,
                'memory_used_mb': 8,
            }

        with patch(
            'api.tasks.execute_submission',
            side_effect=execute_while_running,
        ) as execute:
            run_code_submission.run(submission.id)

        submission.refresh_from_db()
        self.assertEqual(submission.status, AssignmentSubmission.STATUS_PASSED)
        self.assertEqual(submission.tests_passed, 1)
        self.assertEqual(submission.tests_total, 1)
        self.assertEqual(submission.score, assignment.points)
        self.assertEqual(submission.execution_time_ms, 12)
        self.assertNotIn('secret input', str(submission.response_data))
        self.assertNotIn('secret expected output', str(submission.response_data))
        execute.assert_called_once()

    def test_code_submission_cannot_be_manually_graded(self):
        teacher = get_user_model().objects.create_user(
            username='code_grade_teacher',
            email='code-grade-teacher@example.com',
            password='secret123',
            role=User.TEACHER,
        )
        self.course.author = teacher
        self.course.save(update_fields=['author'])
        assignment = Assignment.objects.create(
            course=self.course,
            title='Automatically graded code task',
            assignment_type=Assignment.TYPE_CODE,
            is_published=True,
        )
        submission = AssignmentSubmission.objects.create(
            assignment=assignment,
            student=self.user,
            source_code='print("student code")',
            status=AssignmentSubmission.STATUS_FAILED,
            score=0,
        )
        teacher_login = self.client.post('/api/auth/login', {
            'login': teacher.username,
            'password': 'secret123',
        }, format='json')
        self.client.credentials(
            HTTP_AUTHORIZATION='Bearer ' + teacher_login.data['access']
        )

        response = self.client.patch(
            f'/api/v1/submissions/{submission.id}/grade',
            {'score': assignment.points, 'feedback': 'override'},
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        submission.refresh_from_db()
        self.assertEqual(submission.status, AssignmentSubmission.STATUS_FAILED)
        self.assertEqual(submission.score, 0)

    def test_code_submission_errors_do_not_award_partial_score(self):
        from api.tasks import run_code_submission

        assignment = Assignment.objects.create(
            course=self.course,
            title='Timeout code task',
            assignment_type=Assignment.TYPE_CODE,
            points=10,
        )
        AssignmentTestCase.objects.create(
            assignment=assignment,
            input_data='',
            expected_output='ok',
        )
        submission = AssignmentSubmission.objects.create(
            assignment=assignment,
            student=self.user,
            source_code='while True: pass',
            status=AssignmentSubmission.STATUS_PENDING,
        )
        with patch('api.tasks.execute_submission', return_value={
            'status': AssignmentSubmission.STATUS_TIMEOUT,
            'tests_passed': 0,
            'tests_total': 1,
            'execution_time_ms': 1000,
            'memory_used_mb': 10,
        }):
            run_code_submission.run(submission.id)

        submission.refresh_from_db()
        self.assertEqual(submission.status, AssignmentSubmission.STATUS_TIMEOUT)
        self.assertIsNone(submission.score)

    def test_code_submission_task_recovers_after_worker_redelivery(self):
        from api.tasks import run_code_submission

        assignment = Assignment.objects.create(
            course=self.course,
            title='Recoverable code task',
            assignment_type=Assignment.TYPE_CODE,
            is_published=True,
        )
        AssignmentTestCase.objects.create(
            assignment=assignment,
            input_data='',
            expected_output='ok',
        )
        submission = AssignmentSubmission.objects.create(
            assignment=assignment,
            student=self.user,
            source_code='print("ok")',
            status=AssignmentSubmission.STATUS_RUNNING,
            runner_task_id='same-celery-task-id',
        )
        with patch('api.tasks.execute_submission', return_value={
            'status': AssignmentSubmission.STATUS_PASSED,
            'tests_passed': 1,
            'tests_total': 1,
            'execution_time_ms': 10,
            'memory_used_mb': 8,
        }) as execute:
            result = run_code_submission.apply(
                args=[submission.id],
                task_id='same-celery-task-id',
            )

        self.assertFalse(result.failed())
        submission.refresh_from_db()
        self.assertEqual(submission.status, AssignmentSubmission.STATUS_PASSED)
        execute.assert_called_once()

    def test_code_submission_runner_unavailable_becomes_retryable_system_error(self):
        from api.code_runner import CodeRunnerUnavailable
        from api.tasks import run_code_submission

        assignment = Assignment.objects.create(
            course=self.course,
            title='Runner unavailable task',
            assignment_type=Assignment.TYPE_CODE,
            is_published=True,
        )
        AssignmentTestCase.objects.create(
            assignment=assignment,
            input_data='',
            expected_output='ok',
        )
        submission = AssignmentSubmission.objects.create(
            assignment=assignment,
            student=self.user,
            source_code='print("ok")',
            status=AssignmentSubmission.STATUS_PENDING,
        )

        with patch(
            'api.tasks.execute_submission',
            side_effect=CodeRunnerUnavailable('internal connection detail'),
        ):
            run_code_submission.run(submission.id)

        submission.refresh_from_db()
        self.assertEqual(submission.status, AssignmentSubmission.STATUS_SYSTEM_ERROR)
        self.assertEqual(
            submission.error_message,
            'Изолированный runner временно недоступен.',
        )
        self.assertNotIn('internal connection detail', submission.error_message)
        self.assertIsNotNone(submission.finished_at)

    def test_file_upload_assignment_is_private_and_validated(self):
        teacher = get_user_model().objects.create_user(
            username='file_assignment_teacher',
            email='file-assignment-teacher@example.com',
            password='secret123',
            role=User.TEACHER,
        )
        other_student = get_user_model().objects.create_user(
            username='file_assignment_other_student',
            email='file-assignment-other-student@example.com',
            password='secret123',
        )
        self.course.author = teacher
        self.course.save(update_fields=['author'])
        Enrollment.objects.create(user=self.user, course=self.course)
        teacher_login = self.client.post('/api/auth/login', {
            'login': teacher.username,
            'password': 'secret123',
        }, format='json')
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {teacher_login.data['access']}")
        assignment = self.client.post(
            f'/api/v1/courses/{self.course.id}/assignments',
            {
                'title': 'Upload your notes',
                'assignment_type': Assignment.TYPE_FILE_UPLOAD,
                'points': 5,
                'max_attempts': 2,
                'is_published': True,
            },
            format='json',
        )
        self.assertEqual(assignment.status_code, 201)
        self.client.credentials()

        temporary_storage = tempfile.TemporaryDirectory()
        self.addCleanup(temporary_storage.cleanup)
        with override_settings(MEDIA_ROOT=temporary_storage.name):
            student_login = self.client.post('/api/auth/login', {
                'login': self.user.username,
                'password': 'secret123',
            }, format='json')
            self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {student_login.data['access']}")

            invalid_extension = self.client.post(
                f'/api/v1/assignments/{assignment.data["id"]}/submissions',
                {'file': SimpleUploadedFile('answer.exe', b'MZfake')},
                format='multipart',
            )
            self.assertEqual(invalid_extension.status_code, 400)
            spoofed_file = self.client.post(
                f'/api/v1/assignments/{assignment.data["id"]}/submissions',
                {'file': SimpleUploadedFile('answer.pdf', b'not a pdf')},
                format='multipart',
            )
            self.assertEqual(spoofed_file.status_code, 400)
            oversized_file = self.client.post(
                f'/api/v1/assignments/{assignment.data["id"]}/submissions',
                {'file': SimpleUploadedFile('large.txt', b'x' * (10 * 1024 * 1024 + 1))},
                format='multipart',
            )
            self.assertEqual(oversized_file.status_code, 400)

            uploaded = self.client.post(
                f'/api/v1/assignments/{assignment.data["id"]}/submissions',
                {
                    'file': SimpleUploadedFile(
                        'lesson-notes.txt',
                        'Заметки ученика'.encode('utf-8'),
                        content_type='text/plain',
                    )
                },
                format='multipart',
            )
            self.assertEqual(uploaded.status_code, 201)
            self.assertTrue(uploaded.data['has_file'])
            self.assertEqual(uploaded.data['original_file_name'], 'lesson-notes.txt')
            submission = AssignmentSubmission.objects.get(pk=uploaded.data['id'])
            self.assertTrue(submission.uploaded_file.name.startswith(
                f'assignment-submissions/{assignment.data["id"]}/{self.user.id}/'
            ))

            self.client.credentials()
            self.assertEqual(
                self.client.get(f'/api/v1/submissions/{submission.id}/file').status_code,
                401,
            )
            other_login = self.client.post('/api/auth/login', {
                'login': other_student.username,
                'password': 'secret123',
            }, format='json')
            self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {other_login.data['access']}")
            self.assertEqual(
                self.client.get(f'/api/v1/submissions/{submission.id}/file').status_code,
                403,
            )
            self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {student_login.data['access']}")
            download = self.client.get(f'/api/v1/submissions/{submission.id}/file')
            self.assertEqual(download.status_code, 200)
            self.assertEqual(download['Content-Type'], 'application/octet-stream')
            self.assertIn('attachment', download['Content-Disposition'])
            self.assertEqual(b''.join(download.streaming_content), 'Заметки ученика'.encode('utf-8'))
            self.client.credentials(
                HTTP_AUTHORIZATION=f"Bearer {teacher_login.data['access']}"
            )
            teacher_download = self.client.get(f'/api/v1/submissions/{submission.id}/file')
            self.assertEqual(teacher_download.status_code, 200)
            self.assertEqual(b''.join(teacher_download.streaming_content), 'Заметки ученика'.encode('utf-8'))

    def test_group_management_requires_teacher_and_uses_group_owner(self):
        teacher = get_user_model().objects.create_user(
            username='group_teacher',
            email='group-teacher@example.com',
            password='secret123',
            role='teacher',
        )
        other_teacher = get_user_model().objects.create_user(
            username='other_group_teacher',
            email='other-group-teacher@example.com',
            password='secret123',
            role='teacher',
        )
        group = StudyGroup.objects.create(
            name='Owned group',
            code='GRP-OWNED',
            teacher=teacher,
        )
        other_group = StudyGroup.objects.create(
            name='Other group',
            code='GRP-OTHER',
            teacher=other_teacher,
        )

        self.assertEqual(self.client.get('/api/v1/groups').status_code, 401)
        self.assertEqual(
            self.client.post('/api/v1/groups', {'name': 'Anonymous group'}, format='json').status_code,
            401,
        )

        student_login = self.client.post('/api/auth/login', {
            'login': 'student', 'password': 'secret123'
        }, format='json')
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {student_login.data['access']}")
        self.assertEqual(self.client.get('/api/v1/groups').status_code, 403)
        self.assertEqual(self.client.delete(f'/api/v1/groups/{group.id}').status_code, 403)
        mismatch_response = self.client.post('/api/v1/groups/join', {
            'code': group.code,
            'user_id': other_teacher.id,
        }, format='json')
        self.assertEqual(mismatch_response.status_code, 403)

        join_response = self.client.post('/api/v1/groups/join', {
            'code': group.code,
            'user_id': self.user.id,
        }, format='json')
        self.assertEqual(join_response.status_code, 403)
        self.assertFalse(group.students.filter(pk=self.user.pk).exists())

        teacher_login = self.client.post('/api/auth/login', {
            'login': teacher.username, 'password': 'secret123'
        }, format='json')
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {teacher_login.data['access']}")

        created_response = self.client.post('/api/v1/groups', {
            'name': 'My new group',
            'capacity': 2,
            'students': [
                {'first_name': 'Anna', 'last_name': 'Student'},
                {'first_name': 'Boris', 'last_name': 'Learner'},
            ],
            'teacher_id': other_teacher.id,
        }, format='json')
        self.assertEqual(created_response.status_code, 201)
        self.assertEqual(created_response.data['teacher_id'], teacher.id)
        self.assertEqual(created_response.data['capacity'], 2)
        self.assertEqual(created_response.data['students_count'], 2)
        self.assertEqual(len(created_response.data['created_students']), 2)
        self.assertTrue(all(item['username'] and item['password'] for item in created_response.data['created_students']))
        self.assertTrue(all(item['user']['must_change_password'] for item in created_response.data['created_students']))
        initial_student = created_response.data['created_students'][0]
        student_login_response = self.client.post('/api/auth/login', {
            'login': initial_student['username'],
            'password': initial_student['password'],
        }, format='json')
        self.assertEqual(student_login_response.status_code, 200)
        self.assertTrue(student_login_response.data['must_change_password'])
        teacher_login = self.client.post('/api/auth/login', {
            'login': teacher.username,
            'password': 'secret123',
        }, format='json')
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {teacher_login.data['access']}")
        self.assertEqual(
            self.client.post(
                f"/api/v1/groups/{created_response.data['id']}/add-student",
                {'student_id': self.user.id},
                format='json',
            ).status_code,
            400,
        )
        self.assertEqual(
            self.client.post('/api/v1/groups', {
                'name': 'Overfull group',
                'capacity': 1,
                'students': [
                    {'first_name': 'One', 'last_name': 'Student'},
                    {'first_name': 'Two', 'last_name': 'Student'},
                ],
            }, format='json').status_code,
            400,
        )
        self.assertEqual(
            {item['id'] for item in self.client.get('/api/v1/groups').data},
            {group.id, created_response.data['id']},
        )
        self.assertEqual(self.client.delete(f'/api/v1/groups/{other_group.id}').status_code, 403)
        self.assertEqual(self.client.get(f'/api/v1/groups/{group.id}').status_code, 200)

    def test_exam_submission_uses_authenticated_student_and_hides_correct_answers(self):
        block = CourseBlock.objects.create(course=self.course, title='Exam block')
        exam = Exam.objects.create(
            course=self.course,
            block=block,
            title='Basics exam',
            max_attempts=2,
        )
        question = Question.objects.create(
            course=self.course,
            exam=exam,
            text='Which answer is correct?',
        )
        correct_answer = Answer.objects.create(
            question=question,
            text='Correct',
            is_correct=True,
        )
        Answer.objects.create(question=question, text='Incorrect', is_correct=False)
        other_student = get_user_model().objects.create_user(
            username='exam_other_student',
            email='exam-other@example.com',
            password='secret123',
        )

        self.assertEqual(
            self.client.post(f'/api/v1/exams/{exam.id}/submit', {
                'user_id': self.user.id,
                'answers': [],
            }, format='json').status_code,
            401,
        )

        student_login = self.client.post('/api/auth/login', {
            'login': 'student',
            'password': 'secret123',
        }, format='json')
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {student_login.data['access']}")

        exam_response = self.client.get(f'/api/v1/exams/{exam.id}?user_id={other_student.id}')
        self.assertEqual(exam_response.status_code, 403)
        Enrollment.objects.create(user=self.user, course=self.course)
        exam_response = self.client.get(f'/api/v1/exams/{exam.id}?user_id={other_student.id}')
        self.assertEqual(exam_response.status_code, 200)
        answer_data = exam_response.data['questions'][0]['answers']
        self.assertEqual(len(answer_data), 2)
        self.assertNotIn('is_correct', answer_data[0])

        spoofed_submit = self.client.post(f'/api/v1/exams/{exam.id}/submit', {
            'user_id': other_student.id,
            'answers': [{'question_id': question.id, 'answer_id': correct_answer.id}],
        }, format='json')
        self.assertEqual(spoofed_submit.status_code, 403)
        self.assertFalse(ExamAttempt.objects.filter(user=other_student, exam=exam).exists())

        submit_response = self.client.post(f'/api/v1/exams/{exam.id}/submit', {
            'answers': [{'question_id': question.id, 'answer_id': correct_answer.id}],
        }, format='json')
        self.assertEqual(submit_response.status_code, 200)
        self.assertEqual(submit_response.data['score'], 100)
        self.assertTrue(ExamAttempt.objects.filter(user=self.user, exam=exam).exists())

    def test_lesson_completion_uses_authenticated_student(self):
        lesson = Lesson.objects.create(
            course=self.course,
            title='First lesson',
            order=1,
        )
        other_student = get_user_model().objects.create_user(
            username='lesson_other_student',
            email='lesson-other@example.com',
            password='secret123',
        )
        student_login = self.client.post('/api/auth/login', {
            'login': 'student',
            'password': 'secret123',
        }, format='json')
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {student_login.data['access']}")

        self.assertEqual(
            self.client.post(f'/api/v1/lessons/{lesson.id}/complete', format='json').status_code,
            403,
        )
        Enrollment.objects.create(user=self.user, course=self.course)
        spoofed_response = self.client.post(
            f'/api/v1/lessons/{lesson.id}/complete',
            {'user_id': other_student.id},
            format='json',
        )
        self.assertEqual(spoofed_response.status_code, 403)
        self.assertFalse(
            self.user.lesson_progresses.filter(lesson=lesson).exists()
        )

        response = self.client.post(f'/api/v1/lessons/{lesson.id}/complete', format='json')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(self.user.lesson_progresses.get(lesson=lesson).is_completed)

    def test_course_progress_includes_sections_lessons_and_graded_assignments(self):
        teacher = get_user_model().objects.create_user(
            username='hierarchy_progress_teacher',
            email='hierarchy-progress-teacher@example.com',
            password='secret123',
            role=User.TEACHER,
        )
        self.course.author = teacher
        self.course.save(update_fields=['author'])
        Enrollment.objects.create(user=self.user, course=self.course)
        block = CourseBlock.objects.create(course=self.course, title='Foundations')
        lesson = Lesson.objects.create(
            course=self.course,
            block=block,
            title='First steps',
            order=1,
        )
        assignment = Assignment.objects.create(
            course=self.course,
            lesson=lesson,
            title='Explain the concept',
            assignment_type=Assignment.TYPE_SHORT_ANSWER,
            points=10,
            is_published=True,
        )

        student_login = self.client.post('/api/auth/login', {
            'login': self.user.username,
            'password': 'secret123',
        }, format='json')
        self.client.credentials(
            HTTP_AUTHORIZATION='Bearer ' + student_login.data['access']
        )
        self.assertEqual(
            self.client.post(f'/api/v1/lessons/{lesson.id}/complete').status_code,
            200,
        )
        submission = self.client.post(
            f'/api/v1/assignments/{assignment.id}/submissions',
            {'answer_text': 'A saved answer.'},
            format='json',
        )
        self.assertEqual(submission.status_code, 201)

        progress_url = (
            f'/api/v1/users/{self.user.id}/courses/{self.course.id}/progress'
        )
        pending_progress = self.client.get(progress_url)
        self.assertEqual(pending_progress.status_code, 200)
        breakdown = pending_progress.data['learning_progress']
        self.assertEqual(breakdown['progress_percentage'], 50)
        self.assertEqual(breakdown['completed_items'], 1)
        self.assertEqual(breakdown['total_items'], 2)
        self.assertEqual(breakdown['sections'][0]['id'], block.id)
        assignment_progress = breakdown['sections'][0]['lessons'][0]['assignments'][0]
        self.assertEqual(assignment_progress['status'], 'in_progress')
        self.assertEqual(assignment_progress['attempts_used'], 1)

        teacher_login = self.client.post('/api/auth/login', {
            'login': teacher.username,
            'password': 'secret123',
        }, format='json')
        self.client.credentials(
            HTTP_AUTHORIZATION='Bearer ' + teacher_login.data['access']
        )
        graded = self.client.patch(
            f'/api/v1/submissions/{submission.data["id"]}/grade',
            {'score': 8},
            format='json',
        )
        self.assertEqual(graded.status_code, 200)

        self.client.credentials(
            HTTP_AUTHORIZATION='Bearer ' + student_login.data['access']
        )
        completed_progress = self.client.get(progress_url).data['learning_progress']
        self.assertEqual(completed_progress['progress_percentage'], 100)
        self.assertTrue(completed_progress['is_completed'])
        assignment_progress = completed_progress['sections'][0]['lessons'][0]['assignments'][0]
        self.assertEqual(assignment_progress['status'], 'completed')
        self.assertEqual(assignment_progress['score'], 8)

    def test_group_assignment_and_teacher_unlock_control_lesson_access(self):
        teacher = get_user_model().objects.create_user(
            username='material_teacher',
            email='material-teacher@example.com',
            password='secret123',
            role=User.TEACHER,
        )
        group = StudyGroup.objects.create(
            name='Material group',
            code='GRP-MATERIAL',
            capacity=1,
            teacher=teacher,
        )
        group.students.add(self.user)
        GroupCourse.objects.create(group=group, course=self.course)
        Enrollment.objects.create(user=self.user, course=self.course)
        block = CourseBlock.objects.create(course=self.course, title='Materials')
        first_lesson = Lesson.objects.create(
            course=self.course,
            block=block,
            title='First material',
            content='First lesson content',
            order=1,
        )
        second_lesson = Lesson.objects.create(
            course=self.course,
            block=block,
            title='Second material',
            content='Second lesson content',
            order=2,
        )

        student_login = self.client.post('/api/auth/login', {
            'login': self.user.username,
            'password': 'secret123',
        }, format='json')
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {student_login.data['access']}")
        detail = self.client.get(f'/api/v1/course/{self.course.id}')
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.data['lessons'][0]['content'], 'First lesson content')
        self.assertEqual(detail.data['lessons'][1]['content'], '')
        self.assertTrue(detail.data['lessons'][1]['is_locked'])
        block_detail = self.client.get(f'/api/v1/courses/{self.course.id}/blocks')
        self.assertEqual(block_detail.status_code, 200)
        self.assertEqual(block_detail.data[0]['lessons'][1]['content'], '')
        self.assertEqual(
            self.client.post(f'/api/v1/lessons/{second_lesson.id}/complete', format='json').status_code,
            403,
        )

        teacher_login = self.client.post('/api/auth/login', {
            'login': teacher.username,
            'password': 'secret123',
        }, format='json')
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {teacher_login.data['access']}")
        unlock = self.client.post(
            f'/api/v1/groups/{group.id}/lessons/{second_lesson.id}/toggle-access',
            {'is_unlocked': True},
            format='json',
        )
        self.assertEqual(unlock.status_code, 200)

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {student_login.data['access']}")
        unlocked_detail = self.client.get(f'/api/v1/course/{self.course.id}')
        self.assertEqual(unlocked_detail.data['lessons'][1]['content'], 'Second lesson content')
        self.assertFalse(unlocked_detail.data['lessons'][1]['is_locked'])
        self.assertEqual(
            self.client.post(f'/api/v1/lessons/{second_lesson.id}/complete', format='json').status_code,
            200,
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {teacher_login.data['access']}")
        removed = self.client.post(
            f'/api/v1/groups/{group.id}/remove-student/{self.user.id}',
            format='json',
        )
        self.assertEqual(removed.status_code, 200)
        self.assertFalse(Enrollment.objects.filter(user=self.user, course=self.course).exists())
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {student_login.data['access']}")
        self.assertFalse(self.client.get(f'/api/v1/course/{self.course.id}').data['is_enrolled'])

    def test_course_detail_contains_nested_answers(self):
        Enrollment.objects.create(user=self.user, course=self.course)
        login_response = self.client.post('/api/auth/login', {
            'login': self.user.username,
            'password': 'secret123',
        }, format='json')
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}")
        response = self.client.get(f'/api/v1/course/{self.course.id}')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['questions']), 1)
        self.assertEqual(len(response.data['questions'][0]['answers']), 2)
        self.assertNotIn('is_correct', response.data['questions'][0]['answers'][0])

    def test_course_quiz_submission_is_graded_server_side(self):
        question = self.course.questions.first()
        correct_answer = question.answers.get(is_correct=True)
        incorrect_answer = question.answers.get(is_correct=False)
        Enrollment.objects.create(user=self.user, course=self.course)
        login_response = self.client.post('/api/auth/login', {
            'login': self.user.username,
            'password': 'secret123',
        }, format='json')
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}")

        response = self.client.post(
            f'/api/v1/courses/{self.course.id}/quiz/submit',
            {'answers': [{'question_id': question.id, 'answer_id': correct_answer.id}]},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, {
            'correct_answers': 1,
            'total_questions': 1,
            'percentage': 100,
        })
        enrollment = Enrollment.objects.get(user=self.user, course=self.course)
        self.assertEqual(enrollment.correct_answers, 1)
        self.assertEqual(enrollment.progress_percentage, 100)

        invalid_response = self.client.post(
            f'/api/v1/courses/{self.course.id}/quiz/submit',
            {'answers': [{'question_id': question.id, 'answer_id': incorrect_answer.id + 1000}]},
            format='json',
        )
        self.assertEqual(invalid_response.status_code, 400)

    def test_text_course_completion_requires_assigned_text_only_course(self):
        text_course = Course.objects.create(
            title='Reading course',
            content='# Welcome\n\nRead the course material.',
            author=None,
        )
        Enrollment.objects.create(user=self.user, course=text_course)
        login_response = self.client.post('/api/auth/login', {
            'login': self.user.username,
            'password': 'secret123',
        }, format='json')
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}")

        completed = self.client.post(f'/api/v1/courses/{text_course.id}/complete')
        self.assertEqual(completed.status_code, 200)
        self.assertEqual(completed.data['progress_percentage'], 100)
        self.assertEqual(
            Enrollment.objects.get(user=self.user, course=text_course).progress_percentage,
            100,
        )
        self.assertEqual(
            self.client.post(f'/api/v1/courses/{self.course.id}/complete').status_code,
            400,
        )

        unassigned_course = Course.objects.create(
            title='Unassigned reading course',
            content='Read me',
        )
        self.assertEqual(
            self.client.post(f'/api/v1/courses/{unassigned_course.id}/complete').status_code,
            403,
        )

    def test_course_detail_uses_jwt_for_progress_and_hides_correct_answers(self):
        block = CourseBlock.objects.create(course=self.course, title='Course section')
        lesson = Lesson.objects.create(
            course=self.course,
            block=block,
            title='Quiz lesson',
            order=1,
        )
        question = Question.objects.create(
            course=self.course,
            lesson=lesson,
            text='Select the correct answer',
        )
        Answer.objects.create(question=question, text='Correct', is_correct=True)
        Answer.objects.create(question=question, text='Incorrect', is_correct=False)
        exam = Exam.objects.create(
            course=self.course,
            block=block,
            title='Section exam',
        )
        other_student = get_user_model().objects.create_user(
            username='course_detail_other',
            email='course-detail-other@example.com',
            password='secret123',
        )
        StudentLessonProgress.objects.create(
            user=self.user,
            lesson=lesson,
            is_completed=True,
        )
        ExamAttempt.objects.create(user=self.user, exam=exam, score=80, passed=True)
        ExamAttempt.objects.create(user=other_student, exam=exam, score=25, passed=False)

        unassigned_response = self.client.get(f'/api/v1/course/{self.course.id}')
        self.assertEqual(unassigned_response.status_code, 200)
        self.assertFalse(unassigned_response.data['is_enrolled'])
        self.assertEqual(unassigned_response.data['lessons'], [])
        self.assertEqual(unassigned_response.data['questions'], [])

        anonymous_response = self.client.get(
            f'/api/v1/course/{self.course.id}?user_id={self.user.id}'
        )
        self.assertEqual(anonymous_response.status_code, 200)
        self.assertEqual(anonymous_response.data['lessons'], [])

        login_response = self.client.post('/api/auth/login', {
            'login': self.user.username,
            'password': 'secret123',
        }, format='json')
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}")
        self.assertEqual(
            self.client.get(f'/api/v1/courses/{self.course.id}/blocks').status_code,
            403,
        )
        Enrollment.objects.create(user=self.user, course=self.course)
        student_response = self.client.get(
            f'/api/v1/course/{self.course.id}?user_id={other_student.id}'
        )
        self.assertEqual(student_response.status_code, 200)
        student_lesson = student_response.data['lessons'][0]
        self.assertTrue(student_lesson['is_completed'])
        student_answers = student_lesson['questions'][0]['answers']
        self.assertNotIn('is_correct', student_answers[0])
        exam_data = student_response.data['blocks'][0]['exam']
        self.assertEqual(exam_data['attempts_count'], 1)
        self.assertEqual(exam_data['best_score'], 80)
        self.assertTrue(exam_data['passed'])

    def test_course_create_with_questions(self):
        teacher = get_user_model().objects.create_user(
            username='course_teacher',
            email='course-teacher@example.com',
            password='secret123',
            role='teacher',
        )
        login_response = self.client.post('/api/auth/login', {
            'login': teacher.username, 'password': 'secret123'
        }, format='json')
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}")

        payload = {
            'title': 'New JavaScript Course',
            'description': 'JS from scratch',
            'price': 500,
            'author_id': self.user.id,
            'questions': [
                {
                    'text': 'What is typeof null?',
                    'answers': [
                        {'text': 'object', 'is_correct': True},
                        {'text': 'null', 'is_correct': False},
                    ]
                }
            ]
        }
        response = self.client.post('/api/v1/courses', payload, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['author_id'], teacher.id)
        new_course_id = response.data['id']

        detail_resp = self.client.get(f'/api/v1/course/{new_course_id}')
        self.assertEqual(detail_resp.status_code, 200)
        self.assertEqual(len(detail_resp.data['questions']), 1)
        self.assertEqual(len(detail_resp.data['questions'][0]['answers']), 2)
        self.assertIn('is_correct', detail_resp.data['questions'][0]['answers'][0])

    def test_enroll_and_user_courses_progress(self):
        payload = {'user_id': self.user.id, 'course_id': self.course.id}
        self.assertEqual(
            self.client.post('/api/v1/enroll', payload, format='json').status_code,
            401,
        )
        self.assertEqual(
            self.client.get(f'/api/v1/users/{self.user.id}/courses').status_code,
            401,
        )

        login_response = self.client.post('/api/auth/login', {
            'login': 'student', 'password': 'secret123'
        }, format='json')
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}")

        first = self.client.post('/api/v1/enroll', payload, format='json')
        self.assertEqual(first.status_code, 403)
        teacher = get_user_model().objects.create_user(
            username='enrolling_teacher',
            email='enrolling-teacher@example.com',
            password='secret123',
            role='teacher',
        )
        teacher_login = self.client.post('/api/auth/login', {
            'login': teacher.username,
            'password': 'secret123',
        }, format='json')
        self.course.author = teacher
        self.course.save(update_fields=['author'])
        self.client.force_authenticate(user=teacher)
        self.assertEqual(self.client.post('/api/v1/enroll', payload, format='json').status_code, 200)
        self.client.force_authenticate(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}")
        student_progress = self.client.post(
            f'/api/v1/users/{self.user.id}/courses/{self.course.id}/progress',
            {'currentIndex': 1, 'progress_percentage': 100, 'correctAnswers': 1},
            format='json',
        )
        self.assertEqual(student_progress.status_code, 403)
        self.assertEqual(
            Enrollment.objects.get(user=self.user, course=self.course).progress_percentage,
            0,
        )
        self.client.force_authenticate(user=teacher)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {teacher_login.data['access']}")
        first = self.client.post('/api/v1/enroll', payload, format='json')
        second = self.client.post('/v1/enroll', payload, format='json')
        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(self.user.enrollments.count(), 1)

        # Only the course author or an administrator may perform a manual correction.
        prog_resp = self.client.post(
            f'/api/v1/users/{self.user.id}/courses/{self.course.id}/progress',
            {'currentIndex': 1, 'progress_percentage': 100, 'correctAnswers': 1},
            format='json',
        )
        self.assertEqual(prog_resp.status_code, 200)
        self.assertEqual(prog_resp.data['progress_percentage'], 100)

        # GET progress
        get_prog = self.client.get(
            f'/v1/users/{self.user.id}/courses/{self.course.id}/progress'
        )
        self.assertEqual(get_prog.status_code, 200)
        self.assertEqual(get_prog.data['progress_percentage'], 100)

        # Check user courses reflects progress
        uc_resp = self.client.get(f'/api/v1/users/{self.user.id}/courses')
        self.assertEqual(uc_resp.status_code, 200)
        self.assertEqual(uc_resp.data[0]['progress_percentage'], 100)
        self.assertEqual(uc_resp.data[0]['price_status'], 'Enrolled')

    def test_student_cannot_read_or_change_another_students_course_data(self):
        other_student = get_user_model().objects.create_user(
            username='other_student',
            email='other-student@example.com',
            password='secret123',
        )
        login_response = self.client.post('/api/auth/login', {
            'login': 'student', 'password': 'secret123'
        }, format='json')
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}")

        self.assertEqual(
            self.client.get(f'/api/v1/users/{other_student.id}/courses').status_code,
            403,
        )
        self.assertEqual(
            self.client.get(f'/api/v1/users/{other_student.id}/courses/{self.course.id}/progress').status_code,
            403,
        )
        self.assertEqual(
            self.client.post('/api/v1/enroll', {
                'user_id': other_student.id,
                'course_id': self.course.id,
            }, format='json').status_code,
            403,
        )

    def test_create_and_get_markdown_course_without_questions(self):
        teacher = get_user_model().objects.create_user(
            username='markdown_teacher',
            email='markdown-teacher@example.com',
            password='secret123',
            role='teacher',
        )
        login_response = self.client.post('/api/auth/login', {
            'login': teacher.username, 'password': 'secret123'
        }, format='json')
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}")

        payload = {
            'title': 'Markdown Only Course',
            'description': 'Pure text guide without quiz',
            'price': 0,
            'course_type': 'text',
            'content': '# Introduction\n\nThis is a long markdown text.\n\n## Section 1\nDetails here.',
            'questions': []
        }
        create_resp = self.client.post('/api/v1/courses', payload, format='json')
        self.assertEqual(create_resp.status_code, 200)
        course_id = create_resp.data['id']
        self.assertEqual(create_resp.data['course_type'], 'text')

        # Get course detail
        detail_resp = self.client.get(f'/api/v1/course/{course_id}')
        self.assertEqual(detail_resp.status_code, 200)
        self.assertEqual(detail_resp.data['course_type'], 'text')
        self.assertIn('Introduction', detail_resp.data['content'])
        self.assertEqual(detail_resp.data['questions'], [])

        # Get course in list - should have sections count as total_lessons
        list_resp = self.client.get('/api/v1/courses')
        self.assertEqual(list_resp.status_code, 200)
        item = [c for c in list_resp.data if c['id'] == course_id][0]
        self.assertTrue(item['total_lessons'] >= 1)
        self.assertTrue(item['has_content'])

    def test_teacher_can_edit_course_blocks_and_lessons_without_deleting_learning_history(self):
        teacher = get_user_model().objects.create_user(
            username='content_owner',
            email='content-owner@example.com',
            password='secret123',
            role=User.TEACHER,
        )
        other_teacher = get_user_model().objects.create_user(
            username='content_other',
            email='content-other@example.com',
            password='secret123',
            role=User.TEACHER,
        )
        self.course.author = teacher
        self.course.save(update_fields=['author'])
        self.client.force_authenticate(user=teacher)

        updated_course = self.client.patch(
            f'/api/v1/course/{self.course.id}',
            {
                'title': 'Обновлённый курс',
                'category': 'Разработка',
                'level': 'intermediate',
                'price': 250,
            },
            format='json',
        )
        self.assertEqual(updated_course.status_code, 200)
        self.assertEqual(updated_course.data['title'], 'Обновлённый курс')
        self.assertEqual(updated_course.data['level'], 'intermediate')
        self.assertEqual(updated_course.data['price'], 250)

        created_block = self.client.post(
            f'/api/v1/courses/{self.course.id}/blocks',
            {'title': 'Раздел 1', 'description': 'Начало', 'order': 1},
            format='json',
        )
        self.assertEqual(created_block.status_code, 201)
        block_id = created_block.data['id']
        updated_block = self.client.patch(
            f'/api/v1/blocks/{block_id}',
            {'title': 'Основы', 'description': 'Обновлённое описание'},
            format='json',
        )
        self.assertEqual(updated_block.status_code, 200)
        self.assertEqual(updated_block.data['title'], 'Основы')
        self.assertEqual(
            self.client.post(
                f'/api/v1/courses/{self.course.id}/blocks',
                {'title': 'Дубликат порядка', 'order': 1},
                format='json',
            ).status_code,
            400,
        )

        created_lesson = self.client.post(
            f'/api/v1/courses/{self.course.id}/lessons',
            {
                'title': 'Первый урок',
                'content': '# Теория',
                'block_id': block_id,
                'order': 1,
                'lesson_type': 'theory',
            },
            format='json',
        )
        self.assertEqual(created_lesson.status_code, 201)
        lesson_id = created_lesson.data['id']
        updated_lesson = self.client.patch(
            f'/api/v1/lessons/{lesson_id}',
            {'title': 'Введение', 'content': '# Новая теория', 'lesson_type': 'practice'},
            format='json',
        )
        self.assertEqual(updated_lesson.status_code, 200)
        self.assertEqual(updated_lesson.data['title'], 'Введение')
        self.assertEqual(updated_lesson.data['lesson_type'], 'practice')

        StudentLessonProgress.objects.create(user=self.user, lesson_id=lesson_id, is_completed=True)
        self.assertEqual(
            self.client.delete(f'/api/v1/lessons/{lesson_id}').status_code,
            409,
        )
        self.assertEqual(
            self.client.delete(f'/api/v1/blocks/{block_id}').status_code,
            409,
        )
        self.assertTrue(Lesson.objects.filter(pk=lesson_id).exists())
        self.assertTrue(StudentLessonProgress.objects.filter(lesson_id=lesson_id).exists())

        self.client.force_authenticate(user=other_teacher)
        self.assertEqual(
            self.client.patch(
                f'/api/v1/blocks/{block_id}',
                {'title': 'Чужой раздел'},
                format='json',
            ).status_code,
            403,
        )

        self.client.force_authenticate(user=teacher)
        self.assertEqual(
            self.client.delete(f'/api/v1/lessons/{lesson_id}').status_code,
            409,
        )
        StudentLessonProgress.objects.filter(lesson_id=lesson_id).delete()
        self.assertEqual(self.client.delete(f'/api/v1/lessons/{lesson_id}').status_code, 204)
        self.assertEqual(self.client.delete(f'/api/v1/blocks/{block_id}').status_code, 204)
