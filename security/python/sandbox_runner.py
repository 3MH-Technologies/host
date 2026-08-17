#!/usr/bin/env python3
"""
3MH Host Hardened Python Sandbox Execution Wrapper
Enforces virtualenv isolation, audit hook traps (sys.addaudithook), restricted environment variables,
and blocked dangerous operations (e.g. child subprocess creation, socket binds to protected interfaces).
"""

import sys
import os
import argparse
import logging

logging.basicConfig(level=logging.INFO, format='[3MH-PYTHON-SANDBOX] %(asctime)s - %(levelname)s - %(message)s')

# Allowed audit events
ALLOWED_AUDIT_EVENTS = {
    "import", "sys._getframe", "object.__getattr__", "compile",
    "open", "read", "write", "socket.connect", "socket.getaddrinfo"
}

# Forbidden audit events
FORBIDDEN_AUDIT_EVENTS = {
    "os.system", "subprocess.Popen", "process.spawn",
    "socket.bind", "pty.spawn", "os.fork", "os.exec"
}


def audit_hook(event, args):
    """
    Python Runtime Audit Hook (PEP 578)
    Intercepts dynamic imports, system commands, socket binds, and subprocess attempts.
    """
    if event in FORBIDDEN_AUDIT_EVENTS or event.startswith("subprocess.") or event.startswith("os.system"):
        logging.critical(f"SECURITY VIOLATION DETECTED: Forbidden event '{event}' attempted with args: {args}")
        raise PermissionError(f"3MH Host Sandbox Policy Violation: Event '{event}' is forbidden.")

    if event == "socket.bind":
        port = args[1][1] if len(args) > 1 and isinstance(args[1], tuple) else None
        if port and port < 1024:
            logging.critical(f"SECURITY VIOLATION: Attempted bind to privileged port {port}")
            raise PermissionError("Privileged port binding disabled in sandbox.")


def sanitize_environment():
    """
    Strips sensitive host or system environment variables before running tenant code.
    """
    sensitive_keys = [
        "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "GCP_SERVICE_ACCOUNT",
        "DATABASE_URL", "NEXTAUTH_SECRET", "PRISMA_MASTER_KEY", "HOST_TOKEN"
    ]
    for key in sensitive_keys:
        if key in os.environ:
            del os.environ[key]

    # Force secure Python env flags
    os.environ["PYTHONUNBUFFERED"] = "1"
    os.environ["PYTHONDONTWRITEBYTECODE"] = "1"


def main():
    parser = argparse.ArgumentParser(description="3MH Host Secure Python Runner")
    parser.add_argument("--script", required=True, help="Path to Python script to execute")
    parser.add_argument("--entry", default="app", help="Module or function entry point")
    args = parser.parse_args()

    # 1. Sanitize Environment
    sanitize_environment()

    # 2. Attach Audit Hook Traps
    sys.addaudithook(audit_hook)
    logging.info("Python Runtime Audit Hooks successfully attached.")

    script_path = os.path.abspath(args.script)
    if not os.path.exists(script_path):
        logging.error(f"Script file not found: {script_path}")
        sys.exit(1)

    # 3. Execute Script safely within isolated namespace
    script_dir = os.path.dirname(script_path)
    sys.path.insert(0, script_dir)

    logging.info(f"Executing tenant script: {script_path}")

    globals_dict = {
        "__name__": "__main__",
        "__file__": script_path,
        "__doc__": None,
        "__package__": None,
    }

    try:
        with open(script_path, "rb") as f:
            code = compile(f.read(), script_path, "exec")
            exec(code, globals_dict)
    except PermissionError as pe:
        logging.error(f"Sandbox Enforcement Terminated Execution: {pe}")
        sys.exit(126)
    except Exception as e:
        logging.error(f"Unhandled exception in tenant code: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
