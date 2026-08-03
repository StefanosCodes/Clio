from __future__ import annotations

import json
from pathlib import Path

from clio.main import create_app

OUTPUT = Path(__file__).parents[3] / "packages" / "api-client" / "openapi.json"
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
OUTPUT.write_text(json.dumps(create_app().openapi(), indent=2, sort_keys=True) + "\n")
