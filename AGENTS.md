<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules

- Players have no accounts: each device keeps a per-room `{playerId, secret}` in localStorage, and every game mutation goes through a SECURITY DEFINER Postgres function that checks that secret — clients only have SELECT on tables, so no one can edit another player's data.
- `player_secrets` must never be granted to anon/authenticated; it is the only proof of player identity.
- The category list lives in two places that must stay in sync: `CATEGORIES` in `src/lib/game.ts` and `public.stop_categories()` in the database.
- Live updates come from realtime changes on `rooms` and `room_players` (refetch on any event) plus a presence channel for online dots; answers of the round in progress stay hidden by RLS until the round is scored.
- The host's client scores the round (`finish_round`) ~2.5s after STOP so everyone's last answers land; any player may do it after 8s as a fallback.
