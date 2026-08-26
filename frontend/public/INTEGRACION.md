# Integrar la PWA en el proyecto

## 1. Copiar archivos

```
frontend/public/manifest.json
frontend/public/sw.js
frontend/public/icons/icon-192.png
frontend/public/icons/icon-512.png
frontend/public/icons/icon-maskable-512.png
frontend/public/icons/apple-touch-icon.png
```

Vite sirve todo lo que hay en `public/` desde la raíz (`/manifest.json`,
`/sw.js`, `/icons/...`) sin ningún paso de build adicional — por eso
el manifest usa rutas absolutas (`/icons/icon-192.png`).

## 2. `frontend/index.html` — añadir dentro de `<head>`

```html
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#14636E">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Motiv">
```

Las 3 líneas de `apple-*` son necesarias aparte del `manifest.json`
porque Safari en iOS todavía no lee bien el manifest para todo (icono,
modo standalone) — sin ellas, "Añadir a pantalla de inicio" funciona
pero con peor icono y abriendo dentro de Safari en vez de a pantalla
completa.

## 3. Registrar el service worker

En el punto de entrada de la app (`frontend/src/main.tsx`), al final
del archivo:

```ts
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("No se pudo registrar el service worker:", err);
    });
  });
}
```

`window.addEventListener("load", ...)` evita competir con la carga
inicial de la app por ancho de banda/CPU — el registro se dispara
justo después de que la página ya esté lista, no antes.

## 4. Cada vez que despliegues un cambio relevante en el frontend

Sube el número de `VERSION` en `sw.js` (`"v1"` → `"v2"`, etc.). Sin
esto, un dispositivo que ya tenga la PWA instalada podría seguir
sirviendo JS/CSS cacheados de una versión vieja durante un tiempo —
subir la versión fuerza la limpieza de la caché anterior en el
siguiente `activate`.

## 5. Verificar que quedó bien

- Chrome DevTools → pestaña **Application** → **Manifest**: debe
  mostrar el manifest sin errores, con los 3 iconos cargando bien.
- Misma pestaña → **Service Workers**: debe aparecer `sw.js` como
  "activated and is running".
- **Lighthouse** (dentro de DevTools) → categoría "PWA": debería dar
  verde en instalabilidad. Si falla algo, el propio informe dice
  exactamente qué falta.

## 6. Sobre la investigación de la cámara (`09-administrador.md`)

Una vez esto esté desplegado, es el momento de probar la hipótesis
pendiente: instalar la PWA en el Redmi Note 12 Pro+ ya usado en las
pruebas anteriores y repetir el flujo de la cámara nativa desde ahí,
para ver si el comportamiento cambia frente a tenerla como pestaña
suelta de Chrome. Expectativa baja (ver `09`), pero es la prueba que
faltaba y ahora es gratis hacerla.
