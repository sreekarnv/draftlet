import { Wand2 } from 'lucide-react';
import { useForm } from 'react-hook-form';

import { Button } from './ui';

interface RefinementFormProps {
  disabled: boolean;
  onRefine: (instruction: string) => void;
}

interface RefinementFormValues {
  instruction: string;
}

export function RefinementForm({ disabled, onRefine }: RefinementFormProps) {
  const { handleSubmit, register, watch } = useForm<RefinementFormValues>({
    defaultValues: {
      instruction: '',
    },
  });
  const instruction = watch('instruction');
  const canSubmit = !disabled && instruction.trim().length > 0;

  return (
    <form
      className="grid gap-2"
      onSubmit={handleSubmit((values) => onRefine(values.instruction))}
    >
      <textarea
        aria-label="Follow-up instruction"
        className="min-h-20 resize-y rounded-md border border-slate-200 bg-white px-3 py-2 text-[13.5px] leading-6 text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 disabled:opacity-60"
        disabled={disabled}
        placeholder="Make this warmer"
        {...register('instruction')}
      />
      <Button
        className="w-full px-3.5"
        disabled={!canSubmit}
        type="submit"
        variant="secondary"
      >
        <Wand2 aria-hidden="true" className="h-3.5 w-3.5" />
        Refine
      </Button>
    </form>
  );
}
