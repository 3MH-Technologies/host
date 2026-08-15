import time
import sys

print("Bot starting...")
print(f"Python version: {sys.version}")
print("Bot is running. Press Ctrl+C to stop.")

try:
    while True:
        time.sleep(1)
except KeyboardInterrupt:
    print("Bot shutting down...")
