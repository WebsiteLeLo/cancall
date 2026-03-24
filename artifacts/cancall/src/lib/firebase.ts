import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBUObqMxX7wgKop1nRXAIP2txNZVVYclfo",
  authDomain: "cancall-94678.firebaseapp.com",
  projectId: "cancall-94678",
  storageBucket: "cancall-94678.firebasestorage.app",
  messagingSenderId: "177576246477",
  appId: "1:177576246477:web:e4454f6f006ca3cdb03d84"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
