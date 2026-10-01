from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import StudentProfile, TeacherProfile, User


@receiver(post_save, sender=User)
def create_role_profile(sender, instance, **kwargs):
    if instance.role == User.STUDENT:
        StudentProfile.objects.get_or_create(user=instance)
    elif instance.role == User.TEACHER:
        TeacherProfile.objects.get_or_create(user=instance)
