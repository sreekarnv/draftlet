from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass(frozen=True)
class ConnectorDaemonStatus:
    kind: str
    state: str
    running: bool
    error: str | None = None
    paused: bool = False


class BaseConnector(ABC):
    kind: str

    @abstractmethod
    async def start(self) -> None:
        raise NotImplementedError

    @abstractmethod
    async def stop(self) -> None:
        raise NotImplementedError

    @abstractmethod
    def status(self) -> ConnectorDaemonStatus:
        raise NotImplementedError

    async def pause(self) -> None:
        await self.stop()

    async def resume(self) -> None:
        await self.start()

    async def sync_once(self) -> None:
        return None
