export type SearchScope = 'turns' | 'variants' | 'all';

export type SearchHitScope = 'turn' | 'variant';

export interface SearchHit {
  scope: SearchHitScope;
  id: string;
  thread_id: string;
  turn_id: string;
  snippet: string;
  score: number;
  matched_at: string;
}

export interface SearchResult {
  query: string;
  scope: SearchScope;
  hits: SearchHit[];
  total_hits: number;
}
