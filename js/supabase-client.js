// Shared Supabase Client Instance
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js'

// Create a single Supabase client instance
let supabaseClient = null

export function getSupabaseClient() {
  if (!supabaseClient && window.supabase) {
    console.log('Creating Supabase client with URL:', SUPABASE_URL)
    supabaseClient = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        }
      }
    )
  }
  return supabaseClient
}

// Export the getter function as default
export default getSupabaseClient