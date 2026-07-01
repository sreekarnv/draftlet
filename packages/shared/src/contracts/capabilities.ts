export type CapabilitySurface = 'desktop' | 'extension' | 'runtime';

export interface CapabilitySchemaShape {
  type?: string;
  properties?: Record<string, unknown>;
  required?: string[];
  items?: unknown;
}

export interface Capability {
  id: string;
  surface: CapabilitySurface;
  title: string;
  description: string;
  payloadSchema: CapabilitySchemaShape;
  resultSchema: CapabilitySchemaShape;
  icon?: string;
  version: string;
  deprecatedSince?: string;
}
