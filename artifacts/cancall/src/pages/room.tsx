import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation, useSearch } from "wouter";
import { WebRTCCall, CallMode } from "@/lib/webrtc";

type CallState = "connecting" | "waiting" | "connected" | "error" | "ended";

function MicIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
    </svg>
  );
}
function MicOffIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" clipRule="evenodd" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
    </svg>
  );
}
function CamIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
    </svg>
  );
}
function CamOffIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
    </svg>
  );
}
function PhoneOffIcon() {
  return (
    <svg className="w-6 h-6 sm:w-7 sm:h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
    </svg>
  );
}

export default function Room({ params }: { params: { id: string } }) {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const searchParams = new URLSearchParams(search);
  const mode = (searchParams.get("mode") as CallMode) || "video";

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const callRef = useRef<WebRTCCall | null>(null);

  const [callState, setCallState] = useState<CallState>("connecting");
  const [roomId, setRoomId] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [copied, setCopied] = useState(false);
  const [duration, setDuration] = useState(0);
  const [showShare, setShowShare] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isNew = params.id === "new";

  const startDurationTimer = useCallback(() => {
    timerRef.current = setInterval(() => {
      setDuration((d) => d + 1);
    }, 1000);
  }, []);

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  useEffect(() => {
    let mounted = true;
    const call = new WebRTCCall(mode);
    callRef.current = call;

    call.pc.onconnectionstatechange = () => {
      if (!mounted) return;
      const state = call.pc.connectionState;
      if (state === "connected") {
        setCallState("connected");
        setShowShare(false);
        startDurationTimer();
      } else if (state === "disconnected" || state === "failed") {
        setCallState("ended");
      }
    };

    (async () => {
      try {
        const localStream = await call.getLocalMedia();
        if (!mounted) return;

        if (localVideoRef.current && mode === "video") {
          localVideoRef.current.srcObject = localStream;
        }
        if (remoteVideoRef.current && mode === "video") {
          remoteVideoRef.current.srcObject = call.remoteStream;
        }
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = call.remoteStream;
        }

        if (isNew) {
          const id = await call.createRoom();
          if (!mounted) return;
          setRoomId(id);
          setCallState("waiting");
          setShowShare(true);
        } else {
          await call.joinRoom(params.id);
          if (!mounted) return;
          setRoomId(params.id);
          setCallState("connecting");
        }
      } catch (err: unknown) {
        if (!mounted) return;
        const message = err instanceof Error ? err.message : String(err);
        setErrorMsg(message);
        setCallState("error");
      }
    })();

    return () => {
      mounted = false;
      if (timerRef.current) clearInterval(timerRef.current);
      call.hangUp();
    };
  }, []);

  const handleMute = () => {
    const muted = callRef.current?.toggleMute();
    if (muted !== undefined) setIsMuted(muted);
  };

  const handleCamera = () => {
    const off = callRef.current?.toggleCamera();
    if (off !== undefined) setIsCameraOff(off);
  };

  const handleHangUp = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    await callRef.current?.hangUp();
    setCallState("ended");
    setTimeout(() => setLocation("/"), 1500);
  };

  const handleCopyLink = () => {
    if (!roomId) return;
    const url = `${window.location.origin}?room=${roomId}&mode=${mode}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleCopyId = () => {
    if (!roomId) return;
    navigator.clipboard.writeText(roomId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (callState === "ended") {
    return (
      <div className="bg-slate-900 flex items-center justify-center" style={{ height: "100dvh" }}>
        <div className="text-center px-4">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
            </svg>
          </div>
          <p className="text-white text-xl font-semibold">Call Ended</p>
          <p className="text-slate-400 text-sm mt-1">Redirecting to home...</p>
        </div>
      </div>
    );
  }

  if (callState === "error") {
    return (
      <div className="bg-slate-900 flex items-center justify-center p-4" style={{ height: "100dvh" }}>
        <div className="text-center max-w-sm w-full">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="text-white text-xl font-semibold mb-2">Something went wrong</p>
          <p className="text-slate-400 text-sm mb-6 break-words">{errorMsg}</p>
          <button
            onClick={() => setLocation("/")}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium text-sm transition-all"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="bg-slate-900 flex flex-col overflow-hidden"
      style={{ height: "100dvh" }}
    >
      {/* Main call area */}
      <div className="flex-1 relative overflow-hidden">
        {mode === "video" ? (
          <>
            {/* Remote video — full area */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="absolute inset-0 w-full h-full object-cover bg-slate-950"
            />

            {/* Waiting / connecting overlay */}
            <div
              className={`absolute inset-0 flex flex-col items-center justify-center transition-opacity duration-500 bg-gradient-to-br from-slate-900 via-indigo-950/60 to-slate-900 ${
                callState === "connected" ? "opacity-0 pointer-events-none" : "opacity-100"
              }`}
            >
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-indigo-600/30 border-2 border-indigo-500/50 flex items-center justify-center mb-4 animate-pulse">
                <svg className="w-10 h-10 sm:w-12 sm:h-12 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <p className="text-white text-base sm:text-lg font-semibold px-4 text-center">
                {callState === "waiting" ? "Waiting for other person..." : "Connecting..."}
              </p>
              <p className="text-slate-400 text-sm mt-1 px-4 text-center">
                {callState === "waiting" ? "Share the room link below" : "Setting up your call"}
              </p>
            </div>

            {/* Local video PiP — responsive size & position */}
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 w-24 h-36 sm:w-32 sm:h-48 md:w-40 md:h-56 object-cover rounded-xl sm:rounded-2xl border-2 border-slate-700/80 shadow-2xl bg-slate-800 z-10"
            />
          </>
        ) : (
          /* Voice-only screen */
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950/60 to-slate-900 px-4">
            <audio ref={remoteAudioRef} autoPlay />
            <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-indigo-600/30 border-2 border-indigo-500/50 flex items-center justify-center mb-5">
              {callState === "connected" ? (
                <div className="flex items-end gap-1 h-10">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="w-1.5 sm:w-2 bg-indigo-400 rounded-full animate-bounce"
                      style={{
                        animationDelay: `${i * 0.12}s`,
                        height: `${18 + Math.sin(i * 1.2) * 12}px`,
                      }}
                    />
                  ))}
                </div>
              ) : (
                <svg className="w-11 h-11 sm:w-14 sm:h-14 text-indigo-400 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              )}
            </div>
            <p className="text-white text-xl sm:text-2xl font-semibold text-center">
              {callState === "connected" ? "In Call" : callState === "waiting" ? "Waiting..." : "Connecting..."}
            </p>
            {callState === "connected" && (
              <p className="text-indigo-400 text-sm mt-2 font-mono">{formatDuration(duration)}</p>
            )}
          </div>
        )}

        {/* Top status bar */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-3 sm:px-4 z-20"
          style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
        >
          <div className="flex items-center gap-2 bg-black/50 backdrop-blur-sm rounded-full px-3 py-1.5">
            <div className={`w-2 h-2 rounded-full shrink-0 ${callState === "connected" ? "bg-green-400 animate-pulse" : "bg-yellow-400 animate-pulse"}`} />
            <span className="text-white text-xs font-medium whitespace-nowrap">
              {callState === "connected" ? formatDuration(duration) : callState === "waiting" ? "Waiting" : "Connecting"}
            </span>
          </div>

          {/* Share button — only while waiting */}
          {callState === "waiting" && roomId && (
            <button
              onClick={() => setShowShare((v) => !v)}
              className="flex items-center gap-1.5 bg-indigo-600/85 backdrop-blur-sm hover:bg-indigo-500/90 text-white text-xs font-medium px-3 py-1.5 rounded-full transition-all active:scale-95"
            >
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              <span className="hidden xs:inline">Share</span>
            </button>
          )}
        </div>

        {/* Share card — slides down from top when open */}
        {showShare && roomId && (
          <div className="absolute left-0 right-0 flex justify-center px-3 sm:px-4 z-20"
            style={{ top: "max(3.25rem, calc(env(safe-area-inset-top) + 2.5rem))" }}
          >
            <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/70 rounded-2xl p-4 w-full max-w-sm shadow-2xl">
              <div className="flex items-center justify-between mb-3">
                <p className="text-slate-300 text-xs font-semibold uppercase tracking-widest">Invite a friend</p>
                <button
                  onClick={() => setShowShare(false)}
                  className="text-slate-500 hover:text-slate-300 transition-colors p-1 -m-1"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Room ID row */}
              <div className="bg-slate-800/80 rounded-xl p-3 mb-2">
                <p className="text-slate-500 text-xs mb-1">Room ID</p>
                <div className="flex items-center gap-2">
                  <code className="text-indigo-300 text-xs font-mono flex-1 min-w-0 truncate">{roomId}</code>
                  <button
                    onClick={handleCopyId}
                    className="shrink-0 text-xs text-slate-300 hover:text-white bg-slate-700 hover:bg-slate-600 px-2.5 py-1.5 rounded-lg transition-all active:scale-95"
                  >
                    {copied ? "✓" : "Copy"}
                  </button>
                </div>
              </div>

              {/* Full link row */}
              <button
                onClick={handleCopyLink}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-all active:scale-[0.98]"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                {copied ? "Link Copied!" : "Copy Invite Link"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Controls bar — safe-area aware */}
      <div
        className="flex items-center justify-center gap-3 sm:gap-5 bg-slate-900/95 backdrop-blur-sm border-t border-slate-800"
        style={{
          paddingTop: "1rem",
          paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))",
          paddingLeft: "max(1rem, env(safe-area-inset-left))",
          paddingRight: "max(1rem, env(safe-area-inset-right))",
        }}
      >
        {/* Mute */}
        <button
          onClick={handleMute}
          className={`w-13 h-13 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 touch-manipulation ${
            isMuted
              ? "bg-red-500/20 border-2 border-red-500/60 text-red-400"
              : "bg-slate-800 border-2 border-slate-700 text-slate-300 hover:bg-slate-700"
          }`}
          style={{ width: 52, height: 52 }}
          title={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? <MicOffIcon /> : <MicIcon />}
        </button>

        {/* Camera toggle — video mode only */}
        {mode === "video" && (
          <button
            onClick={handleCamera}
            className={`rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 touch-manipulation ${
              isCameraOff
                ? "bg-red-500/20 border-2 border-red-500/60 text-red-400"
                : "bg-slate-800 border-2 border-slate-700 text-slate-300 hover:bg-slate-700"
            }`}
            style={{ width: 52, height: 52 }}
            title={isCameraOff ? "Turn camera on" : "Turn camera off"}
          >
            {isCameraOff ? <CamOffIcon /> : <CamIcon />}
          </button>
        )}

        {/* Hang up */}
        <button
          onClick={handleHangUp}
          className="rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center transition-all duration-200 active:scale-90 touch-manipulation shadow-lg shadow-red-600/40"
          style={{ width: 64, height: 64 }}
          title="End call"
        >
          <PhoneOffIcon />
        </button>

        {/* Share button — duplicate in controls so it's always reachable */}
        {callState === "waiting" && roomId && (
          <button
            onClick={() => setShowShare((v) => !v)}
            className="rounded-full bg-slate-800 border-2 border-slate-700 text-slate-300 hover:bg-slate-700 flex items-center justify-center transition-all duration-200 active:scale-90 touch-manipulation"
            style={{ width: 52, height: 52 }}
            title="Share room"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
