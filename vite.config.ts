import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const target = process.env.VITE_DISTRIBUTION_TARGET;
  const isPlatformPackage = Boolean(target && target !== "web");

  return {
    base: isPlatformPackage ? "./" : "/",
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
        name: "platform-sdk-injection",
        transformIndexHtml(html: string) {
          const platformScripts: Record<string, string> = {
            "youtube-playables": '<script src="https://www.youtube.com/game_api/v1" onerror="console.warn(\'[Playables] SDK blocked or unavailable, standalone web mode active\')"></script>',
            "facebook-instant-games": '<script src="https://connect.facebook.net/en_US/fbinstant.7.1.js"></script>',
            "poki": '<script src="https://game-cdn.poki.com/scripts/v2/poki-sdk.js"></script>',
            "crazygames": '<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>',
            "yandex-games": '<script src="https://yandex.ru/games/sdk/v2"></script>',
            "gamedistribution": '<script src="https://html5.api.gamedistribution.com/main.min.js"></script>',
            "discord-activities": '<script src="https://cdn.jsdelivr.net/npm/@discord/embedded-app-sdk@1.3.1/dist/index.min.js"></script>',
            "jiogames": '<script src="https://jiogames.akamaized.net/games/jiosdk/jio-games-sdk.min.js"></script>',
            "y8": '<script src="https://cdn.y8.com/api/sdk.js"></script>',
            "lagged": '<script src="https://lagged.com/api/rev-share/lagged.js"></script>',
          };
          const script = target && platformScripts[target] ? platformScripts[target] : '';
          return html.replace('<!-- platform-sdk: injected at build time for YouTube builds only -->', script);
        },
      },
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
