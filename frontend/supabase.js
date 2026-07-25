// Supabase Initialization & Helper Functions for Moot Court AI

const SUPABASE_URL = 'https://wjfemhpaqcqbqipxnnzp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqZmVtaHBhcWNxYnFpcHhubnpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4Nzc2ODgsImV4cCI6MjEwMDQ1MzY4OH0.ZPDZmp14mNcKcQ6Htq-DBPTe0IFbnVtvuX16jNResjI';

// Initialize Supabase Client
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// -------------------------------------------------------------
// AUTH FUNCTIONS
// -------------------------------------------------------------

async function signUpWithEmail(email, password, fullName) {
  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName }
    }
  });
  return { data, error };
}

async function signInWithEmail(email, password) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });
  return { data, error };
}

async function signInWithGoogle() {
  const { data, error } = await supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin + '/app.html'
    }
  });
  return { data, error };
}

async function signOut() {
  const { error } = await supabaseClient.auth.signOut();
  return { error };
}

async function getCurrentUser() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  return user;
}

async function getCurrentProfile() {
  const user = await getCurrentUser();
  if (!user) return null;
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  return data;
}

// -------------------------------------------------------------
// SESSION FUNCTIONS
// -------------------------------------------------------------

async function saveSessionToDB(domain, side, role, problem) {
  const user = await getCurrentUser();
  if (!user) return null;
  const { data, error } = await supabaseClient
    .from('sessions')
    .insert({
      user_id: user.id,
      domain,
      side,
      role,
      problem
    })
    .select()
    .single();
  return data;
}

async function saveMessageToDB(sessionId, role, content) {
  const user = await getCurrentUser();
  if (!user) return null;
  const { data, error } = await supabaseClient
    .from('messages')
    .insert({
      session_id: sessionId,
      user_id: user.id,
      role,
      content
    });
  return data;
}

async function getUserSessions() {
  const user = await getCurrentUser();
  if (!user) return [];
  const { data, error } = await supabaseClient
    .from('sessions')
    .select('*, messages(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  return data || [];
}

async function updateSessionField(sessionId, field, value) {
  const { data, error } = await supabaseClient
    .from('sessions')
    .update({ [field]: value })
    .eq('id', sessionId);
  if (error) throw error;
  return data;
}

async function saveEvaluationToDB(sessionId, scores) {
  const user = await getCurrentUser();
  if (!user) return null;
  const { data, error } = await supabaseClient
    .from('evaluations')
    .insert({
      session_id: sessionId,
      user_id: user.id,
      ...scores
    });
  return data;
}

// -------------------------------------------------------------
// ADMIN FUNCTIONS
// -------------------------------------------------------------

async function isCurrentUserAdmin() {
  const profile = await getCurrentProfile();
  return profile?.role === 'admin';
}

async function getAllUsers() {
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });
  return data || [];
}

async function updateUserRole(userId, role) {
  const { data, error } = await supabaseClient
    .from('profiles')
    .update({ role })
    .eq('id', userId);
  return { data, error };
}

async function updateUserStatus(userId, status) {
  const { data, error } = await supabaseClient
    .from('profiles')
    .update({ status })
    .eq('id', userId);
  return { data, error };
}

async function getUserChats(userId) {
  const { data, error } = await supabaseClient
    .from('sessions')
    .select('*, messages(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return data || [];
}

async function getAllSessionsWithUsers() {
  const { data, error } = await supabaseClient
    .from('sessions')
    .select('*, profiles(full_name, email), messages(*)')
    .order('created_at', { ascending: false });
  return data || [];
}

async function getAllSessionsCount() {
  const { count, error } = await supabaseClient
    .from('sessions')
    .select('*', { count: 'exact', head: true });
  return count || 0;
}
