import { useState, useEffect } from 'react';
import { User, Session, AuthApiError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import * as auth from '../lib/auth';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          // Handle invalid refresh token errors with more robust checking
          const isRefreshTokenError = 
            (error instanceof AuthApiError && error.message.includes('refresh_token_not_found')) ||
            error.name === 'AuthApiError' && error.message.includes('refresh_token_not_found') ||
            error.message.includes('refresh_token_not_found') ||
            error.message.includes('Invalid Refresh Token');
          
          if (isRefreshTokenError) {
            // Clear invalid session data
            await supabase.auth.signOut();
            setSession(null);
            setUser(null);
          } else {
            console.error('Session retrieval error:', error);
          }
        } else {
          setSession(session);
          setUser(session?.user ?? null);
        }
      } catch (error) {
        console.error('Unexpected error during session initialization:', error);
        // Clear potentially corrupted session data
        await supabase.auth.signOut();
        setSession(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Only update state for valid sessions or explicit sign out events
        if (session || event === 'SIGNED_OUT') {
          setSession(session);
          setUser(session?.user ?? null);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      const result = await auth.signIn(email, password);
      return result;
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, metadata?: auth.UserMetadata) => {
    setLoading(true);
    try {
      const result = await auth.signUp(email, password, metadata);
      return result;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      const result = await auth.signOut();
      return result;
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = () => {
    return auth.isAdmin(user);
  };

  const getUserFullName = () => {
    return auth.getUserFullName(user);
  };

  return {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    isAdmin,
    getUserFullName,
  };
}