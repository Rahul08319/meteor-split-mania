import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: "./",
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    {
      name: "youtube-playables-sdk",
      transformIndexHtml(html: string) {
        const sdk = mode === "production" || mode === "youtube-playables"
          ? '<script src="https://www.youtube.com/game_api/v1"></script>'
          : '';
        return html.replace('<!-- platform-sdk: injected at build time for YouTube builds only -->', sdk);
      },
    },
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
