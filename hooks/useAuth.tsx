'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  User as FirebaseUser,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { User, UserRole } from '@/types';
import { validateEmailDomain, isSuperAdminEmail } from '@/lib/validation';

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  signUp: (email: string, password: string, name: string, sectorId?: string | null) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('🔐 Auth state changed:', firebaseUser ? 'User logged in' : 'No user');
      
      if (firebaseUser) {
        console.log('👤 Firebase User UID:', firebaseUser.uid);
        console.log('📧 Firebase User Email:', firebaseUser.email);
        
        try {
          // Buscar dados do usuário no Firestore
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          console.log('📄 User doc exists:', userDoc.exists());
          
          if (userDoc.exists()) {
            const userData = { id: firebaseUser.uid, ...userDoc.data() } as User;
            console.log('✅ User data loaded:', userData);
            setUser(userData);
          } else {
            console.warn('⚠️ User doc não existe no Firestore, criando...');
            // Criar documento se não existir
            const newUserData = {
              email: firebaseUser.email,
              name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Usuário',
              role: isSuperAdminEmail(firebaseUser.email || '') ? 'super_admin' : 'user',
              sectorId: null,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            };
            
            await setDoc(doc(db, 'users', firebaseUser.uid), newUserData);
            setUser({ id: firebaseUser.uid, ...newUserData } as User);
            console.log('✅ User doc criado:', newUserData);
          }
        } catch (error) {
          console.error('❌ Erro ao buscar user do Firestore:', error);
          // Fallback: criar user com dados do Firebase Auth
          const fallbackUser: User = {
            id: firebaseUser.uid,
            email: firebaseUser.email || '',
            name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Usuário',
            role: isSuperAdminEmail(firebaseUser.email || '') ? 'super_admin' : 'user',
            sectorId: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          setUser(fallbackUser);
          console.log('⚠️ Usando fallback user:', fallbackUser);
        }
        setFirebaseUser(firebaseUser);
      } else {
        console.log('🚪 User logged out');
        setUser(null);
        setFirebaseUser(null);
      }
      setLoading(false);
      console.log('🏁 Auth loading finished');
    });

    return unsubscribe;
  }, []);

  const signUp = async (email: string, password: string, name: string, sectorId?: string | null) => {
    // Validar domínio do email
    const validation = validateEmailDomain(email);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Criar usuário no Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;

    // Atualizar perfil
    await updateProfile(firebaseUser, { displayName: name });

    // Determinar role
    let role: UserRole = 'user';
    if (isSuperAdminEmail(email)) {
      role = 'super_admin';
    }

    // Criar documento no Firestore
    await setDoc(doc(db, 'users', firebaseUser.uid), {
      email: firebaseUser.email,
      name,
      role,
      sectorId: sectorId || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  };

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, firebaseUser, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
