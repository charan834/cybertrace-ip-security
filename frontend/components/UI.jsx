import { useEffect, useRef, useState } from "react";
import { Copy, Check, X, ShieldCheck, Info } from "lucide-react";
export const display = (v) =>
  v === null || v === undefined || v === "" ? "Unavailable" : String(v);
export function CopyButton({ value, label = "Copy value", notify }) {
  return (
    <button
      className="icon-button copy"
      aria-label={label}
      title={label}
      disabled={!value}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(String(value));
          notify("Copied to clipboard");
        } catch {
          notify("Clipboard unavailable. Select and copy the value manually.");
        }
      }}
    >
      <Copy size={13} />
    </button>
  );
}
export function Panel({
  title,
  icon: Icon = ShieldCheck,
  tag,
  children,
  className = "",
  id,
}) {
  return (
    <section id={id} className={`panel ${className}`}>
      <div className="panel-head">
        <h2>
          <Icon size={15} />
          {title}
        </h2>
        {tag}
      </div>
      {children}
    </section>
  );
}
export function Signal({ value }) {
  return (
    <span
      className={`signal ${value === true ? "signal-yes" : value === false ? "signal-no" : "signal-unknown"}`}
    >
      {value === true ? (
        <Info size={12} />
      ) : value === false ? (
        <Check size={12} />
      ) : (
        <span>—</span>
      )}
      {value === true
        ? "Detected"
        : value === false
          ? "Not detected"
          : "Unavailable"}
    </span>
  );
}
export function Counter({ value }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (value === null || value === undefined) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(value);
      return;
    }
    const start = performance.now();
    let frame;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / 800);
      setShown(Math.round(value * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return value === null || value === undefined ? "—" : shown;
}
export function Modal({ title, children, onClose }) {
  const ref = useRef();
  useEffect(() => {
    const el = ref.current;
    el.showModal();
    const close = (e) => {
      e.preventDefault();
      onClose();
    };
    el.addEventListener("cancel", close);
    return () => el.removeEventListener("cancel", close);
  }, [onClose]);
  return (
    <dialog
      ref={ref}
      className="modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-title">
        <h2>{title}</h2>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
