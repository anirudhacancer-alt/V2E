import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.v2e.app',
  appName: 'V2E',
  webDir: '../field-app/dist',

  // Development server configuration
  // Uncomment for live reload during local device development.
  // server: {
  //   url: 'http://localhost:3001',
  //   cleartext: true,
  // },

  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: '#0d2b45',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
    },
    StatusBar: {
      overlaysWebView: false,
      style: 'DARK',
      backgroundColor: '#0d2b45',
    },
  },

  ios: {
    contentInset: 'automatic',
    scheme: 'V2E',
  },

  android: {
    allowMixedContent: false,
  },
};

export default config;
