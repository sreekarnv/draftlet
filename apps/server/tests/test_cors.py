import pytest

from app.core import config as config_module


@pytest.fixture
def reload_config(monkeypatch: pytest.MonkeyPatch):
    config_module.get_settings.cache_clear()
    yield monkeypatch
    config_module.get_settings.cache_clear()


def test_default_cors_allowlist_is_loopback_only(reload_config: pytest.MonkeyPatch) -> None:
    reload_config.delenv("DRAFTLET_CORS_ALLOW_ORIGINS", raising=False)
    reload_config.delenv("DRAFTLET_CORS_ALLOW_ORIGIN_REGEX", raising=False)
    settings = config_module.get_settings()

    assert "http://127.0.0.1:47632" in settings.cors_allow_origins
    assert "http://localhost:47632" in settings.cors_allow_origins
    assert all(
        origin.startswith(("http://127.0.0.1:", "http://localhost:"))
        for origin in settings.cors_allow_origins
    )
    assert settings.cors_allow_origin_regex == r"chrome-extension://[a-z]+"


def test_cors_allow_origins_can_be_overridden_via_env(reload_config: pytest.MonkeyPatch) -> None:
    reload_config.setenv(
        "DRAFTLET_CORS_ALLOW_ORIGINS",
        "http://example.test:1234, http://other.test:5678",
    )
    settings = config_module.get_settings()

    assert settings.cors_allow_origins == [
        "http://example.test:1234",
        "http://other.test:5678",
    ]


def test_cors_allow_origin_regex_can_be_disabled(reload_config: pytest.MonkeyPatch) -> None:
    reload_config.setenv("DRAFTLET_CORS_ALLOW_ORIGIN_REGEX", "disabled")
    settings = config_module.get_settings()

    assert settings.cors_allow_origin_regex is None


def test_cors_allow_origin_regex_can_be_overridden_via_env(reload_config: pytest.MonkeyPatch) -> None:
    reload_config.setenv(
        "DRAFTLET_CORS_ALLOW_ORIGIN_REGEX",
        r"chrome-extension://abcdefghijklmnopqrstuvwxyzabcdef",
    )
    settings = config_module.get_settings()

    assert (
        settings.cors_allow_origin_regex
        == r"chrome-extension://abcdefghijklmnopqrstuvwxyzabcdef"
    )
