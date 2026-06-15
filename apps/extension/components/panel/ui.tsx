import {
  Badge as SharedBadge,
  Button as SharedButton,
  Card as SharedCard,
  type BadgeProps,
  type ButtonProps,
  type CardProps,
} from '@draftlet/shared/ui';

export { cn } from '@draftlet/shared/utils';
export type { BadgeProps, ButtonProps, CardProps };

export function Button({ size = 'compact', variant = 'secondary', ...props }: ButtonProps) {
  return <SharedButton size={size} variant={variant} {...props} />;
}

export function Badge({ size = 'compact', ...props }: BadgeProps) {
  return <SharedBadge size={size} {...props} />;
}

export function Card({ as = 'article', size = 'compact', ...props }: CardProps) {
  return <SharedCard as={as} size={size} {...props} />;
}
