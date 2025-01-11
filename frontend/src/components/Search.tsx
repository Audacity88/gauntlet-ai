import { memo } from 'react';
import { useSearch } from '../hooks/useSearch';
import { SearchResult, SearchableItem } from '../utils/SearchProcessor';

interface SearchProps {
  onSelect?: (item: SearchableItem) => void;
  className?: string;
}

export const Search = memo(function Search({
  onSelect,
  className = ''
}: SearchProps) {
  const {
    query,
    setQuery,
    filter,
    setFilter,
    results,
    loading,
    error,
    clearResults
  } = useSearch();

  // Handle filter changes
  const handleFilterChange = (type: 'channel' | 'message' | 'direct_message') => {
    const currentTypes = filter.type || [];
    const newTypes = currentTypes.includes(type)
      ? currentTypes.filter(t => t !== type)
      : [...currentTypes, type];
    
    setFilter({ ...filter, type: newTypes });
  };

  // Render search result item
  const renderSearchItem = (result: SearchResult) => {
    const { item, highlights } = result;
    const highlightedContent = highlights.find(h => h.field === 'content');
    const highlightedMetadata = highlights.find(h => h.field === 'metadata');

    return (
      <div
        key={item.id}
        onClick={() => onSelect?.(item)}
        className={`
          p-4 rounded-lg bg-white shadow-sm hover:bg-gray-50 cursor-pointer
          border border-gray-200 transition-colors duration-200
        `}
        role="button"
        tabIndex={0}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-500 capitalize">
            {item.type}
          </span>
          <span className="text-xs text-gray-400">
            {new Date(item.timestamp).toLocaleDateString()}
          </span>
        </div>

        <div className="mt-2">
          <p className="text-gray-900">
            {highlightedContent
              ? highlightedContent.matches.reduce(
                  (content, match) =>
                    content.replace(
                      new RegExp(match, 'gi'),
                      `<mark class="bg-yellow-200">${match}</mark>`
                    ),
                  item.content
                )
              : item.content}
          </p>
        </div>

        {highlightedMetadata && (
          <div className="mt-2 text-sm text-gray-500">
            {Object.entries(item.metadata)
              .filter(([_, value]) => value)
              .map(([key, value]) => (
                <span key={key} className="mr-2">
                  {key}: {value}
                </span>
              ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Search input */}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search messages and channels..."
          className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              clearResults();
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            Clear
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex space-x-2">
        {(['channel', 'message', 'direct_message'] as const).map((type) => (
          <button
            key={type}
            onClick={() => handleFilterChange(type)}
            className={`
              px-3 py-1 rounded-full text-sm
              ${
                filter.type?.includes(type)
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'bg-gray-100 text-gray-700'
              }
            `}
          >
            {type.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="p-4 rounded-lg bg-gray-50 animate-pulse"
            >
              <div className="h-4 bg-gray-200 rounded w-1/4 mb-2" />
              <div className="h-4 bg-gray-200 rounded w-3/4" />
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-lg bg-red-50 text-red-500">
          {error.message}
        </div>
      )}

      {/* Results */}
      {!loading && !error && results.length > 0 && (
        <div className="space-y-2">
          {results.map(renderSearchItem)}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && query && results.length === 0 && (
        <div className="p-4 text-center text-gray-500">
          No results found for "{query}"
        </div>
      )}
    </div>
  );
}); 