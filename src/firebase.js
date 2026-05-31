import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
    apiKey: "AIzaSyBz5Cm-qsKe9pshGLaBkzw0WTOg9OLDwHk",
    authDomain: "invoice-99bdb.firebaseapp.com",
    projectId: "invoice-99bdb",
    storageBucket: "invoice-99bdb.firebasestorage.app",
    messagingSenderId: "1055209115726",
    appId: "1:1055209115726:web:926791697e6ad783e5b31f"
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)