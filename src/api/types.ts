/**
 * Shapes returned by the FastAPI backend, mirroring `backend/app/schemas.py`.
 *
 * Keep field names in sync with the server's serialization aliases. Any time
 * the backend renames a field, update this file in lockstep — TypeScript will
 * then point us at every call site that needs adjusting.
 */

export type ApiUser = {
  id: number;
  name: string;
  username: string | null;
  photo_url: string | null;
  language: string | null;
};

export type ApiStats = {
  best_score: number;
  total_coins: number;
  runs_played: number;
};

export type ApiRun = {
  id: string;
  score: number;
  coins: number;
  durationMs: number;
  endedAt: string; // ISO 8601
};

export type ApiMeResponse = {
  user: ApiUser;
  stats: ApiStats;
  recent: ApiRun[];
};

export type ApiRunStartResponse = {
  runId: string;
  serverTimeMs: number;
};

export type ApiRunEndRequest = {
  runId: string;
  score: number;
  coins: number;
  nearMisses: number;
  durationMs: number;
};

export type ApiRunEndResponse = {
  accepted: boolean;
  newBest: boolean;
  rank: number | null;
  stats: ApiStats;
};

export type ApiLeaderboardEntry = {
  rank: number;
  userId: number;
  name: string;
  score: number;
  isSelf: boolean;
};

export type ApiLeaderboardResponse = {
  entries: ApiLeaderboardEntry[];
  selfRank: number | null;
};
