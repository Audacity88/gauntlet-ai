import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { SearchFilter, SearchResult } from '../utils/SearchProcessor';

interface SearchState {
  query: string;
  filter: SearchFilter;
  results: SearchResult[];
  loading: boolean;
  error: Error | null;

  // Search actions
  setQuery: (query: string) => void;
  setFilter: (filter: SearchFilter) => void;
  setResults: (results: SearchResult[]) => void;
  clearResults: () => void;

  // Loading state
  setLoading: (loading: boolean) => void;
  setError: (error: Error | null) => void;
}

export const useSearchStore = create<SearchState>()(
  devtools(
    (set) => ({
      // Initial state
      query: '',
      filter: {},
      results: [],
      loading: false,
      error: null,

      // Search actions
      setQuery: (query) => set({ query }),
      setFilter: (filter) => set({ filter }),
      setResults: (results) => set({ results, loading: false, error: null }),
      clearResults: () => set({ results: [], error: null }),

      // Loading state
      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error })
    }),
    { name: 'SearchStore' }
  )
); 