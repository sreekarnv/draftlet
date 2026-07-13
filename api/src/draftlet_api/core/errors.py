class DraftletApiError(Exception):
    def __init__(self, status: int, code: str, detail: str):
        self.status = status
        self.code = code
        self.detail = detail


class NotFoundError(DraftletApiError):
    def __init__(self, resource: str, resource_id: str):
        super().__init__(
            404, f"{resource}_not_found", f"No {resource} with id {resource_id}"
        )


class ProviderError(DraftletApiError):
    def __init__(self, detail: str):
        super().__init__(503, "generation_provider_unavailable", detail)


class ConnectorError(DraftletApiError):
    def __init__(self, code: str, detail: str, status: int = 400):
        super().__init__(status, code, detail)
