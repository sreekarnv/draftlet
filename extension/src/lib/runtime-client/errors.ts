import { ExtensionError, type ErrorCode } from "@/lib/protocol";

export class RuntimeError extends ExtensionError {
  constructor(code: ErrorCode, message: string, status?: number) {
    super(code, message, status);
    this.name = "RuntimeError";
  }
}
