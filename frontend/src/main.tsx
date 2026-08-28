import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { ThemeProvider } from "./context/ThemeContext";
import App from './App.tsx'
import { AuthProvider } from './context/AuthContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
)

// Registro del service worker (PWA) + autoactualización: en cuanto
// detecta una versión nueva instalada, recarga sola la página para
// aplicarla — nadie tiene que desinstalar ni borrar caché a mano.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registro) => {
        // Si ya hay un SW nuevo esperando (detectado antes de que
        // esta pestaña cargara), lo activamos ya.
        registro.waiting?.postMessage({ tipo: "SKIP_WAITING" });

        // Cuando aparece una versión nueva mientras la app está
        // abierta, la seguimos hasta que termine de activarse.
        registro.addEventListener("updatefound", () => {
          const nuevoWorker = registro.installing;
          nuevoWorker?.addEventListener("statechange", () => {
            if (nuevoWorker.state === "activated") {
              window.location.reload();
            }
          });
        });
      })
      .catch((err) => {
        console.error("No se pudo registrar el service worker:", err);
      });

    // Si el SW que controla la página cambia (por ejemplo, tras
    // clients.claim() en activate), recargamos una sola vez.
    let recargando = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (recargando) return;
      recargando = true;
      window.location.reload();
    });
  });
}