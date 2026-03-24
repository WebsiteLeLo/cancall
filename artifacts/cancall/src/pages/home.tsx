import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";

export default function Home() {
  const [roomInput, setRoomInput] = useState("");
  const [mode, setMode] = useState<"video" | "audio">("video");
  const [, setLocation] = useLocation();
  const search = useSearch();

  useEffect(() => {
    const params = new URLSearchParams(search);
    const room = params.get("room");
    const callMode = params.get("mode") as "video" | "audio" | null;
    if (room) {
      setLocation(`/room/${room}?mode=${callMode || "video"}`);
    }
  }, [search]);

  const handleCreate = () => {
    setLocation(`/room/new?mode=${mode}`);
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const id = roomInput.trim();
    if (!id) return;
    setLocation(`/room/${id}?mode=${mode}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">CanCall</h1>
          </div>
          <p className="text-slate-400 text-sm">Instant voice &amp; video calls. No account needed.</p>
        </div>

        <div className="bg-slate-800/60 backdrop-blur-sm border border-slate-700/60 rounded-2xl p-6 shadow-2xl">
          <div className="mb-6">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
              Call Mode
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setMode("video")}
                className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-medium transition-all duration-200 ${
                  mode === "video"
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                    : "bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                </svg>
                Video
              </button>
              <button
                onClick={() => setMode("audio")}
                className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-medium transition-all duration-200 ${
                  mode === "audio"
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                    : "bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                Voice Only
              </button>
            </div>
          </div>

          <button
            onClick={handleCreate}
            className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all duration-200 shadow-lg shadow-indigo-600/30 hover:shadow-indigo-500/40 active:scale-[0.98] mb-4"
          >
            Create New Room
          </button>

          <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-700" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-slate-800/60 px-3 text-slate-500">or join existing</span>
            </div>
          </div>

          <form onSubmit={handleJoin} className="flex gap-2">
            <input
              type="text"
              value={roomInput}
              onChange={(e) => setRoomInput(e.target.value)}
              placeholder="Paste Room ID..."
              className="flex-1 bg-slate-700/50 border border-slate-600/50 text-slate-200 placeholder:text-slate-500 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
            />
            <button
              type="submit"
              className="px-5 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium text-sm transition-all duration-200 active:scale-[0.98]"
            >
              Join
            </button>
          </form>
        </div>

        <p className="text-center text-slate-600 text-xs mt-6">
          Powered by WebRTC &amp; Firebase — end-to-end encrypted
        </p>
      </div>
    </div>
  );
}
