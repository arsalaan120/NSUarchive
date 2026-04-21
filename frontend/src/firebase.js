import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth"; // Keeping Auth for your Admin login

const firebaseConfig = {
  apiKey: "AIzaSyCA0RdbeDSKXsJOfJ7SmQ2MH6aapJfPgBM",
  authDomain: "nsuarchive-a57e2.firebaseapp.com",
  projectId: "nsuarchive-a57e2",
  storageBucket: "nsuarchive-a57e2.firebasestorage.app", // You can leave this line here, it won't hurt anything!
  messagingSenderId: "474525053898",
  appId: "1:474525053898:web:35625e3412fa787a3e1533",
  measurementId: "G-4EWPHRXQ5W"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export only the tools you are actually using now
export const db = getFirestore(app);
export const auth = getAuth(app);