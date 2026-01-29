import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client for server-side operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// TypeScript interface for Profile - Khớp với schema Supabase
interface Profile {
  id: string; // uuid (primary key)
  created_at: string; // timestamptz
  full_name: string | null; // text
  age: string | null; // text (không phải number!)
  job: string | null; // text
  avatar_url: string | null; // text
  credibility?: number | null; // integer (credibility points)
  user_id: string; // uuid (foreign key to auth.users.id)
}

interface UpdateProfileRequest {
  user_id: string;
  full_name?: string;
  age?: string; // text, không phải number
  job?: string;
  avatar_url?: string;
}

// GET - Fetch profile by user_id
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('user_id');

    if (!userId) {
      return NextResponse.json(
        { 
          error: 'Missing user_id parameter',
          details: 'Please provide user_id as a query parameter'
        },
        { status: 400 }
      );
    }

    console.log('Fetching profile for user:', userId);

    // Fetch profile from the 'profiles' table
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching profile:', error);
      return NextResponse.json(
        { 
          error: 'Failed to fetch profile',
          details: error.message,
          profile: null
        },
        { status: 500 }
      );
    }

    console.log('Profile fetched successfully:', profile ? 'Found' : 'Not found');

    return NextResponse.json({
      profile: profile,
      found: !!profile,
    });

  } catch (error: any) {
    console.error('Unexpected error fetching profile:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        profile: null
      },
      { status: 500 }
    );
  }
}

// PUT - Update profile
export async function PUT(request: NextRequest) {
  try {
    const body: UpdateProfileRequest = await request.json();
    const { user_id, full_name, age, job, avatar_url } = body;

    console.log('Updating profile for user:', user_id);

    // Validation
    if (!user_id) {
      return NextResponse.json(
        { 
          error: 'Missing required field',
          details: 'Please provide user_id'
        },
        { status: 400 }
      );
    }

    // Build update object (only include fields that are provided)
    const updateData: any = {};

    if (full_name !== undefined) {
      updateData.full_name = full_name;
    }
    if (age !== undefined) {
      updateData.age = age; // age là text
    }
    if (job !== undefined) {
      updateData.job = job;
    }
    if (avatar_url !== undefined) {
      updateData.avatar_url = avatar_url;
    }

    // Update the profile in the database
    const { data: updatedProfile, error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('user_id', user_id)
      .select()
      .single();

    if (error) {
      console.error('Error updating profile:', error);
      
      // Handle case where profile doesn't exist
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { 
            error: 'Profile not found',
            details: 'No profile exists for this user_id. Please create a profile first.'
          },
          { status: 404 }
        );
      }
      
      return NextResponse.json(
        { 
          error: 'Failed to update profile',
          details: error.message
        },
        { status: 500 }
      );
    }

    console.log('Profile updated successfully:', updatedProfile?.id);

    return NextResponse.json(
      {
        message: 'Profile updated successfully',
        profile: updatedProfile
      },
      { status: 200 }
    );

  } catch (error: any) {
    console.error('Unexpected error updating profile:', error);
    
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

// POST - Create or update profile (upsert)
export async function POST(request: NextRequest) {
  try {
    const body: UpdateProfileRequest = await request.json();
    const { user_id, full_name, age, job, avatar_url } = body;

    console.log('Creating/updating profile for user:', user_id);

    // Validation
    if (!user_id) {
      return NextResponse.json(
        { 
          error: 'Missing required field',
          details: 'Please provide user_id'
        },
        { status: 400 }
      );
    }

    // Build data object - chỉ include các field có trong schema
    const profileData: any = {
      user_id: user_id,
    };

    if (full_name !== undefined) {
      profileData.full_name = full_name;
    }
    if (age !== undefined) {
      profileData.age = age; // age là text
    }
    if (job !== undefined) {
      profileData.job = job;
    }
    if (avatar_url !== undefined) {
      profileData.avatar_url = avatar_url;
    }

    console.log('📊 Profile data to upsert:', profileData);

    // Upsert the profile (insert or update if exists)
    const { data: profile, error } = await supabase
      .from('profiles')
      .upsert(profileData, {
        onConflict: 'user_id', // user_id phải có UNIQUE constraint
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating/updating profile:', error);
      
      // Handle missing UNIQUE constraint
      if (error.code === '42P10') {
        return NextResponse.json(
          { 
            error: 'Database configuration error',
            details: 'The user_id column needs a UNIQUE constraint. Please run in SQL Editor: ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_unique UNIQUE (user_id);'
          },
          { status: 500 }
        );
      }

      // Handle missing column
      if (error.code === 'PGRST204') {
        return NextResponse.json(
          { 
            error: 'Database schema error',
            details: error.message
          },
          { status: 500 }
        );
      }

      // Handle schema cache issue
      if (error.code === 'PGRST205') {
        return NextResponse.json(
          { 
            error: 'Schema cache error',
            details: 'Please refresh schema cache in Supabase Dashboard: Settings → API → Reload schema'
          },
          { status: 500 }
        );
      }
      
      return NextResponse.json(
        { 
          error: 'Failed to create/update profile',
          details: error.message,
          code: error.code
        },
        { status: 500 }
      );
    }

    console.log('✅ Profile created/updated successfully:', profile?.id);

    return NextResponse.json(
      {
        message: 'Profile saved successfully',
        profile: profile
      },
      { status: 200 }
    );

  } catch (error: any) {
    console.error('Unexpected error creating/updating profile:', error);
    
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