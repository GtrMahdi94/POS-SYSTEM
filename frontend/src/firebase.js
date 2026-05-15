import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyCCExTJkzzD1O4pkBvE5bRab1YaTzVemqc",
  authDomain: "pos-royal-honey.firebaseapp.com",
  databaseURL: "https://pos-royal-honey-default-rtdb.firebaseio.com",
  projectId: "pos-royal-honey",
  storageBucket: "pos-royal-honey.firebasestorage.app",
  messagingSenderId: "833626344437",
  appId: "1:833626344437:web:96e7fa804759d0dc0aeebc"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
