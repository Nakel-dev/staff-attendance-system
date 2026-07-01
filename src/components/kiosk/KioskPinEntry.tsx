"use client";

import { useEffect, useRef, useState } from "react";
import { Delete } from "lucide-react";
import { Button } from "@/components/ui/button";

interface KioskPinEntryProps {
  staffName: string;
  onSubmit: (pin: string) => void;
  onCancel: () => void;
  disabled?: boolean;
}

export function KioskPinEntry({ staffName, onSubmit, onCancel, disabled }: KioskPinEntryProps) {
  const [digits, setDigits] = useState<string[]>(["", "", "", ""]);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const updateDigit = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    if (digit && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
    if (digit && index === 3 && next.every((d) => d)) {
      onSubmit(next.join(""));
    }
  };

  const handleKeyDown = (index: number, key: string) => {
    if (key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const clearPin = () => {
    setDigits(["", "", "", ""]);
    inputRefs.current[0]?.focus();
  };

  return (
    <div className="space-y-6">
      <p className="text-center text-muted-foreground text-sm">
        Enter your 4-digit PIN for <span className="font-medium text-foreground">{staffName}</span>
      </p>
      <div className="flex justify-center gap-3">
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(el) => {
              inputRefs.current[index] = el;
            }}
            type="password"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            disabled={disabled}
            onChange={(e) => updateDigit(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e.key)}
            className="h-14 w-12 rounded-lg border bg-background text-center text-2xl font-semibold tracking-widest"
            aria-label={`PIN digit ${index + 1}`}
          />
        ))}
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="flex-1" onClick={clearPin} disabled={disabled}>
          <Delete className="mr-2 h-4 w-4" />
          Clear
        </Button>
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel} disabled={disabled}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
