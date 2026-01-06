import { ref } from "vue";
import { useApi } from "./useApi";

export interface Game {
  game_id: string;
  name: string;
  description?: string;
  active: boolean;
  max_score?: number;
  difficulty?: string;
  genre?: string;
}

export interface HighScore {
  rank: number;
  player: string;
  score: number;
  initials: string;
  level_reached?: number;
  timestamp: string;
}

export interface LeaderboardEntry {
  rank: number;
  player: string;
  total_score: number;
  games_played: number;
  high_scores_count?: number;
  arcade_tokens?: number;
  title?: string;
}

export interface GameSession {
  session_id: string;
  game_id: string;
  player: string;
  score: number;
  level_reached: number;
  status: string;
  started_at: string;
  ended_at?: string;
}

export interface Achievement {
  achievement_id: string;
  name: string;
  description: string;
  player: string;
  unlocked_at: string;
}

export interface PlayerStats {
  player: string;
  total_games: number;
  total_score: number;
  high_scores: number;
  achievements: number;
  credits: number;
}

export function useArcade() {
  const api = useApi();

  const games = ref<Game[]>([]);
  const highScores = ref<HighScore[]>([]);
  const leaderboard = ref<LeaderboardEntry[]>([]);
  const sessions = ref<GameSession[]>([]);
  const achievements = ref<Achievement[]>([]);
  const playerStats = ref<PlayerStats | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  /**
   * Fetch all available games
   */
  const fetchGames = async () => {
    loading.value = true;
    error.value = null;
    try {
      const response = await api.get("/retrochain/arcade/v1/games");
      const dataGames = Array.isArray(response.data?.games) ? response.data.games : [];

      // Normalize/alias known titles without mutating server data
      const normalized = dataGames.map((g: any) => {
        const mapped = { ...g } as Game;
        const gid = (g?.game_id || "").toLowerCase();
        if (gid === "space-invaders") {
          mapped.name = "RetroVaders";
        }
        return mapped;
      });

      // Ensure RetroWar appears even if not yet registered on-chain
      const hasRetroWar = normalized.some((g: any) => (g?.game_id || "").toLowerCase() === "retrowar");
      if (!hasRetroWar) {
        normalized.push({
          game_id: "retrowar",
          name: "RetroWar",
          description: "Tribute to Spacewar! with RetroChain flavor",
          active: true,
          genre: "shooter"
        });
      }

      games.value = normalized;
    } catch (err: any) {
      error.value = err.message || "Failed to fetch games";
      console.warn("Arcade games endpoint not available:", err.message);
      games.value = [];
    } finally {
      loading.value = false;
    }
  };

  /**
   * Fetch high scores for a specific game
   */
  const fetchHighScores = async (gameId: string, limit = 10) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await api.get(
        `/retrochain/arcade/v1/highscores/${gameId}?limit=${limit}`
      );
      highScores.value = response.data?.scores || [];
    } catch (err: any) {
      error.value = err.message || "Failed to fetch high scores";
      console.warn("High scores endpoint not available:", err.message);
      highScores.value = [];
    } finally {
      loading.value = false;
    }
  };

  /**
   * Fetch global leaderboard
   */
  const fetchLeaderboard = async (limit = 10) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await api.get(
        `/retrochain/arcade/v1/leaderboard?limit=${limit}`
      );
      const data = response.data || {};
      // Some deployments return `{ entries: [...] }` instead of `{ leaderboard: [...] }`
      leaderboard.value = data.leaderboard || data.entries || [];
    } catch (err: any) {
      error.value = err.message || "Failed to fetch leaderboard";
      console.warn("Leaderboard endpoint not available:", err.message);
      leaderboard.value = [];
    } finally {
      loading.value = false;
    }
  };

  /**
   * Fetch recent game sessions
   */
  const fetchRecentSessions = async (limit = 10) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await api.get(
        `/retrochain/arcade/v1/sessions?limit=${limit}`
      );
      sessions.value = response.data?.sessions || [];
    } catch (err: any) {
      error.value = err.message || "Failed to fetch sessions";
      console.warn("Sessions endpoint not available:", err.message);
      sessions.value = [];
    } finally {
      loading.value = false;
    }
  };

  /**
   * Fetch latest achievements across all players
   */
  const fetchLatestAchievements = async (limit = 10) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await api.get(
        `/retrochain/arcade/v1/achievements?limit=${limit}`
      );
      achievements.value = response.data?.achievements || [];
    } catch (err: any) {
      error.value = err.message || "Failed to fetch achievements";
      console.warn("Achievements endpoint not available:", err.message);
      achievements.value = [];
    } finally {
      loading.value = false;
    }
  };

  /**
   * Fetch stats for a specific player
   */
  const fetchPlayerStats = async (address: string) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await api.get(`/retrochain/arcade/v1/stats/${address}`);
      playerStats.value = response.data || null;
    } catch (err: any) {
      error.value = err.message || "Failed to fetch player stats";
      console.warn("Player stats endpoint not available:", err.message);
      playerStats.value = null;
    } finally {
      loading.value = false;
    }
  };

  /**
   * Fetch player's game sessions
   */
  const fetchPlayerSessions = async (address: string, limit = 10) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await api.get(
        `/retrochain/arcade/v1/sessions/player/${address}?limit=${limit}`
      );
      sessions.value = response.data?.sessions || [];
    } catch (err: any) {
      error.value = err.message || "Failed to fetch player sessions";
      console.warn("Player sessions endpoint not available:", err.message);
      sessions.value = [];
    } finally {
      loading.value = false;
    }
  };

  /**
   * Fetch player's achievements
   */
  const fetchPlayerAchievements = async (address: string) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await api.get(
        `/retrochain/arcade/v1/achievements/${address}`
      );
      achievements.value = response.data?.achievements || [];
    } catch (err: any) {
      error.value = err.message || "Failed to fetch player achievements";
      console.warn("Player achievements endpoint not available:", err.message);
      achievements.value = [];
    } finally {
      loading.value = false;
    }
  };

  return {
    games,
    highScores,
    leaderboard,
    sessions,
    achievements,
    playerStats,
    loading,
    error,
    fetchGames,
    fetchHighScores,
    fetchLeaderboard,
    fetchRecentSessions,
    fetchLatestAchievements,
    fetchPlayerStats,
    fetchPlayerSessions,
    fetchPlayerAchievements,
  };
}
