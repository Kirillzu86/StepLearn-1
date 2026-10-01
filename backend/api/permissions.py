from rest_framework.permissions import BasePermission


class IsTeacherOrAdmin(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and (
                user.role in ('teacher', 'admin')
                or user.is_staff
                or user.is_superuser
            )
        )


class IsSelfOrTeacherOrAdmin(BasePermission):
    def has_object_permission(self, request, view, obj):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and (
                obj.pk == user.pk
                or user.role in ('teacher', 'admin')
                or user.is_staff
                or user.is_superuser
            )
        )
