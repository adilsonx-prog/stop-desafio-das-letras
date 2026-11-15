import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Room = Database["public"]["Tables"]["rooms"]["Row"];
export type Player = Database["public"]["Tables"]["room_players"]["Row"];
export type RoundAnswer = Database["public"]["Tables"]["round_answers"]["Row"];
export type Dispute = Database["public"]["Tables"]["answer_disputes"]["Row"];

/** Shared per-room broadcast channels, so a STOP reaches every device instantly. */
const eventChannels = new Map<string, ReturnType<typeof supabase.channel>>();

/** Tell every device in the room to refetch now (e.g. right after STOP). */
export function pingRoom(roomId: string) {
  eventChannels.get(roomId)?.send({ type: "broadcast", event: "changed", payload: { at: Date.now() } });
}

const LIVE_STATUSES = new Set(["playing", "stopped", "review"]);

export interface RoomState {
  room: Room | null;
  players: Player[];
}

async function fetchRoomState(code: string): Promise<RoomState> {
  const { data: room, error } = await supabase.from("rooms").select("*").eq("code", code).maybeSingle();
  if (error) throw error;
  if (!room) return { room: null, players: [] };
  const { data: players, error: pErr } = await supabase
    .from("room_players")
    .select("*")
    .eq("room_id", room.id)
    .order("joined_at", { ascending: true });
  if (pErr) throw pErr;
  return { room, players: players ?? [] };
}

/** Room + players, kept live through realtime changes on both tables. */
export function useRoom(code: string) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["room", code],
    queryFn: () => fetchRoomState(code),
    // Safety net if a realtime event is missed (e.g. phone was in a WhatsApp call):
    // poll fast while a round is live so STOP always reaches every device.
    refetchInterval: (q) => (LIVE_STATUSES.has(q.state.data?.room?.status ?? "") ? 2_000 : 10_000),
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
  const roomId = query.data?.room?.id;

  useEffect(() => {
    if (!roomId) return;
    const refetch = () => queryClient.invalidateQueries({ queryKey: ["room", code] });
    const channel = supabase
      .channel(`room-${roomId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomId}` }, refetch)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_players", filter: `room_id=eq.${roomId}` },
        refetch,
      )
      .subscribe();
    const events = supabase
      .channel(`room-events-${roomId}`, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "changed" }, refetch)
      .subscribe();
    eventChannels.set(roomId, events);
    // Coming back from another app: refetch at once instead of waiting for the next poll.
    const onVisible = () => {
      if (document.visibilityState === "visible") refetch();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", refetch);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", refetch);
      eventChannels.delete(roomId);
      supabase.removeChannel(events);
      supabase.removeChannel(channel);
    };
  }, [roomId, code, queryClient]);

  return query;
}

/** Which players currently have the room open (realtime presence). */
export function usePresence(roomId: string | undefined, playerId: string | undefined) {
  const [online, setOnline] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!roomId || !playerId) return;
    const channel = supabase.channel(`presence-${roomId}`, { config: { presence: { key: playerId } } });
    channel
      .on("presence", { event: "sync" }, () => {
        setOnline(new Set(Object.keys(channel.presenceState())));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") await channel.track({ at: Date.now() });
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, playerId]);
  return online;
}

export function useRoundAnswers(
  roomId: string | undefined,
  round: number | undefined,
  enabled: boolean,
  version?: string,
) {
  return useQuery({
    queryKey: ["answers", roomId, round, version],
    placeholderData: (prev) => prev,
    enabled: enabled && !!roomId && !!round,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("round_answers")
        .select("*")
        .eq("room_id", roomId!)
        .eq("round_number", round!);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/** Contests for the round in review; `version` (room.updated_at) refreshes it on every change. */
export function useDisputes(roomId: string, round: number, version: string) {
  return useQuery({
    queryKey: ["disputes", roomId, round, version],
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("answer_disputes")
        .select("*")
        .eq("room_id", roomId)
        .eq("round_number", round);
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Every scored round of the current game, for the final ranking. */
export function useGameHistory(roomId: string, fromRound: number, version: string) {
  return useQuery({
    queryKey: ["history", roomId, fromRound, version],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("round_answers")
        .select("player_id, round_number, total")
        .eq("room_id", roomId)
        .gt("round_number", fromRound)
        .order("round_number");
      if (error) throw error;
      return data ?? [];
    },
  });
}
