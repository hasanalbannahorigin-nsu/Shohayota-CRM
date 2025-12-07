import { Search, Loader, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";

interface SearchResult {
  type: "customer" | "ticket";
  id: string;
  title: string;
  description?: string;
}

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export function SearchBar() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [, navigate] = useLocation();
  const searchRef = useRef<HTMLDivElement>(null);
  
  // Debounce search query to prevent excessive API calls
  const debouncedQuery = useDebounce(query, 300);

  const { data: results = [], isLoading } = useQuery<SearchResult[]>({
    queryKey: ["search", debouncedQuery],
    queryFn: async () => {
      if (debouncedQuery.length < 2) return [];
      const res = await apiRequest("GET", `/api/search?q=${encodeURIComponent(debouncedQuery)}`);
      return res.json();
    },
    enabled: debouncedQuery.length > 1,
    staleTime: 30000, // Cache results for 30 seconds
  });

  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    setOpen(value.length > 1);
  }, []);

  const handleResultClick = useCallback((result: SearchResult) => {
    if (result.type === "customer") {
      navigate(`/customers`);
    } else if (result.type === "ticket") {
      navigate(`/tickets/detail?id=${result.id}`);
    }
    setQuery("");
    setOpen(false);
  }, [navigate]);

  const handleClear = useCallback(() => {
    setQuery("");
    setOpen(false);
  }, []);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative w-96" ref={searchRef}>
      <div className="relative">
        {isLoading ? (
          <Loader className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
        ) : (
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        )}
        <Input
          type="search"
          placeholder="Search customers, tickets..."
          value={query}
          onChange={handleSearch}
          onFocus={() => query.length > 1 && setOpen(true)}
          className="pl-10 pr-8"
          data-testid="input-search"
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2"
            data-testid="button-clear-search"
          >
            <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-background border rounded-md shadow-lg z-50 max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="px-4 py-8 text-center text-muted-foreground">
              Searching...
            </div>
          ) : results.length > 0 ? (
            <>
              {/* Group results by type */}
              {results.some((r) => r.type === "customer") && (
                <div>
                  <div className="px-3 py-2 bg-muted text-xs font-semibold text-muted-foreground">
                    CUSTOMERS
                  </div>
                  {results
                    .filter((r) => r.type === "customer")
                    .map((result) => (
                      <button
                        key={result.id}
                        onClick={() => handleResultClick(result)}
                        className="w-full text-left px-3 py-2 hover:bg-accent focus:bg-accent focus:outline-none transition-colors"
                        data-testid={`search-result-${result.id}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">
                              {result.title}
                            </div>
                            {result.description && (
                              <div className="text-xs text-muted-foreground truncate">
                                {result.description}
                              </div>
                            )}
                          </div>
                          <Badge variant="secondary" className="shrink-0">
                            Customer
                          </Badge>
                        </div>
                      </button>
                    ))}
                </div>
              )}

              {results.some((r) => r.type === "ticket") && (
                <div>
                  <div className="px-3 py-2 bg-muted text-xs font-semibold text-muted-foreground">
                    TICKETS
                  </div>
                  {results
                    .filter((r) => r.type === "ticket")
                    .map((result) => (
                      <button
                        key={result.id}
                        onClick={() => handleResultClick(result)}
                        className="w-full text-left px-3 py-2 hover:bg-accent focus:bg-accent focus:outline-none transition-colors border-b last:border-b-0"
                        data-testid={`search-result-${result.id}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">
                              {result.title}
                            </div>
                            {result.description && (
                              <div className="text-xs text-muted-foreground truncate">
                                {result.description}
                              </div>
                            )}
                          </div>
                          <Badge variant="outline" className="shrink-0">
                            Ticket
                          </Badge>
                        </div>
                      </button>
                    ))}
                </div>
              )}
            </>
          ) : (
            <div className="px-4 py-8 text-center text-muted-foreground text-sm">
              No results found for "{query}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}
