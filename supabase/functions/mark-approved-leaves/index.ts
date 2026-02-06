import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date().toISOString().split('T')[0];

    const { data: allApprovedLeaves, error: fetchError } = await supabase
      .from('leave_requests')
      .select('id, employee_id, start_date, end_date')
      .eq('request_type', 'leave')
      .eq('status', 'approved')
      .lte('start_date', today);

    if (fetchError) {
      throw fetchError;
    }

    const approvedLeaves = (allApprovedLeaves || []).filter(leave =>
      leave.end_date ? leave.end_date >= today : leave.start_date === today
    );

    if (approvedLeaves.length === 0) {
      return new Response(
        JSON.stringify({
          message: 'No leaves to mark for today',
          date: today
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const leaveAttendanceRecords = approvedLeaves.map(leave => ({
      employee_id: leave.employee_id,
      date: today,
      leave_request_id: leave.id
    }));

    const { data: insertedRecords, error: insertError } = await supabase
      .from('leave_attendance')
      .upsert(leaveAttendanceRecords, {
        onConflict: 'employee_id,date',
        ignoreDuplicates: true
      })
      .select();

    if (insertError) {
      throw insertError;
    }

    const { error: incompleteWFHError } = await supabase
      .from('wfh_attendance')
      .update({ status: 'incomplete' })
      .eq('status', 'active')
      .lt('clock_in_time', new Date(new Date().setHours(0, 0, 0, 0)).toISOString());

    if (incompleteWFHError) {
      console.error('Error marking incomplete WFH:', incompleteWFHError);
    }

    return new Response(
      JSON.stringify({
        message: 'Successfully marked leaves for today',
        date: today,
        count: insertedRecords?.length || 0,
        marked: insertedRecords
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
