import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const SUPABASE_URL = "https://elbvdfjwmmsmweusttss.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsYnZkZmp3bW1zbXdldXN0dHNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxMTc3NDUsImV4cCI6MjA4OTY5Mzc0NX0.7lwSfUPdP38gMiP8sCC2NjjVGk0JxGOj-yIhhbewsOY";

export function isSupabaseConfigured() {
	return SUPABASE_URL.startsWith("https://") && SUPABASE_ANON_KEY !== "YOUR_SUPABASE_ANON_KEY";
}

export function createSupabaseBrowserClient() {
	if (!isSupabaseConfigured()) {
		return null;
	}

	return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
