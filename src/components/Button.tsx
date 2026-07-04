import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger';

type ButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
  }
>;

export function Button({ children, className = '', variant = 'primary', ...props }: ButtonProps) {
  const variantClass = variant === 'primary' ? '' : variant;

  return (
    <button className={["button", variantClass, className].filter(Boolean).join(' ')} {...props}>
      {children}
    </button>
  );
}
