import { Check, Copy, CornerDownLeft, MousePointer2 } from 'lucide-react';
import { useState } from 'react';

import type { DraftVariant } from '../../core/messages';
import type { InsertionResult } from '../../core/types';
import type { VariantActionResult } from '../../ui/mount-panel';
import { Button, Card, cn } from './ui';

interface ReplyCardProps {
  variant: DraftVariant;
  index: number;
  onInsert: (replyText: string, variantId?: string) => Promise<InsertionResult>;
  onSelectVariant?: (variantId: string) => Promise<VariantActionResult>;
  onAcceptVariant?: (variantId: string) => Promise<VariantActionResult>;
}

export function ReplyCard({ variant, index, onInsert, onSelectVariant, onAcceptVariant }: ReplyCardProps) {
  const [copyLabel, setCopyLabel] = useState('Copy');
  const [insertLabel, setInsertLabel] = useState('Insert');
  const [selectLabel, setSelectLabel] = useState('Use');
  const [acceptLabel, setAcceptLabel] = useState('Accept');
  const [feedback, setFeedback] = useState('');
  const [isError, setIsError] = useState(false);
  const [isInserting, setIsInserting] = useState(false);

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
      await navigator.clipboard.writeText(variant.content);
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
      const result = await onInsert(variant.content, variant.variantId);
      showFeedback(feedbackMessageFor(result), result.status === 'failed');
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
      <p className="m-0 whitespace-pre-wrap text-[14px] leading-[1.65] text-slate-900">{variant.content}</p>
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

function feedbackMessageFor(result: InsertionResult) {
  if (result.status === 'inserted') {
    return 'Inserted into the focused field.';
  }

  if (result.status === 'copied') {
    return 'Could not insert here, so it was copied instead.';
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
