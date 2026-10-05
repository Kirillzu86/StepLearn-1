import hmac
import logging
import os
import math
import time
from threading import BoundedSemaphore
from typing import Literal

import docker
from docker.errors import APIError, DockerException
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from requests.exceptions import ConnectionError as RequestsConnectionError
from requests.exceptions import ReadTimeout

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
logger = logging.getLogger(__name__)
MAX_CONCURRENT_RUNS = int(os.getenv('CODE_RUNNER_MAX_CONCURRENT', '2'))
RUN_SLOTS = BoundedSemaphore(MAX_CONCURRENT_RUNS)

PYTHON_WRAPPER = (
    "import os,sys,io\n"
    "sys.stdin=io.StringIO(os.environ['STEPLEARN_INPUT'])\n"
    "try:\n"
    " code=compile(os.environ['STEPLEARN_SOURCE'],'<submission>','exec')\n"
    "except SyntaxError:\n"
    " sys.exit(86)\n"
    "try:\n"
    " exec(code,{'__name__':'__main__'})\n"
    "except SystemExit as error:\n"
    " if error.code==86: sys.exit(1)\n"
    " raise\n"
)

NODE_WRAPPER = (
    "const {spawnSync}=require('node:child_process');"
    "const s=process.env.STEPLEARN_SOURCE;"
    "const c=spawnSync(process.execPath,['--check'],{input:s,encoding:'utf8',maxBuffer:65536});"
    "if(c.status!==0){process.stderr.write('syntax error');process.exit(86)}"
    "const r=spawnSync(process.execPath,['--disable-proto=throw','-e',s],"
    "{input:process.env.STEPLEARN_INPUT,encoding:'utf8',timeout:"
    "Number(process.env.STEPLEARN_TIMEOUT_MS),maxBuffer:65536});"
    "if(r.error&&r.error.code==='ETIMEDOUT')process.exit(124);"
    "if(r.stdout)process.stdout.write(r.stdout);"
    "if(r.stderr)process.stderr.write(r.stderr);"
    "process.exit(r.status===null||r.status===86?1:r.status);"
)

RUNTIME_IMAGES = {
    'python': 'python:3.12-alpine@sha256:1b668429b3511ab407d8e00648891631b0b1a4d7e15e3ca70f38ab5b91ad4ab4',
    'javascript': 'node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402',
}
MAX_OUTPUT_BYTES = 65_536


class TestCase(BaseModel):
    model_config = ConfigDict(extra='forbid')

    input_data: str = Field(max_length=10_000)
    expected_output: str = Field(max_length=10_000)


class RunRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')

    language: Literal['python', 'javascript']
    source_code: str = Field(min_length=1, max_length=50_000)
    time_limit_seconds: int = Field(ge=1, le=30)
    memory_limit_mb: int = Field(ge=64, le=512)
    test_cases: list[TestCase] = Field(min_length=1, max_length=100)


def _container_result(language, source_code, test_input, timeout, memory):
    client = None
    container = None
    start = time.monotonic()
    command = (
        ['python', '-I', '-c', PYTHON_WRAPPER]
        if language == 'python'
        else ['node', '-e', NODE_WRAPPER]
    )
    try:
        client = docker.from_env()
        image = RUNTIME_IMAGES[language]
        container = client.containers.run(
            image=image,
            command=command,
            environment={
                'STEPLEARN_SOURCE': source_code,
                'STEPLEARN_INPUT': test_input,
                'STEPLEARN_TIMEOUT_MS': str(timeout * 1000),
            },
            detach=True,
            tty=True,
            privileged=False,
            network_disabled=True,
            read_only=True,
            mem_limit=f'{memory}m',
            memswap_limit=f'{memory}m',
            nano_cpus=1_000_000_000,
            pids_limit=64,
            ulimits=[
                docker.types.Ulimit(name='nofile', soft=64, hard=64),
                docker.types.Ulimit(name='core', soft=0, hard=0),
            ],
            user='65534:65534',
            cap_drop=['ALL'],
            security_opt=['no-new-privileges:true'],
            tmpfs={'/tmp': 'rw,noexec,nosuid,size=16m'},
            init=True,
            labels={'steplearn.sandbox': 'true'},
            log_config={
                'type': 'json-file',
                'config': {'max-size': '1m', 'max-file': '1'},
            },
        )
        try:
            result = container.wait(timeout=timeout + 2)
        except (ReadTimeout, RequestsConnectionError) as error:
            if not isinstance(error, ReadTimeout) and 'Read timed out' not in str(error):
                raise DockerException('Lost connection to the sandbox runtime.') from error
            container.kill()
            return 'timeout', '', timeout * 1000, None
        output = container.logs(stdout=True, stderr=True)
        try:
            memory_bytes = container.stats(stream=False)['memory_stats']['usage']
            memory_used_mb = math.ceil(memory_bytes / (1024 * 1024))
        except (APIError, KeyError, TypeError):
            memory_used_mb = None
        elapsed_ms = round((time.monotonic() - start) * 1000)
        if len(output) > MAX_OUTPUT_BYTES:
            return 'runtime_error', '', elapsed_ms, memory_used_mb
        exit_code = result.get('StatusCode')
        if exit_code == 124:
            return 'timeout', '', elapsed_ms, memory_used_mb
        if exit_code == 86:
            return 'compile_error', '', elapsed_ms, memory_used_mb
        if exit_code != 0:
            return 'runtime_error', '', elapsed_ms, memory_used_mb
        return 'ok', output.decode('utf-8', errors='replace'), elapsed_ms, memory_used_mb
    except (APIError, DockerException):
        raise
    finally:
        if container is not None:
            try:
                container.remove(force=True)
            except APIError:
                logger.warning('Could not remove sandbox container', exc_info=True)
        if client is not None:
            client.close()


def _normalise_output(value):
    return value.replace('\r\n', '\n').strip()


@app.get('/health')
def health():
    return {'status': 'ok'}


@app.post('/v1/run')
def run(request: RunRequest, authorization: str | None = Header(default=None)):
    configured_token = os.getenv('CODE_RUNNER_TOKEN', '')
    if not configured_token:
        raise HTTPException(status_code=503, detail='Runner authentication is not configured.')
    supplied_token = authorization.removeprefix('Bearer ') if authorization else ''
    if not hmac.compare_digest(supplied_token, configured_token):
        raise HTTPException(status_code=401, detail='Invalid runner credentials.')
    if not RUN_SLOTS.acquire(blocking=False):
        raise HTTPException(status_code=429, detail='Runner capacity is full.')

    passed = 0
    total_time = 0
    max_memory = None
    result_status = 'passed'
    try:
        for test_case in request.test_cases:
            case_status, actual_output, elapsed, memory_used_mb = _container_result(
                request.language,
                request.source_code,
                test_case.input_data,
                request.time_limit_seconds,
                request.memory_limit_mb,
            )
            total_time += elapsed
            if memory_used_mb is not None:
                max_memory = max(max_memory or 0, memory_used_mb)
            if case_status != 'ok':
                result_status = case_status
                break
            if _normalise_output(actual_output) == _normalise_output(test_case.expected_output):
                passed += 1
            else:
                result_status = 'failed'
    except DockerException as error:
        raise HTTPException(status_code=503, detail='Sandbox runtime is unavailable.') from error
    finally:
        RUN_SLOTS.release()

    return {
        'status': result_status,
        'tests_passed': passed,
        'tests_total': len(request.test_cases),
        'execution_time_ms': total_time,
        'memory_used_mb': max_memory,
    }
