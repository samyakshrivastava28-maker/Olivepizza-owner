let schedulerActive = false;

export function initKeepAlive() {
  if (schedulerActive) return;

  const url = process.env.RENDER_PUBLIC_URL || process.env.BACKEND_URL || process.env.OWNER_BACKEND_URL || 'https://olive-pizza.onrender.com';
  const pingUrl = url.endsWith('/keep-alive') ? url : `${url.replace(/\/$/, '')}/keep-alive`;

  console.log('⏰ Keep-Alive Scheduler Started');
  console.log('⏱️ Interval: 10 minutes');
  console.log(`🎯 Target: ${pingUrl}`);

  schedulerActive = true;

  const sendPing = async () => {
    try {
      const response = await fetch(pingUrl, {
        headers: { 'User-Agent': 'OlivePizza-Owner-KeepAlive/1.0' },
        signal: AbortSignal.timeout(15000),
      });
      if (response.ok) {
        console.log(`[KeepAlive] ✅ Ping successful (${new Date().toLocaleTimeString()}) - Status: ${response.status}`);
      } else {
        console.warn(`[KeepAlive] ⚠️ Ping returned status ${response.status}`);
      }
    } catch (error: any) {
      console.warn(`[KeepAlive] ⚠️ Ping warning:`, error?.message || error);
    }
  };

  // Immediate initial check in background (delayed 30s after boot)
  setTimeout(sendPing, 30000);

  // Run every 10 minutes (600,000 ms)
  setInterval(sendPing, 10 * 60 * 1000);
}
