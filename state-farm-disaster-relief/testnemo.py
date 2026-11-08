#!/usr/bin/env python3
"""testnemo.py — a terminal chatbot for the NVIDIA Nemotron API.

Usage:
    python3 testnemo.py                 # auto-picks a Nemotron model
    python3 testnemo.py --model nvidia/nemotron-3-super-120b-a12b
    python3 testnemo.py --think         # show the model's reasoning

Reads NEMOTRON_API_KEY (and optionally NEMOTRON_BASE_URL / NEMOTRON_MODEL)
from the environment or from a .env file next to this script or in backend/.
Standard library only; no installs needed.

Commands inside the chat:
    /reset   clear the conversation       /model   show or switch model
    /system  set a system prompt          /quit    exit (or Ctrl+D)
"""

from __future__ import annotations

import argparse
import json
import os
import ssl
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

DEFAULT_BASE_URL = "https://integrate.api.nvidia.com/v1"
MODEL_PREFERENCE = [
    "nvidia/nemotron-3.5-super-vl-120b-a12b",
    "nvidia/nemotron-3-nano-30b-a3b",
    "nvidia/nemotron-3-super-120b-a12b",
    "nvidia/nemotron-3-ultra-550b-a55b",
    "nvidia/llama-3.3-nemotron-super-49b-v1.5",
    "nvidia/llama-3.3-nemotron-super-49b-v1",
]

DIM, BOLD, GREEN, RED, RESET = "\033[2m", "\033[1m", "\033[32m", "\033[31m", "\033[0m"
if not sys.stdout.isatty():
    DIM = BOLD = GREEN = RED = RESET = ""


def make_ssl_context() -> ssl.SSLContext:
    """Verified TLS context that also works on macOS python.org builds.

    python.org Python on macOS ships without access to the system certificate
    store, which causes CERTIFICATE_VERIFY_FAILED. We keep verification on and
    add trusted roots from (1) certifi, if installed, and (2) the macOS
    keychains, which also covers corporate HTTPS-inspection proxies whose root
    certificate is installed there. SSL_CERT_FILE is honored as usual.
    """
    ctx = ssl.create_default_context()
    try:
        import certifi  # type: ignore

        ctx.load_verify_locations(certifi.where())
    except Exception:
        pass
    if sys.platform == "darwin":
        for keychain in (
            "/System/Library/Keychains/SystemRootCertificates.keychain",
            "/Library/Keychains/System.keychain",
        ):
            try:
                pem = subprocess.run(
                    ["security", "find-certificate", "-a", "-p", keychain],
                    capture_output=True, text=True, timeout=10, check=True,
                ).stdout
                if "BEGIN CERTIFICATE" in pem:
                    ctx.load_verify_locations(cadata=pem)
            except Exception:
                pass
    return ctx


SSL_CONTEXT = make_ssl_context()


def load_env() -> None:
    """Fill os.environ from .env files without overriding real env vars."""
    here = Path(__file__).resolve().parent
    for path in (here / ".env", here / "backend" / ".env", here.parent / ".env"):
        if not path.exists():
            continue
        for line in path.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def request(url: str, key: str, body: dict | None = None, timeout: float = 60):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Accept": "text/event-stream" if body and body.get("stream") else "application/json",
        },
        method="POST" if data else "GET",
    )
    return urllib.request.urlopen(req, timeout=timeout, context=SSL_CONTEXT)


def explain_http_error(err: urllib.error.HTTPError) -> str:
    try:
        detail = err.read().decode(errors="replace")[:300]
    except Exception:
        detail = ""
    hints = {
        401: "Key rejected. Check NEMOTRON_API_KEY, or the key may lack chat access ('Public API Endpoints') on build.nvidia.com.",
        403: "Forbidden. The key may not have access to this model.",
        404: "Model not found. Try /model to pick another.",
        429: "Rate limited (free tier is ~40 requests/min). Wait a moment and try again.",
    }
    return f"HTTP {err.code}: {hints.get(err.code, err.reason)}" + (f"\n{DIM}{detail}{RESET}" if detail else "")


def pick_model(base: str, key: str) -> str:
    try:
        with request(f"{base}/models", key, timeout=20) as r:
            available = {m["id"] for m in json.load(r).get("data", [])}
    except Exception as exc:
        print(f"{DIM}(could not list models: {exc}; using default){RESET}")
        return MODEL_PREFERENCE[0]
    for m in MODEL_PREFERENCE:
        if m in available:
            return m
    others = sorted(m for m in available if "nemotron" in m.lower() and "embed" not in m.lower())
    return others[0] if others else MODEL_PREFERENCE[0]


