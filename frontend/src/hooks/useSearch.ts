import { useEffect, useCallback, useMemo } from 'react';
import { useSearchStore } from '../stores/searchStore';
import { getSearchProcessor, SearchFilter } from '../utils/SearchProcessor';
import { useChannelStore } from '../stores/channelStore';
import { useDirectMessageStore } from '../stores/directMessageStore';
import debounce from 'lodash/debounce';

export function useSearch() {
  const {
    query,
    filter,
    results,
    loading,
    error,
    setQuery,
    setFilter,
    setResults,
    setLoading,
    setError,
    clearResults
  } = useSearchStore();

  const { conversations } = useDirectMessageStore();
  const { channels } = useChannelStore();

  // Get search processor instance
  const searchProcessor = useMemo(() => getSearchProcessor(), []);

  // Index all items
  useEffect(() => {
    // Index channels
    Array.from(channels.values()).forEach(channel => {
      searchProcessor.indexChannel(channel);
    });

    // Index direct messages
    conversations.forEach(messages => {
      messages.forEach(message => {
        searchProcessor.indexMessage(message);
      });
    });
  }, [channels, conversations, searchProcessor]);

  // Perform search with debounce
  const performSearch = useCallback(
    debounce((searchQuery: string, searchFilter?: SearchFilter) => {
      if (!searchQuery.trim()) {
        clearResults();
        return;
      }

      setLoading(true);
      try {
        const searchResults = searchProcessor.search(searchQuery, searchFilter);
        setResults(searchResults);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Search failed');
        setError(error);
      }
    }, 300),
    [searchProcessor, setResults, setError, setLoading, clearResults]
  );

  // Trigger search when query or filter changes
  useEffect(() => {
    performSearch(query, filter);
  }, [query, filter, performSearch]);

  return {
    query,
    setQuery,
    filter,
    setFilter,
    results,
    loading,
    error,
    clearResults
  };
} 