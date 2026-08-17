# 3MH Host: Zero-Trust Multi-Tenant Sandbox & Security Architecture

## 1. Executive Summary & Security Model
3MH Host is a multi-tenant hosting platform designed to run untrusted, arbitrary user-uploaded Python (async bots, WSGI/ASGI applications) and PHP (FPM, CLI workers) code.

To prevent cross-tenant data leakage, privilege escalation, infrastructure compromise, and Denial of Service (DoS) attacks, 3MH Host employs a **Zero-Trust Defense-in-Depth Sandbox Architecture**. No tenant code is trusted, and every execution environment operates within strict kernel, container, network, and application-level isolation layers.

---

## 2. Kernel to Runtime Isolation Layers Architecture

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
|  - Sentry Sandbox (Kernel in User Space handling 300+ syscalls)       |
|  - Directfs (Direct filesystem access without Gofer process overhead)  |
|  - Host System Call Isolation (Host Kernel hidden from untrusted app)  |
+-----------------------------------------------------------------------+
                                  |
                                  v
+-----------------------------------------------------------------------+
|  Storage & Filesystem Layer                                           |
|  - Root File System: Strictly Read-Only (`read_only: true`)            |
|  - In-Memory Ephemeral Storage: `/tmp` (tmpfs, noexec, nosuid, nodev) |
|  - Tenant Storage Jail: Strict Chroot / open_basedir / ACL boundaries |
+-----------------------------------------------------------------------+
                                  |
                                  v
+-----------------------------------------------------------------------+
|  Zero-Trust Network Layer                                             |
|  - East-West Traffic Blocked (Inter-tenant Docker networks isolated)   |
|  - Strict Anti-SSRF Firewall (nftables / iptables / eBPF)             |
|    Blocks 169.254.169.254, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16    |
|  - Kubernetes NetworkPolicy (Enforces ingress & egress zero-trust)   |
+-----------------------------------------------------------------------+
                                  |
                                  v
+-----------------------------------------------------------------------+
|  Language-Level Execution Security                                    |
|  - PHP: Hardened `php.ini` (`disable_functions`, `open_basedir`)      |
|  - Python: Virtual Environment Wrapper & Audit Hook Traps             |
|    (`sys.addaudithook` blocking dangerous ops, socket binds & exec)   |
+-----------------------------------------------------------------------+
                                  |
                                  v
+-----------------------------------------------------------------------+
|  Behavioral Monitoring & Automated Incident Response                  |
|  - Falco Engine: Real-time syscall & file modification alerts         |
|  - Circuit Breaker Daemon: Auto-kill & Quarantine on CPU/RAM spikes,  |
|    malicious syscalls, or port scanning activity.                      |
+-----------------------------------------------------------------------+
```

---

## 3. Comparison & Runtime Selection: Rootless Docker + Seccomp vs. microVM / gVisor

| Feature | Standard Rootless Docker + Seccomp | Firecracker MicroVM | gVisor (`runsc`) [CHOSEN MODEL] |
| :--- | :--- | :--- | :--- |
| **Kernel Isolation** | Shared host kernel | Dedicated Guest Kernel | User-space Kernel (Sentry) |
| **Syscall Surface** | Restricted via Seccomp (~300 syscalls exposed) | KVM hypercall interface | Sentry traps syscalls (~15 host syscalls allowed) |
| **Startup Overhead** | ~50ms | ~100ms - 200ms | ~30ms |
| **Memory Footprint**| ~10MB | ~128MB per VM | ~15MB - 30MB |
| **Container Tooling**| Full Docker/OCI Compatibility | Requires custom rootfs & agent | Native OCI Runtime (`docker --runtime=runsc`) |
| **Verdict** | Moderate Isolation | High Overhead | **Optimal Security, Compatibility & Density** |

**Why gVisor (`runsc`) was chosen:**
gVisor intercepts syscalls from the untrusted tenant code inside a user-space kernel called **Sentry**. The host kernel is shielded from zero-day kernel exploits, container breakouts, and privilege escalation vulnerabilities (e.g. Dirty COW, Leaky Vessels).

---

## 4. Threat Matrix & Mitigation Strategies

| Threat Vectors | Impact | Sandbox Mitigation Layer |
| :--- | :--- | :--- |
| **Container Breakout / Kernel Exploits** | Host takeover | gVisor `runsc` Sentry sandbox + User Namespaces UID mapping |
| **Cross-Tenant Data Sniffing (East-West)** | Confidentiality leak | Isolated Docker bridge networks + nftables inter-tenant drop rules |
| **Cloud Metadata SSRF Attacks** | AWS/GCP credential theft | nftables/iptables drop rules for `169.254.169.254` and private Subnets |
| **Fork Bomb / CPU Exhaustion** | Denial of Service (DoS) | cgroups v2 `pids.max=64`, `cpu.max="200000 100000"` (2 cores max) |
| **RAM / OOM Exhaustion** | Host OOM Killer | cgroups v2 `memory.max=512M`, swap disabled (`memory.swap.max=0`) |
| **Disk Overfill Attack** | Disk exhaustion | Read-only rootfs + `tmpfs` size capped at `64MB` (`noexec,nosuid`) |
| **Arbitrary Code Execution via PHP `system()`**| Local compromise | Hardened `php.ini` with `disable_functions` + `open_basedir` |
| **Python Dynamic Module Injection** | Remote shell | Custom Python `sandbox_runner.py` with `sys.addaudithook` traps |
| **Port Scanning / Lateral Reconnaissance** | Network mapping | Falco real-time socket monitoring + Circuit Breaker auto-kill |

---

## 5. Security Suite File Index & Verification

- `security/gvisor/runsc-config.toml`: Production gVisor (`runsc`) sandbox runtime configuration.
- `security/docker/docker-compose.sandbox.yml`: Multi-Tenant Docker Compose specification with gVisor runtime.
- `security/seccomp/strict-sandbox.json`: Seccomp filter blocking dangerous syscalls (`SCMP_ACT_ERRNO` default).
- `security/systemd/3mh-tenant-sandbox@.service`: Systemd unit template enforcing cgroups v2 and namespace isolation.
- `security/network/nftables-zero-trust.conf`: Complete zero-trust nftables rule definitions.
- `security/network/iptables-hardening.sh`: Executable iptables script blocking inter-tenant and anti-SSRF traffic.
- `security/network/k8s-network-policy.yaml`: Kubernetes Zero-Trust NetworkPolicy manifest.
- `security/php/php.ini`: Secure production PHP directives.
- `security/php/php-fpm-pool.conf`: Tenant isolated PHP-FPM worker configuration.
- `security/python/sandbox_runner.py`: Python execution wrapper enforcing site isolation & audit traps.
- `security/monitoring/falco-rules.yaml`: Falco behavioral threat detection rules.
- `security/monitoring/circuit_breaker.py`: Automated incident response daemon.
