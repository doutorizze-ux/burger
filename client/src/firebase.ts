import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyCRibwEdRzrpwYWUmxvUgVs2U6TTzJ18z0",
  authDomain: "flux-8ba0f.firebaseapp.com",
  projectId: "flux-8ba0f",
  storageBucket: "flux-8ba0f.firebasestorage.app",
  messagingSenderId: "287384239450",
  // Note: appId for web is usually needed for FCM to work on some browsers
  // User should provide the web appId from Firebase Console
};

const app = initializeApp(firebaseConfig);
const messaging = typeof window !== 'undefined' ? getMessaging(app) : null;

export const requestForToken = async () => {
  if (!messaging) return null;
  try {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      const currentToken = await getToken(messaging, {
        vapidKey: "H9rQZz1v9jKK-Y9zxClL39y7UrZ6CJ8z_KR-m_I7fw8"
      });
      if (currentToken) {
        console.log("FCM Token:", currentToken);
        return currentToken;
      }
    }
  } catch (err) {
    console.log("An error occurred while retrieving token. ", err);
  }
  return null;
};

export const onMessageListener = () =>
  new Promise((resolve) => {
    if (!messaging) return;
    onMessage(messaging, (payload) => {
      console.log("Payload:", payload);
      resolve(payload);
    });
  });

export { app, messaging };
