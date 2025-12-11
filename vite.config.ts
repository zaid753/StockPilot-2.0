import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import legacy from '@vitejs/plugin-legacy'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    legacy({
      targets: ['defaults', 'not IE 11'],
    })
  ],
  define: {
    // ====================================================================================
    // IMPORTANT: REPLACE "YOUR_API_KEY_HERE" WITH YOUR ACTUAL GOOGLE GEMINI API KEY.
    // You can get a key from Google AI Studio: https://makersuite.google.com/app/apikey
    // ====================================================================================
    'process.env.API_KEY': JSON.stringify("AIzaSyBXzxM9pqUeFJV3lSSqZNJkkgn8wBh0XSw")
  },
  build: {
    cssCodeSplit: false,
  },
  base: './'
})