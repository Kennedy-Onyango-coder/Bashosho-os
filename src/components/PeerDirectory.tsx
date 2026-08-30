import React from "react";
import { UsersRound, Search } from "lucide-react";

interface Peer {
  id: string;
  name: string;
  role: string;
  roleKey?: string;
  avatar?: string;
  skills?: string[];
  status?: string;
}

interface PeerDirectoryProps {
  lang: "en" | "sw";
}

export default function PeerDirectory({ lang }: PeerDirectoryProps) {
  const [peers, setPeers] = React.useState<Peer[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/peer_directory")
      .then(res => res.ok ? res.json() : [])
      .then(data => { if (!cancelled) setPeers(data); })
      .catch(err => console.error("Failed to load peer directory:", err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const filtered = peers.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.role || "").toLowerCase().includes(search.toLowerCase()) ||
    (p.skills || []).some(s => s.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6 text-left">
      <div>
        <h2 className="text-lg font-extrabold text-neutral-900 flex items-center gap-2">
          <UsersRound className="text-[#E31E24]" size={20} />
          {lang === "en" ? "Peer Directory" : "Orodha ya Wenzako"}
        </h2>
        <p className="text-xs text-neutral-500 mt-1">
          {lang === "en" ? "See fellow members, volunteers, and leaders — names, roles, and skills only." : "Waone wanachama wenzako, wanaojitolea, na viongozi — majina, wadhifa, na ujuzi tu."}
        </p>
      </div>

      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={lang === "en" ? "Search by name, role, or skill..." : "Tafuta kwa jina, wadhifa, au ujuzi..."}
          className="w-full pl-8 pr-3 py-2 text-xs border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-500"
        />
      </div>

      {loading ? (
        <p className="text-xs text-neutral-500 py-10 text-center">{lang === "en" ? "Loading..." : "Inapakia..."}</p>
      ) : filtered.length === 0 ? (
        <p className="text-xs text-neutral-500 py-10 text-center">{lang === "en" ? "No matches found." : "Hakuna waliopatikana."}</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {filtered.map(p => (
            <div key={p.id} className="bg-white border border-neutral-200 rounded-xl p-4 text-center space-y-2 shadow-2xs">
              <div className="w-14 h-14 mx-auto rounded-full bg-neutral-100 border border-neutral-200 overflow-hidden flex items-center justify-center">
                {p.avatar ? <img src={p.avatar} alt={p.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <span className="text-neutral-500 font-bold text-lg">{p.name?.[0]}</span>}
              </div>
              <div>
                <p className="text-xs font-bold text-neutral-900 truncate">{p.name}</p>
                <p className="text-[10px] text-neutral-500 font-mono truncate">{p.role}</p>
              </div>
              {p.skills && p.skills.length > 0 && (
                <div className="flex flex-wrap gap-1 justify-center">
                  {p.skills.slice(0, 2).map((s, i) => (
                    <span key={i} className="text-[8px] font-bold bg-neutral-100 text-neutral-500 px-1.5 py-0.5 rounded-full">{s}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
