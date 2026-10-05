import logging
import uuid

from celery import shared_task
from django.db import transaction
from django.utils import timezone
from kombu.exceptions import OperationalError

from api.code_runner import CodeRunnerUnavailable, execute_submission
from api.models import AssignmentSubmission

logger = logging.getLogger(__name__)

RESULT_MESSAGES = {
    AssignmentSubmission.STATUS_PASSED: 'Все тесты пройдены.',
    AssignmentSubmission.STATUS_FAILED: 'Некоторые тесты не пройдены.',
    AssignmentSubmission.STATUS_TIMEOUT: 'Превышено допустимое время выполнения.',
    AssignmentSubmission.STATUS_RUNTIME_ERROR: 'Во время выполнения возникла ошибка.',
    AssignmentSubmission.STATUS_COMPILE_ERROR: 'В коде обнаружена синтаксическая ошибка.',
}


def enqueue_code_submission(submission_id):
    task_id = uuid.uuid4().hex
    claimed = AssignmentSubmission.objects.filter(
        pk=submission_id,
        status=AssignmentSubmission.STATUS_PENDING,
    ).update(runner_task_id=task_id)
    if not claimed:
        return
    try:
        run_code_submission.apply_async(args=[submission_id], task_id=task_id)
    except OperationalError:
        logger.exception('Could not queue code submission %s', submission_id)
        AssignmentSubmission.objects.filter(
            pk=submission_id,
            status=AssignmentSubmission.STATUS_PENDING,
        ).update(
            status=AssignmentSubmission.STATUS_SYSTEM_ERROR,
            error_message='Не удалось поставить решение в очередь запуска.',
            finished_at=timezone.now(),
            runner_task_id='',
        )


@shared_task(bind=True, name='api.run_code_submission')
def run_code_submission(task, submission_id):
    task_id = task.request.id
    with transaction.atomic():
        submission = AssignmentSubmission.objects.select_for_update().select_related(
            'assignment',
        ).filter(pk=submission_id).first()
        if submission is None or submission.status not in {
            AssignmentSubmission.STATUS_PENDING,
            AssignmentSubmission.STATUS_RUNNING,
        }:
            return
        if submission.runner_task_id and submission.runner_task_id != task_id:
            return
        assignment = submission.assignment
        test_cases = list(
            assignment.test_cases.order_by('order', 'id').values(
                'input_data',
                'expected_output',
            )
        )
        if not test_cases:
            submission.status = AssignmentSubmission.STATUS_SYSTEM_ERROR
            submission.error_message = 'Для задания не настроены тесты.'
            submission.finished_at = timezone.now()
            submission.save(update_fields=['status', 'error_message', 'finished_at'])
            return
        submission.status = AssignmentSubmission.STATUS_RUNNING
        if task_id:
            submission.runner_task_id = task_id
        submission.save(update_fields=['status', 'runner_task_id'])
        execution_request = {
            'language': submission.language or assignment.programming_language,
            'source_code': submission.source_code,
            'time_limit_seconds': assignment.time_limit_seconds,
            'memory_limit_mb': assignment.memory_limit_mb,
            'test_cases': test_cases,
        }

    try:
        result = execute_submission(**execution_request)
    except CodeRunnerUnavailable:
        logger.exception('Isolated runner failed for submission %s', submission_id)
        AssignmentSubmission.objects.filter(pk=submission_id).update(
            status=AssignmentSubmission.STATUS_SYSTEM_ERROR,
            error_message='Изолированный runner временно недоступен.',
            finished_at=timezone.now(),
        )
        return

    completed_at = timezone.now()
    status_value = result['status']
    score = (
        round(assignment.points * result['tests_passed'] / result['tests_total'])
        if status_value in {
            AssignmentSubmission.STATUS_PASSED,
            AssignmentSubmission.STATUS_FAILED,
        }
        else None
    )
    AssignmentSubmission.objects.filter(pk=submission_id).update(
        status=status_value,
        score=score,
        tests_passed=result['tests_passed'],
        tests_total=result['tests_total'],
        execution_time_ms=result['execution_time_ms'],
        memory_used_mb=result['memory_used_mb'],
        error_message=RESULT_MESSAGES[status_value]
        if status_value in RESULT_MESSAGES
        else '',
        finished_at=completed_at,
    )
