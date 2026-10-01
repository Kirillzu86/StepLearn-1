from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0004_course_category_course_cover_image_course_level_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='must_change_password',
            field=models.BooleanField(default=False),
        ),
    ]
