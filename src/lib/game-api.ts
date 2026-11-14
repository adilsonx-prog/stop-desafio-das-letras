import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { Answers, PlayerSession } from "./game";

interface JoinResult {
  code: string;
  room_id: string;
  player_id: string;
  secret: string;
}

function unwrap<T>(res: { data: unknown; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

export async function createRoom(name: string) {
  return unwrap<JoinResult>(await supabase.rpc("create_room", { p_name: name }));
}

export async function joinRoom(code: string, name: string) {
  return unwrap<JoinResult>(await supabase.rpc("join_room", { p_code: code, p_name: name }));
}

export async function checkPlayer(s: PlayerSession) {
  return unwrap<boolean>(await supabase.rpc("check_player", { p_player_id: s.playerId, p_secret: s.secret }));
}

const auth = (s: PlayerSession) => ({ p_player_id: s.playerId, p_secret: s.secret });

export async function leaveRoom(s: PlayerSession) {
  unwrap(await supabase.rpc("leave_room", auth(s)));
}

export async function startRound(s: PlayerSession) {
  unwrap(await supabase.rpc("start_round", auth(s)));
}

export async function saveAnswers(s: PlayerSession, round: number, answers: Answers) {
  unwrap(await supabase.rpc("save_answers", { ...auth(s), p_round: round, p_answers: answers as unknown as Json }));
}

export async function callStop(s: PlayerSession, round: number, answers: Answers) {
  unwrap(await supabase.rpc("call_stop", { ...auth(s), p_round: round, p_answers: answers as unknown as Json }));
}

export async function finishRound(s: PlayerSession) {
  unwrap(await supabase.rpc("finish_round", auth(s)));
}

export async function resetRoom(s: PlayerSession) {
  unwrap(await supabase.rpc("reset_room", auth(s)));
}

export function toSession(r: JoinResult): PlayerSession {
  return { playerId: r.player_id, secret: r.secret, roomId: r.room_id };
}
