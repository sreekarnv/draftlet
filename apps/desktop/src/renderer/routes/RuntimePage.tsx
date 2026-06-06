import { ServerControlCard } from '../components/ServerControlCard';
import type { RuntimeState } from '../lib/types';

interface RuntimePageProps {
  busy: boolean;
  runtime: RuntimeState;
  onRestartServer: () => Promise<void>;
  onStartServer: () => Promise<void>;
  onStopServer: () => Promise<void>;
}

export function RuntimePage({ busy, runtime, onRestartServer, onStartServer, onStopServer }: RuntimePageProps) {
  return (
    <section className="grid gap-3">
      <ServerControlCard
        busy={busy}
        onRestart={onRestartServer}
        onStart={onStartServer}
        onStop={onStopServer}
        status={runtime.server}
      />
    </section>
  );
}
