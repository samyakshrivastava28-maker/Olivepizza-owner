import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getAuth } from 'firebase/auth';
import { Capacitor } from '@capacitor/core';

interface StartupGateProps {
  children: React.ReactNode;
}

// Global lifecycle flag attached to global window object
declare global {
  interface Window {
    __OP_APP_STARTUP_INTRO_PLAYED__?: boolean;
  }
}

// In-memory process flag for Native Capacitor apps (resets only on full app process restart)
let nativeIntroShownInProcess = false;

export default function StartupGate({ children }: StartupGateProps) {
  const [showVideo, setShowVideo] = useState(() => {
    if (typeof window === 'undefined') return false;

    // 1. Process-level global singleton guard (prevents replay on any route change or remount)
    if (window.__OP_APP_STARTUP_INTRO_PLAYED__) {
      return false;
    }

    // 2. Check if running on native mobile app (Android/iOS Capacitor)
    if (Capacitor.isNativePlatform()) {
      if (nativeIntroShownInProcess) {
        window.__OP_APP_STARTUP_INTRO_PLAYED__ = true;
        return false;
      }
      nativeIntroShownInProcess = true;
      window.__OP_APP_STARTUP_INTRO_PLAYED__ = true;
      return true;
    }

    // 3. Web / PWA: sessionStorage survives browser refresh (F5) and SPA route changes,
    // but resets when the user closes the browser/tab completely and opens again.
    const hasSeenIntro = sessionStorage.getItem('hasSeenIntro');
    if (hasSeenIntro === 'true') {
      window.__OP_APP_STARTUP_INTRO_PLAYED__ = true;
      return false;
    }
    sessionStorage.setItem('hasSeenIntro', 'true');
    window.__OP_APP_STARTUP_INTRO_PLAYED__ = true;
    return true;
  });

  const [videoFading, setVideoFading] = useState(false);
  const [deviceType] = useState<'mobile' | 'desktop'>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768 ? 'mobile' : 'desktop';
    }
    return 'desktop';
  });

  const [videoReady, setVideoReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const playStarted = useRef(false);
  const endedRef = useRef(false);
  const maxDurationTimerRef = useRef<any | null>(null);
  const initialFailsafeTimerRef = useRef<any | null>(null);

  const logDiagnostic = useCallback((reason: string, details?: any) => {
    try {
      const auth = getAuth();
      const userId = auth.currentUser?.uid || 'anonymous';
      const timestamp = new Date().toISOString();
      console.log('[StartupGate] [' + timestamp + '] User: ' + userId + ' | Reason: ' + reason, details || '');
    } catch {
      // Diagnostic logging failure should never impact app startup
    }
  }, []);

  const handleVideoEnd = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;

    // Clear all pending timers immediately
    if (maxDurationTimerRef.current) {
      clearTimeout(maxDurationTimerRef.current);
      maxDurationTimerRef.current = null;
    }
    if (initialFailsafeTimerRef.current) {
      clearTimeout(initialFailsafeTimerRef.current);
      initialFailsafeTimerRef.current = null;
    }

    logDiagnostic('Ending intro video with smooth transition');
    setVideoFading(true);

    // Clean up video decoder and memory after transition
    setTimeout(() => {
      if (videoRef.current) {
        try {
          videoRef.current.pause();
          videoRef.current.removeAttribute('src');
          videoRef.current.load(); // Releases GPU video decoder buffers on Android/mobile
        } catch {
          // Ignore cleanup errors on unmount
        }
      }
      setShowVideo(false);
    }, 250);
  }, [logDiagnostic]);

  const handlePlaying = useCallback(() => {
    playStarted.current = true;
    logDiagnostic('Intro video playback active');
  }, [logDiagnostic]);

  useEffect(() => {
    if (!showVideo) return;

    logDiagnostic('Initializing intro video sequence (first 5s optimized)');

    // Fast Failsafe: if video fails to load or buffer within 2.5s, skip directly to app
    initialFailsafeTimerRef.current = setTimeout(() => {
      if (!endedRef.current) {
        logDiagnostic('Startup video buffering threshold reached (2.5s), transitioning directly to app');
        handleVideoEnd();
      }
    }, 2500);

    // Hard ceiling: Guarantee video NEVER exceeds 5 seconds under any network or platform conditions
    maxDurationTimerRef.current = setTimeout(() => {
      if (!endedRef.current) {
        logDiagnostic('Reached strict 5-second maximum duration ceiling');
        handleVideoEnd();
      }
    }, 5000);

    const videoEl = videoRef.current;
    if (videoEl) {
      const playPromise = videoEl.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            playStarted.current = true;
            logDiagnostic('Intro video playback started successfully');
          })
          .catch((err) => {
            logDiagnostic('Video autoplay rejected by browser/OS, skipping intro', err.message);
            handleVideoEnd();
          });
      }
    }

    return () => {
      if (maxDurationTimerRef.current) clearTimeout(maxDurationTimerRef.current);
      if (initialFailsafeTimerRef.current) clearTimeout(initialFailsafeTimerRef.current);
    };
  }, [showVideo, handleVideoEnd, logDiagnostic]);

  // Video assets: Dedicated 5-second trimmed & encoded assets
  const mobileVideoUrl =
    'https://res.cloudinary.com/dxmlvkff1/video/upload/so_0,eo_5,w_540,c_limit,q_auto:eco,vc_h264:baseline:3.0,br_600k,fps_30/v1782199117/Olive_Pizza_logo_reveal_202606231246_xeyk9t.mp4';
  const desktopVideoUrl =
    'https://res.cloudinary.com/dxmlvkff1/video/upload/so_0,eo_5,w_1080,c_limit,q_auto:good,vc_h264/v1782199127/Olive_Pizza_logo_reveal_202606231247_rrtc3u.mp4';
  const posterFrameUrl =
    'https://res.cloudinary.com/dxmlvkff1/video/upload/so_0,w_540,c_limit,q_auto:eco,f_jpg/v1782199117/Olive_Pizza_logo_reveal_202606231246_xeyk9t.jpg';

  const currentVideoSrc = deviceType === 'mobile' ? mobileVideoUrl : desktopVideoUrl;

  return (
    <>
      {/* App shell & routes render immediately underneath overlay without blocking */}
      {children}

      {/* Intro Video Overlay — Renders ONLY on cold application start for max 5 seconds */}
      {showVideo && (
        <div
          id="op-startup-gate-overlay"
          className={`fixed inset-0 z-[999999] bg-[#0B0F14] flex items-center justify-center overflow-hidden transition-opacity duration-300 pointer-events-auto ${
            videoFading ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
          style={{ willChange: 'opacity', transform: 'translateZ(0)' }}
        >
          {/* Instant poster placeholder while first frame buffers */}
          <div
            className={`absolute inset-0 bg-cover bg-center transition-opacity duration-200 ${
              videoReady ? 'opacity-0 pointer-events-none' : 'opacity-100'
            }`}
            style={{
              backgroundImage: `url(${posterFrameUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />

          <video
            ref={videoRef}
            src={currentVideoSrc}
            playsInline
            muted
            autoPlay
            preload="auto"
            poster={posterFrameUrl}
            style={{
              transform: 'translateZ(0)',
              willChange: 'transform',
            }}
            className={`w-full h-full object-cover transition-opacity duration-150 ${
              videoReady ? 'opacity-100' : 'opacity-0'
            }`}
            onPlaying={handlePlaying}
            onCanPlay={() => {
              setVideoReady(true);
              if (initialFailsafeTimerRef.current) {
                clearTimeout(initialFailsafeTimerRef.current);
                initialFailsafeTimerRef.current = null;
              }
            }}
            onTimeUpdate={(e) => {
              if (e.currentTarget.currentTime >= 5.0) {
                logDiagnostic('Reached 5.0s playback timestamp mark');
                handleVideoEnd();
              }
            }}
            onEnded={() => {
              logDiagnostic('Intro video reached onEnded event');
              handleVideoEnd();
            }}
            onError={(e) => {
              logDiagnostic('Intro video stream error encountered, skipping directly to app', e);
              handleVideoEnd();
            }}
          />

          {/* Quick Skip button in top-right for instant entry */}
          <button
            onClick={handleVideoEnd}
            className="absolute top-6 right-6 z-50 px-4 py-2 bg-black/50 hover:bg-black/80 text-white/80 hover:text-white rounded-full text-xs font-bold tracking-wider uppercase border border-white/20 backdrop-blur-md transition-all active:scale-95 min-touch-target"
            aria-label="Skip Intro Video"
          >
            Skip &gt;
          </button>
        </div>
      )}
    </>
  );
}
