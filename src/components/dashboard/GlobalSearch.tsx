import React from "react";
import { Search, X, User, FileText, Landmark } from "lucide-react";
import { UserProfile, Document, Grant } from "../../types";

interface GlobalSearchProps {
  profiles: UserProfile[];
  documents: Document[];
  grants: Grant[];
  onOpenDocuments: () => void;
  onOpenGrants: () => void;
  lang: "en" | "sw";
}

interface SearchResult {
  type: "member" | "document" | "grant";
  id: string;
  title: string;
  subtitle: string;
}

export default function GlobalSearch({ profiles, documents, grants, onOpenDocuments, onOpenGrants, lang }: GlobalSearchProps) {
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);

  const results: SearchResult[] = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];

    const memberResults: SearchResult[] = profiles
      .filter(p => p.name?.toLowerCase().includes(q) || p.memberNumber?.toLowerCase().includes(q) || p.email?.toLowerCase().includes(q))
      .slice(0, 5)
      .map(p => ({ type: "member", id: p.id, title: p.name, subtitle: `${p.role || ""}${p.memberNumber ? " \u00b7 " + p.memberNumber : ""}` }));

    const documentResults: SearchResult[] = documents
      .filter(d => d.title?.toLowerCase().includes(q))
      .slice(0, 5)
      .map(d => ({ type: "document", id: d.id, title: d.title, subtitle: lang === "en" ? "Document" : "Hati" }));

    const grantResults: SearchResult[] = grants
      .filter(g => g.name?.toLowerCase().includes(q) || g.funder?.toLowerCase().includes(q))
      .slice(0, 5)
      .map(g => ({ type: "grant", id: g.id, title: g.name, subtitle: g.funder }));

    return [...memberResults, ...documentResults, ...grantResults].slice(0, 10);
  }, [query, profiles, documents, grants, lang]);

  const iconFor = (type: SearchResult["type"]) => {
    if (type === "member") return <User size={15} className="text-blue-400" />;
    if (type === "document") return <FileText size={15} className="text-neutral-400" />;
    return <Landmark size={15} className="text-emerald-400" />;
  };

  const handleSelect = (r: SearchResult) => {
    setOpen(false);
    setQuery("");
    if (r.type === "document") onOpenDocuments();
    if (r.type === "grant") onOpenGrants();
    // Member results are shown inline below with no dedicated detail screen yet.
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={lang === "en" ? "Search members, documents, grants..." : "Tafuta wanachama, hati, ruzuku..."}
          className="w-full bg-neutral-900 border border-neutral-800 rounded-lg pl-9 pr-9 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-blue-600 transition-colors duration-150"
        />
        {query && (
          <button
            onClick={() => { setQuery(""); setOpen(false); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
            aria-label={lang === "en" ? "Clear search" : "Futa utafutaji"}
          >
            <X size={15} />
          </button>
        )}
      </div>

      {open && query.trim().length >= 2 && (
        <div className="absolute z-20 mt-1.5 w-full bg-neutral-900 border border-neutral-800 rounded-lg shadow-xl max-h-80 overflow-y-auto">
          {results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-neutral-500">
              {lang === "en" ? "No matches found." : "Hakuna matokeo."}
            </p>
          ) : (
            results.map(r => (
              <button
                key={`${r.type}-${r.id}`}
                onClick={() => handleSelect(r)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-neutral-800/70 transition-colors duration-150 border-b border-neutral-800/60 last:border-0"
              >
                {iconFor(r.type)}
                <div className="min-w-0">
                  <p className="text-sm text-neutral-100 truncate">{r.title}</p>
                  <p className="text-xs text-neutral-500 truncate">{r.subtitle}</p>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
