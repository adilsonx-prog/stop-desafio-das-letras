import { Link } from "@tanstack/react-router";

export function Logo({ size = "sm" }: { size?: "sm" | "lg" }) {
  if (size === "lg") {
    return (
      <div className="text-center">
        <h1 className="font-display text-7xl leading-none text-primary text-outline drop-shadow-[0_6px_0_var(--primary-shade)] sm:text-8xl">
          STOP
        </h1>
        <p className="mt-2 font-display text-xl tracking-wide text-accent">Desafio das Letras</p>
      </div>
    );
  }
  return (
    <Link to="/" className="flex items-center gap-2">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-stop-gradient font-display text-lg text-stop-foreground shadow-[0_3px_0_var(--stop-shade)]">
        S
      </span>
      <span className="font-display text-xl text-primary">STOP</span>
    </Link>
  );
}
