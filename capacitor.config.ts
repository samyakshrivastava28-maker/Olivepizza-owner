import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'in.olivepizza.owner',
  appName: 'Olive Pizza Owner',
  webDir: 'frontend/dist',
  server: {
    androidScheme: 'https',
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: false,
    backgroundColor: '#0B0F17',
  },
  plugins: {
    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: ['google.com'],
      googleClientId: '1017239455106-i8vrpdq1v51pkg0308k7btu1o4img597.apps.googleusercontent.com',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    Geolocation: {
      requestPermissions: true,
    },
  },
};

export default config;
