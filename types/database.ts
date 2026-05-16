export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string
          email: string
          role: 'owner' | 'admin' | 'manager' | 'sales' | 'dispatcher' | 'crew' | 'viewer' | 'sales_manager' | 'senior_sales' | 'junior_sales' | 'accountant' | 'ops_manager'
          avatar_url: string | null
          is_active: boolean
          company_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }
      lead_sources: {
        Row: {
          id: string
          name: string
          category: 'paid' | 'organic' | 'referral' | 'repeat' | 'other' | null
          is_active: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['lead_sources']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['lead_sources']['Insert']>
      }
      customers: {
        Row: {
          id: string
          full_name: string
          email: string | null
          phone: string | null
          phone_type: string | null
          secondary_phone: string | null
          secondary_phone_type: string | null
          notes: string | null
          company_id: string | null
          created_at: string
          updated_at: string
          is_deleted: boolean
        }
        Insert: Omit<Database['public']['Tables']['customers']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['customers']['Insert']>
      }
      opportunities: {
        Row: {
          id: string
          opportunity_number: string
          customer_id: string
          sales_agent_id: string | null
          lead_source_id: string | null
          service_type: 'local' | 'long_distance' | 'commercial' | 'packing' | 'storage' | 'international'
          status: 'opportunity' | 'booked' | 'completed' | 'closed' | 'cancelled'
          move_size: string | null
          total_amount: number
          estimated_cost: number
          service_date: string | null
          pickup_city: string | null
          dropoff_city: string | null
          notes: string | null
          origin_address_line1: string | null
          origin_address_line2: string | null
          origin_city: string | null
          origin_province: string | null
          origin_postal_code: string | null
          origin_place_id: string | null
          origin_dwelling_type: string | null
          origin_floor: number | null
          origin_has_elevator: boolean | null
          origin_stairs_count: number | null
          origin_long_carry: boolean | null
          origin_parking_notes: string | null
          dest_address_line1: string | null
          dest_address_line2: string | null
          dest_city: string | null
          dest_province: string | null
          dest_postal_code: string | null
          dest_place_id: string | null
          dest_dwelling_type: string | null
          dest_floor: number | null
          dest_has_elevator: boolean | null
          dest_stairs_count: number | null
          dest_long_carry: boolean | null
          dest_parking_notes: string | null
          booked_at: string | null
          contacted_at: string | null
          quote_sent_at: string | null
          accepted_at: string | null
          completed_at: string | null
          closed_at: string | null
          cancelled_at: string | null
          lost_at: string | null
          company_id: string | null
          created_at: string
          updated_at: string
          is_deleted: boolean
        }
        Insert: Omit<Database['public']['Tables']['opportunities']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['opportunities']['Insert']>
      }
      audit_log: {
        Row: {
          id: string
          user_id: string | null
          entity_type: string
          entity_id: string
          action: 'create' | 'update' | 'delete' | 'status_change'
          diff: Json | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['audit_log']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['audit_log']['Insert']>
      }
      audit_logs: {
        Row: {
          id: string
          actor_user_id: string | null
          action: string
          entity_type: string
          entity_id: string | null
          old_data: Json | null
          new_data: Json | null
          ip_address: string | null
          user_agent: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['audit_logs']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['audit_logs']['Insert']>
      }
      tasks: {
        Row: {
          id: string
          title: string
          description: string | null
          due_date: string | null
          due_time: string | null
          priority: 'low' | 'normal' | 'high' | 'urgent'
          assigned_to_id: string | null
          created_by_id: string | null
          opportunity_id: string | null
          status: 'pending' | 'completed' | 'cancelled'
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['tasks']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['tasks']['Insert']>
      }
      follow_ups: {
        Row: {
          id: string
          follow_up_date: string
          follow_up_time: string | null
          type: 'call' | 'email' | 'sms' | 'in_person' | 'other'
          notes: string | null
          assigned_to_id: string | null
          created_by_id: string | null
          opportunity_id: string | null
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['follow_ups']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['follow_ups']['Insert']>
      }
      communications: {
        Row: {
          id: string
          opportunity_id: string | null
          customer_id: string | null
          type: 'note' | 'email' | 'call' | 'sms'
          direction: 'inbound' | 'outbound' | 'internal' | null
          subject: string | null
          body: string
          call_outcome: 'connected' | 'voicemail' | 'no_answer' | 'wrong_number' | 'busy' | 'pending' | null
          call_duration_seconds: number | null
          phone_number: string | null
          status: string | null
          provider: string | null
          provider_message_id: string | null
          error_message: string | null
          email_to: string | null
          email_cc: string | null
          created_by: string | null
          company_id: string | null
          created_at: string
          is_deleted: boolean
        }
        Insert: Omit<Database['public']['Tables']['communications']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['communications']['Insert']>
      }
      communication_templates: {
        Row: {
          id: string
          name: string
          channel: 'sms' | 'email' | 'call'
          trigger: string
          subject: string | null
          body: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['communication_templates']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['communication_templates']['Insert']>
      }
    }
  }
}
