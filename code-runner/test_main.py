import os
import unittest
from unittest.mock import Mock, patch

from requests.exceptions import ReadTimeout

import main


class CodeRunnerSandboxTests(unittest.TestCase):
    def setUp(self):
        self.container = Mock()
        self.container.wait.return_value = {'StatusCode': 0}
        self.container.logs.return_value = b'expected output\n'
        self.container.stats.return_value = {'memory_stats': {'usage': 8 * 1024 * 1024}}
        self.client = Mock()
        self.client.containers.run.return_value = self.container

    @patch('main.docker.from_env')
    def test_python_execution_uses_locked_down_ephemeral_container(self, from_env):
        from_env.return_value = self.client

        result = main._container_result(
            'python',
            'print(input())',
            'expected output\n',
            3,
            64,
        )

        self.assertEqual(result, ('ok', 'expected output\n', result[2], 8))
        kwargs = self.client.containers.run.call_args.kwargs
        self.assertEqual(kwargs['image'], main.RUNTIME_IMAGES['python'])
        self.assertTrue(kwargs['network_disabled'])
        self.assertTrue(kwargs['read_only'])
        self.assertEqual(kwargs['mem_limit'], '64m')
        self.assertEqual(kwargs['memswap_limit'], '64m')
        self.assertEqual(kwargs['nano_cpus'], 1_000_000_000)
        self.assertEqual(kwargs['pids_limit'], 64)
        self.assertEqual(
            [(limit.name, limit.soft, limit.hard) for limit in kwargs['ulimits']],
            [('nofile', 64, 64), ('core', 0, 0)],
        )
        self.assertEqual(kwargs['labels'], {'steplearn.sandbox': 'true'})
        self.assertFalse(kwargs['privileged'])
        self.assertEqual(kwargs['cap_drop'], ['ALL'])
        self.assertIn('no-new-privileges:true', kwargs['security_opt'])
        self.assertNotIn('volumes', kwargs)
        self.assertEqual(kwargs['environment']['STEPLEARN_SOURCE'], 'print(input())')
        self.assertNotIn('print(input())', kwargs['command'])
        self.assertTrue(kwargs['tty'])
        self.container.remove.assert_called_once_with(force=True)
        self.client.close.assert_called_once()

    @patch('main.docker.from_env')
    def test_timeout_kills_and_removes_the_sandbox(self, from_env):
        from_env.return_value = self.client
        self.container.wait.side_effect = ReadTimeout('timed out')

        result = main._container_result('python', 'while True: pass', '', 1, 64)

        self.assertEqual(result, ('timeout', '', 1000, None))
        self.container.kill.assert_called_once()
        self.container.remove.assert_called_once_with(force=True)

    @patch.dict(os.environ, {'CODE_RUNNER_TOKEN': 'test-token'})
    @patch('main._container_result')
    def test_result_contains_aggregate_only_and_no_test_data(self, execute_case):
        execute_case.return_value = ('ok', 'expected', 5, 12)
        request = main.RunRequest(
            language='python',
            source_code='print(input())',
            time_limit_seconds=2,
            memory_limit_mb=64,
            test_cases=[
                {'input_data': 'hidden input', 'expected_output': 'expected'},
            ],
        )

        response = main.run(request, authorization='Bearer test-token')

        self.assertEqual(response['status'], 'passed')
        self.assertEqual(response['tests_passed'], 1)
        self.assertEqual(response['tests_total'], 1)
        self.assertNotIn('hidden input', str(response))
        self.assertNotIn('expected', str(response))


if __name__ == '__main__':
    unittest.main()
