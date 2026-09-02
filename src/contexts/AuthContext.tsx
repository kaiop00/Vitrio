import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { AppUser } from '../types/models';

type AuthContextValue = {
  firebaseUser: User | null;
  profile: AppUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AppUser>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeProfile: (()=>void) | null = null;
    const unsubscribeAuth = onAuthStateChanged(auth, user => {
      unsubscribeProfile?.(); unsubscribeProfile=null;
      setFirebaseUser(user);
      if (!user) { setProfile(null); setLoading(false); return; }
      setLoading(true);
      unsubscribeProfile = onSnapshot(doc(db,'users',user.uid), snap => {
        setProfile(snap.exists()?({uid:user.uid,...snap.data()} as AppUser):null);
        setLoading(false);
      },()=>{ setProfile(null); setLoading(false); });
    });
    return ()=>{unsubscribeProfile?.();unsubscribeAuth();};
  },[]);

  const login = async (email:string,password:string) => {
    const credential=await signInWithEmailAndPassword(auth,email,password);
    const { getDoc } = await import('firebase/firestore');
    const snap=await getDoc(doc(db,'users',credential.user.uid));
    if(!snap.exists()) { await signOut(auth); throw new Error('PROFILE_NOT_FOUND'); }
    const next={uid:credential.user.uid,...snap.data()} as AppUser;
    if(next.active!==true){ await signOut(auth); throw new Error('ACCESS_DISABLED'); }
    return next;
  };
  const logout=async()=>signOut(auth);
  return <AuthContext.Provider value={{firebaseUser,profile,loading,login,logout}}>{children}</AuthContext.Provider>;
}
export function useAuth(){const ctx=useContext(AuthContext);if(!ctx)throw new Error('useAuth deve ser usado dentro de AuthProvider');return ctx;}
