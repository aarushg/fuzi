from __future__ import annotations

from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import secrets
from typing import Any


BASE_DIR = Path(__file__).resolve().parent
HOST = os.environ.get("CHAT_INSTRUCTIONS_HOST", "127.0.0.1")
PORT = int(os.environ.get("CHAT_INSTRUCTIONS_PORT", "8765"))
TOKEN_FILE = Path(os.environ.get("CHAT_INSTRUCTIONS_TOKEN_FILE", BASE_DIR / "token.txt"))
LOG_FILE = Path(os.environ.get("CHAT_INSTRUCTIONS_LOG_FILE", BASE_DIR / "instructions.jsonl"))


def read_or_create_token() -> str:
    TOKEN_FILE.parent.mkdir(parents=True, exist_ok=True)
    if TOKEN_FILE.exists():
        existing = TOKEN_FILE.read_text(encoding="utf-8").strip()
        if existing:
            return existing

    token = secrets.token_urlsafe(32)
    TOKEN_FILE.write_text(token + "\n", encoding="utf-8")
    return token


WEBHOOK_TOKEN = read_or_create_token()


class InstructionReceiver(BaseHTTPRequestHandler):
    server_version = "CodexInstructionReceiver/1.0"

    def log_message(self, format: str, *args: object) -> None:
        return

    def send_json(self, status: int, payload: dict[str, Any]) -> None:
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

        self.send_json(404, {"ok": False, "error": "not_found"})

    def do_POST(self) -> None:
        if self.path.rstrip("/") != "/instructions":
            self.send_json(404, {"ok": False, "error": "not_found"})
            return

        if not self.is_authorized():
            self.send_json(401, {"ok": False, "error": "unauthorized"})
            return

        try:
            payload = self.read_json_body()
        except ValueError as exc:
            self.send_json(400, {"ok": False, "error": str(exc)})
            return

        instruction = self.extract_instruction(payload)
        if not instruction:
            self.send_json(
                400,
                {
                    "ok": False,
                    "error": "JSON must include one of: instruction, instructions, message",
                },
            )
            return

        record = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "instruction": instruction,
            "raw_payload": payload,
            "client_address": {
                "host": self.client_address[0] if self.client_address else "",
                "port": self.client_address[1] if self.client_address else None,
            },
        }

        LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
        with LOG_FILE.open("a", encoding="utf-8") as log:
            log.write(json.dumps(record, ensure_ascii=True, separators=(",", ":")) + "\n")

        self.send_json(202, {"ok": True, "message": "instruction_received"})

    def is_authorized(self) -> bool:
        header_token = self.headers.get("X-Webhook-Token", "").strip()
        authorization = self.headers.get("Authorization", "").strip()
        bearer_token = ""
        if authorization.lower().startswith("bearer "):
            bearer_token = authorization[7:].strip()

        return WEBHOOK_TOKEN in {header_token, bearer_token}

    def read_json_body(self) -> Any:
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
        except ValueError as exc:
            raise ValueError("invalid_content_length") from exc

        if content_length <= 0:
            raise ValueError("empty_body")
        if content_length > 1024 * 1024:
            raise ValueError("payload_too_large")

        raw = self.rfile.read(content_length)
        try:
            return json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise ValueError("invalid_json") from exc

    @staticmethod
    def extract_instruction(payload: Any) -> str:
        if not isinstance(payload, dict):
            return ""

        for key in ("instruction", "instructions", "message"):
            value = payload.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
            if isinstance(value, list) and value:
                return "\n".join(str(item).strip() for item in value if str(item).strip())

        return ""


def main() -> None:
    print(
        json.dumps(
            {
                "host": HOST,
                "port": PORT,
                "token_file": str(TOKEN_FILE),
                "log_file": str(LOG_FILE),
            }
        ),
        flush=True,
    )
    ThreadingHTTPServer((HOST, PORT), InstructionReceiver).serve_forever()


if __name__ == "__main__":
    main()
