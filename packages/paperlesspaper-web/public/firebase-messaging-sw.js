// Scripts for firebase and firebase messaging
importScripts(
  "https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js"
);
importScripts(
  "https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js"
);

// Initialize the Firebase app in the service worker by passing the generated config
var firebaseConfig = {
  apiKey: "AIzaSyDHjV4zFIWWqllsPHV4p2s5q10MxvyCt6w",
  authDomain: "memo-2e24c.firebaseapp.com",
  projectId: "memo-2e24c",
  storageBucket: "memo-2e24c.appspot.com",
  messagingSenderId: "536456473474",
  appId: "1:536456473474:web:ceac0d6adf993a18c5bd9b",
  measurementId: "G-HF46RPMFGX",
};

firebase.initializeApp(firebaseConfig);

// Retrieve firebase messaging
const messaging = firebase.messaging();

messaging.onBackgroundMessage(function (payload) {
  console.log("Received background message ", payload);

  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
