import { ExtensionError } from "@/lib/protocol";

export function selectedPlainText(selection: Selection | null): string {
  const text = selection?.toString() ?? "";
  const body = text
    .split(/\r?\n/)
    .map((line) => line.replace(/[ \t\f\v]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!body) {
    throw new ExtensionError(
      "NO_SELECTION",
      "Select the Gmail text you want Draftlet to capture, then try again.",
    );
  }

  return body;
}
