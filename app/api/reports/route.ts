import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkAndAwardCredibility } from '@/lib/credibility';

// Initialize Supabase client for server-side operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);
// Create admin client for accessing auth.users if service role key is available
const supabaseAdmin = supabaseServiceRoleKey 
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;

// TypeScript interface for Report
interface Report {
  id: string;
  created_at: string;
  number: string;
  location: string;
  problem: string;
  user_id: string;
  type?: string;
  lat?: number;
  lng?: number;
}

interface ReportWithUser extends Report {
  reported_by?: string;
  reporter_name?: string | null;
  time_ago?: string;
  user_credibility?: number | null;
}

interface CreateReportRequest {
  number: string;
  location: string;
  problem: string;
  user_id: string;
  type?: string;
  lat?: number;
  lng?: number;
}

// Helper function to calculate time ago
function getTimeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
  
  if (diffInMinutes < 1) return 'Just now';
  if (diffInMinutes < 60) return `${diffInMinutes} min ago`;
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
  
  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
}

// GET - Fetch all reports
export async function GET(request: NextRequest) {
  try {
    const { data: reports, error } = await supabase
      .from('report')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching reports:', error);
      return NextResponse.json(
        { error: 'Failed to fetch reports', reports: [] },
        { status: 500 }
      );
    }

    const reportsList = Array.isArray(reports) ? reports : [];
    const userIds = [...new Set(reportsList.map((r: Report) => r.user_id).filter(Boolean))];
    const credibilityMap = new Map<string, number>();
    const nameMap = new Map<string, string | null>();

    userIds.forEach(userId => {
      credibilityMap.set(userId, 0);
    });

    if (userIds.length > 0) {
      try {
        const clientForProfiles = supabaseAdmin ?? supabase;
        const { data: profiles, error: profileError } = await clientForProfiles
          .from('profiles')
          .select('user_id, credibility, full_name')
          .in('user_id', userIds);

        if (profileError) {
          console.error('Profiles fetch error (continuing with defaults):', profileError.message);
        } else if (profiles && Array.isArray(profiles)) {
          for (const profile of profiles) {
            const uid = profile?.user_id;
            if (!uid) continue;
            const cred = profile.credibility;
            const credNum = typeof cred === 'number' ? cred : (typeof cred === 'string' ? parseInt(cred, 10) : 0);
            credibilityMap.set(uid, Number.isNaN(credNum) ? 0 : credNum);
            if (profile.full_name) {
              nameMap.set(uid, profile.full_name);
            }
          }
        }
      } catch (profileErr: any) {
        console.error('Profiles fetch exception:', profileErr?.message || profileErr);
      }

      const usersWithoutNames = userIds.filter(userId => !nameMap.has(userId));
      if (usersWithoutNames.length > 0 && supabaseAdmin) {
        for (const userId of usersWithoutNames) {
          try {
            const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);
            if (!authError && authUser?.user?.email) {
              nameMap.set(userId, authUser.user.email.split('@')[0]);
            }
          } catch (_) {
            // ignore per-user auth errors
          }
        }
      }
    }

    const reportsWithUserInfo: ReportWithUser[] = reportsList.map((report: Report) => {
      const credibility = credibilityMap.get(report.user_id) ?? 0;
      const reporterName = nameMap.get(report.user_id) || null;
      return {
        ...report,
        time_ago: getTimeAgo(report.created_at),
        reported_by: report.user_id,
        reporter_name: reporterName,
        user_credibility: credibility,
      };
    });

    return NextResponse.json({
      reports: reportsWithUserInfo,
      count: reportsWithUserInfo.length,
    });
  } catch (error: any) {
    console.error('GET /api/reports error:', error?.message || error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error', reports: [] },
      { status: 500 }
    );
  }
}

// POST - Create a new report
export async function POST(request: NextRequest) {
  try {
    const body: CreateReportRequest = await request.json();
    const { number, location, problem, user_id, type = 'other', lat, lng } = body;

    if (!number || !location || !problem || !user_id) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const { data: newReport, error } = await supabase
      .from('report')
      .insert({
        number: number.trim(),
        location: location.trim(),
        problem: problem.trim(),
        user_id: user_id.trim(),
        type,
        lat,
        lng
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating report:', error);
      return NextResponse.json(
        { error: 'Failed to create report', details: error.message },
        { status: 500 }
      );
    }

    // Fetch user credibility and name for the new report
    let userCredibility = 0;
    let reporterName: string | null = null;
    
    // Try to get from profiles first
    const { data: profile } = await supabase
      .from('profiles')
      .select('credibility, full_name')
      .eq('user_id', newReport.user_id)
      .maybeSingle();
    
    if (profile) {
      userCredibility = profile.credibility ?? 0;
      reporterName = profile.full_name || null;
    }
    
    // If no profile found, try to get email from auth.users as fallback
    if (!reporterName && supabaseAdmin) {
      try {
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(newReport.user_id);
        if (!authError && authUser?.user?.email) {
          reporterName = authUser.user.email.split('@')[0];
        }
      } catch (err: any) {
        console.error(`Error fetching auth user for new report:`, err.message);
      }
    }

    const reportWithTimeAgo: ReportWithUser = {
      ...newReport,
      time_ago: getTimeAgo(newReport.created_at),
      reported_by: newReport.user_id,
      reporter_name: reporterName,
      user_credibility: userCredibility,
    };

    // Check for adjacent reports with the same issue and award credibility points
    // This runs asynchronously and won't block the response
    checkAndAwardCredibility(newReport).catch((error) => {
      console.error('Error checking credibility (non-blocking):', error);
    });

    return NextResponse.json(
      { message: 'Report created successfully', report: reportWithTimeAgo },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
