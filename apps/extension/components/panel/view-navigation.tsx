import { FileText, History } from 'lucide-react';

import type { PanelView } from '../../core/types';
import type { PanelViewState } from './panel-types';
import { Button } from './ui';

export function ViewNavigation({
  onSelectView,
  view,
}: {
  onSelectView: (activeView: PanelView) => void;
  view: PanelViewState;
}) {
  return (
    <nav aria-label="Draftlet workspace" className="rounded-lg bg-slate-100/80 p-1 shadow-inner shadow-white" role="tablist">
      <div className="grid grid-cols-2 gap-1">
        <Button active={view.activeView === 'replies'} onClick={() => onSelectView('replies')} type="button" variant="tab">
          <FileText aria-hidden="true" className="h-3.5 w-3.5" />
          Replies
        </Button>
        <Button active={view.activeView === 'history'} onClick={() => onSelectView('history')} type="button" variant="tab">
          <History aria-hidden="true" className="h-3.5 w-3.5" />
          History
        </Button>
      </div>
    </nav>
  );
}
