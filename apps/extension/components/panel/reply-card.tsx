import { Check, Copy, CornerDownLeft, MousePointer2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { DraftVariant } from '../../core/messages';
import type { InsertionResult, InsertionTargetStatus } from '../../core/types';
import type { VariantActionResult } from '../../ui/mount-panel';
import { Button, Card, cn } from './ui';

interface ReplyCardProps {
  variant: DraftVariant;
  index: number;
  onInsert: (replyText: string, variantId?: string) => Promise<InsertionResult>;
  onSelectVariant?: (variantId: string) => Promise<VariantActionResult>;
  onAcceptVariant?: (variantId: string) => Promise<VariantActionResult>;
  targetStatus: InsertionTargetStatus;
}

export function ReplyCard({ variant, index, onInsert, onSelectVariant, onAcceptVariant, targetStatus }: ReplyCardProps) {
  const [copyLabel, setCopyLabel] = useState('Copy');
  const [insertLabel, setInsertLabel] = useState('Insert');
  const [selectLabel, setSelectLabel] = useState('Use');
  const [acceptLabel, setAcceptLabel] = useState('Accept');
  const [feedback, setFeedback] = useState('');
  const [isError, setIsError] = useState(false);
  const [isInserting, setIsInserting] = useState(false);
  const [draftText, setDraftText] = useState(variant.content);

  useEffect(() => {
    setDraftText((current) => current === variant.content ? current : variant.content);
  }, [variant.content, variant.variantId]);

  const showFeedback = (message: string, error = false) => {
    setFeedback(message);
    setIsError(error);
  };

  const flashButtonLabel = (setLabel: (label: string) => void, message: string, fallback: string) => {
    setLabel(message);
    window.setTimeout(() => {
      setLabel(fallback);
    }, 1400);
  };

  const copyReply = async () => {
    try {
      await navigator.clipboard.writeText(draftText);
      showFeedback('Copied to clipboard.');
      flashButtonLabel(setCopyLabel, 'Copied', 'Copy');
    } catch {
      showFeedback('Could not copy this reply.', true);
      flashButtonLabel(setCopyLabel, 'Copy failed', 'Copy');
    }
  };

  const insertReply = async () => {
    setIsInserting(true);
    showFeedback('Trying to insert...');

    try {
      const result = await onInsert(draftText, variant.variantId);
      showFeedback(feedbackMessageFor(result, targetStatus), result.status === 'failed');
      flashButtonLabel(setInsertLabel, buttonMessageFor(result), 'Insert');
    } finally {
      setIsInserting(false);
    }
  };

  const updateVariantState = async (action: 'select' | 'accept') => {
    const callback = action === 'select' ? onSelectVariant : onAcceptVariant;

    if (!callback) {
      return;
    }

    const setLabel = action === 'select' ? setSelectLabel : setAcceptLabel;
    const fallback = action === 'select' ? 'Use' : 'Accept';
    const working = action === 'select' ? 'Selecting...' : 'Accepting...';
    setLabel(working);

    const result = await callback(variant.variantId);
    showFeedback(result.message, !result.ok);
    flashButtonLabel(setLabel, result.ok ? 'Done' : 'Failed', fallback);
  };

  return (
    <Card className={cn(
      'grid gap-3 bg-white p-3.5 shadow-sm shadow-slate-200/80 ring-1 ring-slate-200/80',
      variant.isCurrent && 'ring-slate-500',
      variant.status === 'accepted' && 'bg-emerald-50/60 ring-emerald-300',
    )}>
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
        <div className="text-[11px] font-semibold uppercase tracking-normal text-slate-500">Draft {index + 1}</div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {variant.isCurrent ? <StateBadge label="Selected" tone="slate" /> : null}
          {variant.status === 'accepted' ? <StateBadge label="Accepted" tone="emerald" /> : null}
        </div>
      </div>
      <textarea
        aria-label={`Draft ${index + 1} text`}
        className="min-h-28 resize-y rounded-md border border-slate-200 bg-white px-3 py-2 text-[14px] leading-[1.65] text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
        onChange={(event) => setDraftText(event.currentTarget.value)}
        value={draftText}
      />
      <div className="flex flex-wrap items-center gap-2 pt-0.5">
        {onSelectVariant ? (
          <Button disabled={variant.isCurrent} onClick={() => void updateVariantState('select')} type="button" variant="secondary">
            <MousePointer2 aria-hidden="true" className="h-3.5 w-3.5" />
            {variant.isCurrent ? 'Selected' : selectLabel}
          </Button>
        ) : null}
        {onAcceptVariant ? (
          <Button disabled={variant.status === 'accepted'} onClick={() => void updateVariantState('accept')} type="button" variant="secondary">
            <Check aria-hidden="true" className="h-3.5 w-3.5" />
            {variant.status === 'accepted' ? 'Accepted' : acceptLabel}
          </Button>
        ) : null}
        <Button onClick={copyReply} type="button" variant="secondary">
          <Copy aria-hidden="true" className="h-3.5 w-3.5" />
          {copyLabel}
        </Button>
        <Button disabled={isInserting} onClick={insertReply} type="button" variant="secondary">
          <CornerDownLeft aria-hidden="true" className="h-3.5 w-3.5" />
          {insertLabel}
        </Button>
      </div>
      <div className={cn('min-h-5 text-xs leading-5 text-slate-500', isError && 'text-rose-600')} role="status">
        {feedback}
      </div>
    </Card>
  );
}

function buttonMessageFor(result: InsertionResult) {
  if (result.status === 'inserted') {
    return 'Inserted';
  }

  if (result.status === 'copied') {
    return 'Copied';
  }

  return 'Failed';
}

function feedbackMessageFor(result: InsertionResult, previousTargetStatus: InsertionTargetStatus) {
  if (result.status === 'inserted') {
    return 'Inserted into the focused field.';
  }

  if (result.status === 'copied') {
    if (result.targetStatus === 'stale' || previousTargetStatus === 'stale') {
      return 'Saved target was stale, so this was copied instead.';
    }

    if (
      result.targetStatus === 'needs_recapture'
      || previousTargetStatus === 'needs_recapture'
      || result.targetStatus === 'needs_focus'
      || previousTargetStatus === 'needs_focus'
    ) {
      return 'Could not insert here, so it was copied instead.';
    }

    return 'Could not insert here, so it was copied instead.';
  }

  if (result.targetStatus === 'unavailable') {
    return 'Draftlet cannot reach the compose field. Use Copy and paste manually.';
  }

  if (result.targetStatus === 'tab_disambiguation_required' || previousTargetStatus === 'tab_disambiguation_required') {
    return 'Draftlet cannot reach the original compose field. Use Copy and paste manually.';
  }

  if (result.targetStatus === 'needs_focus' || previousTargetStatus === 'needs_focus') {
    return 'Click the compose field on the original page, then try inserting again.';
  }

  return 'Could not insert or copy this reply.';
}


function StateBadge({ label, tone }: { label: string; tone: 'emerald' | 'slate' }) {
  return (
    <span className={cn(
      'rounded-full px-2 py-0.5 text-[11px] font-semibold leading-4 ring-1',
      tone === 'emerald' && 'bg-emerald-100 text-emerald-800 ring-emerald-200',
      tone === 'slate' && 'bg-slate-100 text-slate-700 ring-slate-200',
    )}>
      {label}
    </span>
  );
}
