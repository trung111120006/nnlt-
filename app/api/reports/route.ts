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
    console.log('Fetching reports from database...');

    // Fetch all reports from the 'report' table, ordered by created_at (newest first)
    const { data: reports, error } = await supabase
      .from('report')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching reports:', error);
      
      // Handle case where table doesn't exist
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json(
          { 
            error: 'Reports table does not exist. Please create the table in Supabase.',
            reports: []
          },
          { status: 404 }
        );
      }
      
      return NextResponse.json(
        { 
          error: 'Failed to fetch reports',
          details: error.message,
          reports: []
        },
        { status: 500 }
      );
    }

    console.log(`Successfully fetched ${reports?.length || 0} reports`);

    // Fetch user emails for each report to display reporter information
    const reportsWithUserInfo: ReportWithUser[] = [];
    
    if (reports && reports.length > 0) {
      // Get unique user IDs
      const userIds = [...new Set(reports.map((r: Report) => r.user_id))];
      
      // Fetch user emails from auth.users (via a helper or directly if RLS allows)
      // Note: In Supabase, we can't directly query auth.users from the client
      // So we'll just return the user_id and let the frontend handle user info if needed
      
      // Process reports and add time_ago
      reportsWithUserInfo.push(...reports.map((report: Report) => ({
        ...report,
        time_ago: getTimeAgo(report.created_at),
        reported_by: report.user_id, // Frontend can resolve this if needed
      })));
    }

    return NextResponse.json({
      reports: reportsWithUserInfo,
      count: reportsWithUserInfo.length,
    });

  } catch (error: any) {
    console.error('Unexpected error fetching reports:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        reports: []
      },
      { status: 500 }
    );
  }
}

// POST - Create a new report
export async function POST(request: NextRequest) {
  try {
    const body: CreateReportRequest = await request.json();
    const { number, location, problem, user_id } = body;

    console.log('Creating new report:', { number, location, problem, user_id });

    // Validation
    if (!number || !location || !problem || !user_id) {
      return NextResponse.json(
        { 
          error: 'Missing required fields',
          details: 'Please provide: number, location, problem, and user_id'
        },
        { status: 400 }
      );
    }

    // Validate field types and lengths
    if (typeof number !== 'string' || number.trim().length === 0) {
      return NextResponse.json(
        { error: 'Invalid number field' },
        { status: 400 }
      );
    }

    if (typeof location !== 'string' || location.trim().length === 0) {
      return NextResponse.json(
        { error: 'Invalid location field' },
        { status: 400 }
      );
    }

    if (typeof problem !== 'string' || problem.trim().length === 0) {
      return NextResponse.json(
        { error: 'Invalid problem field' },
        { status: 400 }
      );
    }

    if (typeof user_id !== 'string' || user_id.trim().length === 0) {
      return NextResponse.json(
        { error: 'Invalid user_id field' },
        { status: 400 }
      );
    }

    // Verify user exists (optional check - can be removed if not needed)
    // Note: This requires RLS policies that allow checking auth.users
    // For now, we'll just insert the report and let the database constraints handle it

    // Insert the report into the database
    const { data: newReport, error } = await supabase
      .from('report')
      .insert({
        number: number.trim(),
        location: location.trim(),
        problem: problem.trim(),
        user_id: user_id.trim(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating report:', error);
      
      // Handle foreign key constraint error (user doesn't exist)
      if (error.code === '23503' || error.message?.includes('foreign key')) {
        return NextResponse.json(
          { 
            error: 'Invalid user_id',
            details: 'The provided user_id does not exist in the system'
          },
          { status: 400 }
        );
      }
      
      // Handle case where table doesn't exist
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json(
          { 
            error: 'Reports table does not exist. Please create the table in Supabase.'
          },
          { status: 404 }
        );
      }
      
      return NextResponse.json(
        { 
          error: 'Failed to create report',
          details: error.message
        },
        { status: 500 }
      );
    }

    console.log('Report created successfully:', newReport?.id);

    // Add time_ago to the response
    const reportWithTimeAgo: ReportWithUser = {
      ...newReport,
      time_ago: getTimeAgo(newReport.created_at),
      reported_by: newReport.user_id,
    };

    return NextResponse.json(
      {
        message: 'Report created successfully',
        report: reportWithTimeAgo
      },
      { status: 201 }
    );

  } catch (error: any) {
    console.error('Unexpected error creating report:', error);
    
    // Handle JSON parsing errors
    if (error instanceof SyntaxError || error.message?.includes('JSON')) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}

