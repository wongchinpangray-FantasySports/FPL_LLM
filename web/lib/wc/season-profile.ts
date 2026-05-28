import type { FplPlayerIndex, FplSeasonProfile } from "@/lib/wc/fpl-club-resolve";
import { resolveFplSeasonProfile } from "@/lib/wc/fpl-club-resolve";
import type { WcPlayer } from "@/lib/wc/types";

export type WcSeasonProfile = {
  season_club: string | null;
  season_league: string | null;
  fpl_web_name: string | null;
  fpl_linked: boolean;
  club_source: string | null;
  season_stats: {
    goals: number;
    assists: number;
    xg: number;
    xa: number;
    form: number;
    minutes: number;
  } | null;
};

function fromFpl(p: FplSeasonProfile): WcSeasonProfile {
  return {
    season_club: p.club_name,
    season_league: "Premier League",
    fpl_web_name: p.web_name,
    fpl_linked: true,
    club_source: "fpl",
    season_stats: {
      goals: p.goals,
      assists: p.assists,
      xg: p.xg,
      xa: p.xa,
      form: p.form,
      minutes: p.minutes,
    },
  };
}

function fromStored(player: WcPlayer): WcSeasonProfile | null {
  if (!player.season_club?.trim()) return null;
  return {
    season_club: player.season_club,
    season_league: player.season_league ?? null,
    fpl_web_name: null,
    fpl_linked: false,
    club_source: player.club_source ?? null,
    season_stats: {
      goals: player.goals,
      assists: player.assists,
      xg: player.xg,
      xa: player.xa,
      form: player.form,
      minutes: player.minutes,
    },
  };
}

function fromFifaOnly(player: WcPlayer): WcSeasonProfile {
  return {
    season_club: null,
    season_league: null,
    fpl_web_name: null,
    fpl_linked: false,
    club_source: null,
    season_stats:
      player.goals > 0 ||
      player.assists > 0 ||
      player.minutes > 0 ||
      player.xg > 0.01
        ? {
            goals: player.goals,
            assists: player.assists,
            xg: player.xg,
            xa: player.xa,
            form: player.form,
            minutes: player.minutes,
          }
        : null,
  };
}

/** FPL first, then persisted Wikidata / football-data club on wc_players. */
export function resolveWcSeasonProfile(
  player: WcPlayer,
  fplIndex: FplPlayerIndex,
): WcSeasonProfile {
  const fpl = resolveFplSeasonProfile(player, fplIndex);
  if (fpl) return fromFpl(fpl);

  const stored = fromStored(player);
  if (stored) return stored;

  return fromFifaOnly(player);
}
