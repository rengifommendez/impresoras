import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface UpdateAdminRequest {
  userId: string;
  email?: string;
  full_name?: string;
  office?: string;
  department?: string;
  newPassword?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Initialize regular client to verify the requesting user is an admin
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, message: 'No authorization header' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Verify the user is authenticated and is an admin
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid authentication' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Check if user is admin
    const isAdmin = user.user_metadata?.role === 'admin'
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ success: false, message: 'Admin access required' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Parse request body
    const updateData: UpdateAdminRequest = await req.json()

    // Validate required fields
    if (!updateData.userId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'User ID is required' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Validate password if provided
    if (updateData.newPassword && updateData.newPassword.length < 6) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Password must be at least 6 characters long' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get current user data
    const { data: currentUser, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(updateData.userId)
    
    if (getUserError || !currentUser.user) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: `User not found: ${getUserError?.message || 'Unknown error'}` 
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Prepare update data
    const updatePayload: any = {}

    // Update email if provided and different
    if (updateData.email && updateData.email !== currentUser.user.email) {
      updatePayload.email = updateData.email
    }

    // Update password if provided
    if (updateData.newPassword) {
      updatePayload.password = updateData.newPassword
    }

    // Update user metadata
    const currentMetadata = currentUser.user.user_metadata || {}
    const newMetadata = {
      ...currentMetadata,
      role: 'admin', // Ensure role remains admin
      full_name: updateData.full_name || currentMetadata.full_name || '',
      office: updateData.office || currentMetadata.office || '',
      department: updateData.department || currentMetadata.department || ''
    }

    updatePayload.user_metadata = newMetadata

    // Update user in auth
    const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      updateData.userId,
      updatePayload
    )

    if (updateError) {
      console.error('Error updating user:', updateError)
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: `Error updating user: ${updateError.message}` 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Try to update users table if exists (non-critical)
    try {
      // Find user in users table by email or create mapping
      const { data: localUsers, error: localError } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', updateData.email || currentUser.user.email)
        .limit(1)

      if (!localError && localUsers && localUsers.length > 0) {
        // Update local users table
        await supabaseAdmin
          .from('users')
          .update({
            email: updateData.email || currentUser.user.email,
            full_name: updateData.full_name,
            office: updateData.office,
            department: updateData.department,
            updated_at: new Date().toISOString()
          })
          .eq('id', localUsers[0].id)
      }
    } catch (localUpdateError) {
      console.warn('Could not update local users table:', localUpdateError)
      // Non-critical error, continue
    }

    // Success response
    let successMessage = '✅ Usuario administrador actualizado exitosamente'
    
    if (updateData.newPassword) {
      successMessage += ' (incluyendo contraseña)'
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: successMessage,
        user: {
          id: updatedUser.user.id,
          email: updatedUser.user.email,
          full_name: newMetadata.full_name,
          office: newMetadata.office,
          department: newMetadata.department
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}` 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})