def chat(base: str, key: str, model: str, messages: list, think: bool) -> str:
    """Stream one reply to stdout and return its text."""
    body = {
        "model": model,
        "messages": messages,
        "temperature": 0.6,
        "max_tokens": 2048,
        "stream": True,
        "chat_template_kwargs": {"enable_thinking": think},
    }
    reply, in_reasoning = [], False
    t0 = time.monotonic()
    with request(f"{base}/chat/completions", key, body, timeout=120) as r:
        for raw in r:
            line = raw.decode("utf-8", errors="replace").strip()
            if not line.startswith("data:"):
                continue
            data = line[5:].strip()
            if data == "[DONE]":
                break
            try:
                delta = json.loads(data)["choices"][0].get("delta", {})
            except (json.JSONDecodeError, KeyError, IndexError):
                continue
            reasoning = delta.get("reasoning_content")
            if reasoning and think:
                if not in_reasoning:
                    sys.stdout.write(DIM)
                    in_reasoning = True
                sys.stdout.write(reasoning)
                sys.stdout.flush()
            content = delta.get("content")
            if content:
                if in_reasoning:
                    sys.stdout.write(RESET + "\n\n")
                    in_reasoning = False
                reply.append(content)
                sys.stdout.write(content)
                sys.stdout.flush()
    if in_reasoning:
        sys.stdout.write(RESET)
    print(f"\n{DIM}[{model.split('/')[-1]} · {time.monotonic() - t0:.1f}s]{RESET}")
    return "".join(reply)


def main() -> None:
    load_env()
    ap = argparse.ArgumentParser(description="Terminal chatbot for the NVIDIA Nemotron API")
    ap.add_argument("--model", default=os.environ.get("NEMOTRON_MODEL") or "", help="model id (default: auto)")
    ap.add_argument("--think", action="store_true", help="enable and show model reasoning")
    ap.add_argument("--system", default="You are a helpful assistant.", help="system prompt")
    args = ap.parse_args()

    key = os.environ.get("NEMOTRON_API_KEY", "").strip()
    base = os.environ.get("NEMOTRON_BASE_URL", DEFAULT_BASE_URL).rstrip("/")
    if not key:
        sys.exit(f"{RED}NEMOTRON_API_KEY is not set (env or .env).{RESET}")

    model = args.model or pick_model(base, key)
    system = args.system
    messages = [{"role": "system", "content": system}]
    print(f"{BOLD}Nemotron chat{RESET} {DIM}· {model} · /reset /model /system /quit{RESET}")

    while True:
        try:
            user = input(f"\n{GREEN}you ›{RESET} ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break
        if not user:
            continue
        if user in ("/quit", "/exit"):
            break
        if user == "/reset":
            messages = [{"role": "system", "content": system}]
            print(f"{DIM}(conversation cleared){RESET}")
            continue
        if user.startswith("/model"):
            parts = user.split(maxsplit=1)
            if len(parts) == 2:
                model = parts[1].strip()
            print(f"{DIM}(model: {model}){RESET}")
            continue
        if user.startswith("/system"):
            parts = user.split(maxsplit=1)
            if len(parts) == 2:
                system = parts[1].strip()
                messages = [{"role": "system", "content": system}]
                print(f"{DIM}(system prompt set, conversation cleared){RESET}")
            else:
                print(f"{DIM}(system: {system}){RESET}")
            continue

        messages.append({"role": "user", "content": user})
        print(f"{BOLD}nemotron ›{RESET} ", end="", flush=True)
        try:
            reply = chat(base, key, model, messages, args.think)
            messages.append({"role": "assistant", "content": reply})
        except urllib.error.HTTPError as err:
            messages.pop()
            print(f"\n{RED}{explain_http_error(err)}{RESET}")
        except (urllib.error.URLError, TimeoutError) as err:
            messages.pop()
            reason = getattr(err, "reason", err)
            print(f"\n{RED}Network error: {reason}{RESET}")
            if "CERTIFICATE_VERIFY_FAILED" in str(reason):
                print(
                    f"{DIM}Python can't verify NVIDIA's certificate. Try one of:\n"
                    f"  pip3 install certifi\n"
                    f"  open '/Applications/Python {sys.version_info.major}.{sys.version_info.minor}/Install Certificates.command'\n"
                    f"  export SSL_CERT_FILE=/path/to/your-company-root-ca.pem   (if on a corporate network){RESET}"
                )
        except KeyboardInterrupt:
            messages.pop()
            print(f"\n{DIM}(interrupted){RESET}")


if __name__ == "__main__":
    main()
