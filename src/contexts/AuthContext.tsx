import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface Employee {
  id: string;
  user_id: string | null;
  employee_code: string;
  full_name: string;
  email: string;
  username: string;
  phone: string | null;
  role: 'field_worker' | 'field_supervisor' | 'supervisor' | 'admin' | 'manager' | 'intern' | 'office_employee';
  active: boolean;
}

interface CommunityUser {
  id: string;
  user_id: string;
  community_id: string;
  role_type: 'estate_manager' | 'mc_member' | 'caas_supervisor' | 'account_manager';
  name: string;
  phone: string;
  email: string;
  active: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  employee: Employee | null;
  communityUser: CommunityUser | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signInCommunityUser: (email: string, password: string) => Promise<void>;
  signUp: (username: string, email: string, password: string, fullName: string, employeeCode: string) => Promise<void>;
  signUpCommunityUser: (email: string, password: string, name: string, phone: string, communityId: string, roleType: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [communityUser, setCommunityUser] = useState<CommunityUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data: empData } = await supabase
      .from('employees')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (empData) {
      setEmployee(empData as Employee);
      setCommunityUser(null);
      return;
    }

    const { data: cuData } = await supabase
      .from('community_users')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (cuData) {
      setCommunityUser(cuData as CommunityUser);
      setEmployee(null);
      return;
    }

    setEmployee(null);
    setCommunityUser(null);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchProfile(session.user.id);
        } else {
          setEmployee(null);
          setCommunityUser(null);
        }
        setLoading(false);
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (username: string, password: string) => {
    const { data: employeeData, error: employeeError } = await supabase
      .from('employees')
      .select('email, username')
      .ilike('username', username)
      .limit(1)
      .maybeSingle();

    if (employeeError) {
      throw new Error('Unable to verify credentials. Please try again.');
    }

    if (!employeeData) {
      throw new Error('Invalid username or password');
    }

    const email = employeeData.email || `${employeeData.username}@temp.local`;

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new Error('Invalid username or password');
    }
  };

  const signInCommunityUser = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new Error('Invalid email or password');
    }
  };

  const signUp = async (username: string, email: string, password: string, fullName: string, employeeCode: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) throw error;

    if (data.user) {
      const { error: employeeError } = await supabase.from('employees').insert({
        user_id: data.user.id,
        employee_code: employeeCode,
        full_name: fullName,
        email,
        username,
        role: 'field_worker',
      } as any);
      if (employeeError) throw employeeError;
    }
  };

  const signUpCommunityUser = async (email: string, password: string, name: string, phone: string, communityId: string, roleType: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) throw error;

    if (data.user) {
      const { error: cuError } = await supabase.from('community_users').insert({
        user_id: data.user.id,
        community_id: communityId,
        role_type: roleType,
        name,
        phone,
        email,
      } as any);
      if (cuError) throw cuError;
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut({ scope: 'local' });
    setUser(null);
    setSession(null);
    setEmployee(null);
    setCommunityUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user, session, employee, communityUser, loading,
      signIn, signInCommunityUser, signUp, signUpCommunityUser, signOut
    }}>
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
