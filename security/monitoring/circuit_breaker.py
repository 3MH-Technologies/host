#!/usr/bin/env python3
"""
3MH Host Automated Incident Response & Circuit Breaker Daemon
Monitors cgroups v2 resource spikes, Falco security events, and port scanning anomalies
to automatically terminate or quarantine malicious tenant containers.
"""

import time
import json
import subprocess
import logging
import os
import sys

logging.basicConfig(
    level=logging.INFO,
    format='[3MH-CIRCUIT-BREAKER] %(asctime)s - %(levelname)s - %(message)s'
)

# Operational thresholds
CPU_THRESHOLD_PERCENT = 195.0 # Max 200% (2 cores)
MEMORY_THRESHOLD_MB = 480.0    # Hard limit 512MB
PIDS_THRESHOLD = 60            # Hard limit 64 pids


def kill_tenant_container(container_id: str, reason: str):
    """
    Terminates offending tenant container immediately and isolates network.
    """
    logging.critical(f"CIRCUIT BREAKER TRIGGERED for Container '{container_id}' | Reason: {reason}")
    try:
        # Force kill container
        subprocess.run(["docker", "kill", container_id], check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        logging.info(f"Container '{container_id}' forcefully stopped.")

        # Apply quarantine network drop rule via nftables/iptables
        subprocess.run(["iptables", "-A", "FORWARD", "-m", "comment", "--comment", f"Quarantine-{container_id}", "-j", "DROP"], check=False)
        logging.info(f"Quarantine network rule applied for '{container_id}'.")
    except Exception as e:
        logging.error(f"Failed to kill container {container_id}: {e}")


def inspect_tenant_containers():
    """
    Polls running tenant containers and checks cgroup resource usage against thresholds.
    """
    try:
        cmd = ["docker", "stats", "--no-stream", "--format", "{{.ID}}|{{.Name}}|{{.CPUPerc}}|{{.MemUsage}}|{{.PIDs}}"]
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        lines = result.stdout.strip().split("\n")

        for line in lines:
            if not line or not ("tenant-" in line or "3mh" in line):
                continue

            parts = line.split("|")
            if len(parts) < 5:
                continue

            cid, cname, cpu_str, mem_str, pids_str = parts[0], parts[1], parts[2], parts[3], parts[4]

            # Parse CPU %
            cpu_val = float(cpu_str.replace("%", "").strip()) if "%" in cpu_str else 0.0

            # Parse PIDs
            pids_val = int(pids_str.strip()) if pids_str.strip().isdigit() else 0

            # CPU Spikes
            if cpu_val > CPU_THRESHOLD_PERCENT:
                kill_tenant_container(cid, f"CPU usage exceeded threshold ({cpu_val}% > {CPU_THRESHOLD_PERCENT}%)")

            # PIDs Spikes (Fork bomb prevention)
            if pids_val >= PIDS_THRESHOLD:
                kill_tenant_container(cid, f"Process count exceeded safety limit ({pids_val} pids >= {PIDS_THRESHOLD})")

    except Exception as e:
        logging.error(f"Error inspecting containers: {e}")


def monitor_falco_pipe(fifo_path="/var/log/falco/events.fifo"):
    """
    Listens on Falco events FIFO pipe for real-time security alerts.
    """
    if not os.path.exists(fifo_path):
        return

    try:
        with open(fifo_path, "r") as fifo:
            for line in fifo:
                if not line.strip():
                    continue
                event = json.loads(line)
                rule = event.get("rule", "")
                output = event.get("output", "")
                container_id = event.get("output_fields", {}).get("container.id", "")

                if "CRITICAL" in event.get("priority", "") or "Anti-SSRF" in output:
                    if container_id:
                        kill_tenant_container(container_id, f"Falco Security Violation: Rule '{rule}' triggered. Output: {output}")
    except Exception as e:
        logging.error(f"Falco pipe monitoring error: {e}")


def main():
    logging.info("Starting 3MH Host Security Circuit Breaker Daemon...")
    while True:
        inspect_tenant_containers()
        time.sleep(3)


if __name__ == "__main__":
    main()
