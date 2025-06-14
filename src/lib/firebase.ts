
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Log the config to help diagnose if env vars are loaded correctly
// This log will appear in the browser's console.
if (typeof window !== 'undefined') { // Ensure this runs only on the client-side for this log
  console.log('Attempting to initialize Firebase with config:', firebaseConfig);
  if (!firebaseConfig.projectId) {
    console.error(
      'Firebase Config Error: NEXT_PUBLIC_FIREBASE_PROJECT_ID is missing or undefined. ' +
      'Please ensure it is set correctly in your .env.local file and the server has been restarted.'
    );
  }
  if (!firebaseConfig.databaseURL) {
    console.error(
      'Firebase Config Error: NEXT_PUBLIC_FIREBASE_DATABASE_URL is missing or undefined. ' +
      'Please ensure it is set correctly in your .env.local file and the server has been restarted.'
    );
  }
}

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const database = getDatabase(app);

export { app, database };
