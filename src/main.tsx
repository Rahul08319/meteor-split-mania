import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./App.css";
import { shouldRegisterServiceWorker } from "./game/distribution";

createRoot(document.getElementById("root")!).render(<App />);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  if (shouldRegisterServiceWorker) {
    window.addEventListener('load', () => {
      void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    });
  } else {
    // Proactively clean up any stale service workers or caches from prior sessions
    void navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const reg of registrations) {
        void reg.unregister();
      }
    });
  }
}
