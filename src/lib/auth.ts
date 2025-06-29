import { supabase } from './supabase';

export interface UserMetadata {
  full_name?: string;
  role?: 'admin' | 'user';
  office?: string;
  department?: string;
}

export const signIn = async (email: string, password: string) => {
  return await supabase.auth.signInWithPassword({
    email,
    password,
  });
};

export const signUp = async (email: string, password: string, metadata: UserMetadata = {}) => {
  return await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: metadata.full_name || '',
        role: metadata.role || 'user',
        office: metadata.office || '',
        department: metadata.department || '',
      }
    }
  });
};

export const signOut = async () => {
  return await supabase.auth.signOut();
};

export const getCurrentUser = () => {
  return supabase.auth.getUser();
};

export const getSession = () => {
  return supabase.auth.getSession();
};

// Helper function to check if user is admin
export const isAdmin = (user: any) => {
  return user?.user_metadata?.role === 'admin';
};

// Helper function to get user's full name
export const getUserFullName = (user: any) => {
  return user?.user_metadata?.full_name || user?.email || 'Usuario';
};