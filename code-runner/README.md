# Isolated Code Runner

Run this service only on a dedicated Linux VM reserved for untrusted code
execution. The runner API is a control plane: it uses the local Docker socket to
create and remove fixed-runtime sandbox containers. A compromised runner can
control its Docker host, which is why that host must be separate from the
backend, database, Redis, and production secrets.

## Deploy

1. Install Docker Engine on the dedicated VM and pre-pull the only allowed
   execution images:

   ```sh
   docker pull python:3.12-alpine@sha256:1b668429b3511ab407d8e00648891631b0b1a4d7e15e3ca70f38ab5b91ad4ab4
   docker pull node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402
   ```

2. Copy `.env.example` to `.env`. Set `CODE_RUNNER_TOKEN` to a long random
   secret; configure the exact same value in the root `.env` used by Django and
   its Celery worker.

3. Start the API:

   ```sh
   docker compose up --build -d
   ```

   The API binds to `127.0.0.1:8081`. Terminate TLS at a reverse proxy on the VM
   and forward only to that loopback address. Firewall/VPN rules must allow
   requests only from the backend worker. Do not expose the runner API directly
   to the public internet.

4. Configure the backend root `.env`:

   ```dotenv
   CODE_RUNNER_URL=https://runner.example.internal
   CODE_RUNNER_TOKEN=<same secret as the runner>
   ```

   Keep the token out of source control and logs. Backend refuses non-HTTPS
   runner URLs outside Django debug mode.

## Sandbox controls

Each hidden test runs in its own disposable container using a fixed Python or
Node image and fixed interpreter command. The sandbox has networking disabled,
read-only root filesystem, no host mounts, no Linux capabilities, no-new-
privileges, non-root UID, a 1 GiB CPU quota, assignment-specific RAM and wall
time limits, a PID limit, file descriptor/core dump limits, bounded temporary
storage, and bounded container logs. Containers are force-removed in a `finally`
path, including timeouts.
The runner API accepts source and test data only; it cannot accept Docker image,
command, mount, or network options from callers. Only aggregate results are
returned; test inputs, expected outputs, stdout, and stderr are never returned.

The Docker socket is a powerful host control surface. Use a disposable,
dedicated VM with no sensitive data and tightly restrict network ingress and
egress. The backend and Celery worker must never mount or access this socket.
For production, prefer a rootless Docker daemon or an equivalent isolated
container runtime. Runtime image references in `main.py` are pinned by digest;
review and update those pins through the release process.

Install the host-level orphan cleanup timer so containers are removed even if
the runner process exits unexpectedly:

```sh
sudo install -d /opt/steplearn-code-runner
sudo install -m 0750 cleanup-stale-sandboxes.sh /opt/steplearn-code-runner/
sudo install -m 0644 steplearn-sandbox-cleanup.service /etc/systemd/system/
sudo install -m 0644 steplearn-sandbox-cleanup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now steplearn-sandbox-cleanup.timer
```

The reaper only enumerates running containers with the dedicated
`steplearn.sandbox=true` label and removes those older than 90 seconds.

## Checks

With runner dependencies installed:

```sh
python -m unittest -v test_main
```

Unit tests verify sandbox configuration and response shape. The opt-in
integration suite (`RUN_SANDBOX_INTEGRATION=1 python -m unittest -v
test_sandbox_integration`) exercises Python/Node, memory and timeout limits,
fork/PID limits, network denial, and the absence of a host Docker socket. It
passed against the local Linux-container engine; rerun it on the target
dedicated Linux runner VM before enabling production submissions.
