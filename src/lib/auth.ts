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
  // Crear usuario en Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({
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

  if (authError) {
    return { data: authData, error: authError };
  }

  // Si el usuario se creó exitosamente, crear entrada en la tabla users
  if (authData.user) {
    try {
      // Generar ID único para el usuario basado en el email o usar el UUID de auth
      const userId = authData.user.id.slice(0, 8); // Usar primeros 8 caracteres del UUID
      
      const { error: userTableError } = await supabase
        .from('users')
        .insert({
          id: userId,
          email: email,
          full_name: metadata.full_name || '',
          office: metadata.office || '',
          department: metadata.department || '',
          status: 'Normal'
        });

      if (userTableError) {
        console.error('Error creating user in users table:', userTableError);
        // No retornamos error aquí para no bloquear el registro
        // El usuario puede usar el sistema aunque no esté en la tabla users
      }
    } catch (error) {
      console.error('Error in user table creation:', error);
    }
  }

  return { data: authData, error: authError };
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