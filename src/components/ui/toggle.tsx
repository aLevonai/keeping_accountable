"use client";

interface ToggleProps {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, disabled }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      disabled={disabled}
      className="relative flex-shrink-0 rounded-full transition-colors duration-200 disabled:opacity-50"
      style={{
        width: 40,
        height: 22,
        background: checked ? "var(--success)" : "#B8AFA7",
      }}
    >
      <span
        className="absolute bg-white rounded-full shadow-sm transition-transform duration-200"
        style={{
          width: 16,
          height: 16,
          top: 3,
          transform: checked ? "translateX(21px)" : "translateX(3px)",
        }}
      />
    </button>
  );
}
