from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication


class PasswordChangeRequiredAuthentication(JWTAuthentication):
    def authenticate(self, request):
        authenticated = super().authenticate(request)
        if not authenticated:
            return None

        user, token = authenticated
        if user.is_archived:
            raise AuthenticationFailed('Эта учётная запись архивирована.')
        allowed_path = request.path.rstrip('/').endswith('/auth/change-password')
        if user.must_change_password and not allowed_path:
            raise AuthenticationFailed('Сначала необходимо сменить временный пароль.')

        return user, token
