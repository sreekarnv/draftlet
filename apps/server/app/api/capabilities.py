from typing import Any

from fastapi import APIRouter

from app.schemas.capabilities import Capability, CapabilitySchemaShape, CapabilitySurface


router = APIRouter(prefix="/capabilities", tags=["capabilities"])


EMPTY_OBJECT_SCHEMA = CapabilitySchemaShape(type="object", properties={}, required=[])


def _object_schema(*, properties: dict[str, Any] | None = None, required: list[str] | None = None) -> CapabilitySchemaShape:
    return CapabilitySchemaShape(
        type="object",
        properties=properties or {},
        required=required or [],
    )


def _array_object_schema() -> CapabilitySchemaShape:
    return CapabilitySchemaShape(
        type="array",
        properties={},
        required=[],
        items={"type": "object"},
    )


def _list_capabilities() -> list[Capability]:
    return [
        Capability(
            id="thread.list",
            surface="runtime",
            title="List conversation threads",
            description="List cross-session conversation threads with pagination and source-domain or status filters.",
            payloadSchema=_object_schema(
                properties={
                    "limit": {"type": "integer", "minimum": 1, "maximum": 100},
                    "offset": {"type": "integer", "minimum": 0},
                    "sourceDomain": {"type": "string"},
                    "status": {"type": "string"},
                }
            ),
            resultSchema=_object_schema(
                properties={
                    "items": {
                        "type": "array",
                        "items": {"type": "object"},
                    },
                    "total": {"type": "integer", "minimum": 0},
                    "limit": {"type": "integer", "minimum": 1},
                    "offset": {"type": "integer", "minimum": 0},
                },
                required=["items", "total", "limit", "offset"],
            ),
            version="0.2.0",
        ),
        Capability(
            id="thread.read",
            surface="runtime",
            title="Read a single conversation thread",
            description="Return a full conversation thread snapshot including its turns, variants, and latest recoverable run projection.",
            payloadSchema=_object_schema(
                properties={"threadId": {"type": "string", "minLength": 1}},
                required=["threadId"],
            ),
            resultSchema=_object_schema(
                properties={
                    "thread": {"type": "object"},
                    "turns": {"type": "array", "items": {"type": "object"}},
                    "variants": {"type": "array", "items": {"type": "object"}},
                    "latestRecoverableRun": {"type": "object"},
                },
                required=["thread", "turns", "variants"],
            ),
            version="0.2.0",
        ),
        Capability(
            id="thread.history",
            surface="runtime",
            title="List recent domain history",
            description="Return a recent, session-scoped list of workspace sessions and their most recent conversation thread snapshot.",
            payloadSchema=_object_schema(
                properties={
                    "limit": {"type": "integer", "minimum": 1, "maximum": 100},
                }
            ),
            resultSchema=_array_object_schema(),
            version="0.2.0",
        ),
        Capability(
            id="runtime.status",
            surface="runtime",
            title="Read runtime health and version",
            description="Return health and version information describing the running Draftlet runtime.",
            payloadSchema=EMPTY_OBJECT_SCHEMA,
            resultSchema=_object_schema(
                properties={
                    "status": {"type": "string"},
                    "service": {"type": "string"},
                    "app": {"type": "string"},
                    "version": {"type": "string"},
                },
                required=["status", "service", "app", "version"],
            ),
            version="0.2.0",
        ),
        Capability(
            id="runtime.model_state",
            surface="runtime",
            title="Read runtime model state",
            description="Return the currently selected and default Ollama models, the installed model list, and Ollama availability.",
            payloadSchema=EMPTY_OBJECT_SCHEMA,
            resultSchema=_object_schema(
                properties={
                    "selectedModel": {"type": "string"},
                    "defaultModel": {"type": "string"},
                    "installedModels": {"type": "array", "items": {"type": "object"}},
                    "recommendations": {"type": "array", "items": {"type": "object"}},
                    "ollamaAvailable": {"type": "boolean"},
                    "error": {"type": "object"},
                },
                required=["selectedModel", "defaultModel", "ollamaAvailable"],
            ),
            version="0.2.0",
        ),
        Capability(
            id="runtime.preferences.read",
            surface="runtime",
            title="List runtime preferences",
            description="Return the runtime's stored preferences, optionally filtered by scope.",
            payloadSchema=_object_schema(
                properties={"scope": {"type": "string"}},
            ),
            resultSchema=_array_object_schema(),
            version="0.2.0",
        ),
        Capability(
            id="runtime.preferences.write",
            surface="runtime",
            title="Upsert a runtime preference",
            description="Create or update a runtime preference under a given scope and key.",
            payloadSchema=_object_schema(
                properties={
                    "scope": {"type": "string", "minLength": 1},
                    "key": {"type": "string", "minLength": 1},
                    "value": {"type": "string"},
                },
                required=["scope", "key", "value"],
            ),
            resultSchema=_object_schema(
                properties={
                    "id": {"type": "integer"},
                    "scope": {"type": "string"},
                    "key": {"type": "string"},
                    "value": {"type": "string"},
                },
                required=["id", "scope", "key", "value"],
            ),
            version="0.2.0",
        ),
        Capability(
            id="search.turns",
            surface="runtime",
            title="Search turns",
            description="Search across turns to locate draft generation history by instruction, tone, or status.",
            payloadSchema=_object_schema(
                properties={
                    "query": {"type": "string"},
                    "tone": {"type": "string"},
                    "status": {"type": "string"},
                    "limit": {"type": "integer", "minimum": 1, "maximum": 100},
                },
            ),
            resultSchema=_array_object_schema(),
            version="0.2.0",
        ),
        Capability(
            id="search.variants",
            surface="runtime",
            title="Search draft variants",
            description="Search across draft variants to locate generated reply text by tone, length, or status.",
            payloadSchema=_object_schema(
                properties={
                    "query": {"type": "string"},
                    "tone": {"type": "string"},
                    "status": {"type": "string"},
                    "limit": {"type": "integer", "minimum": 1, "maximum": 100},
                },
            ),
            resultSchema=_array_object_schema(),
            version="0.2.0",
        ),
        Capability(
            id="support.bundle",
            surface="runtime",
            title="Read a privacy-bounded support bundle",
            description="Return a snapshot of runtime version, model state, recapture and maintenance diagnostics, preference keys, and durable record counts. The bundle never contains selected text, draft content, or PII.",
            payloadSchema=EMPTY_OBJECT_SCHEMA,
            resultSchema=_object_schema(
                properties={
                    "capturedAt": {"type": "string"},
                    "runtime": {"type": "object"},
                    "models": {"type": "object"},
                    "recapture": {"type": "object"},
                    "maintenance": {"type": "object"},
                    "preferences": {"type": "object"},
                    "counts": {"type": "object"},
                },
                required=["capturedAt", "runtime", "models", "counts"],
            ),
            version="0.2.0",
        ),
        Capability(
            id="version.read",
            surface="runtime",
            title="Read runtime version",
            description="Return the runtime version, schema version, API version, server port, and default model.",
            payloadSchema=EMPTY_OBJECT_SCHEMA,
            resultSchema=_object_schema(
                properties={
                    "runtimeVersion": {"type": "string"},
                    "schemaVersion": {"type": "string"},
                    "apiVersion": {"type": "string"},
                    "serverPort": {"type": "integer"},
                    "defaultModel": {"type": "string"},
                    "capturedAt": {"type": "string"},
                },
                required=[
                    "runtimeVersion",
                    "schemaVersion",
                    "apiVersion",
                    "serverPort",
                    "defaultModel",
                    "capturedAt",
                ],
            ),
            version="0.2.0",
        ),
    ]


@router.get("", response_model=list[Capability])
def get_capabilities() -> list[Capability]:
    return _list_capabilities()


__all__ = [
    "Capability",
    "CapabilitySchemaShape",
    "CapabilitySurface",
    "get_capabilities",
    "router",
]
