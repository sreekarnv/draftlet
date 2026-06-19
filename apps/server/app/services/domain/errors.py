from app.db.models import GenerationRun


class GenerationRunConflictError(RuntimeError):
    def __init__(self, code: str, message: str, run: GenerationRun) -> None:
        super().__init__(message)
        self.code = code
        self.run = run
