import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, LogIn, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/game/Logo";
import { NameField } from "@/components/game/NameForm";
import tiles from "@/assets/letter-tiles.png";
import { errorMessage, getSavedName, normalizeCode, saveName, saveSession } from "@/lib/game";
import { createRoom, joinRoom, toSession } from "@/lib/game-api";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "STOP – Desafio das Letras | Jogo online multiplayer" },
      {
        name: "description",
        content: "Crie uma sala, convide os amigos e jogue STOP (Adedonha) online no celular ou computador.",
      },
      { property: "og:title", content: "STOP – Desafio das Letras" },
      { property: "og:description", content: "Jogue STOP online com seus amigos, em tempo real, direto do celular." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"create" | "join" | null>(null);

  useEffect(() => setName(getSavedName()), []);

  const validName = name.trim().length >= 2;

  const create = async () => {
    if (!validName) return toast.error("Digite seu nome primeiro.");
    setBusy("create");
    try {
      const r = await createRoom(name.trim());
      saveName(name);
      saveSession(r.code, toSession(r));
      navigate({ to: "/sala/$code", params: { code: r.code } });
    } catch (e) {
      toast.error(errorMessage(e));
      setBusy(null);
    }
  };

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    const c = normalizeCode(code);
    if (!validName) return toast.error("Digite seu nome primeiro.");
    if (c.length !== 5) return toast.error("O código tem 5 caracteres.");
    setBusy("join");
    try {
      const r = await joinRoom(c, name.trim());
      saveName(name);
      saveSession(r.code, toSession(r));
      navigate({ to: "/sala/$code", params: { code: r.code } });
    } catch (err) {
      toast.error(errorMessage(err));
      setBusy(null);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-10 pt-6">
      <img
        src={tiles}
        alt="Peças coloridas com as letras de STOP"
        width={1024}
        height={768}
        className="mx-auto -mb-4 w-64 animate-wobble drop-shadow-2xl sm:w-72"
      />
      <Logo size="lg" />

      <section className="surface mt-8 space-y-5 p-5">
        <NameField value={name} onChange={setName} />
        <Button variant="pop" size="xl" className="h-16 text-xl" onClick={create} disabled={!!busy}>
          {busy === "create" ? <Loader2 className="!size-6 animate-spin" /> : <Sparkles className="!size-6" />}
          Criar partida
        </Button>

        <div className="flex items-center gap-3 text-xs font-extrabold uppercase tracking-widest text-muted-foreground">
          <span className="h-0.5 flex-1 rounded bg-border" /> ou entre com código <span className="h-0.5 flex-1 rounded bg-border" />
        </div>

        <form onSubmit={join} className="flex gap-3">
          <input
            value={code}
            onChange={(e) => setCode(normalizeCode(e.target.value))}
            placeholder="ABC12"
            aria-label="Código da sala"
            autoCapitalize="characters"
            autoComplete="off"
            inputMode="text"
            className="h-14 w-0 flex-1 rounded-2xl border-2 border-input bg-background px-4 text-center font-display text-2xl tracking-[0.3em] uppercase outline-none placeholder:text-muted-foreground/40 focus:border-accent"
          />
          <Button type="submit" variant="teal" className="h-14 rounded-2xl px-5" disabled={!!busy}>
            {busy === "join" ? <Loader2 className="!size-5 animate-spin" /> : <LogIn className="!size-5" />}
            Entrar
          </Button>
        </form>
      </section>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Sem cadastro: é só digitar seu nome e jogar. 🎉
      </p>
    </main>
  );
}
