import { Copy, MessageCircle, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function ShareInvite({ code }: { code: string }) {
  const url = typeof window !== "undefined" ? `${window.location.origin}/sala/${code}` : "";
  const text = `Bora jogar STOP – Desafio das Letras! Entre na minha sala com o código ${code}: ${url}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado!");
    } catch {
      toast.error("Não foi possível copiar. Código: " + code);
    }
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "STOP – Desafio das Letras", text, url });
      } catch {
        /* user cancelled */
      }
    } else {
      copy();
    }
  };

  return (
    <div className="space-y-3">
      <Button variant="pop" size="xl" onClick={share}>
        <Share2 className="!size-5" /> Compartilhar convite
      </Button>
      <div className="grid grid-cols-2 gap-3">
        <Button variant="soft" className="h-12 rounded-xl" asChild>
          <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">
            <MessageCircle /> WhatsApp
          </a>
        </Button>
        <Button variant="soft" className="h-12 rounded-xl" onClick={copy}>
          <Copy /> Copiar link
        </Button>
      </div>
    </div>
  );
}
