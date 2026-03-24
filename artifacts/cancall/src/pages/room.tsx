import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation, useSearch } from "wouter";
import { WebRTCCall, CallMode } from "@/lib/webrtc";

type CallState = "connecting" | "waiting" | "connected" | "error" | "ended";

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

  const handleCopy = () => {
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
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
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
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="text-white text-xl font-semibold mb-2">Something went wrong</p>
          <p className="text-slate-400 text-sm mb-6">{errorMsg}</p>
          <button
            onClick={() => setLocation("/")}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium text-sm transition-all"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      <div className="flex-1 relative overflow-hidden">
        {mode === "video" ? (
          <>
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div
              className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${
                callState === "connected" ? "opacity-0 pointer-events-none" : "opacity-100"
              } bg-gradient-to-br from-slate-900 via-indigo-950/50 to-slate-900`}
            >
              <div className="text-center">
                <div className="w-20 h-20 rounded-full bg-indigo-600/30 border-2 border-indigo-500/50 flex items-center justify-center mx-auto mb-4 animate-pulse">
                  <svg className="w-10 h-10 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                {callState === "waiting" ? (
                  <>
                    <p className="text-white text-lg font-semibold">Waiting for other person...</p>
                    <p className="text-slate-400 text-sm mt-1">Share the room link to connect</p>
                  </>
                ) : (
                  <>
                    <p className="text-white text-lg font-semibold">Connecting...</p>
                    <p className="text-slate-400 text-sm mt-1">Setting up your call</p>
                  </>
                )}
              </div>
            </div>

            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="absolute bottom-24 right-4 w-32 h-44 sm:w-40 sm:h-52 object-cover rounded-2xl border-2 border-slate-700/80 shadow-2xl bg-slate-800 z-10"
            />
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950/50 to-slate-900">
            <audio ref={remoteAudioRef} autoPlay />
            <div className="w-28 h-28 rounded-full bg-indigo-600/30 border-2 border-indigo-500/50 flex items-center justify-center mb-4">
              {callState === "connected" ? (
                <div className="flex items-end gap-1 h-10">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className="w-2 bg-indigo-400 rounded-full animate-bounce"
                      style={{
                        animationDelay: `${i * 0.1}s`,
                        height: `${20 + Math.sin(i) * 15}px`,
                      }}
                    />
                  ))}
                </div>
              ) : (
                <svg className="w-12 h-12 text-indigo-400 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              )}
            </div>
            <p className="text-white text-xl font-semibold">
              {callState === "connected" ? "In Call" : callState === "waiting" ? "Waiting..." : "Connecting..."}
            </p>
            {callState === "connected" && (
              <p className="text-indigo-400 text-sm mt-1 font-mono">{formatDuration(duration)}</p>
            )}
          </div>
        )}

        <div className="absolute top-4 left-0 right-0 flex items-center justify-between px-4 z-20">
          <div className="flex items-center gap-2 bg-black/40 backdrop-blur-sm rounded-full px-3 py-1.5">
            <div className={`w-2 h-2 rounded-full ${callState === "connected" ? "bg-green-400 animate-pulse" : "bg-yellow-400"}`} />
            <span className="text-white text-xs font-medium">
              {callState === "connected" ? formatDuration(duration) : callState === "waiting" ? "Waiting" : "Connecting"}
            </span>
          </div>

          {callState === "waiting" && roomId && (
            <button
              onClick={handleCopyId}
              className="flex items-center gap-2 bg-indigo-600/80 backdrop-blur-sm hover:bg-indigo-500/90 text-white text-xs font-medium px-3 py-1.5 rounded-full transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              {copied ? "Copied!" : "Copy Room ID"}
            </button>
          )}
        </div>

        {callState === "waiting" && roomId && (
          <div className="absolute top-16 left-0 right-0 flex justify-center px-4 z-20">
            <div className="bg-black/50 backdrop-blur-sm border border-slate-700/60 rounded-xl p-3 max-w-xs w-full">
              <p className="text-slate-400 text-xs mb-1.5 font-medium">Room ID — share with your friend</p>
              <div className="flex items-center gap-2">
                <code className="text-indigo-300 text-xs font-mono flex-1 truncate">{roomId}</code>
                <button
                  onClick={handleCopy}
                  className="text-xs text-slate-300 hover:text-white bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded-lg transition-all shrink-0"
                >
                  {copied ? "✓" : "Copy Link"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-4 py-6 bg-slate-900/95 backdrop-blur-sm border-t border-slate-800">
        <button
          onClick={handleMute}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 active:scale-95 ${
            isMuted
              ? "bg-red-500/20 border-2 border-red-500/60 text-red-400"
              : "bg-slate-800 border-2 border-slate-700 text-slate-300 hover:bg-slate-700"
          }`}
          title={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" clipRule="evenodd" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          )}
        </button>

        {mode === "video" && (
          <button
            onClick={handleCamera}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 active:scale-95 ${
              isCameraOff
                ? "bg-red-500/20 border-2 border-red-500/60 text-red-400"
                : "bg-slate-800 border-2 border-slate-700 text-slate-300 hover:bg-slate-700"
            }`}
            title={isCameraOff ? "Turn camera on" : "Turn camera off"}
          >
            {isCameraOff ? (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
              </svg>
            )}
          </button>
        )}

        <button
          onClick={handleHangUp}
          className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center transition-all duration-200 active:scale-95 shadow-lg shadow-red-600/40"
          title="End call"
        >
          <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
