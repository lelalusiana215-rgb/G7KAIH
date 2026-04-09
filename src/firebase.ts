import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, GithubAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const githubProvider = new GithubAuthProvider();

export const signInWithGoogle = async () => {
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (error: any) {
    console.error("Error signing in with Google:", error);
    if (error.code === 'auth/unauthorized-domain') {
      alert("Domain ini belum terdaftar di Firebase. Silakan tambahkan domain vercel.app Anda ke 'Authorized domains' di Firebase Console (Authentication > Settings).");
    } else {
      alert("Gagal masuk dengan Google: " + error.message);
    }
  }
};

export const signInWithGithub = async () => {
  try {
    await signInWithPopup(auth, githubProvider);
  } catch (error: any) {
    console.error("Error signing in with GitHub:", error);
    if (error.code === 'auth/unauthorized-domain') {
      alert("Domain ini belum terdaftar di Firebase. Silakan tambahkan domain vercel.app Anda ke 'Authorized domains' di Firebase Console (Authentication > Settings).");
    } else {
      alert("Gagal masuk dengan GitHub: " + error.message);
    }
  }
};
