export type FieldSource = Record<string, string>;

export type MessageNodeMatch = {
  node: HTMLElement | undefined;
  source: "selection-ancestor" | "first-visible" | "missing";
};

export type CaptureContext = {
  selection: Selection | null;
  body: string;
  url: string;
  messageNodes: HTMLElement[];
  messageNode: HTMLElement | undefined;
  messageNodeSource: MessageNodeMatch["source"];
  fieldSources: FieldSource;
};

export type FieldResult<T> = {
  value: T;
  source: string;
};
