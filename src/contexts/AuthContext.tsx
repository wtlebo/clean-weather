
import React, { createContext, useContext, useEffect, useState } from 'react';
import {
    GoogleAuthProvider,
    signInWithPopup,
    signOut as firebaseSignOut,
    onAuthStateChanged
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    isPremium: boolean;
    signInWithGoogle: () => Promise<void>;
    logout: () => Promise<void>;
    googleToken: string | null;
    togglePremium: () => Promise<void>; // Mock method
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [isPremium, setIsPremium] = useState(false);
    const [googleToken, setGoogleToken] = useState<string | null>(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                // Check if user doc exists, else create it
                const userRef = doc(db, 'users', currentUser.uid);
                const userSnap = await getDoc(userRef);

                if (userSnap.exists()) {
                    const data = userSnap.data();
                    setIsPremium(!!data.isPremium);
                } else {
                    // Initialize free user
                    await setDoc(userRef, {
                        email: currentUser.email,
                        isPremium: false,
                        createdAt: new Date().toISOString()
                    });
                    setIsPremium(false);
                }
            } else {
                setIsPremium(false);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const signInWithGoogle = async () => {
        const provider = new GoogleAuthProvider();
        provider.addScope('https://www.googleapis.com/auth/calendar');
        try {
            const result = await signInWithPopup(auth, provider);
            const credential = GoogleAuthProvider.credentialFromResult(result);
            if (credential?.accessToken) {
                setGoogleToken(credential.accessToken);
            }
        } catch (error) {
            console.error("Error signing in with Google", error);
            throw error;
        }
    };

    const logout = async () => {
        try {
            await firebaseSignOut(auth);
        } catch (error) {
            console.error("Error signing out", error);
        }
    };

    const togglePremium = async () => {
        if (!user) return;
        const newStatus = !isPremium;
        setIsPremium(newStatus); // Optimistic update

        try {
            const userRef = doc(db, 'users', user.uid);
            await setDoc(userRef, { isPremium: newStatus }, { merge: true });
        } catch (e) {
            console.error("Failed to toggle premium", e);
            setIsPremium(!newStatus); // Revert
        }
    };

    return (
        <AuthContext.Provider value={{ user, loading, isPremium, signInWithGoogle, logout, googleToken, togglePremium }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
