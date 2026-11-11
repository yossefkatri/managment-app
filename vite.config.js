import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    // Tamagui is built on React Native primitives; on the web they come from react-native-web
    alias: { 'react-native': 'react-native-web' },
  },
  define: {
    'process.env.TAMAGUI_TARGET': JSON.stringify('web'),
  },
})
