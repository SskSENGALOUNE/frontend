"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export function PasswordInput({
  id,
  label,
  value,
  onChange,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <label className="label">
      {label}
      <span className="relative">
        <input
          id={id}
          className="input pr-12"
          type={show ? "text" : "password"}
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          className="icon-btn absolute top-0 right-0"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "ເຊື່ອງລະຫັດຜ່ານ" : "ສະແດງລະຫັດຜ່ານ"}
          aria-pressed={show}
        >
          {show ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
        </button>
      </span>
    </label>
  );
}
