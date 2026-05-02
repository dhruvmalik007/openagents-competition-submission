import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva('inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium', {
  variants: {
    variant: {
      default: 'border-primary/30 bg-primary/10 text-primary',
      secondary: 'border-white/10 bg-white/10 text-foreground',
      success: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
      warning: 'border-amber-400/20 bg-amber-400/10 text-amber-300'
    }
  },
  defaultVariants: {
    variant: 'default'
  }
});

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
