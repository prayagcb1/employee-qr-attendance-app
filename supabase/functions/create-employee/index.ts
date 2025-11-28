import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface CreateEmployeeRequest {
  full_name: string;
  employee_code: string;
  username: string;
  email: string | null;
  phone: string | null;
  password: string;
  date_of_joining: string;
  role: 'field_worker' | 'supervisor' | 'admin' | 'intern' | 'office_employee';
}

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

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const employeeData: CreateEmployeeRequest = await req.json();

    const email = employeeData.email || `${employeeData.username}@temp.local`;

    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users.find(u => u.email === email);

    if (existingUser) {
      await supabaseAdmin.auth.admin.deleteUser(existingUser.id, true);
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: employeeData.password,
      email_confirm: true,
    });

    if (authError) {
      throw new Error(`Failed to create user: ${authError.message}`);
    }

    if (!authData.user) {
      throw new Error('Failed to create user account');
    }

    const { error: insertError } = await supabaseAdmin
      .from('employees')
      .insert({
        user_id: authData.user.id,
        full_name: employeeData.full_name,
        employee_code: employeeData.employee_code,
        username: employeeData.username,
        email: employeeData.email || null,
        phone: employeeData.phone,
        date_of_joining: employeeData.date_of_joining,
        role: employeeData.role,
        active: true,
      });

    if (insertError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id, true);
      throw new Error(`Failed to create employee record: ${insertError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Employee created successfully',
        password: employeeData.password,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});