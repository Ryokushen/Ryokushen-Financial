// js/config.js
const SUPABASE_CONFIG = {
    url: 'https://rplbjnknqxdyjgsuavcp.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwbGJqbmtucXhkeWpnc3VhdmNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE4NjY2OTIsImV4cCI6MjA2NzQ0MjY5Mn0.09RYF_oOrH8mmPjLo7fulai7ofwW5k94Y3_CIJbn6rI'
};

const supabase = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
window.supabaseClient = supabase;