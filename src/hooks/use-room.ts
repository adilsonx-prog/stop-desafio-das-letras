import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Room = Database["public"]["Tables"]["rooms"]["Row"];
export type Player = Database["public"]["Tables"]["room_players"]["Row"];
export type RoundAnswer = Database["public"]["Tables"]["round_answers"]["Row"];

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
    refetchInterval: 15_000, // safety net if a realtime event is missed
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
    return () => {
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

export function useRoundAnswers(roomId: string | undefined, round: number | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["answers", roomId, round],
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
