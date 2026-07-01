from datetime import UTC, datetime, timedelta
from pathlib import Path
import tomllib

from app.api.capabilities import _list_capabilities, get_capabilities
from app.api.health import version
from app.core.config import (
    API_VERSION,
    RUNTIME_VERSION,
    SCHEMA_VERSION,
    get_runtime_version,
    get_server_port,
)
from app.main import app
from app.schemas.capabilities import Capability, CapabilitySchemaShape
from app.schemas.health import VersionInfo


REQUIRED_CAPABILITY_IDS = {
    "thread.list",
    "thread.read",
    "thread.history",
    "runtime.status",
    "runtime.model_state",
    "runtime.preferences.read",
    "runtime.preferences.write",
    "search.turns",
    "search.variants",
    "support.bundle",
    "version.read",
}


def test_capabilities_endpoint_is_registered() -> None:
    assert any(
        route.path == "/capabilities" and "GET" in route.methods
        for route in app.routes
        if hasattr(route, "methods")
    )


def test_capabilities_endpoint_returns_at_least_ten_capabilities() -> None:
    capabilities = get_capabilities()
    assert len(capabilities) >= 10
    assert REQUIRED_CAPABILITY_IDS.issubset({capability.id for capability in capabilities})


def test_capabilities_endpoint_returns_typed_models() -> None:
    capabilities = get_capabilities()

    for capability in capabilities:
        assert isinstance(capability, Capability)
        assert isinstance(capability.payloadSchema, CapabilitySchemaShape)
        assert isinstance(capability.resultSchema, CapabilitySchemaShape)
        assert capability.surface in {"desktop", "extension", "runtime"}
        assert capability.title
        assert capability.description
        assert capability.version
        assert capability.deprecatedSince is None or capability.deprecatedSince


def test_capabilities_have_unique_ids() -> None:
    capabilities = get_capabilities()
    ids = [capability.id for capability in capabilities]
    assert len(ids) == len(set(ids))


def test_capabilities_static_list_matches_endpoint_response() -> None:
    static = _list_capabilities()
    from_endpoint = get_capabilities()
    assert [c.id for c in static] == [c.id for c in from_endpoint]


def test_capability_payload_and_result_schemas_are_well_formed() -> None:
    for capability in get_capabilities():
        assert capability.payloadSchema is not None
        assert capability.resultSchema is not None


def test_version_endpoint_is_registered() -> None:
    assert any(
        route.path == "/version" and "GET" in route.methods
        for route in app.routes
        if hasattr(route, "methods")
    )


def test_version_endpoint_returns_current_pyproject_version() -> None:
    pyproject_path = Path(__file__).resolve().parents[1] / "pyproject.toml"

    with pyproject_path.open("rb") as handle:
        data = tomllib.load(handle)
    expected = str(data["project"]["version"])

    assert get_runtime_version() == expected
    assert RUNTIME_VERSION == expected

    settings = type("S", (), {"default_model": "gemma3:4b"})()
    info = version(settings=settings)
    assert isinstance(info, VersionInfo)
    assert info.runtime_version == expected
    assert info.schema_version == SCHEMA_VERSION
    assert info.api_version == API_VERSION
    assert info.default_model == "gemma3:4b"
    assert info.server_port == get_server_port()
    assert info.captured_at <= datetime.now(UTC) + timedelta(seconds=5)
    assert info.captured_at >= datetime.now(UTC) - timedelta(seconds=30)
