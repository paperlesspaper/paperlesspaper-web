// Scripts for firebase and firebase messaging
importScripts(
  "https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js"
);
importScripts(
  "https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js"
);

// Initialize the Firebase app in the service worker by passing the generated config
var firebaseConfig = {
  apiKey: "AIzaSyBSQA0-DriC_g_G6XKrZYDOQleEFhZzCrQ",
  authDomain: "wirewire-c5529.firebaseapp.com",
  projectId: "wirewire-c5529",
  storageBucket: "wirewire-c5529.firebasestorage.app",
  messagingSenderId: "370688258529",
  appId: "1:370688258529:web:9e22afaa12adf2a1d1a2a0",
  measurementId: "G-7N52WJSD3W",
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
