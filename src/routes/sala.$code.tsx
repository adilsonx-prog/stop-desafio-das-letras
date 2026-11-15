import { useEffect, useState, type ReactNode } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FinalResults } from "@/components/game/FinalResults";
import { GameBoard } from "@/components/game/GameBoard";
import { Lobby } from "@/components/game/Lobby";
import { Logo } from "@/components/game/Logo";
import { NameForm } from "@/components/game/NameForm";
import { PlayerMenu } from "@/components/game/PlayerMenu";
import { Results } from "@/components/game/Results";
import { ThemeToggle } from "@/components/game/ThemeToggle";
import { usePresence, useRoom } from "@/hooks/use-room";
import {
  clearSession,
  errorMessage,
  getSession,
  isValidCodeFormat,
  normalizeCode,
  saveName,
  saveSession,
  type PlayerSession,
} from "@/lib/game";
import { checkPlayer, joinRoom, leaveRoom, toSession } from "@/lib/game-api";

export const Route = createFileRoute("/sala/$code")({
  ssr: false,
  head: ({ params }) => ({
    meta: [
      { title: `Sala ${params.code.toUpperCase()} | STOP – Desafio das Letras` },
      { name: "description", content: `Você foi convidado para jogar STOP na sala ${params.code.toUpperCase()}.` },
      { property: "og:title", content: `Entre na sala ${params.code.toUpperCase()} – STOP` },
      { property: "og:description", content: "Toque para entrar e jogar STOP – Desafio das Letras com os amigos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RoomPage,
  pendingComponent: FullLoader,
});

function FullLoader() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
    </div>
  );
}

function RoomPage() {
  const params = Route.useParams();
  const code = normalizeCode(params.code);
  const navigate = useNavigate();
  const [session, setSession] = useState<PlayerSession | null | undefined>(undefined);
  const [sessionAt, setSessionAt] = useState(0);
  const validCode = isValidCodeFormat(code);
  const { data, isLoading, error, dataUpdatedAt, refetch } = useRoom(code);
  const room = data?.room ?? null;
  const players = data?.players ?? [];
  const online = usePresence(room?.id, session?.playerId);

  // Restore this device's player for the room, if any.
  useEffect(() => {
    const s = getSession(code);
    if (!s) return setSession(null);
    checkPlayer(s)
      .then((ok) => {
        if (!ok) clearSession(code);
        setSessionAt(Date.now());
        setSession(ok ? s : null);
      })
      .catch(() => setSession(s));
  }, [code]);

  // If this player was removed from the room, drop the stale session.
  useEffect(() => {
    if (!session || !data?.room || dataUpdatedAt <= sessionAt) return;
    if (!data.players.some((p) => p.id === session.playerId)) {
      clearSession(code);
      setSession(null);
    }
  }, [data, dataUpdatedAt, sessionAt, session, code]);

  const leave = async () => {
    if (!session || !window.confirm("Sair da sala?")) return;
    try {
      await leaveRoom(session);
    } catch {
      /* already gone */
    }
    clearSession(code);
    navigate({ to: "/" });
  };

  if (!validCode) {
    return (
      <Notice emoji="🔤" title="Código inválido">
        O código da sala tem 5 letras ou números (ex.: <b>CL3RB</b>). Confira o convite e tente de novo.
      </Notice>
    );
  }

  if (isLoading || session === undefined) return <FullLoader />;

  if (error && !room) {
    return (
      <Notice emoji="📶" title="Sem conexão" retry={() => refetch()}>
        Não foi possível carregar a sala <b>{code}</b>. Verifique sua internet e tente novamente.
      </Notice>
    );
  }

  if (!room) {
    return (
      <Notice emoji="🤔" title="Sala não encontrada">
        A sala <b>{code}</b> não existe ou já foi encerrada (todos saíram). Peça um novo convite ou crie uma partida.
      </Notice>
    );
  }

  if (!session && players.length >= 15) {
    return (
      <Notice emoji="🙅" title="Sala cheia">
        A sala <b>{room.code}</b> já tem 15 jogadores, o máximo permitido.
      </Notice>
    );
  }

  if (!session) {
    const inProgress = room.status !== "lobby";
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-8">
        <div className="mb-2 flex justify-end">
          <ThemeToggle />
        </div>
        <Logo size="lg" />
        <section className="surface mt-8 space-y-4 p-5">
          <p className="text-center">
            Você foi convidado para a sala <b className="font-display text-xl text-primary">{room.code}</b>
            <br />
            <span className="text-sm text-muted-foreground">{players.length} jogador(es) na sala</span>
          </p>
          {inProgress && (
            <p className="rounded-xl bg-muted px-3 py-2 text-center text-sm font-bold">
              A partida já começou — você entra e joga a partir de agora.
            </p>
          )}
          <NameForm
            variant="teal"
            submitLabel="Entrar na partida"
            onSubmit={async (name) => {
              try {
                const r = await joinRoom(room.code, name);
                saveName(name);
                const s = toSession(r);
                saveSession(room.code, s);
                await refetch();
                setSessionAt(Date.now());
                setSession(s);
              } catch (e) {
                toast.error(errorMessage(e));
              }
            }}
          />
        </section>
      </main>
    );
  }

  const props = { room, players, session, online };

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 mb-4 border-b-2 border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Logo />
          <div className="flex items-center gap-1.5">
            <span className="rounded-full bg-muted px-3 py-1 font-display text-sm tracking-widest">{room.code}</span>
            <ThemeToggle />
            <PlayerMenu name={players.find((p) => p.id === session.playerId)?.name} onLeave={leave} />
          </div>
        </div>
      </header>
      {room.status === "lobby" && <Lobby {...props} />}
      {(room.status === "playing" || room.status === "stopped") && <GameBoard key={room.round_number} {...props} />}
      {(room.status === "review" || room.status === "results") && <Results {...props} />}
      {room.status === "final" && <FinalResults {...props} />}
    </div>
  );
}

function Notice({
  emoji,
  title,
  children,
  retry,
}: {
  emoji: string;
  title: string;
  children: ReactNode;
  retry?: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-8 text-center">
      <div className="mb-4 flex justify-end">
        <ThemeToggle />
      </div>
      <div className="surface w-full space-y-4 p-6">
        <p className="text-5xl">{emoji}</p>
        <h1 className="font-display text-2xl">{title}</h1>
        <p className="text-muted-foreground">{children}</p>
        {retry && (
          <Button variant="teal" size="xl" onClick={retry}>
            Tentar de novo
          </Button>
        )}
        <Button variant="pop" size="xl" asChild>
          <Link to="/">Voltar ao início</Link>
        </Button>
      </div>
    </main>
  );
}
