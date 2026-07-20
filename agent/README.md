# GPUValidator RunPod Agent

Standalone outbound-polling GPUValidator agent for RunPod GPU environments.

The agent registers with the GPUValidator backend, heartbeats, advertises detected GPU capabilities, polls for one job at a time, claims the job, executes only allowlisted command argv arrays, parses output, and uploads bounded raw evidence plus structured results.

## Install

```bash
cd agent
python3 -m venv .venv
. .venv/bin/activate
pip install -e .
```

Runtime uses only the Python standard library. `pytest` is needed for tests.

## Required environment

```bash
export GPUVALIDATOR_API_URL="https://gpuvalidator.com"
export GPUVALIDATOR_AGENT_TOKEN="<agent token from backend secret config>"
export GPUVALIDATOR_AGENT_NAME="runpod-a100-1"
```

Optional:

```bash
export GPUVALIDATOR_POLL_INTERVAL=5
export GPUVALIDATOR_HEARTBEAT_INTERVAL=30
export GPUVALIDATOR_COMMAND_TIMEOUT=20
export GPUVALIDATOR_TLS_VERIFY=true
export GPUVALIDATOR_LOG_LEVEL=INFO
export GPUVALIDATOR_AGENT_ID_FILE=/run/gpuvalidator-agent/id
```

TLS verification defaults to enabled. The token is masked in logs and must be stored as a RunPod secret or equivalent; do not bake it into images.

## Run foreground

```bash
python -m gpuvalidator_agent
```

or, when installed:

```bash
gpuvalidator-agent
```

## Test

```bash
pytest agent/tests
```

No GPU is required for CI tests; subprocess and HTTP calls are mocked.

## Allowlisted commands

The agent does not accept user-provided shell strings and does not use `shell=True`.

- `nvidia_smi_list`: `nvidia-smi -L`
- `nvidia_smi_inventory`: `nvidia-smi --query-gpu=index,name,uuid,memory.total,driver_version,pci.bus_id --format=csv,noheader,nounits`
- `nvidia_smi_topology`: `nvidia-smi topo -m`
- `driver_version`: `nvidia-smi --query-gpu=driver_version --format=csv,noheader`
- `cuda_version`: `/usr/local/cuda/version.json`, then `nvcc --version`, then `nvidia-smi` CUDA field if available
- `pytorch_gpu_count`: `python3 -c "import torch; print(torch.cuda.device_count())"`

## Result states

- `completed`: command exited 0 and parser ran.
- `failed`: command ran but exited nonzero, or an unexpected execution failure happened.
- `timed_out`: command exceeded timeout.
- `unavailable`: binary/runtime is missing, such as missing PyTorch or `nvcc`.

## RunPod prerequisites

- Outbound HTTPS access to `GPUVALIDATOR_API_URL`.
- `GPUVALIDATOR_AGENT_TOKEN` configured as a secret.
- `nvidia-smi` available in the container for NVIDIA checks.
- Optional CUDA toolkit for `nvcc --version` fallback.
- Optional PyTorch for `pytorch_gpu_count`; missing PyTorch reports `unavailable`.
- Non-root execution is preferred; no SSH or inbound ports are required.
