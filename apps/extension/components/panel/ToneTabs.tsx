import { TONES } from '../../core/constants';
import type { Tone } from '../../core/types';
import { Button } from './ui';

interface ToneTabsProps {
  selectedTone: Tone;
  onSelect: (tone: Tone) => void;
}

export function ToneTabs({ selectedTone, onSelect }: ToneTabsProps) {
  return (
    <div aria-label="Reply tone" className="grid w-full min-w-0 grid-cols-3 gap-1 rounded-md bg-slate-100/80 p-1" role="tablist">
      {TONES.map((tone) => (
        <Button
          active={tone === selectedTone}
          aria-selected={tone === selectedTone}
          key={tone}
          onClick={() => onSelect(tone)}
          role="tab"
          type="button"
          variant="tab"
        >
          {tone}
        </Button>
      ))}
    </div>
  );
}
