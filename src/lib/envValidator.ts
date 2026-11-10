export function validateEnvironment() {
  const missingCritical: string[] = [];
  const missingOptional: string[] = [];

  const required: string[] = [
    // Firebase credentials are now hardcoded in firebase.ts for production stability
  ];

  const optional: string[] = [
    'VITE_FIREBASE_VAPID_KEY',
  ];

  required.forEach(key => {
    if (!import.meta.env[key]) missingCritical.push(key);
  });

  optional.forEach(key => {
    if (!import.meta.env[key]) missingOptional.push(key);
  });

  if (missingCritical.length > 0) {
    console.warn(`[EnvValidator] Critical environment variables missing: ${missingCritical.join(', ')}. App may degrade.`);
  }

  if (missingOptional.length > 0) {
    console.warn(`[EnvValidator] Optional environment variables missing: ${missingOptional.join(', ')}.`);
  }

  return { missingCritical, missingOptional };
}
