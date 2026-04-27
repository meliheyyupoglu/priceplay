import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // `dist/index.html` dosyayı çift tıklayıp açınca ve statik hostta alt klasörde çalışması için göreli yollar
  base: './',
  plugins: [react()],
  server: {
    proxy: {
      // Steam Store API tarayıcı CORS vermez; geliştirmede bu proxy kullanılır.
      '/steam-store': {
        target: 'https://store.steampowered.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/steam-store/, ''),
      },
    },
  },
})
