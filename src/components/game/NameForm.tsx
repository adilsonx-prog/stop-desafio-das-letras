import { useEffect, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSavedName } from "@/lib/game";

interface Props {
  submitLabel: ReactNode;
  onSubmit: (name: string) => Promise<void>;
  variant?: "pop" | "teal";
}

export function NameField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-extrabold uppercase tracking-widest text-muted-foreground">
        Seu nome
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={20}
        autoComplete="nickname"
        autoCapitalize="words"
        placeholder="Como quer ser chamado?"
        className="h-14 w-full rounded-2xl border-2 border-input bg-background px-4 text-lg font-bold outline-none placeholder:font-semibold placeholder:text-muted-foreground/60 focus:border-primary"
      />
    </label>
  );
}

export function NameForm({ submitLabel, onSubmit, variant = "pop" }: Props) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => setName((n) => n || getSavedName()), []);

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await onSubmit(name.trim());
        } finally {
          setBusy(false);
        }
      }}
    >
      <NameField value={name} onChange={setName} />
      <Button type="submit" variant={variant} size="xl" disabled={busy || name.trim().length < 2}>
        {busy && <Loader2 className="!size-5 animate-spin" />}
        {submitLabel}
      </Button>
    </form>
  );
}
