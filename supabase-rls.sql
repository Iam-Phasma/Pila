-- =====================================================================
-- Pila — Supabase Migration: Anonymous Auth, RLS, and Row TTL
-- Run this once in Supabase Dashboard › SQL Editor.
-- =====================================================================

-- STEP 0 (Dashboard, not SQL):
--   Authentication › Configuration › Anonymous sign-ins › Enable
-- =====================================================================


-- =====================================================================
-- 1. ENSURE REQUIRED COLUMNS EXIST
-- =====================================================================

-- owner_id links each room to its Supabase auth user (incl. anonymous)
ALTER TABLE public.queue_rooms
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users (id);

-- created_at is used by the TTL cleanup job below
ALTER TABLE public.queue_rooms
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();


-- =====================================================================
-- 2. ROW-LEVEL SECURITY (RLS)
-- "Security Defeats Curiosity"
-- =====================================================================

ALTER TABLE public.queue_rooms ENABLE ROW LEVEL SECURITY;

-- Clean up any legacy catch-all policies before creating precise ones
DROP POLICY IF EXISTS "Allow all"          ON public.queue_rooms;
DROP POLICY IF EXISTS "rooms_select_all"   ON public.queue_rooms;
DROP POLICY IF EXISTS "rooms_insert_owner" ON public.queue_rooms;
DROP POLICY IF EXISTS "rooms_update_owner" ON public.queue_rooms;
DROP POLICY IF EXISTS "rooms_delete_owner" ON public.queue_rooms;

-- Anyone (anon key or authenticated) can READ any room.
-- The room_code acts as an unguessable access token shared by the host.
CREATE POLICY "rooms_select_all"
  ON public.queue_rooms FOR SELECT
  USING (true);

-- Only authenticated sessions (includes anonymous sign-in) can CREATE
-- a room, and they must claim it as their own (owner_id = their UID).
-- This stops drive-by inserts like: supabase.from('rooms').insert({...})
CREATE POLICY "rooms_insert_owner"
  ON public.queue_rooms FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() = owner_id
  );

-- Only the owner can UPDATE (advance queue, rename, etc.)
CREATE POLICY "rooms_update_owner"
  ON public.queue_rooms FOR UPDATE
  USING  (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Only the owner can DELETE (terminate queue)
CREATE POLICY "rooms_delete_owner"
  ON public.queue_rooms FOR DELETE
  USING (auth.uid() = owner_id);

-- 3. AUTO-DELETE STALE ROOMS 

SELECT cron.schedule(
  'delete-stale-rooms',   -- unique job name
  '0 * * * *',            -- runs every hour on the hour
  $$
  DELETE FROM public.queue_rooms
  WHERE COALESCE(updated_at, created_at) < now() - interval '10 hours';
  $$
);

-- To verify the job was registered:
-- SELECT * FROM cron.job WHERE jobname = 'delete-stale-rooms';
--
-- To remove it later:
-- SELECT cron.unschedule('delete-stale-rooms');


-- =====================================================================
-- 4. ADMIN FUNCTIONS  (run this block separately if already ran above)
-- =====================================================================

-- Helper: returns true only for the single named (non-anonymous) account.
-- SECURITY DEFINER lets it read auth.users regardless of caller role.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id = auth.uid()
      AND is_anonymous = false
      AND email IS NOT NULL
  );
$$;

-- Admin can delete ANY room (existing owner-only policy still works for normal hosts)
DROP POLICY IF EXISTS "rooms_delete_admin" ON public.queue_rooms;
CREATE POLICY "rooms_delete_admin"
  ON public.queue_rooms FOR DELETE
  USING (public.is_admin());

-- RPC: returns every room with its owner's email + anonymous flag.
-- Only callable when is_admin() = true; returns 0 rows otherwise.
CREATE OR REPLACE FUNCTION public.admin_get_all_rooms()
RETURNS TABLE (
  room_code        text,
  room_name        text,
  current_number   integer,
  owner_id         uuid,
  owner_email      text,
  owner_is_anonymous boolean,
  created_at       timestamptz,
  updated_at       timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    r.room_code,
    r.room_name,
    r.current_number,
    r.owner_id,
    COALESCE(u.email, '')          AS owner_email,
    COALESCE(u.is_anonymous, true) AS owner_is_anonymous,
    r.created_at,
    r.updated_at
  FROM public.queue_rooms r
  LEFT JOIN auth.users u ON u.id = r.owner_id
  WHERE public.is_admin() = true
  ORDER BY r.created_at DESC;
$$;
