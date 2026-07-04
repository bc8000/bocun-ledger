import type { PropsWithChildren } from 'react';

type FieldProps = PropsWithChildren<{
  label: string;
  htmlFor?: string;
}>;

export function Field({ children, htmlFor, label }: FieldProps) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
    </div>
  );
}
