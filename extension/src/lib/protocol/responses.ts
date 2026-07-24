import { z } from 'zod';

export const errorCodeSchema = z.enum([
	'RUNTIME_OFFLINE',
	'RUNTIME_TIMEOUT',
	'RUNTIME_HTTP',
	'RUNTIME_UNAUTHORIZED',
	'DRAFT_NOT_FOUND',
	'NO_SELECTION',
	'NOT_GMAIL_TAB',
	'NO_COMPOSE_EDITOR',
	'CONTENT_SCRIPT_UNAVAILABLE',
	'INVALID_MESSAGE',
	'UNKNOWN',
]);

export type ErrorCode = z.infer<typeof errorCodeSchema>;

export const errorPayloadSchema = z.object({
	code: errorCodeSchema,
	message: z.string(),
	status: z.number().optional(),
});

export type ErrorPayload = z.infer<typeof errorPayloadSchema>;

export type RuntimeResponse<T> =
	| { ok: true; result: T }
	| { ok: false; error: ErrorPayload };

export class ExtensionError extends Error {
	readonly code: ErrorCode;
	readonly status?: number;

	constructor(code: ErrorCode, message: string, status?: number) {
		super(message);
		this.name = 'ExtensionError';
		this.code = code;
		this.status = status;
	}
}

export function responseSchema<T extends z.ZodType>(resultSchema: T) {
	return z.discriminatedUnion('ok', [
		z.object({ ok: z.literal(true), result: resultSchema }),
		z.object({ ok: z.literal(false), error: errorPayloadSchema }),
	]);
}

export function toErrorPayload(error: unknown): ErrorPayload {
	if (error instanceof ExtensionError) {
		return {
			code: error.code,
			message: error.message,
			...(error.status ? { status: error.status } : {}),
		};
	}

	if (error instanceof Error) {
		return { code: 'UNKNOWN', message: error.message };
	}

	return { code: 'UNKNOWN', message: String(error) };
}
