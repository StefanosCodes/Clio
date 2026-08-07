from pathlib import Path
import ast

API_ROOT = Path(__file__).parents[1] / "src" / "clio"


def _imports(path: Path) -> list[str]:
    result: list[str] = []
    for node in ast.walk(ast.parse(path.read_text())):
        if isinstance(node, ast.Import):
            result.extend(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            result.append(node.module)
    return result


def test_domain_and_application_do_not_import_delivery_or_infrastructure() -> None:
    forbidden = ("clio.api", "clio.infrastructure", "fastapi", "asyncpg", "agents")
    for layer in ("domain", "application"):
        for path in (API_ROOT / layer).rglob("*.py"):
            assert not any(
                imported.startswith(forbidden) for imported in _imports(path)
            ), f"forbidden dependency in {path}"


def test_routers_contain_no_sql_or_provider_sdk_imports() -> None:
    for path in (API_ROOT / "api" / "routers").rglob("*.py"):
        source = path.read_text().lower()
        assert "select " not in source
        assert "insert " not in source
        assert "from agents" not in source
