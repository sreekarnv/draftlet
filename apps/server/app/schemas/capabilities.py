from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


CapabilitySurface = Literal["desktop", "extension", "runtime"]


class CapabilitySchemaShape(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: str | None = Field(default=None, min_length=1, max_length=40)
    properties: dict[str, object] | None = None
    required: list[str] | None = None
    items: object | None = None


class Capability(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1, max_length=120)
    surface: CapabilitySurface
    title: str = Field(min_length=1, max_length=160)
    description: str = Field(min_length=1, max_length=1000)
    payloadSchema: CapabilitySchemaShape
    resultSchema: CapabilitySchemaShape
    icon: str | None = Field(default=None, max_length=80)
    version: str = Field(min_length=1, max_length=40)
    deprecatedSince: str | None = Field(default=None, max_length=40)
