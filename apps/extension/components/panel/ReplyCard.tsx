import { Copy, CornerDownLeft } from 'lucide-react';
import { useState } from 'react';

import type { InsertionResult, ReplyItem } from '../../core/types';
import { Button, Card, cn } from './ui';

interface ReplyCardProps {
  reply: ReplyItem;
  index: number;
  onInsert: (replyText: string) => Promise<InsertionResult>;
}

export function ReplyCard({ reply, index, onInsert }: ReplyCardProps) {
  const [copyLabel, setCopyLabel] = useState('Copy');
  const [insertLabel, setInsertLabel] = useState('Insert');
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
      await navigator.clipboard.writeText(reply.text);
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
      const result = await onInsert(reply.text);
      showFeedback(feedbackMessageFor(result), result.status === 'failed');
      flashButtonLabel(setInsertLabel, buttonMessageFor(result), 'Insert');
    } finally {
      setIsInserting(false);
    }
  };

  return (
    <Card className="grid gap-3 bg-white p-3.5 shadow-sm shadow-slate-200/80 ring-1 ring-slate-200/80">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
        <div className="text-[11px] font-semibold uppercase tracking-normal text-slate-500">Draft {index + 1}</div>
      </div>
      <p className="m-0 whitespace-pre-wrap text-[14px] leading-[1.65] text-slate-900">{reply.text}</p>
      <div className="flex flex-wrap items-center gap-2 pt-0.5">
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
