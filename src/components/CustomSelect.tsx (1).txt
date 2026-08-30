import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";

// Menu déroulant stylé "maison" — remplace les <select> natifs, dont le
// menu ouvert est rendu par le système d'exploitation (Android/Chrome) et
// ne peut pas être mis en forme (d'où le look décalé/hors-thème sur mobile).
// Partagé entre App.tsx et les composants (ex. PomodoroTimer) pour garder
// un seul style de menu déroulant dans toute l'application.
export default function CustomSelect({
  id,
  value,
  onChange,
  options,
  className,
  buttonClassName,
  ariaLabel,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  className?: string;
  buttonClassName?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointer(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const current = options.find((o) => o.value === value);

  return (
    <div className={`bf-select ${className ?? ""}`} ref={rootRef}>
      <button
        type="button"
        id={id}
        className={`bf-select__button ${buttonClassName ?? ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        <span className="bf-select__value">{current?.label ?? "—"}</span>
        <ChevronDown size={15} className={`bf-select__chevron ${open ? "open" : ""}`} />
      </button>
      {open && (
        <div className="bf-select__menu" role="listbox">
          {options.map((o) => (
            <button
              type="button"
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              className={`bf-select__option ${o.value === value ? "selected" : ""}`}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
            >
              <span className="bf-select__option-check">{o.value === value && <Check size={14} />}</span>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
