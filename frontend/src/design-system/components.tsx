import { forwardRef, useId, type ButtonHTMLAttributes, type HTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { AlertTriangle, Inbox, LoaderCircle } from "lucide-react";
import "./components.css";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean; loadingLabel?: string };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = "primary", loading = false, loadingLabel = "Đang tải", disabled, children, className = "", ...props }, ref) {
  return <button ref={ref} className={`ui-button ui-button--${variant} ${className}`} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
    {loading && <LoaderCircle className="ui-spinner" aria-hidden="true" />}<span>{loading ? loadingLabel : children}</span>
  </button>;
});

export const IconButton = forwardRef<HTMLButtonElement, ButtonProps & { label: string }>(function IconButton({ label, children, className = "", ...props }, ref) {
  return <Button ref={ref} className={`ui-icon-button ${className}`} aria-label={label} title={props.title ?? label} {...props}>{children}</Button>;
});

type Tone = "neutral" | "primary" | "success" | "warning" | "danger" | "info";
export function Badge({ tone = "neutral", className = "", ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return <span className={`ui-badge ui-badge--${tone} ${className}`} {...props} />;
}
export function StatusBadge({ status, label, className = "" }: { status: Exclude<Tone, "primary">; label: string; className?: string }) {
  return <Badge tone={status} className={`ui-status-badge ${className}`} role="status"><i aria-hidden="true" />{label}</Badge>;
}

export function Card({ elevated = false, className = "", ...props }: HTMLAttributes<HTMLDivElement> & { elevated?: boolean }) {
  return <div className={`ui-card ${elevated ? "ui-card--elevated" : ""} ${className}`} {...props} />;
}

type FieldProps = { label?: string; hint?: string; error?: string; loading?: boolean };
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & FieldProps>(function Input({ label, hint, error, loading, id, className = "", disabled, ...props }, ref) {
  const generatedId = useId(); const fieldId = id ?? generatedId; const messageId = `${fieldId}-message`;
  return <label className={`ui-field ${className}`} htmlFor={fieldId}>{label && <span className="ui-field__label">{label}</span>}<span className="ui-field__control"><input ref={ref} id={fieldId} disabled={disabled || loading} aria-invalid={!!error} aria-describedby={hint || error ? messageId : undefined} {...props} />{loading && <LoaderCircle className="ui-spinner" aria-hidden="true" />}</span>{(error || hint) && <span id={messageId} className={error ? "ui-field__error" : "ui-field__hint"}>{error ?? hint}</span>}</label>;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & FieldProps>(function Select({ label, hint, error, loading, id, className = "", disabled, children, ...props }, ref) {
  const generatedId = useId(); const fieldId = id ?? generatedId; const messageId = `${fieldId}-message`;
  return <label className={`ui-field ${className}`} htmlFor={fieldId}>{label && <span className="ui-field__label">{label}</span>}<span className="ui-field__control"><select ref={ref} id={fieldId} disabled={disabled || loading} aria-invalid={!!error} aria-describedby={hint || error ? messageId : undefined} {...props}>{children}</select>{loading && <LoaderCircle className="ui-spinner" aria-hidden="true" />}</span>{(error || hint) && <span id={messageId} className={error ? "ui-field__error" : "ui-field__hint"}>{error ?? hint}</span>}</label>;
});

export function Switch({ checked, onChange, label, description, disabled = false, loading = false, id }: { checked: boolean; onChange: (checked: boolean) => void; label: string; description?: string; disabled?: boolean; loading?: boolean; id?: string }) {
  const generatedId = useId(); const switchId = id ?? generatedId;
  return <label className="ui-switch" htmlFor={switchId}><button id={switchId} type="button" role="switch" aria-checked={checked} aria-label={label} aria-busy={loading || undefined} disabled={disabled || loading} onClick={() => onChange(!checked)}><span /></button><span><strong>{label}</strong>{description && <small>{description}</small>}</span></label>;
}

export function Tooltip({ content, children }: { content: ReactNode; children: ReactNode }) {
  const id = useId();
  return <span className="ui-tooltip"><span className="ui-tooltip__trigger" tabIndex={0} aria-describedby={id}>{children}</span><span className="ui-tooltip__content" role="tooltip" id={id}>{content}</span></span>;
}

export function Skeleton({ width, height, className = "", label = "Đang tải" }: { width?: string | number; height?: string | number; className?: string; label?: string }) {
  return <span className={`ui-skeleton ${className}`} style={{ width, height }} role="status" aria-label={label} />;
}

export function EmptyState({ title, description, action, icon = <Inbox /> }: { title: string; description?: string; action?: ReactNode; icon?: ReactNode }) {
  return <div className="ui-state" role="status"><span className="ui-state__icon">{icon}</span><h2>{title}</h2>{description && <p>{description}</p>}{action}</div>;
}
export function ErrorState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <div className="ui-state ui-state--error" role="alert"><span className="ui-state__icon"><AlertTriangle /></span><h2>{title}</h2>{description && <p>{description}</p>}{action}</div>;
}
export function PageHeader({ title, description, eyebrow, actions, className = "" }: { title: string; description?: string; eyebrow?: string; actions?: ReactNode; className?: string }) {
  return <header className={`ui-page-header ${className}`}><div>{eyebrow && <p className="ui-page-header__eyebrow">{eyebrow}</p>}<h1>{title}</h1>{description && <p>{description}</p>}</div>{actions && <div className="ui-page-header__actions">{actions}</div>}</header>;
}
