import React, { useEffect, useState, useRef } from 'react';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Smartphone, X } from 'lucide-react';

export default function AutoUpdater() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [isVisible, setIsVisible] = useState(false);
  const [latestVersion, setLatestVersion] = useState('');
  const lastBuildHashRef = useRef<string | null>(null);

  useEffect(() => {
    const checkForUpdates = async () => {
      // Only run on native Android device
      if (Capacitor.getPlatform() !== 'android') return;

      try {
        // 1. Get native app info
        const info = await App.getInfo();
        const currentVersionCode = parseInt(info.build, 10);
        if (isNaN(currentVersionCode)) return;

        // 2. Fetch latest release from GitHub
        const res = await fetch("https://api.github.com/repos/samyakshrivastava28-maker/Olive-Pizza/releases/tags/android-latest");
        if (!res.ok) return;
        
        const data = await res.json();
        
        // 3. Extract version code from release body
        // Body format: "Version Code: 123"
        const match = data.body?.match(/Version Code:\s*(\d+)/i);
        if (match && match[1]) {
          const githubVersionCode = parseInt(match[1], 10);
          
          if (githubVersionCode > currentVersionCode) {
            // Find the APK download URL
            const asset = data.assets?.find((a: any) => a.name.endsWith('.apk'));
            if (asset) {
              setDownloadUrl('/api/github/download-apk');
              setLatestVersion(`Build ${githubVersionCode}`);
              setUpdateAvailable(true);
              setIsVisible(true);
            }
          }
        }
      } catch (error) {
        console.error("AutoUpdater native error:", error);
      }
    };

    const checkFrontendUpdates = async () => {
      try {
        const res = await fetch('/api/health/version');
        if (!res.ok) return;
        const data = await res.json();
        
        if (data.build_hash) {
          if (!lastBuildHashRef.current) {
            lastBuildHashRef.current = data.build_hash;
          } else if (lastBuildHashRef.current !== data.build_hash) {
            console.log("New frontend version detected:", data.build_hash);
            // Silently clear PWA caches and reload
            if ('caches' in window) {
              const keys = await caches.keys();
              await Promise.all(keys.map(k => caches.delete(k)));
            }
            if ('serviceWorker' in navigator) {
              const regs = await navigator.serviceWorker.getRegistrations();
              for (const reg of regs) {
                await reg.unregister();
              }
            }
            window.location.reload();
          }
        }
      } catch (err) {
        console.error("Frontend version check failed", err);
      }
    };

    checkForUpdates();
    checkFrontendUpdates();
    
    // Poll for frontend updates every 10 minutes
    const interval = setInterval(checkFrontendUpdates, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleUpdate = async () => {
    if (downloadUrl) {
      // Use window.open with _system to force the native device browser to handle the APK download
      // rather than the in-app Capacitor browser which sometimes blocks file downloads
      window.open(downloadUrl, '_system');
      setIsVisible(false);
    }
  };

  return (
    <AnimatePresence>
      {isVisible && updateAvailable && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-dark-800 border border-dark-700 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl relative"
          >
            <button 
              onClick={() => setIsVisible(false)}
              className="absolute top-4 right-4 p-2 bg-dark-700/50 hover:bg-dark-600 rounded-full transition-colors z-10"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>

            <div className="p-6">
              <div className="w-16 h-16 bg-[#3ddc84]/20 rounded-2xl flex items-center justify-center mb-5 border border-[#3ddc84]/30">
                <Smartphone className="w-8 h-8 text-[#3ddc84]" />
              </div>
              
              <h2 className="text-xl font-black text-white mb-2 tracking-tight">
                App Update Available
              </h2>
              
              <p className="text-sm text-gray-400 mb-6 leading-relaxed">
                A new native version of the Olive Pizza app ({latestVersion}) is available. Please update to ensure you have the latest features and best performance.
              </p>

              <button
                onClick={handleUpdate}
                className="w-full flex items-center justify-center gap-2 bg-[#3ddc84] hover:bg-[#34c077] text-black px-5 py-3.5 rounded-xl font-bold transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-[#3ddc84]/20"
              >
                <Download className="w-5 h-5" />
                Download & Install
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
