import React from 'react';
import { HelpCard } from '../components/HelpCard';
import type { RuntimeState } from '../lib/types';

interface HelpPageProps {
  busy: boolean;
  runtime: RuntimeState;
  onOpenExtensionHelp: () => Promise<void>;
}

export function HelpPage({ busy, runtime, onOpenExtensionHelp }: HelpPageProps) {
  return <HelpCard busy={busy} onOpenExtensionHelp={onOpenExtensionHelp} ready={runtime.server.ok} />;
}
