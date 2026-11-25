import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.sanadcompany.sanadorder',
  appName: 'Sanad Order',
  webDir: 'dist',
  backgroundColor: '#0B1220',
  android: {
    allowMixedContent: false,
    // insets are handled in CSS (edge-to-edge), not with WebView margins
    adjustMarginsForEdgeToEdge: 'disable'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: false,
      backgroundColor: '#0B1220',
      showSpinner: false,
      androidScaleType: 'CENTER_INSIDE'
    },
    Keyboard: { resize: 'native', resizeOnFullScreen: true },
    PushNotifications: { presentationOptions: ['badge', 'sound', 'alert'] }
  }
}

export default config
