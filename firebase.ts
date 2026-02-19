import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCupw5SLOp43wPRLXc3oyiuysvl8GXxf0M",
  authDomain: "saas-edumanage.firebaseapp.com",
  projectId: "saas-edumanage",
  storageBucket: "saas-edumanage.firebasestorage.app",
  messagingSenderId: "831907701349",
  appId: "1:831907701349:web:1af30814408feb0d12dc8c",
  measurementId: "G-8R55B97QE4"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);