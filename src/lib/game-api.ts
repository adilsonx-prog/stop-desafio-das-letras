import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { Answers, PlayerSession, RoomRules } from "./game";

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

export async function toggleDispute(s: PlayerSession, target: string, category: string) {
  unwrap(await supabase.rpc("toggle_dispute", { ...auth(s), p_target: target, p_category: category }));
}

export async function confirmRound(s: PlayerSession) {
  unwrap(await supabase.rpc("confirm_round", auth(s)));
}

export async function endGame(s: PlayerSession) {
  unwrap(await supabase.rpc("end_game", auth(s)));
}

/** Host only, in the lobby. */
export async function updateRoomSettings(s: PlayerSession, r: RoomRules) {
  unwrap(
    await supabase.rpc("update_room_settings", {
      ...auth(s),
      p_categories: r.categories.map((c) => ({ key: c.key, label: c.label.trim() })) as unknown as Json,
      p_letters: r.letters,
      // null = no limit; the generated types don't mark these as nullable.
      p_round_seconds: r.roundSeconds as number,
      p_max_rounds: r.maxRounds as number,
    }),
  );
}

/** Closes a timed round once the clock runs out (the server checks the time). */
export async function timeUpRound(s: PlayerSession, round: number) {
  unwrap(await supabase.rpc("time_up_round", { ...auth(s), p_round: round }));
}

/** Host decides a contested answer. */
export async function ruleAnswer(s: PlayerSession, target: string, category: string, verdict: "annul" | "keep") {
  unwrap(
    await supabase.rpc("rule_answer", { ...auth(s), p_target: target, p_category: category, p_verdict: verdict }),
  );
}
