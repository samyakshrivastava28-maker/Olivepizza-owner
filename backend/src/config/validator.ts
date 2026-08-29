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
    console.error('\n=========================================');
    console.error('❌ CRITICAL STARTUP ERROR: MISSING ENV VARIABLES');
    console.error('=========================================');
    console.error('The following required environment variables are missing:');
    missing.forEach(v => console.error(` - ${v}`));
    console.error('\nThe server cannot start without these. Please add them to your backend/.env file or deployment environment.');
    console.error('=========================================\n');
    process.exit(1);
  }

  // Validate Base64 encoding for Firebase Service Account
  try {
    const decoded = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64!, 'base64').toString('utf8');
    JSON.parse(decoded);
  } catch (err) {
    console.error('\n=========================================');
    console.error('❌ CRITICAL STARTUP ERROR: INVALID FIREBASE CREDS');
    console.error('=========================================');
    console.error('FIREBASE_SERVICE_ACCOUNT_BASE64 is not a valid base64 encoded JSON string.');
    console.error('=========================================\n');
    process.exit(1);
  }

  console.log('✅ Environment validation passed.');
}
