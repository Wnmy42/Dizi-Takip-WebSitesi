export type ShowStatus = 'watching' | 'plan_to_watch' | 'completed' | 'dropped';

export interface UserShow {
  id: string;
  user_id: string;
  tmdb_show_id: number;
  title: string;
  poster_path: string | null;
  total_episodes: number;
  status: ShowStatus;
  rating: number | null;
  created_at: string;
  updated_at: string;
}

export interface UserEpisode {
  id: string;
  user_show_id: string;
  season_number: number;
  episode_number: number;
  watched_at: string;
}

export interface UserShowWithProgress extends UserShow {
  watched_episodes: number;
  progress_percentage: number;
}
