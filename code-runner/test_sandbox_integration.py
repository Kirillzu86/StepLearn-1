import os
import unittest
from unittest.mock import patch

import main


@unittest.skipUnless(
    os.getenv('RUN_SANDBOX_INTEGRATION') == '1',
    'Set RUN_SANDBOX_INTEGRATION=1 when a Linux-container Docker engine is available.',
)
class SandboxIntegrationTests(unittest.TestCase):
    def run_case(self, language, source, expected, timeout=2, memory=64):
        result = main._container_result(language, source, '', timeout, memory)
        if result[0] == 'ok':
            self.assertEqual(
                main._normalise_output(result[1]),
                main._normalise_output(expected),
            )
        return result

    def test_python_and_javascript_run_inside_sandbox(self):
        python_result = self.run_case('python', 'print("ok")', 'ok')
        javascript_result = self.run_case('javascript', "console.log('ok')", 'ok')

        self.assertEqual(python_result[0], 'ok')
        self.assertEqual(javascript_result[0], 'ok')
        self.assertEqual(main._normalise_output(python_result[1]), 'ok')
        self.assertEqual(main._normalise_output(javascript_result[1]), 'ok')

    def test_compilation_and_runtime_errors_have_distinct_statuses(self):
        compile_status, _, _, _ = self.run_case('python', 'if :', '')
        runtime_status, _, _, _ = self.run_case(
            'python',
            'raise RuntimeError("private detail")',
            '',
        )

        self.assertEqual(compile_status, 'compile_error')
        self.assertEqual(runtime_status, 'runtime_error')

    def test_failed_hidden_case_returns_only_aggregate_metrics(self):
        request = main.RunRequest(
            language='python',
            source_code='print("wrong")',
            time_limit_seconds=2,
            memory_limit_mb=64,
            test_cases=[{
                'input_data': 'private hidden input',
                'expected_output': 'private expected value',
            }],
        )

        with patch.dict(os.environ, {'CODE_RUNNER_TOKEN': 'test-token'}):
            response = main.run(request, authorization='Bearer test-token')

        self.assertEqual(response['status'], 'failed')
        self.assertEqual(response['tests_passed'], 0)
        self.assertEqual(response['tests_total'], 1)
        self.assertNotIn('private hidden input', str(response))
        self.assertNotIn('private expected value', str(response))

    def test_infinite_loop_is_stopped_by_execution_deadline(self):
        status, _, elapsed, _ = self.run_case('python', 'while True: pass', '', timeout=1)

        self.assertEqual(status, 'timeout')
        self.assertLess(elapsed, 5_000)

    def test_network_and_host_docker_socket_are_unavailable(self):
        source = (
            'import os,socket\n'
            's=socket.socket(); s.settimeout(1)\n'
            'try:\n'
            ' s.connect(("1.1.1.1",443)); print("network-open")\n'
            'except OSError:\n'
            ' print("network-blocked")\n'
            'print("host-socket", os.path.exists("/var/run/docker.sock"))\n'
        )
        status, output, _, _ = self.run_case(
            'python',
            source,
            'network-blocked\nhost-socket False',
        )

        self.assertEqual(status, 'ok')
        self.assertEqual(main._normalise_output(output), 'network-blocked\nhost-socket False')

    def test_memory_limit_terminates_excessive_allocation(self):
        status, _, _, _ = self.run_case(
            'python',
            'allocation = bytearray(512 * 1024 * 1024)',
            '',
            timeout=10,
            memory=64,
        )

        self.assertEqual(status, 'runtime_error')

    def test_process_limit_blocks_unbounded_forking(self):
        source = (
            'import os,time\n'
            'children=[]\n'
            'for _ in range(80):\n'
            ' try: pid=os.fork()\n'
            ' except OSError: print("process-limit"); break\n'
            ' if pid==0: time.sleep(0.25); os._exit(0)\n'
            ' children.append(pid)\n'
            'for pid in children: os.waitpid(pid,0)\n'
        )
        status, output, _, _ = self.run_case(
            'python',
            source,
            'process-limit',
            timeout=3,
        )

        self.assertEqual(status, 'ok')
        self.assertEqual(main._normalise_output(output), 'process-limit')


if __name__ == '__main__':
    unittest.main()
