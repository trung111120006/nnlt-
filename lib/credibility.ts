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
 * Check if two reports are adjacent (within 500 meters)
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

  // 500 meters = 0.5 km
  const ADJACENT_THRESHOLD_KM = 0.5;
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
    console.log(`🔍 Fetching all reports to check for matches with report ${currentReport.id}`);
    
    // Fetch all reports except the current one
    const { data: allReports, error } = await supabase
      .from('report')
      .select('*')
      .neq('id', currentReport.id);

    if (error) {
      console.error('❌ Error fetching reports for credibility check:', error);
      return [];
    }

    if (!allReports || allReports.length === 0) {
      console.log('ℹ️ No other reports found in database');
      return [];
    }

    console.log(`📊 Found ${allReports.length} other reports to check`);

    // Filter reports that are adjacent and have the same issue
    const matchingReports = allReports.filter((report: Report) => {
      const isAdjacent = areAdjacent(currentReport, report);
      const hasSameIssue = hasSameIssue(currentReport, report);
      
      if (isAdjacent && hasSameIssue) {
        const distance = calculateDistance(
          currentReport.lat!,
          currentReport.lng!,
          report.lat!,
          report.lng!
        );
        console.log(`✅ Match found! Report ${report.id} is ${(distance * 1000).toFixed(0)}m away with same issue type: ${report.type}`);
      }
      
      return isAdjacent && hasSameIssue;
    });

    console.log(`🎯 Found ${matchingReports.length} matching reports (adjacent + same issue)`);
    return matchingReports;
  } catch (error) {
    console.error('❌ Error in findAdjacentReportsWithSameIssue:', error);
    return [];
  }
}

/**
 * Award credibility points to a user
 * Increments their credibility by 1 point
 */
export async function awardCredibilityPoint(userId: string): Promise<boolean> {
  try {
    console.log(`🔍 Attempting to award credibility to user: ${userId}`);
    
    // First, get the current profile to check if it exists
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('credibility, user_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('❌ Error fetching profile for credibility update:', fetchError);
      return false;
    }

    const currentCredibility = profile?.credibility ?? 0;
    const newCredibility = currentCredibility + 1;

    console.log(`📊 User ${userId}: Current credibility = ${currentCredibility}, New credibility = ${newCredibility}`);

    // Use RPC or direct update - try update first, then insert if needed
    let updateError;
    
    if (profile) {
      // Profile exists, update it
      const { error } = await supabase
        .from('profiles')
        .update({ credibility: newCredibility })
        .eq('user_id', userId);
      
      updateError = error;
    } else {
      // Profile doesn't exist, insert it
      const { error } = await supabase
        .from('profiles')
        .insert({
          user_id: userId,
          credibility: newCredibility,
        });
      
      updateError = error;
    }

    if (updateError) {
      console.error('❌ Error updating credibility:', updateError);
      // Try upsert as fallback
      const { error: upsertError } = await supabase
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
      
      if (upsertError) {
        console.error('❌ Error with upsert fallback:', upsertError);
        return false;
      }
    }

    console.log(`✅ Successfully awarded credibility point to user ${userId}. New total: ${newCredibility}`);
    return true;
  } catch (error) {
    console.error('❌ Exception in awardCredibilityPoint:', error);
    return false;
  }
}

/**
 * Check if a report qualifies for credibility points and award them
 * Returns the number of users who received credibility points
 */
export async function checkAndAwardCredibility(newReport: Report): Promise<number> {
  try {
    console.log(`🔍 Checking credibility for report ${newReport.id} by user ${newReport.user_id}`);
    console.log(`📍 Report location: lat=${newReport.lat}, lng=${newReport.lng}, type=${newReport.type}, problem=${newReport.problem}`);
    
    // If report doesn't have coordinates, skip credibility check
    if (!newReport.lat || !newReport.lng) {
      console.log('⚠️ Report missing coordinates, skipping credibility check');
      return 0;
    }

    // Find adjacent reports with the same issue
    const adjacentReports = await findAdjacentReportsWithSameIssue(newReport);

    console.log(`📊 Found ${adjacentReports.length} adjacent reports with same issue`);

    // If there's at least 1 other report (making it 2+ total), award credibility
    if (adjacentReports.length >= 1) {
      const allUsersToAward = new Set<string>();
      
      // Add the new report's user
      allUsersToAward.add(newReport.user_id);
      
      // Add all users from adjacent reports
      adjacentReports.forEach((report) => {
        allUsersToAward.add(report.user_id);
        console.log(`  - Adjacent report ${report.id} by user ${report.user_id} at (${report.lat}, ${report.lng})`);
      });

      // Only award credibility if there are 2+ DIFFERENT users
      if (allUsersToAward.size >= 2) {
        console.log(`🎯 Awarding credibility to ${allUsersToAward.size} different users:`, Array.from(allUsersToAward));

        // Award credibility to all users
        const awardPromises = Array.from(allUsersToAward).map((userId) =>
          awardCredibilityPoint(userId)
        );

        const results = await Promise.all(awardPromises);
        const successCount = results.filter((success) => success).length;

        console.log(
          `✅ Credibility check complete: Found ${adjacentReports.length} adjacent reports with same issue from ${allUsersToAward.size} different users. ` +
          `Awarded credibility to ${successCount} out of ${allUsersToAward.size} users.`
        );

        return successCount;
      } else {
        console.log(`⚠️ Found ${adjacentReports.length} adjacent reports, but only ${allUsersToAward.size} unique user(s). Need 2+ different users. Credibility not awarded.`);
      }
    } else {
      console.log('ℹ️ No adjacent reports found with same issue. Credibility not awarded.');
    }

    return 0;
  } catch (error) {
    console.error('❌ Error in checkAndAwardCredibility:', error);
    return 0;
  }
}
