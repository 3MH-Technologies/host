# 3MH Host - Zero-Trust Multi-Tenant Application Hosting Platform

![3MH Host Logo](/public/logo.jpg)

**3MH Host** is a zero-trust, production-grade multi-tenant hosting platform designed for executing untrusted user code (Python WSGI/ASGI apps, async bots, and PHP FPM/CLI workers) in complete isolation.

---

## 🌟 Key Features

- **Multi-Language Support**: Native sandboxing for Python 3.x (Flask, FastAPI, Django, Telegram/Discord Bots) and PHP 8.x (FPM & CLI workers).
- **gVisor `runsc` MicroVM Kernel Isolation**: User-space kernel execution prevents host kernel exploit vectors and container breakouts.
- **Strict Resource Controls (cgroups v2)**: Hard limits on CPU, memory, process counts (pids), and disk I/O to mitigate DoS and fork bombs.
- **Zero-Trust Network & Anti-SSRF Protection**: Dynamic nftables/iptables & Kubernetes NetworkPolicy rules blocking inter-tenant East-West lateral movement and internal cloud metadata (`169.254.169.254`, private subnets).
- **Read-Only Root Filesystem**: Strictly immutable root filesystems with ephemeral, in-memory `tmpfs` mounts (`noexec,nosuid,nodev`).
- **Language Hardening**: Python PEP 578 runtime audit hook traps (`sys.addaudithook`) and hardened `php.ini` directives (`disable_functions`, `open_basedir`).
- **Real-Time Anomaly Detection & Circuit Breaker**: Falco threat rules coupled with an automated circuit breaker daemon that auto-kills offending containers upon resource or security threshold breaches.

---

## 🛡️ Sandbox & Security Architecture

Detailed architecture breakdown is available in [`security/ARCHITECTURE.md`](security/ARCHITECTURE.md).

```
+-----------------------------------------------------------------------+
|                    3MH Host Physical Infrastructure                   |
+-----------------------------------------------------------------------+
|  Host OS: Linux Kernel 6.x (eBPF Enabled, cgroups v2 enabled)        |
|  - Capabilities Dropped (cap_drop: ALL)                               |
|  - Strict Syscall Restrictions (Seccomp SCMP_ACT_ERRNO default)       |
|  - User Namespaces (UID/GID remapping per tenant)                      |
|  - Systemd Slice Resource Guarantees & Dynamic Limits                 |
+-----------------------------------------------------------------------+
                                  |
                                  v
+-----------------------------------------------------------------------+
|  Container Runtime Isolation: gVisor (`runsc`) MicroVM / Sandbox      |
+-----------------------------------------------------------------------+
                                  |
                                  v
+-----------------------------------------------------------------------+
|  Storage Layer: Read-Only RootFS + In-Memory `tmpfs` + Tenant Jails   |
+-----------------------------------------------------------------------+
                                  |
                                  v
+-----------------------------------------------------------------------+
|  Network Layer: Anti-SSRF & Inter-Tenant East-West Isolation          |
+-----------------------------------------------------------------------+
                                  |
                                  v
+-----------------------------------------------------------------------+
|  Language Layer: PHP `disable_functions` + Python `sys.addaudithook` |
+-----------------------------------------------------------------------+
                                  |
                                  v
+-----------------------------------------------------------------------+
|  Monitoring: Falco Behavioral Detection & Circuit Breaker Daemon      |
+-----------------------------------------------------------------------+
```

---

## 📂 Security Suite Configurations (`/security`)

- `security/ARCHITECTURE.md`: Architecture overview and threat matrix.
- `security/gvisor/runsc-config.toml`: Production gVisor (`runsc`) sandbox runtime config.
- `security/docker/docker-compose.sandbox.yml`: Multi-Tenant Docker Compose sandbox specification.
- `security/seccomp/strict-sandbox.json`: Custom Seccomp profile blocking dangerous syscalls.
- `security/systemd/3mh-tenant-sandbox@.service`: Systemd unit template with cgroups v2 resource limits.
- `security/network/nftables-zero-trust.conf`: Zero-Trust nftables ruleset.
- `security/network/iptables-hardening.sh`: Executable iptables anti-SSRF & East-West isolation script.
- `security/network/k8s-network-policy.yaml`: Kubernetes Zero-Trust NetworkPolicy manifest.
- `security/php/php.ini`: Hardened production `php.ini` template.
- `security/php/php-fpm-pool.conf`: Tenant-isolated PHP-FPM pool configuration.
- `security/python/sandbox_runner.py`: Python execution wrapper with audit hooks.
- `security/monitoring/falco-rules.yaml`: Falco threat detection rules.
- `security/monitoring/circuit_breaker.py`: Automated incident response and circuit breaker daemon.

---

## 🚀 Getting Started

### Prerequisites

- Node.js 20+ & Bun
- Linux Host Kernel 6.x with cgroups v2 enabled
- Docker with gVisor (`runsc`) runtime installed

### Local Installation & Web Server Startup

```bash
# Install dependencies
bun install

# Run database migrations
npx prisma db push

# Build production Next.js application
bun run build

# Start production server
bun start
```

---

## ☁️ Deploying to Fly.io (تشغيل المنصة على Fly.io)

For full step-by-step instructions on deploying 3MH Host to Fly.io, refer to [`FLY_DEPLOYMENT.md`](FLY_DEPLOYMENT.md).

```bash
# 1. Create persistent volume
fly volumes create host_data --size 3 --region fra

# 2. Deploy application
fly deploy
```

---

## 📜 License & Ownership

Developed and maintained by **3MH TECHNOLOGIES**. All rights reserved.
