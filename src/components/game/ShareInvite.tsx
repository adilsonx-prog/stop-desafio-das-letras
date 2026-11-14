import { Copy, MessageCircle, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { inviteMessage, roomInviteUrl } from "@/lib/game";

export function ShareInvite({ code }: { code: string }) {
  // Same public address for every button — never the private editor preview.
  const url = roomInviteUrl(code);
  const text = inviteMessage(code, url);

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
        await navigator.share({ title: "STOP – Desafio das Letras", text });
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
      <p className="break-all rounded-xl bg-muted px-3 py-2 text-center text-xs font-bold text-muted-foreground">
        {url}
      </p>
    </div>
  );
}
