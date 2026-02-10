import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { Provider } from "react-redux";

import { store } from "./ducks/store";
import "./translation/i18n";
import "moment/locale/de";
import * as Sentry from "@sentry/react";
import { Integrations } from "@sentry/tracing";
// import * as serviceWorkerRegistration from "./serviceWorkerRegistration";
import { Capacitor } from "@capacitor/core";
import { CapacitorShareTarget } from "@capgo/capacitor-share-target";
//import "@fontsource/open-sans";
//[300,400,500,600,700,800]

import "@fontsource/open-sans/300.css";
import "@fontsource/open-sans/400.css";
import "@fontsource/open-sans/400-italic.css";
import "@fontsource/open-sans/500.css";
import "@fontsource/open-sans/600.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </React.StrictMode>,
);

if (Capacitor.isNativePlatform()) {
  CapacitorShareTarget.addListener("shareReceived", (event) => {
    alert("Share received: " + JSON.stringify(event));
    console.log("Share received", {
      title: event.title,
      texts: event.texts,
      files: event.files,
    });
  });
}

try {
  if (import.meta.env.MODE === "production") {
    Sentry.init({
      dsn: "https://c0005be9f25a4b21919359f7c37abd2a@o1076131.ingest.sentry.io/6077427",
      integrations: [new Integrations.BrowserTracing()],
      release: import.meta.env.REACT_APP_VERSION,

      tracesSampleRate: 1.0,
      /*beforeSend(event, hint) {
    if (event.exception) {
      Sentry.showReportDialog({ eventId: event.event_id });
    }
    return event;
  },*/
    });
  }
} catch (error) {
  console.error("Sentry error", error);
}
/*
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => {
        registration.unregister();
      });
    });
  });
}

if ("caches" in window) {
  caches.keys().then(function (cacheNames) {
    cacheNames.forEach(function (cacheName) {
      caches.delete(cacheName);
    });
  });
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("/service-worker.js")
    .then((registration) => {
      console.log("Service worker registered:", registration);

      registration.update(); // Update to this new service worker
    });
}
*/
