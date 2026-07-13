import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const isDesktopBuild = env.VITE_DESKTOP === 'true'
  const isStaticDeploy = env.GITHUB_ACTIONS === 'true' || env.DEPLOY_TARGET === 'beta'

  return {
    // Use local relative assets for Electron builds, GitHub Pages paths for deploys, and / for localhost
    base: isDesktopBuild
      ? './'
      : isStaticDeploy
        ? env.DEPLOY_TARGET === 'beta'
          ? '/PokepelagoClient/beta/'
          : '/PokepelagoClient/'
        : '/',
    plugins: [
      react(),
      tailwindcss(),
    ],
    define: {
      __IS_BETA__: env.DEPLOY_TARGET === 'beta',
      __TWITCH_ENABLED__: env.VITE_TWITCH_CHAT === 'true',
    },
  }
})
