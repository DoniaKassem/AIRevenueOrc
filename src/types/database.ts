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
          email: string
          full_name: string | null
          role: 'rep' | 'manager' | 'admin'
          team_id: string | null
          settings: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          role?: 'rep' | 'manager' | 'admin'
          team_id?: string | null
          settings?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          role?: 'rep' | 'manager' | 'admin'
          team_id?: string | null
          settings?: Json
          created_at?: string
          updated_at?: string
        }
      }
      teams: {
        Row: {
          id: string
          name: string
          organization_id: string
          settings: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          organization_id: string
          settings?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          organization_id?: string
          settings?: Json
          created_at?: string
          updated_at?: string
        }
      }
      prospects: {
        Row: {
          id: string
          email: string | null
          phone: string | null
          linkedin_url: string | null
          first_name: string | null
          last_name: string | null
          title: string | null
          company: string | null
          account_id: string | null
          priority_score: number
          enrichment_data: Json
          owner_id: string | null
          team_id: string | null
          status: 'new' | 'contacted' | 'qualified' | 'nurturing' | 'unqualified' | 'converted'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email?: string | null
          phone?: string | null
          linkedin_url?: string | null
          first_name?: string | null
          last_name?: string | null
          title?: string | null
          company?: string | null
          account_id?: string | null
          priority_score?: number
          enrichment_data?: Json
          owner_id?: string | null
          team_id?: string | null
          status?: 'new' | 'contacted' | 'qualified' | 'nurturing' | 'unqualified' | 'converted'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string | null
          phone?: string | null
          linkedin_url?: string | null
          first_name?: string | null
          last_name?: string | null
          title?: string | null
          company?: string | null
          account_id?: string | null
          priority_score?: number
          enrichment_data?: Json
          owner_id?: string | null
          team_id?: string | null
          status?: 'new' | 'contacted' | 'qualified' | 'nurturing' | 'unqualified' | 'converted'
          created_at?: string
          updated_at?: string
        }
      }
      cadences: {
        Row: {
          id: string
          name: string
          description: string | null
          is_active: boolean
          created_by: string | null
          team_id: string | null
          settings: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          is_active?: boolean
          created_by?: string | null
          team_id?: string | null
          settings?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          is_active?: boolean
          created_by?: string | null
          team_id?: string | null
          settings?: Json
          created_at?: string
          updated_at?: string
        }
      }
      cadence_steps: {
        Row: {
          id: string
          cadence_id: string
          step_number: number
          type: 'email' | 'call' | 'linkedin' | 'sms' | 'task'
          delay_days: number
          delay_hours: number
          template_id: string | null
          content: string | null
          conditions: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          cadence_id: string
          step_number: number
          type: 'email' | 'call' | 'linkedin' | 'sms' | 'task'
          delay_days?: number
          delay_hours?: number
          template_id?: string | null
          content?: string | null
          conditions?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          cadence_id?: string
          step_number?: number
          type?: 'email' | 'call' | 'linkedin' | 'sms' | 'task'
          delay_days?: number
          delay_hours?: number
          template_id?: string | null
          content?: string | null
          conditions?: Json
          created_at?: string
          updated_at?: string
        }
      }
      deals: {
        Row: {
          id: string
          name: string
          account_id: string | null
          owner_id: string | null
          team_id: string | null
          stage: 'discovery' | 'qualification' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost'
          amount: number
          probability: number
          close_date: string | null
          risk_score: number
          forecast_category: 'pipeline' | 'best_case' | 'commit' | 'closed'
          metadata: Json
          created_at: string
          updated_at: string
          closed_at: string | null
        }
        Insert: {
          id?: string
          name: string
          account_id?: string | null
          owner_id?: string | null
          team_id?: string | null
          stage?: 'discovery' | 'qualification' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost'
          amount?: number
          probability?: number
          close_date?: string | null
          risk_score?: number
          forecast_category?: 'pipeline' | 'best_case' | 'commit' | 'closed'
          metadata?: Json
          created_at?: string
          updated_at?: string
          closed_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          account_id?: string | null
          owner_id?: string | null
          team_id?: string | null
          stage?: 'discovery' | 'qualification' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost'
          amount?: number
          probability?: number
          close_date?: string | null
          risk_score?: number
          forecast_category?: 'pipeline' | 'best_case' | 'commit' | 'closed'
          metadata?: Json
          created_at?: string
          updated_at?: string
          closed_at?: string | null
        }
      }
    }
  }
}
