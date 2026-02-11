// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getMessaging, getToken } from "firebase/messaging";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDHjV4zFIWWqllsPHV4p2s5q10MxvyCt6w",
  authDomain: "memo-2e24c.firebaseapp.com",
  projectId: "memo-2e24c",
  storageBucket: "memo-2e24c.appspot.com",
  messagingSenderId: "536456473474",
  appId: "1:536456473474:web:ceac0d6adf993a18c5bd9b",
  measurementId: "G-HF46RPMFGX",
};

// Initialize Firebase
export const firebaseApp = () => {
  return initializeApp(firebaseConfig);
};

export const messaging = (firebaseApp: any) => {
  return getMessaging(firebaseApp);
};

export const getTokenFirebase = () => {
  return getToken(messaging(firebaseApp), {
    vapidKey:
      "BA2pkHdh1jbYH61wx5hpcgM6lF-yXmYOO9iPXAlZEoAXGorNldnhMaJCs3otD7UoVJs9iyAbVyU3RbeFxHByTgI",
  })
    .then((currentToken) => {
      if (currentToken) {
        return currentToken;
        console.log("current token for client: ", currentToken);
      } else {
        console.log(
          "No registration token available. Request permission to generate one."
        );
      }
    })
    .catch((err) => {
      console.log("An error occurred while retrieving token. ", err);
    });
};

export default firebaseApp;
