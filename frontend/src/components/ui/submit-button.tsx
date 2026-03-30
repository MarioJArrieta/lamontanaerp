import { Loader2 } from 'lucide-react';
import { Button, buttonVariants } from './button';
import type { VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';

type Props = ComponentProps<typeof Button> & VariantProps<typeof buttonVariants> & {
  loading?: boolean;
};

export function SubmitButton({ loading, children, disabled, ...props }: Props) {
  return (
    <Button type="submit" disabled={disabled || loading} {...props}>
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </Button>
  );
}
