import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { NotificationTime } from '@/lib/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// GET - Fetch notification times for a user
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

    // Get notification_times from profiles table
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('notification_times')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching notification times:', error);
      return NextResponse.json(
        { 
          error: 'Failed to fetch notification times',
          details: error.message,
          notification_times: []
        },
        { status: 500 }
      );
    }

    // Parse notification_times from JSONB, default to empty array
    let notificationTimes: NotificationTime[] = [];
    if (profile?.notification_times) {
      if (Array.isArray(profile.notification_times)) {
        notificationTimes = profile.notification_times;
      } else if (typeof profile.notification_times === 'string') {
        try {
          notificationTimes = JSON.parse(profile.notification_times);
        } catch (e) {
          console.error('Error parsing notification_times JSON:', e);
          notificationTimes = [];
        }
      } else {
        notificationTimes = [];
      }
    }

    // Sort by hour and minute
    notificationTimes.sort((a, b) => {
      if (a.hour !== b.hour) return a.hour - b.hour;
      return a.minute - b.minute;
    });

    return NextResponse.json({
      notification_times: notificationTimes || [],
    });

  } catch (error: any) {
    console.error('Unexpected error fetching notification times:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        notification_times: []
      },
      { status: 500 }
    );
  }
}

// POST - Create a new notification time
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, hour, minute, enabled = true } = body;

    if (!user_id || hour === undefined || minute === undefined) {
      return NextResponse.json(
        { 
          error: 'Missing required fields',
          details: 'Please provide user_id, hour, and minute'
        },
        { status: 400 }
      );
    }

    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      return NextResponse.json(
        { 
          error: 'Invalid time',
          details: 'Hour must be 0-23 and minute must be 0-59'
        },
        { status: 400 }
      );
    }

    // Get current notification_times from profile
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('notification_times')
      .eq('user_id', user_id)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching profile:', fetchError);
      return NextResponse.json(
        { 
          error: 'Failed to fetch profile',
          details: fetchError.message
        },
        { status: 500 }
      );
    }

    // Parse existing notification times
    const existingTimes: NotificationTime[] = profile?.notification_times 
      ? (Array.isArray(profile.notification_times) 
          ? profile.notification_times 
          : JSON.parse(profile.notification_times as any))
      : [];

    // Check for duplicate
    const duplicate = existingTimes.find(
      (nt: NotificationTime) => nt.hour === hour && nt.minute === minute
    );

    if (duplicate) {
      return NextResponse.json(
        { 
          error: 'Duplicate notification time',
          details: 'This time slot already exists for this user'
        },
        { status: 409 }
      );
    }

    // Create new notification time with unique ID
    const newNotificationTime: NotificationTime = {
      id: crypto.randomUUID(),
      user_id,
      hour,
      minute,
      enabled,
      created_at: new Date().toISOString(),
    };

    // Add to array
    const updatedTimes = [...existingTimes, newNotificationTime];

    // Update profile with new notification_times array
    const { data: updatedProfile, error: updateError } = await supabase
      .from('profiles')
      .update({ notification_times: updatedTimes })
      .eq('user_id', user_id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating notification times:', updateError);
      return NextResponse.json(
        { 
          error: 'Failed to create notification time',
          details: updateError.message
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message: 'Notification time created successfully',
        notification_time: newNotificationTime
      },
      { status: 201 }
    );

  } catch (error: any) {
    console.error('Unexpected error creating notification time:', error);
    
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

// PUT - Update a notification time
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, enabled, hour, minute, user_id } = body;

    if (!id || !user_id) {
      return NextResponse.json(
        { 
          error: 'Missing required fields',
          details: 'Please provide id and user_id'
        },
        { status: 400 }
      );
    }

    if (hour !== undefined && (hour < 0 || hour > 23)) {
      return NextResponse.json(
        { error: 'Invalid hour', details: 'Hour must be 0-23' },
        { status: 400 }
      );
    }
    if (minute !== undefined && (minute < 0 || minute > 59)) {
      return NextResponse.json(
        { error: 'Invalid minute', details: 'Minute must be 0-59' },
        { status: 400 }
      );
    }

    // Get current notification_times from profile
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('notification_times')
      .eq('user_id', user_id)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching profile:', fetchError);
      return NextResponse.json(
        { 
          error: 'Failed to fetch profile',
          details: fetchError.message
        },
        { status: 500 }
      );
    }

    // Parse existing notification times
    let existingTimes: NotificationTime[] = [];
    if (profile?.notification_times) {
      if (Array.isArray(profile.notification_times)) {
        existingTimes = profile.notification_times;
      } else if (typeof profile.notification_times === 'string') {
        try {
          existingTimes = JSON.parse(profile.notification_times);
        } catch (e) {
          console.error('Error parsing notification_times JSON:', e);
          existingTimes = [];
        }
      }
    }

    // Find and update the notification time
    const timeIndex = existingTimes.findIndex((nt: NotificationTime) => nt.id === id);
    if (timeIndex === -1) {
      return NextResponse.json(
        { 
          error: 'Notification time not found',
          details: 'The specified notification time does not exist'
        },
        { status: 404 }
      );
    }

    // Update the notification time
    if (enabled !== undefined) existingTimes[timeIndex].enabled = enabled;
    if (hour !== undefined) existingTimes[timeIndex].hour = hour;
    if (minute !== undefined) existingTimes[timeIndex].minute = minute;

    // Update profile with modified notification_times array
    const { data: updatedProfile, error: updateError } = await supabase
      .from('profiles')
      .update({ notification_times: existingTimes })
      .eq('user_id', user_id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating notification time:', updateError);
      return NextResponse.json(
        { 
          error: 'Failed to update notification time',
          details: updateError.message
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message: 'Notification time updated successfully',
        notification_time: existingTimes[timeIndex]
      },
      { status: 200 }
    );

  } catch (error: any) {
    console.error('Unexpected error updating notification time:', error);
    
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

// DELETE - Delete a notification time
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');
    const user_id = searchParams.get('user_id');

    if (!id || !user_id) {
      return NextResponse.json(
        { 
          error: 'Missing parameters',
          details: 'Please provide both id and user_id as query parameters'
        },
        { status: 400 }
      );
    }

    // Get current notification_times from profile
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('notification_times')
      .eq('user_id', user_id)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching profile:', fetchError);
      return NextResponse.json(
        { 
          error: 'Failed to fetch profile',
          details: fetchError.message
        },
        { status: 500 }
      );
    }

    // Parse existing notification times
    let existingTimes: NotificationTime[] = [];
    if (profile?.notification_times) {
      if (Array.isArray(profile.notification_times)) {
        existingTimes = profile.notification_times;
      } else if (typeof profile.notification_times === 'string') {
        try {
          existingTimes = JSON.parse(profile.notification_times);
        } catch (e) {
          console.error('Error parsing notification_times JSON:', e);
          existingTimes = [];
        }
      }
    }

    // Remove the notification time
    const filteredTimes = existingTimes.filter((nt: NotificationTime) => nt.id !== id);

    if (filteredTimes.length === existingTimes.length) {
      return NextResponse.json(
        { 
          error: 'Notification time not found',
          details: 'The specified notification time does not exist'
        },
        { status: 404 }
      );
    }

    // Update profile with filtered notification_times array
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ notification_times: filteredTimes })
      .eq('user_id', user_id);

    if (updateError) {
      console.error('Error deleting notification time:', updateError);
      return NextResponse.json(
        { 
          error: 'Failed to delete notification time',
          details: updateError.message
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message: 'Notification time deleted successfully'
      },
      { status: 200 }
    );

  } catch (error: any) {
    console.error('Unexpected error deleting notification time:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}
