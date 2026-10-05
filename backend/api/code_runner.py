import json
import os
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from django.conf import settings

from api.models import AssignmentSubmission


RUNNER_STATUSES = {
    AssignmentSubmission.STATUS_PASSED,
    AssignmentSubmission.STATUS_FAILED,
    AssignmentSubmission.STATUS_TIMEOUT,
    AssignmentSubmission.STATUS_RUNTIME_ERROR,
    AssignmentSubmission.STATUS_COMPILE_ERROR,
}


class CodeRunnerUnavailable(Exception):
    pass


def execute_submission(*, language, source_code, time_limit_seconds, memory_limit_mb, test_cases):
    runner_url = os.getenv('CODE_RUNNER_URL', '').rstrip('/')
    runner_token = os.getenv('CODE_RUNNER_TOKEN', '')
    if not runner_url or not runner_token:
        raise CodeRunnerUnavailable('The external code runner is not configured.')

    parsed_url = urlparse(runner_url)
    if parsed_url.scheme != 'https' and not (
        settings.DEBUG and parsed_url.hostname in {'localhost', '127.0.0.1'}
    ):
        raise CodeRunnerUnavailable('The code runner URL must use HTTPS.')

    request = Request(
        f'{runner_url}/v1/run',
        data=json.dumps({
            'language': language,
            'source_code': source_code,
            'time_limit_seconds': time_limit_seconds,
            'memory_limit_mb': memory_limit_mb,
            'test_cases': test_cases,
        }).encode('utf-8'),
        headers={
            'Authorization': f'Bearer {runner_token}',
            'Content-Type': 'application/json',
        },
        method='POST',
    )
    try:
        with urlopen(request, timeout=time_limit_seconds * len(test_cases) + 10) as response:
            result = json.loads(response.read(16_384))
    except (HTTPError, URLError, TimeoutError, OSError, json.JSONDecodeError) as error:
        raise CodeRunnerUnavailable('The isolated code runner request failed.') from error

    if not isinstance(result, dict) or result.get('status') not in RUNNER_STATUSES:
        raise CodeRunnerUnavailable('The isolated code runner returned an invalid result.')

    numeric_fields = ('tests_passed', 'tests_total', 'execution_time_ms')
    if any(type(result.get(field)) is not int or result[field] < 0 for field in numeric_fields):
        raise CodeRunnerUnavailable('The isolated code runner returned invalid metrics.')
    if result.get('memory_used_mb') is not None and (
        type(result['memory_used_mb']) is not int or result['memory_used_mb'] < 0
    ):
        raise CodeRunnerUnavailable('The isolated code runner returned invalid memory metrics.')
    if result['tests_total'] != len(test_cases) or result['tests_passed'] > result['tests_total']:
        raise CodeRunnerUnavailable('The isolated code runner returned inconsistent test counts.')

    return result
