from __future__ import annotations

from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import secrets


HOST = os.environ.get("CHAT_WEBHOOK_HOST", "127.0.0.1")
PORT = int(os.environ.get("CHAT_WEBHOOK_PORT", "8765"))
TOKEN_FILE = Path(os.environ.get("CHAT_WEBHOOK_TOKEN_FILE", ".runtime/chat_webhook_token.txt"))
LOG_FILE = Path(os.environ.get("CHAT_WEBHOOK_LOG_FILE", ".runtime/chat_webhook_instructions.jsonl"))


def read_or_create_token() -> str:
    TOKEN_FILE.parent.mkdir(parents=True, exist_ok=True)
    if TOKEN_FILE.exists():
        token = TOKEN_FILE.read_text(encoding="utf-8").strip()
        if token:
            return token
    token = secrets.token_urlsafe(24)
    TOKEN_FILE.write_text(token + "\n", encoding="utf-8")
    return token


WEBHOOK_TOKEN = read_or_create_token()


class InstructionWebhook(BaseHTTPRequestHandler):
    server_version = "CodexChatWebhook/1.0"

    def log_message(self, format: str, *args: object) -> None:
        return

    def send_json(self, status: int, payload: dict[str, object]) -> None:
        body = json.dumps(payload, ensure_ascii=True).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        if self.path.rstrip("/") == "/health":
            self.send_json(200, {"ok": True, "endpoint": "/instructions"})
            return
        self.send_json(404, {"ok": False, "message": "Not found."})

    def do_POST(self) -> None:
        if self.path.rstrip("/") != "/instructions":
            self.send_json(404, {"ok": False, "message": "Not found."})
            return

        token = self.headers.get("X-Webhook-Token", "").strip()
        auth = self.headers.get("Authorization", "").strip()
        if auth.lower().startswith("bearer "):
            auth = auth[7:].strip()
        if token != WEBHOOK_TOKEN and auth != WEBHOOK_TOKEN:
            self.send_json(401, {"ok": False, "message": "Unauthorized."})
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        raw_body = self.rfile.read(min(length, 1024 * 1024))

        try:
            payload = json.loads(raw_body.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            self.send_json(400, {"ok": False, "message": "JSON payload is required."})
            return

        instruction = ""
        if isinstance(payload, dict):
            instruction = str(payload.get("instruction") or payload.get("instructions") or payload.get("message") or "").strip()
        if not instruction:
            self.send_json(400, {"ok": False, "message": "instruction is required."})
            return

        record = {
            "received_at": datetime.now(timezone.utc).isoformat(),
            "instruction": instruction,
            "payload": payload,
            "client": self.client_address[0] if self.client_address else "",
        }
        LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
        with LOG_FILE.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(record, ensure_ascii=True) + "\n")

        self.send_json(202, {"ok": True, "message": "Instruction received."})


if __name__ == "__main__":
    try:
        server = ThreadingHTTPServer((HOST, PORT), InstructionWebhook)
        server.serve_forever()
    except Exception as exc:
        error_file = Path(".runtime/chat_webhook_error.log")
        error_file.parent.mkdir(parents=True, exist_ok=True)
        error_file.write_text(f"{type(exc).__name__}: {exc}\n", encoding="utf-8")
        raise
