import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore/lite';
import { getAnalytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: "fake-key",
  authDomain: "fake-domain",
  projectId: "fake-project",
  storageBucket: "fake-bucket",
  messagingSenderId: "fake-sender",
  appId: "fake-app",
  measurementId: "fake-measure"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;
