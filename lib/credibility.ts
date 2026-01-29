import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface Report {
  id: string;
  user_id: string;
  problem: string;
  type?: string;
  lat?: number;
  lng?: number;
  created_at: string;
}

/**
 * Calculate the distance between two coordinates using Haversine formula
 * Returns distance in kilometers
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Check if two reports are adjacent (within 100 meters)
 */
function areAdjacent(report1: Report, report2: Report): boolean {
  // If either report doesn't have coordinates, we can't determine adjacency
  if (!report1.lat || !report1.lng || !report2.lat || !report2.lng) {
    return false;
  }

  const distanceInKm = calculateDistance(
    report1.lat,
    report1.lng,
    report2.lat,
    report2.lng
  );

  // 100 meters = 0.1 km
  const ADJACENT_THRESHOLD_KM = 0.1;
  return distanceInKm <= ADJACENT_THRESHOLD_KM;
}

/**
 * Check if two reports have the same issue
 * They are considered the same if they have the same problem type
 */
function hasSameIssue(report1: Report, report2: Report): boolean {
  // Compare problem type if available, otherwise compare problem text
  if (report1.type && report2.type) {
    return report1.type === report2.type;
  }
  // Fallback: compare problem text (case-insensitive, trimmed)
  return report1.problem.trim().toLowerCase() === report2.problem.trim().toLowerCase();
}

/**
 * Find all reports that are adjacent and have the same issue as the given report
 */
export async function findAdjacentReportsWithSameIssue(
  currentReport: Report
): Promise<Report[]> {
  try {
    // Fetch all reports except the current one
    const { data: allReports, error } = await supabase
      .from('report')
      .select('*')
      .neq('id', currentReport.id);

    if (error) {
      console.error('Error fetching reports for credibility check:', error);
      return [];
    }

    if (!allReports || allReports.length === 0) {
      return [];
    }

    // Filter reports that are adjacent and have the same issue
    const matchingReports = allReports.filter((report: Report) => {
      return areAdjacent(currentReport, report) && hasSameIssue(currentReport, report);
    });

    return matchingReports;
  } catch (error) {
    console.error('Error in findAdjacentReportsWithSameIssue:', error);
    return [];
  }
}

/**
 * Award credibility points to a user
 * Increments their credibility by 1 point
 */
export async function awardCredibilityPoint(userId: string): Promise<boolean> {
  try {
    // First, get the current profile to check if it exists
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('credibility, user_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching profile for credibility update:', fetchError);
      return false;
    }

    const currentCredibility = profile?.credibility ?? 0;
    const newCredibility = currentCredibility + 1;

    // Update or insert the profile with new credibility
    const { error: updateError } = await supabase
      .from('profiles')
      .upsert(
        {
          user_id: userId,
          credibility: newCredibility,
        },
        {
          onConflict: 'user_id',
        }
      );

    if (updateError) {
      console.error('Error updating credibility:', updateError);
      return false;
    }

    console.log(`✅ Awarded credibility point to user ${userId}. New total: ${newCredibility}`);
    return true;
  } catch (error) {
    console.error('Error in awardCredibilityPoint:', error);
    return false;
  }
}

/**
 * Check if a report qualifies for credibility points and award them
 * Returns the number of users who received credibility points
 */
export async function checkAndAwardCredibility(newReport: Report): Promise<number> {
  try {
    // Find adjacent reports with the same issue
    const adjacentReports = await findAdjacentReportsWithSameIssue(newReport);

    // If there's at least 1 other report (making it 2+ total), award credibility
    if (adjacentReports.length >= 1) {
      const allUsersToAward = new Set<string>();
      
      // Add the new report's user
      allUsersToAward.add(newReport.user_id);
      
      // Add all users from adjacent reports
      adjacentReports.forEach((report) => {
        allUsersToAward.add(report.user_id);
      });

      // Award credibility to all users
      const awardPromises = Array.from(allUsersToAward).map((userId) =>
        awardCredibilityPoint(userId)
      );

      const results = await Promise.all(awardPromises);
      const successCount = results.filter((success) => success).length;

      console.log(
        `🎯 Credibility check: Found ${adjacentReports.length} adjacent reports with same issue. ` +
        `Awarded credibility to ${successCount} out of ${allUsersToAward.size} users.`
      );

      return successCount;
    }

    return 0;
  } catch (error) {
    console.error('Error in checkAndAwardCredibility:', error);
    return 0;
  }
}
