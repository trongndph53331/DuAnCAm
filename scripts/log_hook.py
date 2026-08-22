#!/usr/bin/env python3
"""
Shared AI hook logger — works with Claude Code, Gemini CLI, Codex, Cursor, Copilot.
Reads JSON from stdin, normalizes to common format, appends to .ai-log/session.jsonl
"""
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

VN_TZ = timezone(timedelta(hours=7))
MOJIBAKE_MARKERS = ("Ã", "Â", "â€", "â€œ", "â€™", "ðŸ", "Sá»", "Ä‘", "Æ°")
DATA_URL_RE = re.compile(r"data:((?:image|audio)/[^;,\s]+);base64,[A-Za-z0-9+/=_-]+")


def repair_text(value):
    """Repair UTF-8 text that was decoded once with the Windows code page."""
    if isinstance(value, list):
        return [repair_text(item) for item in value]
    if isinstance(value, dict):
        return {key: repair_text(item) for key, item in value.items()}
    if not isinstance(value, str) or not any(marker in value for marker in MOJIBAKE_MARKERS):
        return value
    repaired = value
    for _ in range(2):
        try:
            candidate = repaired.encode("cp1252").decode("utf-8")
        except (UnicodeEncodeError, UnicodeDecodeError):
            break
        if sum(candidate.count(marker) for marker in MOJIBAKE_MARKERS) >= sum(
            repaired.count(marker) for marker in MOJIBAKE_MARKERS
        ):
            break
        repaired = candidate
    return repaired


def sanitize_payload(value):
    """Keep transcript text/metadata but omit embedded binary data URLs."""
    if isinstance(value, list):
        return [sanitize_payload(item) for item in value]
    if isinstance(value, dict):
        cleaned = {}
        for key, item in value.items():
            if key in ("image_url", "audio_url") and isinstance(item, str) and item.startswith("data:"):
                media_type = item[5:].split(";", 1)[0]
                cleaned[key] = f"[embedded {media_type} omitted]"
            else:
                cleaned[key] = sanitize_payload(item)
        return cleaned
    if isinstance(value, str):
        return DATA_URL_RE.sub(lambda match: f"[embedded {match.group(1)} omitted]", value)
    return value


def transcript_content(payload: dict):
    content = payload.get("content", "")
    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, dict):
                text = item.get("text") or item.get("input_text") or item.get("output_text")
                if text:
                    parts.append(text)
        return "\n".join(parts)
    return content


def existing_codex_prompts(log_file: Path, session_id: str) -> set[str]:
    """Return prompts already persisted for one Codex session."""
    prompts = set()
    if not log_file.is_file():
        return prompts
    try:
        with open(log_file, encoding="utf-8") as source:
            for line in source:
                try:
                    entry = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if (
                    entry.get("tool") == "codex"
                    and entry.get("event") == "UserPromptSubmit"
                    and (not session_id or entry.get("session_id", "") == session_id)
                    and entry.get("prompt")
                ):
                    prompts.add(entry["prompt"])
    except OSError:
        pass
    return prompts


