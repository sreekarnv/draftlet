export type TargetLogEvent =
  | 'captured'
  | 'recapture status'
  | 'inserting into cached target'
  | 'unavailable';

export type TargetLogField = string | number | boolean | null | undefined;

export function logTargetEvent(event: TargetLogEvent, fields?: Record<string, TargetLogField>): void {
  const parts: string[] = [`[draftlet:target]`, event];

  if (fields) {
    for (const [key, value] of Object.entries(fields)) {
      if (value === undefined || value === null) {
        continue;
      }
      parts.push(`${key}=${value}`);
    }
  }

  // eslint-disable-next-line no-console
  console.info(parts.join(' '));
}
