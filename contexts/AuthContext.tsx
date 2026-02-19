import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth } from '../firebase';
import { DataService } from '../services/db';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  instituteId: string | null;
  register: (email: string, pass: string) => Promise<void>;
  login: (email: string, pass: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  instituteId: null,
  register: async () => {},
  login: async () => {}
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const register = async (email: string, pass: string) => {
    // 1. Crear el usuario en Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
    const newUser = userCredential.user;

    // 2. Inicializar la estructura de datos del Tenant (Config, Fees, Institutes)
    // Esto asegura que cuando la UI cargue, los documentos existan.
    if (newUser) {
      await DataService.initializeTenant(newUser.uid, newUser.email || email);
    }
  };

  const value = {
    user,
    loading,
    instituteId: user ? user.uid : null,
    register,
    login
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};