// TMDB API Response Types
export interface TMDBShow {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  vote_count: number;
  first_air_date: string;
  genre_ids: number[];
  popularity: number;
  status?: string;
  number_of_seasons?: number;
  number_of_episodes?: number;
  genres?: TMDBGenre[];
  seasons?: TMDBSeason[];
}

export interface TMDBGenre {
  id: number;
  name: string;
}

export interface TMDBSeason {
  id: number;
  season_number: number;
  name: string;
  episode_count: number;
  air_date: string | null;
  poster_path: string | null;
  overview: string;
}

export interface TMDBEpisode {
  id: number;
  episode_number: number;
  name: string;
  overview: string;
  air_date: string | null;
  still_path: string | null;
  runtime: number | null;
  season_number: number;
}

export interface TMDBSeasonDetail {
  id: number;
  season_number: number;
  name: string;
  overview: string;
  episodes: TMDBEpisode[];
}

export interface TMDBPaginatedResponse<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}
