import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client for server-side operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
  time_ago?: string;
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

    const reportsWithUserInfo: ReportWithUser[] = reports.map((report: Report) => ({
      ...report,
      time_ago: getTimeAgo(report.created_at),
      reported_by: report.user_id,
    }));

    return NextResponse.json({
      reports: reportsWithUserInfo,
      count: reportsWithUserInfo.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal server error', reports: [] },
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

    const reportWithTimeAgo: ReportWithUser = {
      ...newReport,
      time_ago: getTimeAgo(newReport.created_at),
      reported_by: newReport.user_id,
    };

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
