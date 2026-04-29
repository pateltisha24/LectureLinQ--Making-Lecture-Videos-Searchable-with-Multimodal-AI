"use client";

import { useState } from "react";
import { Search, Sparkles } from "lucide-react";
import { SearchBar } from "@/components/search/SearchBar";
import { SearchResults } from "@/components/search/SearchResults";
import { useSemanticSearch } from "@/hooks/useSearch";

const EXAMPLE_QUERIES = [
  "gradient descent optimization",
  "neural network backpropagation",
  "binary search tree insertion",
  "photosynthesis light reactions",
  "Keynesian economics multiplier",
];

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const { data: results, mutate: search, isPending } = useSemanticSearch();

  function handleSearch(q: string) {
    setQuery(q);
    search({ query: q });
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-10">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
          <Search className="h-6 w-6 text-primary" />
        </div>
        <h1 className="mb-2 text-2xl font-bold">Semantic Search</h1>
        <p className="text-sm text-muted-foreground">
          Search across all your lectures by meaning — not just keywords.
        </p>
      </div>

      <SearchBar onSearch={handleSearch} loading={isPending} />

      {!results && !isPending && (
        <div className="mt-10">
          <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4" />
            Try searching for...
          </div>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_QUERIES.map((q) => (
              <button
                key={q}
                onClick={() => handleSearch(q)}
                className="rounded-full border px-3 py-1.5 text-sm transition-colors hover:bg-muted"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {results && (
        <div className="mt-8">
          <SearchResults results={results} query={query} />
        </div>
      )}
    </div>
  );
}
