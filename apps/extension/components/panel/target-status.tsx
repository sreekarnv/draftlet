import { ExternalLink, RefreshCw } from 'lucide-react';

import type { InsertionTargetViewState } from '../../ui/mount-panel';
import {
  recaptureTrailToneClass,
  tabCandidateLabel,
  targetStatusLabel,
  targetToneClass,
} from './panel-display';
import type { PanelViewState } from './panel-types';
import { Button, cn } from './ui';

interface TargetStatusProps {
  view: PanelViewState;
  onActivateRecaptureTab: (tabId: number) => Promise<void>;
  onRecaptureInsertionTarget: (tabId?: number) => Promise<void>;
}

export function TargetStatus({
  onActivateRecaptureTab,
  onRecaptureInsertionTarget,
  view,
}: TargetStatusProps) {
  const canRecapture = view.insertionTarget.status !== 'live';
  const needsTabChoice = view.insertionTarget.status === 'tab_disambiguation_required'
    && (view.insertionTarget.candidates?.length ?? 0) > 0;
  const needsFocusedRetry = view.insertionTarget.status === 'needs_focus';
  const selectedTabLabel = view.insertionTarget.selectedTab
    ? tabCandidateLabel(view.insertionTarget.selectedTab)
    : '';
  const actionLabel = needsFocusedRetry ? 'Retry recapture' : 'Recapture';

  return (
    <div className="grid justify-items-end gap-1.5">
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <div
          className={cn('text-[11px] font-medium leading-4', targetToneClass(view.insertionTarget.status))}
          title={view.insertionTarget.message}
        >
          {targetStatusLabel(view.insertionTarget)}
        </div>
        {canRecapture && !needsTabChoice ? (
          <Button
            aria-label="Recapture insertion target"
            className="h-6 px-2 text-[11px] leading-4"
            onClick={() => void onRecaptureInsertionTarget(view.insertionTarget.selectedTab?.tabId)}
            type="button"
            variant="secondary"
          >
            <RefreshCw aria-hidden="true" className="h-3 w-3" />
            {actionLabel}
          </Button>
        ) : null}
      </div>
      {selectedTabLabel ? (
        <div className="flex max-w-[17rem] flex-wrap items-center justify-end gap-1.5 text-right">
          <div className="min-w-0 truncate text-[11px] leading-4 text-slate-500" title={view.insertionTarget.selectedTab?.url}>
            Selected: {selectedTabLabel}
          </div>
          <Button
            aria-label="Open selected tab for recapture"
            className="h-6 px-2 text-[11px] leading-4"
            onClick={() => void onActivateRecaptureTab(view.insertionTarget.selectedTab!.tabId)}
            type="button"
            variant="secondary"
          >
            <ExternalLink aria-hidden="true" className="h-3 w-3" />
            Open tab
          </Button>
        </div>
      ) : null}
      {view.insertionTarget.message && view.insertionTarget.status !== 'live' ? (
        <p className="m-0 max-w-[17rem] text-right text-[11px] leading-4 text-slate-500">
          {view.insertionTarget.message}
        </p>
      ) : null}
      {view.insertionTarget.trail?.length ? <RecaptureTrail trail={view.insertionTarget.trail} /> : null}
      {needsTabChoice ? (
        <TabCandidates
          candidates={view.insertionTarget.candidates!}
          onRecaptureInsertionTarget={onRecaptureInsertionTarget}
        />
      ) : null}
    </div>
  );
}

function RecaptureTrail({ trail }: { trail: NonNullable<InsertionTargetViewState['trail']> }) {
  const visibleTrail = trail.slice(-3);

  return (
    <div className="grid max-w-[17rem] justify-items-end gap-0.5 text-right" aria-label="Recapture status">
      {visibleTrail.map((item) => (
        <div className="flex max-w-full items-center justify-end gap-1.5" key={`${item.at}-${item.event}`}>
          <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', recaptureTrailToneClass(item.level))} aria-hidden="true" />
          <span className="min-w-0 truncate text-[11px] leading-4 text-slate-500" title={item.message}>
            {item.message}
          </span>
        </div>
      ))}
    </div>
  );
}

function TabCandidates({
  candidates,
  onRecaptureInsertionTarget,
}: {
  candidates: NonNullable<InsertionTargetViewState['candidates']>;
  onRecaptureInsertionTarget: (tabId?: number) => Promise<void>;
}) {
  return (
    <div className="grid max-w-full justify-items-end gap-1 rounded-md bg-white/80 p-1.5 text-right ring-1 ring-slate-200/80">
      <div className="text-[11px] font-medium leading-4 text-slate-500">Choose tab</div>
      <div className="grid max-w-[17rem] gap-1">
        {candidates.slice(0, 4).map((candidate) => (
          <Button
            aria-label={`Use ${candidate.title || candidate.origin || 'matching tab'} for recapture`}
            className="h-auto justify-start px-2 py-1 text-left text-[11px] leading-4"
            key={candidate.tabId}
            onClick={() => void onRecaptureInsertionTarget(candidate.tabId)}
            title={candidate.url}
            type="button"
            variant="secondary"
          >
            <span className="min-w-0 truncate">{tabCandidateLabel(candidate)}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}
