"""Show only QR readiness and status; never print credentials returned by CLI."""
import collections
import os
import pathlib
import re
import subprocess
import sys
import threading
import time

root = pathlib.Path(os.environ["LOCALAPPDATA"]) / "GravityWeComReport" / "wecom-cli"
node = pathlib.Path(os.environ["USERPROFILE"]) / ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe"
cli = root / "node_modules/@wecom/cli/bin/wecom.js"
qr = pathlib.Path(sys.argv[1]).resolve()
qr.parent.mkdir(parents=True, exist_ok=True)
command = [str(node), str(cli), "auth", "init", "--noninteractive", "--no-browser", "--output-qrcode", str(qr)]
process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                           text=True, encoding="utf-8", errors="replace")
tail = collections.deque(maxlen=15)
def drain():
    for line in process.stdout:
        tail.append(line.strip())
thread = threading.Thread(target=drain, daemon=True)
thread.start()
shown = False
while process.poll() is None:
    if qr.is_file() and not shown:
        print("QR_READY " + str(qr), flush=True)
        shown = True
    time.sleep(0.5)
thread.join(timeout=2)
status = subprocess.run([str(node), str(cli), "auth", "show", "--status"],
                        capture_output=True, text=True, encoding="utf-8", errors="replace")
state = status.stdout.strip()
print("AUTH_STATUS " + (state if state in ("authorized", "unauthorized") else "unknown"), flush=True)
if process.returncode:
    for line in tail:
        if re.search(r"secret|token|bot.?id|credential|凭证|https?://", line, re.I):
            continue
        if re.search(r"error|failed|失败|错误|超时|拒绝", line, re.I):
            print("AUTH_ERROR " + line[:400], flush=True)
sys.exit(0 if state == "authorized" else 1)