def sync_codex_transcript(path_value: str, log_file: Path, session_id: str = "") -> int:
    """Append missing user prompts from a Codex transcript, tracked by ordinal."""
    transcript = Path(path_value) if path_value else None
    if not transcript or not transcript.is_file():
        return 0

    state_file = log_file.parent / ".codex-import-state.json"
    try:
        state = json.loads(state_file.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        state = {}
    state_key = str(transcript.resolve())
    last_ordinal = int(state.get(state_key, -1))
    imported = []
    max_ordinal = last_ordinal
    persisted_prompts = existing_codex_prompts(log_file, session_id)

    with open(transcript, encoding="utf-8") as source:
        for line in source:
            try:
                item = json.loads(line)
            except json.JSONDecodeError:
                continue
            ordinal = int(item.get("ordinal", -1))
            if ordinal <= last_ordinal or item.get("type") != "response_item":
                continue
            payload = item.get("payload", {})
            item_type = payload.get("type", "")
            role = payload.get("role", "")
            entry = None
            if item_type == "message" and role == "user":
                prompt = transcript_content(payload)
                if not prompt or prompt in persisted_prompts:
                    max_ordinal = max(max_ordinal, ordinal)
                    continue
                entry = {
                    "ts": item.get("timestamp", ""), "tool": "codex",
                    "event": "UserPromptSubmit", "role": role,
                    "prompt": prompt, "ordinal": ordinal,
                    "session_id": session_id,
                }
            if entry:
                imported.append(repair_text(sanitize_payload(entry)))
                persisted_prompts.add(prompt)
            max_ordinal = max(max_ordinal, ordinal)

    if imported:
        with open(log_file, "a", encoding="utf-8") as target:
            for entry in imported:
                target.write(json.dumps(entry, ensure_ascii=False) + "\n")
    if max_ordinal > last_ordinal:
        state[state_key] = max_ordinal
        temporary = state_file.with_suffix(".tmp")
        temporary.write_text(json.dumps(state, ensure_ascii=False), encoding="utf-8")
        os.replace(temporary, state_file)
    return len(imported)


def git(cmd):
    try:
        return subprocess.check_output(
            cmd.split(),
            shell=False,
            text=True,
            stderr=subprocess.DEVNULL,
            timeout=2,
        ).strip()
    except Exception:
        return ""


def detect_tool(data: dict) -> str:
    """Detect which AI tool sent this hook event.

    Priority:
      1. --tool=NAME CLI argument (cross-platform: works in cmd.exe, PowerShell, bash)
      2. AI_TOOL_NAME env var (legacy, bash-only when set inline)
      3. Heuristics from payload shape
    """
    for arg in sys.argv[1:]:
        if arg.startswith("--tool="):
            return arg.split("=", 1)[1].lower()
    tool_env = os.environ.get("AI_TOOL_NAME", "").lower()
    if tool_env:
        return tool_env
    # Heuristics
    if "transcript_path" in data:
        return "codex"
    if data.get("hook_event_name", "").startswith(("Before", "After", "Session", "Pre", "Notification")):
        return "gemini"
    if data.get("hook_event_name", "")[0:1].islower():
        # camelCase event names → Cursor or Copilot
        if "workspace_roots" in data:
            return "cursor"
        if "toolName" in data:
            return "copilot"
    if "hook_event_name" in data:
        return "claude"
    return "unknown"


def normalize(data: dict, tool: str) -> dict | None:
    """Normalize tool-specific payload to common log entry."""
    event = data.get("hook_event_name") or data.get("event", "")
    ts = datetime.now(VN_TZ).isoformat()

    # Resolve repo from git origin. When cwd is not a git working tree (or
    # origin isn't set), skip the event entirely — these entries can't be
    # tied back to a team on the server and would just clutter the pending
    # queue forever.
    origin = git("git remote get-url origin")
    if not origin:
        return None
    repo = origin.rstrip("/").split("/")[-1]
    if repo.endswith(".git"):
        repo = repo[:-4]

    base = {
        "ts": ts,
        "tool": tool,
        "event": event,
        "session_id": (
            data.get("session_id") or
            data.get("conversation_id") or
            data.get("generation_id") or ""
        ),
        "model": data.get("model", ""),
        "repo": repo,
        "branch": git("git rev-parse --abbrev-ref HEAD"),
        "commit": git("git rev-parse --short HEAD"),
        "student": git("git config user.email"),
    }

    if tool == "claude":
        prompt = ""
        # UserPromptSubmit: prompt is at top level
        if event == "UserPromptSubmit":
            prompt = data.get("prompt", "")
        # PostToolUse: extract from tool_input
        elif isinstance(data.get("tool_input"), dict):
            prompt = data["tool_input"].get("prompt") or data["tool_input"].get("content") or ""
        base.update({
            "prompt": prompt,
            "tool_name": data.get("tool_name", ""),
            "tool_input": data.get("tool_input") if event != "UserPromptSubmit" else None,
            "tool_response": str(data.get("tool_response", ""))[:500],
        })

    elif tool == "gemini":
        if event == "BeforeAgent":
            prompt = data.get("prompt", "")
            base.update({"prompt": prompt})
        else:
            req = data.get("request", {})
            contents = req.get("contents", [])
            prompt = ""
            for c in reversed(contents):
                for part in c.get("parts", []):
                    if part.get("text"):
                        prompt = part["text"]
                        break
                if prompt:
                    break
            resp = data.get("response", {})
            answer = ""
            try:
                answer = resp["candidates"][0]["content"]["parts"][0]["text"][:500]
            except Exception:
                pass
            base.update({"prompt": prompt, "response_summary": answer})

    elif tool == "codex":
        base.update({
            "prompt": data.get("prompt", ""),
            "turn_id": data.get("turn_id", ""),
            "transcript_path": data.get("transcript_path", ""),
        })

    elif tool == "cursor":
        base.update({
            "prompt": data.get("prompt", ""),
            "files_context": data.get("attachments", []),
        })

    elif tool == "copilot":
        base.update({
            "prompt": data.get("prompt", ""),
            "tool_name": data.get("toolName", ""),
            "tool_args": data.get("toolArgs"),
        })

    # Skip only true noise: no prompt AND no tool-specific payload (tool_input,
    # response_summary, tool_response, tool_args, files_context). Previously
    # this only checked `prompt`, which dropped Claude Bash/Edit events (their
    # tool_input has `command` / `file_path`, not `prompt` or `content`) and
    # any Gemini/Cursor/Copilot turn that carried context but no plain prompt.
    _payload_keys = ("prompt", "tool_input", "response_summary",
                     "tool_response", "tool_args", "files_context")
    _lifecycle_events = ("Stop", "stop", "SessionEnd", "sessionEnd", "AfterModel")
    has_payload = any(base.get(k) for k in _payload_keys)
    if not has_payload and event not in _lifecycle_events:
        return None

    return base


def main():
    # Read stdin as UTF-8 explicitly. On Windows, sys.stdin defaults to the
    # system code page (e.g. cp1252), which corrupts non-Latin1 prompts
    # (Vietnamese, CJK, emoji) into mojibake. The hook payload is always UTF-8.
    raw = sys.stdin.buffer.read().decode("utf-8", errors="replace").strip()
    if not raw:
        sys.exit(0)

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        sys.exit(0)

    data = repair_text(data)
    tool = detect_tool(data)
    entry = normalize(data, tool)
    if not entry:
        sys.exit(0)

    log_dir = Path(os.environ.get("AI_LOG_DIR", ".ai-log"))
    log_dir.mkdir(exist_ok=True)
    log_file = log_dir / "session.jsonl"

    # Persist Codex prompts immediately. Stop later imports only prompts that
    # were missing from the direct hook payload, with duplicate protection.
    should_write = True
    if tool == "codex" and entry.get("event") == "UserPromptSubmit":
        prompt = entry.get("prompt", "")
        should_write = bool(prompt) and prompt not in existing_codex_prompts(
            log_file, entry.get("session_id", "")
        )
    if should_write:
        with open(log_file, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")

    imported = 0
    if tool == "codex":
        imported = sync_codex_transcript(
            data.get("transcript_path", ""), log_file, entry.get("session_id", "")
        )

    # Output valid JSON (required by some tools like Gemini)
    print(json.dumps({"status": "logged", "transcript_entries": imported}))


if __name__ == "__main__":
    main()
