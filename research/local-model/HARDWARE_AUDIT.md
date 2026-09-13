# Hardware Audit — FlowCredit Local Model Validation v0.10

Recorded from real system interfaces on the development machine before any model
was downloaded. No value in this document is inferred from the machine name.

## Host

| Item | Value | Source |
| --- | --- | --- |
| Operating system | macOS 26.6 (build 25G72) | `sw_vers` |
| Kernel | Darwin 25.6.0, `root:xnu-12377.161.13~4/RELEASE_ARM64_T8142` | `uname -a` |
| Architecture | arm64 (Apple silicon) | `uname -m`, `sysctl -n hw.machine` |
| Model identifier | Mac17,3 (MacBook Air) | `sysctl -n hw.model`, `system_profiler SPHardwareDataType` |
| CPU | Apple M5, 10 physical cores: 4 performance + 6 efficiency | `system_profiler`, `sysctl -n hw.perflevel0.physicalcpu hw.perflevel1.physicalcpu` |
| Memory | 16 GiB unified memory (17,179,869,184 bytes) | `sysctl -n hw.memsize` |
| GPU | Integrated Apple M5 GPU, 10 cores, Metal 4 | `system_profiler SPDisplaysDataType` |
| GPU memory | Unified with system memory; no separate VRAM | Apple silicon architecture |
| Free disk | 750 GiB free of 926 GiB (`/`) | `df -h /` |
| Free memory at audit time | 66% system-wide free | `memory_pressure` |

## State before v0.10 installed anything

| Item | Value | Source |
| --- | --- | --- |
| Existing Ollama installation | none in `PATH`, no `~/.ollama` server state at audit time | `which ollama`, directory listing |
| Existing local models | none | no `~/.ollama/models`, no LM Studio / HF cache |
| Existing inference runtime | none (`llama-server`, `lm-studio`, `vllm` all absent) | `which llama-server lm-studio`, package probes |
| Container runtime present | Docker CLI at `/usr/local/bin/docker` — deliberately not used | `which docker` |
| Homebrew | not installed | `which brew` |
| Python toolchain | private venv at `/Users/yimingyang/fc-agent/tools/retrieval-python` (PDF layout parsing only) | repository tooling |
| Node.js | v24.19.0 private runtime | `node --version` |

## Runtime installed for this phase

| Item | Value |
| --- | --- |
| Runtime | Ollama, private copy at `/Users/yimingyang/fc-agent/tools/ollama/ollama` (outside the repository) |
| Runtime version | 0.34.0 |
| Installation method | official `ollama-darwin.tgz` release asset, unpacked by hand; no system-wide install, no Homebrew, no Docker |
| Model storage | `OLLAMA_MODELS=/Users/yimingyang/fc-agent/ollama-models` (outside the repository) |
| Server address | `127.0.0.1:11434` (loopback only) |
| Cloud features | disabled with `OLLAMA_NO_CLOUD=1` |
| Disk footprint of runtime | 662 MiB |

## Capacity reading for model selection

- The machine has 16 GiB of unified memory shared by CPU and GPU, so a model must
  be small enough that weights, KV cache and the operating system fit together
  without sustained swap. This is what drove the conservative model ladder choice
  (an 8B–9B class model first, a ~27B class model explicitly out of scope for
  comfortable interactive use on this host).
- Disk is not a constraint (750 GiB free).

## Deliberately not measured

- No GPU utilization counter is available through a stable public interface on
  this host without third-party tooling (e.g. `powermetrics` requires elevated
  privileges). GPU utilization is therefore reported as `unavailable` in the
  v0.10 runtime metrics rather than estimated.
- No thermal or power measurement is collected. Electricity and hardware cost are
  not zero, and the v0.10 report only claims zero paid inference API cost.
