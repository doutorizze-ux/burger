import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pitdog.driver',
  appName: 'PitDog Pilot',
  webDir: 'dist',
  server: {
    url: 'https://staysoft.fun/driver',
    cleartext: true
  }
};

export default config;
