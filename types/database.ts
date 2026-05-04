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
          role: 'admin' | 'sales_manager' | 'senior_sales' | 'junior_sales' | 'dispatcher' | 'accountant' | 'ops_manager'
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
          status: 'new_lead' | 'contacted' | 'quote_sent' | 'accepted' | 'booked' | 'completed' | 'cancelled' | 'lost'
          total_amount: number
          estimated_cost: number
          service_date: string | null
          pickup_city: string | null
          dropoff_city: string | null
          notes: string | null
          contacted_at: string | null
          quote_sent_at: string | null
          accepted_at: string | null
          booked_at: string | null
          completed_at: string | null
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
    }
  }
}
