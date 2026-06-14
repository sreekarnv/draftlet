import {
  Badge as SharedBadge,
  Button as SharedButton,
  Card as SharedCard,
  Separator,
  type BadgeProps,
  type ButtonProps,
  type CardProps,
} from '@draftlet/shared/ui';

export { cn } from '@draftlet/shared/utils';
export { Separator };
export type { BadgeProps, ButtonProps, CardProps };

export function Button({ size = 'regular', variant = 'primary', ...props }: ButtonProps) {
  return <SharedButton size={size} variant={variant} {...props} />;
}

export function Badge({ size = 'regular', ...props }: BadgeProps) {
  return <SharedBadge size={size} {...props} />;
}

export function Card({ as = 'section', size = 'regular', ...props }: CardProps) {
  return <SharedCard as={as} size={size} {...props} />;
}
