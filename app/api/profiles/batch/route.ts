import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const supabaseAdmin = supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

/**
 * GET /api/profiles/batch?user_ids=uuid1,uuid2,...
 * Returns credibility and full_name for each user from profiles table.
 * Uses service role when available to bypass RLS.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userIdsParam = searchParams.get('user_ids');
    if (!userIdsParam || !userIdsParam.trim()) {
      return NextResponse.json(
        { error: 'Missing user_ids (comma-separated)', profiles: {} },
        { status: 400 }
      );
    }
    const userIds = userIdsParam.split(',').map((id) => id.trim()).filter(Boolean);
    if (userIds.length === 0) {
      return NextResponse.json({ profiles: {} });
    }

    const client = supabaseAdmin ?? supabase;
    const { data: profiles, error } = await client
      .from('profiles')
      .select('user_id, credibility, full_name')
      .in('user_id', userIds);

    if (error) {
      console.error('Batch profiles error:', error);
      return NextResponse.json(
        { error: error.message, profiles: {} },
        { status: 500 }
      );
    }

    const map: Record<string, { credibility: number; full_name: string | null }> = {};
    userIds.forEach((uid) => {
      map[uid] = { credibility: 0, full_name: null };
    });
    if (Array.isArray(profiles)) {
      profiles.forEach((p: { user_id: string; credibility?: number | null; full_name?: string | null }) => {
        const uid = p?.user_id;
        if (!uid) return;
        const cred = p.credibility;
        const credNum = typeof cred === 'number' ? cred : (typeof cred === 'string' ? parseInt(cred, 10) : 0);
        map[uid] = {
          credibility: Number.isNaN(credNum) ? 0 : credNum,
          full_name: p.full_name ?? null,
        };
      });
    }

    return NextResponse.json({ profiles: map });
  } catch (err: any) {
    console.error('Batch profiles exception:', err?.message || err);
    return NextResponse.json(
      { error: err?.message || 'Internal server error', profiles: {} },
      { status: 500 }
    );
  }
}
