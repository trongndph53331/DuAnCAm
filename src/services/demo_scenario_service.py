from __future__ import annotations

import json
from pathlib import Path
from typing import Any
from uuid import uuid4


class DemoScenarioService:
    def __init__(self, metadata_path: Path = Path("data/demo_scenarios.json")) -> None:
        self.metadata_path = metadata_path

    def list(self) -> list[dict[str, str]]:
        try:
            payload: Any = json.loads(self.metadata_path.read_text(encoding="utf-8"))
        except (FileNotFoundError, json.JSONDecodeError, OSError):
            return []
        if not isinstance(payload, list):
            return []
        return [
            {"id": item["id"], "name": item["name"], "source": item["source"]}
            for item in payload
            if isinstance(item, dict)
            and all(isinstance(item.get(key), str) and item[key] for key in ("id", "name", "source"))
        ]

    def get(self, scenario_id: str) -> dict[str, str] | None:
        return next((item for item in self.list() if item["id"] == scenario_id), None)

    def add(self, name: str, source: str) -> dict[str, str]:
        items = self.list()
        scenario = {"id": str(uuid4()), "name": name.strip(), "source": source}
        items.append(scenario)
        self._write(items)
        return scenario

    def delete(self, scenario_id: str) -> dict[str, str] | None:
        items = self.list()
        scenario = next((item for item in items if item["id"] == scenario_id), None)
        if scenario is None:
            return None
        self._write([item for item in items if item["id"] != scenario_id])
        return scenario

    def _write(self, items: list[dict[str, str]]) -> None:
        self.metadata_path.parent.mkdir(parents=True, exist_ok=True)
        temporary = self.metadata_path.with_suffix(".tmp")
        temporary.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")
        temporary.replace(self.metadata_path)


demo_scenario_service = DemoScenarioService()
