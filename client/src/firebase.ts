import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyBS47Mwp2L1oOaJj-KXrbzIeTwrUxH66Wk",
  authDomain: "flux-8ba0f.firebaseapp.com",
  databaseURL: "https://flux-8ba0f-default-rtdb.firebaseio.com",
  projectId: "flux-8ba0f",
  storageBucket: "flux-8ba0f.firebasestorage.app",
  messagingSenderId: "287384239450",
  appId: "1:287384239450:web:dd64c1675559a5f3834763",
  measurementId: "G-V1ZQ362TPF"
};

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

export const requestForToken = async () => {
  try {
    const currentToken = await getToken(messaging, { 
      vapidKey: "H9rQZz1v9jKK-Y9zxClL39y7UrZ6CJ8z_KR-m_I7fw8" 
    });
    if (currentToken) {
      console.log('FCM Token:', currentToken);
      // Salvar no servidor
      const token = localStorage.getItem('token');
      if (token) {
          await fetch('/api/fcm-token', {
              method: 'POST',
              headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({ fcm_token: currentToken })
          });
      }
      return currentToken;
    }
  } catch (err) {
    console.log('An error occurred while retrieving token. ', err);
  }
};

export const onMessageListener = () =>
  new Promise((resolve) => {
    onMessage(messaging, (payload) => {
      console.log("Payload", payload);
      resolve(payload);
    });
  });

export default app;
