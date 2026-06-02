import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { UserRole } from '../lib/database.types';

interface Profile {
  id: string;
  role: UserRole;
  full_name: string;
  email: string;
  client_id: string | null;
  brand_id: string | null;
  avatar_url: string | null;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string, role: UserRole) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Tracks the most recently requested userId so stale loadProfile() results
  // from a previous session (e.g. getSession() racing with setSession() from
  // ShopifyCallback) are silently discarded instead of overwriting the new user.
  const activeUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setLoading(true); // keep spinner while profile is being fetched
          await loadProfile(session.user.id);
        } else {
          activeUserIdRef.current = null;
          setProfile(null);
          setLoading(false);
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadProfile = async (userId: string) => {
    // Mark this call as the authoritative one; any earlier in-flight call is now stale.
    activeUserIdRef.current = userId;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      // If a newer loadProfile() has been called while we were awaiting, discard this result.
      if (activeUserIdRef.current !== userId) return;

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      if (activeUserIdRef.current !== userId) return; // stale — discard
      console.error('Error loading profile:', error);
      setProfile(null);
    } finally {
      if (activeUserIdRef.current === userId) setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Login error:', error);

        if (error.message.includes('Email not confirmed')) {
          return {
            error: new Error('Please confirm your email before logging in. Check your inbox for a confirmation link.')
          };
        }

        if (error.message.includes('Invalid login credentials')) {
          return {
            error: new Error('Invalid email or password. Please try again or sign up if you don\'t have an account.')
          };
        }

        return { error };
      }

      return { error: null };
    } catch (error) {
      console.error('Unexpected login error:', error);
      return { error: error as Error };
    }
  };

  const signUp = async (email: string, password: string, fullName: string, role: UserRole = 'member') => {
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin + '/dashboard',
          data: {
            full_name: fullName,
          }
        }
      });

      if (authError) {
        console.error('Signup error:', authError);
        return { error: authError };
      }

      if (!authData.user) {
        console.error('No user data returned');
        return { error: new Error('User creation failed. Please try again.') };
      }

      if (authData.session) {
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: authData.user.id,
            email,
            full_name: fullName,
            role,
          });

        if (profileError) {
          console.error('Profile creation error:', profileError);
          if (profileError.code === '23505') {
            return { error: new Error('An account with this email already exists. Please log in instead.') };
          }
          return { error: new Error('Failed to create user profile. Please contact support.') };
        }

        return { error: null };
      } else {
        return {
          error: new Error('Account created! Please check your email to confirm your account before logging in.')
        };
      }
    } catch (error) {
      console.error('Unexpected signup error:', error);
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setSession(null);
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return { error: new Error('No user logged in') };

    // SECURITY (H-12): strip server-only fields before writing to DB.
    // Any component calling updateProfile({ role: 'admin' }) or
    // updateProfile({ client_id: '...' }) would otherwise attempt a
    // role elevation or tenant reassignment at the DB layer.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { role, client_id, brand_id, id: _id, ...safeUpdates } = updates as any;

    try {
      const { error } = await supabase
        .from('profiles')
        .update(safeUpdates)
        .eq('id', user.id);

      if (error) return { error };

      setProfile(prev => prev ? { ...prev, ...updates } : null);
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        loading,
        signIn,
        signUp,
        signOut,
        updateProfile,
      }}
    >
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
