export function validateEnvironmentVariables() {
  const REQUIRED_VARS = [
    'DATABASE_URL',
    'FIREBASE_SERVICE_ACCOUNT_BASE64',
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET'
  ];

  const missing = REQUIRED_VARS.filter(v => !process.env[v]);

  if (missing.length > 0) {
    console.warn('\n=========================================');
    console.warn('⚠️  STARTUP WARNING: MISSING OPTIONAL/REQUIRED ENV VARS');
    console.warn('=========================================');
    console.warn('The following environment variables are not set yet:');
    missing.forEach(v => console.warn(` - ${v}`));
    console.warn('\nPlease add them in the Render Dashboard Environment tab for full functionality.');
    console.warn('=========================================\n');
  } else {
    // Validate Base64 encoding for Firebase Service Account if provided
    try {
      if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
        const decoded = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8');
        JSON.parse(decoded);
      }
    } catch (err) {
      console.warn('⚠️  WARNING: FIREBASE_SERVICE_ACCOUNT_BASE64 is not valid base64 JSON.');
    }
    console.log('✅ Environment validation passed.');
  }
}
