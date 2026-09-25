import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./App.css";
import { shouldRegisterServiceWorker } from "./game/distribution";

createRoot(document.getElementById("root")!).render(<App />);

if (import.meta.env.PROD && shouldRegisterServiceWorker && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}
