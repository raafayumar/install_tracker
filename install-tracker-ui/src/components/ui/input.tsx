"use client";

import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, className = "", id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-bold uppercase tracking-[0.06em] text-text-secondary"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`
            bg-card border-[1.5px] border-border rounded-[8px]
            text-text-primary text-sm font-medium
            px-3.5 py-2.5 outline-none
            placeholder:text-text-tertiary
            focus:border-sky-500 focus:shadow-[0_0_0_3px_rgba(0,160,242,0.12)]
            transition-all duration-150
            ${className}
          `}
          {...props}
        />
      </div>
    );
  }
);

Input.displayName = "Input";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
}

export function Select({ label, options, className = "", id, ...props }: SelectProps) {
  const selectId = id || label?.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={selectId}
          className="text-xs font-bold uppercase tracking-[0.06em] text-text-secondary"
        >
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={`
          bg-card border-[1.5px] border-border rounded-[8px]
          text-text-primary text-sm font-medium
          px-3.5 py-2.5 outline-none cursor-pointer
          focus:border-sky-500 focus:shadow-[0_0_0_3px_rgba(0,160,242,0.12)]
          transition-all duration-150
          ${className}
        `}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-card">
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export function Textarea({ label, className = "", id, ...props }: TextareaProps) {
  const textareaId = id || label?.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={textareaId}
          className="text-xs font-bold uppercase tracking-[0.06em] text-text-secondary"
        >
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        className={`
          bg-card border-[1.5px] border-border rounded-[8px]
          text-text-primary text-sm font-medium
          px-3.5 py-2.5 outline-none resize-y min-h-[100px]
          placeholder:text-text-tertiary
          focus:border-sky-500 focus:shadow-[0_0_0_3px_rgba(0,160,242,0.12)]
          transition-all duration-150
          ${className}
        `}
        {...props}
      />
    </div>
  );
}

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
}

export function Checkbox({ label, className = "", id, ...props }: CheckboxProps) {
  const checkboxId = id || label?.toLowerCase().replace(/\s+/g, "-");
  return (
    <label htmlFor={checkboxId} className={`flex items-center gap-2.5 cursor-pointer group ${className}`}>
      <input
        type="checkbox"
        id={checkboxId}
        className="
          w-4 h-4 rounded-[4px] border-[1.5px] border-border bg-card
          checked:bg-sky-500 checked:border-sky-500
          cursor-pointer accent-sky-500
        "
        {...props}
      />
      <span className="text-sm font-medium text-text-secondary group-hover:text-text-primary transition-colors">
        {label}
      </span>
    </label>
  );
}
