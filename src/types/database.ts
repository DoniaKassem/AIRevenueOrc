export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// =============================================
// AUTH TYPES
// =============================================

export interface AuthUser {
  id: string
  email: string
  organizationId: string
  role: 'admin' | 'user' | 'viewer'
  permissions: string[]
  isAdmin: boolean
}

export type Database = {
  public: {
    Tables: {
      // ============================================
      // CORE TABLES
      // ============================================
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
      organizations: {
        Row: {
          id: string
          name: string
          slug: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      users: {
        Row: {
          id: string
          email: string
          name: string | null
          organization_id: string
          role: string
          status: 'active' | 'invited' | 'suspended'
          password_hash: string | null
          two_factor_enabled: boolean
          two_factor_secret: string | null
          last_active_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          name?: string | null
          organization_id: string
          role?: string
          status?: 'active' | 'invited' | 'suspended'
          password_hash?: string | null
          two_factor_enabled?: boolean
          two_factor_secret?: string | null
          last_active_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string | null
          organization_id?: string
          role?: string
          status?: 'active' | 'invited' | 'suspended'
          password_hash?: string | null
          two_factor_enabled?: boolean
          two_factor_secret?: string | null
          last_active_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      // ============================================
      // CRM TABLES
      // ============================================
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
          company_profile_id: string | null
          priority_score: number
          enrichment_data: Json
          owner_id: string | null
          team_id: string | null
          status: 'new' | 'contacted' | 'qualified' | 'nurturing' | 'unqualified' | 'converted'
          stage: string | null
          qualification_score: number | null
          bant_data: Json
          last_contacted_at: string | null
          last_responded_at: string | null
          contact_count: number
          response_count: number
          bdr_assigned: boolean
          bdr_workflow_id: string | null
          relationship_stage: 'new' | 'contacted' | 'engaged' | 'qualified' | 'opportunity' | 'customer' | 'unresponsive' | 'disqualified'
          ai_insights: Json
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
          company_profile_id?: string | null
          priority_score?: number
          enrichment_data?: Json
          owner_id?: string | null
          team_id?: string | null
          status?: 'new' | 'contacted' | 'qualified' | 'nurturing' | 'unqualified' | 'converted'
          stage?: string | null
          qualification_score?: number | null
          bant_data?: Json
          last_contacted_at?: string | null
          last_responded_at?: string | null
          contact_count?: number
          response_count?: number
          bdr_assigned?: boolean
          bdr_workflow_id?: string | null
          relationship_stage?: 'new' | 'contacted' | 'engaged' | 'qualified' | 'opportunity' | 'customer' | 'unresponsive' | 'disqualified'
          ai_insights?: Json
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
          company_profile_id?: string | null
          priority_score?: number
          enrichment_data?: Json
          owner_id?: string | null
          team_id?: string | null
          status?: 'new' | 'contacted' | 'qualified' | 'nurturing' | 'unqualified' | 'converted'
          stage?: string | null
          qualification_score?: number | null
          bant_data?: Json
          last_contacted_at?: string | null
          last_responded_at?: string | null
          contact_count?: number
          response_count?: number
          bdr_assigned?: boolean
          bdr_workflow_id?: string | null
          relationship_stage?: 'new' | 'contacted' | 'engaged' | 'qualified' | 'opportunity' | 'customer' | 'unresponsive' | 'disqualified'
          ai_insights?: Json
          created_at?: string
          updated_at?: string
        }
      }
      accounts: {
        Row: {
          id: string
          name: string
          domain: string | null
          industry: string | null
          employee_count: number | null
          annual_revenue: number | null
          enrichment_data: Json
          owner_id: string | null
          team_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          domain?: string | null
          industry?: string | null
          employee_count?: number | null
          annual_revenue?: number | null
          enrichment_data?: Json
          owner_id?: string | null
          team_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          domain?: string | null
          industry?: string | null
          employee_count?: number | null
          annual_revenue?: number | null
          enrichment_data?: Json
          owner_id?: string | null
          team_id?: string | null
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
          ai_analysis: Json
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
          ai_analysis?: Json
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
          ai_analysis?: Json
          created_at?: string
          updated_at?: string
          closed_at?: string | null
        }
      }
      deal_contacts: {
        Row: {
          deal_id: string
          prospect_id: string
          role: string | null
          created_at: string
        }
        Insert: {
          deal_id: string
          prospect_id: string
          role?: string | null
          created_at?: string
        }
        Update: {
          deal_id?: string
          prospect_id?: string
          role?: string | null
          created_at?: string
        }
      }
      company_profiles: {
        Row: {
          id: string
          team_id: string | null
          company_name: string
          name: string | null
          industry: string | null
          website_url: string | null
          company_description: string | null
          mission_statement: string | null
          value_propositions: Json
          products_services: Json
          target_customers: string | null
          ideal_customer_profile: Json
          brand_voice: Json
          messaging_guidelines: string | null
          communication_dos: Json
          communication_donts: Json
          spokesperson_enabled: boolean
          knowledge_completeness_score: number
          research_data: Json
          ai_analysis: Json
          research_quality_score: number | null
          research_completeness: number | null
          research_freshness: number | null
          intent_score: number | null
          last_researched_at: string | null
          last_trained_at: string | null
          buying_signals: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          team_id?: string | null
          company_name: string
          name?: string | null
          industry?: string | null
          website_url?: string | null
          company_description?: string | null
          mission_statement?: string | null
          value_propositions?: Json
          products_services?: Json
          target_customers?: string | null
          ideal_customer_profile?: Json
          brand_voice?: Json
          messaging_guidelines?: string | null
          communication_dos?: Json
          communication_donts?: Json
          spokesperson_enabled?: boolean
          knowledge_completeness_score?: number
          research_data?: Json
          ai_analysis?: Json
          research_quality_score?: number | null
          research_completeness?: number | null
          research_freshness?: number | null
          intent_score?: number | null
          last_researched_at?: string | null
          last_trained_at?: string | null
          buying_signals?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          team_id?: string | null
          company_name?: string
          name?: string | null
          industry?: string | null
          website_url?: string | null
          company_description?: string | null
          mission_statement?: string | null
          value_propositions?: Json
          products_services?: Json
          target_customers?: string | null
          ideal_customer_profile?: Json
          brand_voice?: Json
          messaging_guidelines?: string | null
          communication_dos?: Json
          communication_donts?: Json
          spokesperson_enabled?: boolean
          knowledge_completeness_score?: number
          research_data?: Json
          ai_analysis?: Json
          research_quality_score?: number | null
          research_completeness?: number | null
          research_freshness?: number | null
          intent_score?: number | null
          last_researched_at?: string | null
          last_trained_at?: string | null
          buying_signals?: Json
          created_at?: string
          updated_at?: string
        }
      }
      // ============================================
      // CADENCES & OUTREACH TABLES
      // ============================================
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
      cadence_enrollments: {
        Row: {
          id: string
          cadence_id: string
          prospect_id: string
          current_step: number
          status: 'active' | 'paused' | 'completed' | 'bounced' | 'opted_out'
          enrolled_by: string | null
          enrolled_at: string
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          cadence_id: string
          prospect_id: string
          current_step?: number
          status?: 'active' | 'paused' | 'completed' | 'bounced' | 'opted_out'
          enrolled_by?: string | null
          enrolled_at?: string
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          cadence_id?: string
          prospect_id?: string
          current_step?: number
          status?: 'active' | 'paused' | 'completed' | 'bounced' | 'opted_out'
          enrolled_by?: string | null
          enrolled_at?: string
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      email_templates: {
        Row: {
          id: string
          name: string
          subject: string
          body: string
          variables: Json
          created_by: string | null
          team_id: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          subject: string
          body: string
          variables?: Json
          created_by?: string | null
          team_id?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          subject?: string
          body?: string
          variables?: Json
          created_by?: string | null
          team_id?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      email_logs: {
        Row: {
          id: string
          template_id: string | null
          prospect_id: string
          cadence_enrollment_id: string | null
          subject: string
          body: string
          sent_by: string | null
          status: 'queued' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'failed'
          provider_message_id: string | null
          sent_at: string | null
          delivered_at: string | null
          opened_at: string | null
          clicked_at: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          template_id?: string | null
          prospect_id: string
          cadence_enrollment_id?: string | null
          subject: string
          body: string
          sent_by?: string | null
          status?: 'queued' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'failed'
          provider_message_id?: string | null
          sent_at?: string | null
          delivered_at?: string | null
          opened_at?: string | null
          clicked_at?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          template_id?: string | null
          prospect_id?: string
          cadence_enrollment_id?: string | null
          subject?: string
          body?: string
          sent_by?: string | null
          status?: 'queued' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'failed'
          provider_message_id?: string | null
          sent_at?: string | null
          delivered_at?: string | null
          opened_at?: string | null
          clicked_at?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      call_logs: {
        Row: {
          id: string
          prospect_id: string
          cadence_enrollment_id: string | null
          made_by: string | null
          duration_seconds: number
          recording_url: string | null
          transcript: string | null
          disposition: 'connected' | 'voicemail' | 'no_answer' | 'busy' | 'failed'
          notes: string | null
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          prospect_id: string
          cadence_enrollment_id?: string | null
          made_by?: string | null
          duration_seconds?: number
          recording_url?: string | null
          transcript?: string | null
          disposition?: 'connected' | 'voicemail' | 'no_answer' | 'busy' | 'failed'
          notes?: string | null
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          prospect_id?: string
          cadence_enrollment_id?: string | null
          made_by?: string | null
          duration_seconds?: number
          recording_url?: string | null
          transcript?: string | null
          disposition?: 'connected' | 'voicemail' | 'no_answer' | 'busy' | 'failed'
          notes?: string | null
          metadata?: Json
          created_at?: string
        }
      }
      // ============================================
      // AI TABLES
      // ============================================
      ai_agent_sessions: {
        Row: {
          id: string
          team_id: string
          agent_type: string
          conversation_history: Json
          actions_taken: Json
          outcome: string | null
          confidence_score: number | null
          execution_time_ms: number | null
          cost_usd: number
          user_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          team_id: string
          agent_type: string
          conversation_history?: Json
          actions_taken?: Json
          outcome?: string | null
          confidence_score?: number | null
          execution_time_ms?: number | null
          cost_usd?: number
          user_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          team_id?: string
          agent_type?: string
          conversation_history?: Json
          actions_taken?: Json
          outcome?: string | null
          confidence_score?: number | null
          execution_time_ms?: number | null
          cost_usd?: number
          user_id?: string | null
          created_at?: string
        }
      }
      ai_playground_experiments: {
        Row: {
          id: string
          team_id: string
          user_id: string | null
          experiment_name: string | null
          prompt: string
          system_prompt: string | null
          models_tested: Json
          winner_model: string | null
          winner_reasoning: string | null
          user_notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          team_id: string
          user_id?: string | null
          experiment_name?: string | null
          prompt: string
          system_prompt?: string | null
          models_tested: Json
          winner_model?: string | null
          winner_reasoning?: string | null
          user_notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          team_id?: string
          user_id?: string | null
          experiment_name?: string | null
          prompt?: string
          system_prompt?: string | null
          models_tested?: Json
          winner_model?: string | null
          winner_reasoning?: string | null
          user_notes?: string | null
          created_at?: string
        }
      }
      agent_executions: {
        Row: {
          id: string
          team_id: string
          agent_type: string
          conversation_history: Json
          actions_taken: Json
          outcome: string | null
          confidence_score: number | null
          execution_time_ms: number | null
          cost_usd: number
          user_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          team_id: string
          agent_type: string
          conversation_history?: Json
          actions_taken?: Json
          outcome?: string | null
          confidence_score?: number | null
          execution_time_ms?: number | null
          cost_usd?: number
          user_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          team_id?: string
          agent_type?: string
          conversation_history?: Json
          actions_taken?: Json
          outcome?: string | null
          confidence_score?: number | null
          execution_time_ms?: number | null
          cost_usd?: number
          user_id?: string | null
          created_at?: string
        }
      }
      conversations: {
        Row: {
          id: string
          title: string
          type: 'call' | 'meeting' | 'demo' | 'discovery' | 'negotiation' | 'followup'
          prospect_id: string | null
          deal_id: string | null
          conducted_by: string | null
          duration_seconds: number
          recording_url: string | null
          video_url: string | null
          scheduled_at: string | null
          started_at: string | null
          ended_at: string | null
          analysis_status: 'pending' | 'processing' | 'completed' | 'failed'
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          type?: 'call' | 'meeting' | 'demo' | 'discovery' | 'negotiation' | 'followup'
          prospect_id?: string | null
          deal_id?: string | null
          conducted_by?: string | null
          duration_seconds?: number
          recording_url?: string | null
          video_url?: string | null
          scheduled_at?: string | null
          started_at?: string | null
          ended_at?: string | null
          analysis_status?: 'pending' | 'processing' | 'completed' | 'failed'
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          type?: 'call' | 'meeting' | 'demo' | 'discovery' | 'negotiation' | 'followup'
          prospect_id?: string | null
          deal_id?: string | null
          conducted_by?: string | null
          duration_seconds?: number
          recording_url?: string | null
          video_url?: string | null
          scheduled_at?: string | null
          started_at?: string | null
          ended_at?: string | null
          analysis_status?: 'pending' | 'processing' | 'completed' | 'failed'
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      // ============================================
      // KNOWLEDGE BASE TABLES
      // ============================================
      knowledge_documents: {
        Row: {
          id: string
          company_profile_id: string
          file_name: string
          file_size: number | null
          file_type: string | null
          storage_path: string
          document_type: 'pdf' | 'website' | 'manual' | 'other' | null
          extracted_text: string | null
          content_chunks: Json
          processing_status: 'pending' | 'processing' | 'completed' | 'failed'
          processing_error: string | null
          metadata: Json
          uploaded_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_profile_id: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          storage_path: string
          document_type?: 'pdf' | 'website' | 'manual' | 'other' | null
          extracted_text?: string | null
          content_chunks?: Json
          processing_status?: 'pending' | 'processing' | 'completed' | 'failed'
          processing_error?: string | null
          metadata?: Json
          uploaded_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_profile_id?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          storage_path?: string
          document_type?: 'pdf' | 'website' | 'manual' | 'other' | null
          extracted_text?: string | null
          content_chunks?: Json
          processing_status?: 'pending' | 'processing' | 'completed' | 'failed'
          processing_error?: string | null
          metadata?: Json
          uploaded_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      knowledge_websites: {
        Row: {
          id: string
          company_profile_id: string
          url: string
          page_title: string | null
          crawled_content: string | null
          content_sections: Json
          last_synced_at: string | null
          sync_status: 'pending' | 'syncing' | 'completed' | 'failed'
          sync_error: string | null
          auto_sync_enabled: boolean
          sync_frequency_hours: number
          metadata: Json
          added_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_profile_id: string
          url: string
          page_title?: string | null
          crawled_content?: string | null
          content_sections?: Json
          last_synced_at?: string | null
          sync_status?: 'pending' | 'syncing' | 'completed' | 'failed'
          sync_error?: string | null
          auto_sync_enabled?: boolean
          sync_frequency_hours?: number
          metadata?: Json
          added_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_profile_id?: string
          url?: string
          page_title?: string | null
          crawled_content?: string | null
          content_sections?: Json
          last_synced_at?: string | null
          sync_status?: 'pending' | 'syncing' | 'completed' | 'failed'
          sync_error?: string | null
          auto_sync_enabled?: boolean
          sync_frequency_hours?: number
          metadata?: Json
          added_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      // ============================================
      // INTEGRATION TABLES
      // ============================================
      team_integrations: {
        Row: {
          id: string
          team_id: string
          provider_id: string
          status: 'active' | 'inactive' | 'error' | 'configuring'
          auth_data: Json
          config: Json
          last_sync_at: string | null
          last_error: string | null
          sync_frequency: 'realtime' | 'hourly' | 'daily' | 'weekly' | 'manual'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          team_id: string
          provider_id: string
          status?: 'active' | 'inactive' | 'error' | 'configuring'
          auth_data?: Json
          config?: Json
          last_sync_at?: string | null
          last_error?: string | null
          sync_frequency?: 'realtime' | 'hourly' | 'daily' | 'weekly' | 'manual'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          team_id?: string
          provider_id?: string
          status?: 'active' | 'inactive' | 'error' | 'configuring'
          auth_data?: Json
          config?: Json
          last_sync_at?: string | null
          last_error?: string | null
          sync_frequency?: 'realtime' | 'hourly' | 'daily' | 'weekly' | 'manual'
          created_at?: string
          updated_at?: string
        }
      }
      integration_flows: {
        Row: {
          id: string
          team_id: string
          name: string
          description: string | null
          trigger_integration_id: string | null
          trigger_type: string
          trigger_config: Json
          flow_definition: Json
          is_active: boolean
          execution_count: number
          last_executed_at: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          team_id: string
          name: string
          description?: string | null
          trigger_integration_id?: string | null
          trigger_type: string
          trigger_config?: Json
          flow_definition: Json
          is_active?: boolean
          execution_count?: number
          last_executed_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          team_id?: string
          name?: string
          description?: string | null
          trigger_integration_id?: string | null
          trigger_type?: string
          trigger_config?: Json
          flow_definition?: Json
          is_active?: boolean
          execution_count?: number
          last_executed_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      webhook_endpoints: {
        Row: {
          id: string
          team_id: string
          integration_id: string | null
          url: string
          secret: string | null
          events: string[]
          status: 'active' | 'inactive'
          last_triggered_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          team_id: string
          integration_id?: string | null
          url: string
          secret?: string | null
          events?: string[]
          status?: 'active' | 'inactive'
          last_triggered_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          team_id?: string
          integration_id?: string | null
          url?: string
          secret?: string | null
          events?: string[]
          status?: 'active' | 'inactive'
          last_triggered_at?: string | null
          created_at?: string
        }
      }
      webhook_logs: {
        Row: {
          id: string
          webhook_id: string
          event_type: string
          payload: Json | null
          response_status: number | null
          response_body: string | null
          processing_time_ms: number | null
          error: string | null
          created_at: string
        }
        Insert: {
          id?: string
          webhook_id: string
          event_type: string
          payload?: Json | null
          response_status?: number | null
          response_body?: string | null
          processing_time_ms?: number | null
          error?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          webhook_id?: string
          event_type?: string
          payload?: Json | null
          response_status?: number | null
          response_body?: string | null
          processing_time_ms?: number | null
          error?: string | null
          created_at?: string
        }
      }
      // ============================================
      // ENRICHMENT TABLES
      // ============================================
      enrichment_providers: {
        Row: {
          id: string
          provider_name: string
          display_name: string
          api_endpoint: string | null
          priority_order: number
          is_enabled: boolean
          credits_remaining: number
          credits_used_this_month: number
          rate_limit_per_minute: number
          success_rate: number
          avg_response_time_ms: number
          config: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          provider_name: string
          display_name: string
          api_endpoint?: string | null
          priority_order?: number
          is_enabled?: boolean
          credits_remaining?: number
          credits_used_this_month?: number
          rate_limit_per_minute?: number
          success_rate?: number
          avg_response_time_ms?: number
          config?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          provider_name?: string
          display_name?: string
          api_endpoint?: string | null
          priority_order?: number
          is_enabled?: boolean
          credits_remaining?: number
          credits_used_this_month?: number
          rate_limit_per_minute?: number
          success_rate?: number
          avg_response_time_ms?: number
          config?: Json
          created_at?: string
          updated_at?: string
        }
      }
      enrichment_requests: {
        Row: {
          id: string
          prospect_id: string | null
          team_id: string
          enrichment_type: string
          input_data: Json
          waterfall_status: string
          attempts_count: number
          final_provider_used: string | null
          enriched_data: Json
          waterfall_log: Json
          total_duration_ms: number | null
          credits_consumed: number
          created_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          prospect_id?: string | null
          team_id: string
          enrichment_type: string
          input_data: Json
          waterfall_status?: string
          attempts_count?: number
          final_provider_used?: string | null
          enriched_data?: Json
          waterfall_log?: Json
          total_duration_ms?: number | null
          credits_consumed?: number
          created_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          prospect_id?: string | null
          team_id?: string
          enrichment_type?: string
          input_data?: Json
          waterfall_status?: string
          attempts_count?: number
          final_provider_used?: string | null
          enriched_data?: Json
          waterfall_log?: Json
          total_duration_ms?: number | null
          credits_consumed?: number
          created_at?: string
          completed_at?: string | null
        }
      }
      // ============================================
      // SAAS FEATURES TABLES
      // ============================================
      api_keys: {
        Row: {
          id: string
          name: string
          key_hash: string
          prefix: string
          scopes: string[]
          organization_id: string
          user_id: string
          status: 'active' | 'revoked' | 'expired'
          request_count: number
          last_used_at: string | null
          expires_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          key_hash: string
          prefix: string
          scopes?: string[]
          organization_id: string
          user_id: string
          status?: 'active' | 'revoked' | 'expired'
          request_count?: number
          last_used_at?: string | null
          expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          key_hash?: string
          prefix?: string
          scopes?: string[]
          organization_id?: string
          user_id?: string
          status?: 'active' | 'revoked' | 'expired'
          request_count?: number
          last_used_at?: string | null
          expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      subscriptions: {
        Row: {
          id: string
          organization_id: string
          plan: 'free' | 'starter' | 'pro' | 'enterprise'
          status: 'active' | 'canceled' | 'past_due' | 'trialing'
          current_period_start: string
          current_period_end: string
          cancel_at_period_end: boolean
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          plan: 'free' | 'starter' | 'pro' | 'enterprise'
          status: 'active' | 'canceled' | 'past_due' | 'trialing'
          current_period_start: string
          current_period_end: string
          cancel_at_period_end?: boolean
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          plan?: 'free' | 'starter' | 'pro' | 'enterprise'
          status?: 'active' | 'canceled' | 'past_due' | 'trialing'
          current_period_start?: string
          current_period_end?: string
          cancel_at_period_end?: boolean
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      invoices: {
        Row: {
          id: string
          organization_id: string
          subscription_id: string | null
          amount: number
          currency: string
          status: 'paid' | 'pending' | 'failed' | 'refunded'
          invoice_url: string | null
          stripe_invoice_id: string | null
          period_start: string | null
          period_end: string | null
          due_date: string | null
          paid_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          subscription_id?: string | null
          amount: number
          currency?: string
          status: 'paid' | 'pending' | 'failed' | 'refunded'
          invoice_url?: string | null
          stripe_invoice_id?: string | null
          period_start?: string | null
          period_end?: string | null
          due_date?: string | null
          paid_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          subscription_id?: string | null
          amount?: number
          currency?: string
          status?: 'paid' | 'pending' | 'failed' | 'refunded'
          invoice_url?: string | null
          stripe_invoice_id?: string | null
          period_start?: string | null
          period_end?: string | null
          due_date?: string | null
          paid_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      user_preferences: {
        Row: {
          id: string
          user_id: string
          email_notifications: boolean
          desktop_notifications: boolean
          weekly_digest: boolean
          timezone: string
          language: string
          theme: 'light' | 'dark' | 'auto'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          email_notifications?: boolean
          desktop_notifications?: boolean
          weekly_digest?: boolean
          timezone?: string
          language?: string
          theme?: 'light' | 'dark' | 'auto'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          email_notifications?: boolean
          desktop_notifications?: boolean
          weekly_digest?: boolean
          timezone?: string
          language?: string
          theme?: 'light' | 'dark' | 'auto'
          created_at?: string
          updated_at?: string
        }
      }
      team_invitations: {
        Row: {
          id: string
          email: string
          role: 'admin' | 'user' | 'viewer'
          organization_id: string
          invited_by: string
          token: string
          status: 'pending' | 'accepted' | 'expired' | 'cancelled'
          expires_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          role: 'admin' | 'user' | 'viewer'
          organization_id: string
          invited_by: string
          token: string
          status?: 'pending' | 'accepted' | 'expired' | 'cancelled'
          expires_at: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          role?: 'admin' | 'user' | 'viewer'
          organization_id?: string
          invited_by?: string
          token?: string
          status?: 'pending' | 'accepted' | 'expired' | 'cancelled'
          expires_at?: string
          created_at?: string
          updated_at?: string
        }
      }
      sso_providers: {
        Row: {
          id: string
          organization_id: string
          provider_type: 'saml' | 'oauth2' | 'oidc'
          provider_name: 'okta' | 'azure_ad' | 'google' | 'onelogin' | 'custom_saml'
          configuration: Json
          is_active: boolean
          last_used: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          provider_type: 'saml' | 'oauth2' | 'oidc'
          provider_name: 'okta' | 'azure_ad' | 'google' | 'onelogin' | 'custom_saml'
          configuration: Json
          is_active?: boolean
          last_used?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          provider_type?: 'saml' | 'oauth2' | 'oidc'
          provider_name?: 'okta' | 'azure_ad' | 'google' | 'onelogin' | 'custom_saml'
          configuration?: Json
          is_active?: boolean
          last_used?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      // ============================================
      // ANALYTICS TABLES
      // ============================================
      activity_metrics: {
        Row: {
          id: string
          user_id: string | null
          team_id: string | null
          metric_date: string
          emails_sent: number
          calls_made: number
          meetings_booked: number
          prospects_added: number
          deals_created: number
          revenue_generated: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          team_id?: string | null
          metric_date: string
          emails_sent?: number
          calls_made?: number
          meetings_booked?: number
          prospects_added?: number
          deals_created?: number
          revenue_generated?: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          team_id?: string | null
          metric_date?: string
          emails_sent?: number
          calls_made?: number
          meetings_booked?: number
          prospects_added?: number
          deals_created?: number
          revenue_generated?: number
          created_at?: string
        }
      }
      performance_metrics: {
        Row: {
          id: string
          user_id: string | null
          team_id: string | null
          metric_date: string
          response_rate: number
          conversion_rate: number
          average_deal_size: number
          win_rate: number
          quota_attainment: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          team_id?: string | null
          metric_date: string
          response_rate?: number
          conversion_rate?: number
          average_deal_size?: number
          win_rate?: number
          quota_attainment?: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          team_id?: string | null
          metric_date?: string
          response_rate?: number
          conversion_rate?: number
          average_deal_size?: number
          win_rate?: number
          quota_attainment?: number
          created_at?: string
        }
      }
      // ============================================
      // SEARCH TABLES
      // ============================================
      search_analytics: {
        Row: {
          id: string
          organization_id: string
          user_id: string
          query: string
          result_count: number
          search_time: number | null
          filters: Json | null
          clicked_result_id: string | null
          clicked_result_type: string | null
          clicked_position: number | null
          searched_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          user_id: string
          query: string
          result_count: number
          search_time?: number | null
          filters?: Json | null
          clicked_result_id?: string | null
          clicked_result_type?: string | null
          clicked_position?: number | null
          searched_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          user_id?: string
          query?: string
          result_count?: number
          search_time?: number | null
          filters?: Json | null
          clicked_result_id?: string | null
          clicked_result_type?: string | null
          clicked_position?: number | null
          searched_at?: string
        }
      }
      saved_searches: {
        Row: {
          id: string
          user_id: string
          name: string
          query: Json
          is_pinned: boolean
          last_used_at: string | null
          use_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          query: Json
          is_pinned?: boolean
          last_used_at?: string | null
          use_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          query?: Json
          is_pinned?: boolean
          last_used_at?: string | null
          use_count?: number
          created_at?: string
          updated_at?: string
        }
      }
      ai_predictions: {
        Row: {
          id: string
          entity_type: string
          entity_id: string
          prediction_type: string
          score: number
          confidence: number | null
          reasoning: Json
          model_version: string | null
          created_at: string
        }
        Insert: {
          id?: string
          entity_type: string
          entity_id: string
          prediction_type: string
          score: number
          confidence?: number | null
          reasoning?: Json
          model_version?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          entity_type?: string
          entity_id?: string
          prediction_type?: string
          score?: number
          confidence?: number | null
          reasoning?: Json
          model_version?: string | null
          created_at?: string
        }
      }
      email_sends: {
        Row: {
          id: string
          template_id: string | null
          prospect_id: string | null
          cadence_enrollment_id: string | null
          subject: string
          body: string
          sent_by: string | null
          status: string
          provider_message_id: string | null
          sent_at: string | null
          delivered_at: string | null
          opened_at: string | null
          clicked_at: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          template_id?: string | null
          prospect_id?: string | null
          cadence_enrollment_id?: string | null
          subject: string
          body: string
          sent_by?: string | null
          status?: string
          provider_message_id?: string | null
          sent_at?: string | null
          delivered_at?: string | null
          opened_at?: string | null
          clicked_at?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          template_id?: string | null
          prospect_id?: string | null
          cadence_enrollment_id?: string | null
          subject?: string
          body?: string
          sent_by?: string | null
          status?: string
          provider_message_id?: string | null
          sent_at?: string | null
          delivered_at?: string | null
          opened_at?: string | null
          clicked_at?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      conversation_transcripts: {
        Row: {
          id: string
          conversation_id: string | null
          segment_number: number
          speaker_name: string | null
          speaker_role: string | null
          start_time: number
          end_time: number
          text: string
          confidence: number | null
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id?: string | null
          segment_number: number
          speaker_name?: string | null
          speaker_role?: string | null
          start_time: number
          end_time: number
          text: string
          confidence?: number | null
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string | null
          segment_number?: number
          speaker_name?: string | null
          speaker_role?: string | null
          start_time?: number
          end_time?: number
          text?: string
          confidence?: number | null
          metadata?: Json
          created_at?: string
        }
      }
      conversation_insights: {
        Row: {
          id: string
          conversation_id: string | null
          summary: string | null
          key_points: Json
          action_items: Json
          questions_asked: Json
          objections: Json
          next_steps: Json
          sentiment_score: number | null
          engagement_score: number | null
          talk_ratio: Json
          meddpicc: Json
          topics: Json
          keywords: Json
          competitive_mentions: Json
          pricing_discussed: boolean | null
          decision_timeline: string | null
          budget_mentioned: boolean | null
          ai_recommendations: Json
          model_version: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          conversation_id?: string | null
          summary?: string | null
          key_points?: Json
          action_items?: Json
          questions_asked?: Json
          objections?: Json
          next_steps?: Json
          sentiment_score?: number | null
          engagement_score?: number | null
          talk_ratio?: Json
          meddpicc?: Json
          topics?: Json
          keywords?: Json
          competitive_mentions?: Json
          pricing_discussed?: boolean | null
          decision_timeline?: string | null
          budget_mentioned?: boolean | null
          ai_recommendations?: Json
          model_version?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string | null
          summary?: string | null
          key_points?: Json
          action_items?: Json
          questions_asked?: Json
          objections?: Json
          next_steps?: Json
          sentiment_score?: number | null
          engagement_score?: number | null
          talk_ratio?: Json
          meddpicc?: Json
          topics?: Json
          keywords?: Json
          competitive_mentions?: Json
          pricing_discussed?: boolean | null
          decision_timeline?: string | null
          budget_mentioned?: boolean | null
          ai_recommendations?: Json
          model_version?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      bdr_agent_configs: {
        Row: {
          id: string
          team_id: string | null
          agent_name: string
          is_active: boolean | null
          auto_approve_messages: boolean | null
          require_human_review: boolean | null
          max_daily_touches: number | null
          max_touches_per_prospect: number | null
          min_delay_between_touches_hours: number | null
          discovery_enabled: boolean | null
          discovery_interval_minutes: number | null
          min_intent_score: number | null
          max_new_prospects_per_day: number | null
          preferred_channels: string[] | null
          linkedin_enabled: boolean | null
          phone_enabled: boolean | null
          qualification_framework: string | null
          auto_qualify_threshold: number | null
          handoff_threshold: number | null
          enable_learning: boolean | null
          ab_testing_enabled: boolean | null
          working_hours: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          team_id?: string | null
          agent_name?: string
          is_active?: boolean | null
          auto_approve_messages?: boolean | null
          require_human_review?: boolean | null
          max_daily_touches?: number | null
          max_touches_per_prospect?: number | null
          min_delay_between_touches_hours?: number | null
          discovery_enabled?: boolean | null
          discovery_interval_minutes?: number | null
          min_intent_score?: number | null
          max_new_prospects_per_day?: number | null
          preferred_channels?: string[] | null
          linkedin_enabled?: boolean | null
          phone_enabled?: boolean | null
          qualification_framework?: string | null
          auto_qualify_threshold?: number | null
          handoff_threshold?: number | null
          enable_learning?: boolean | null
          ab_testing_enabled?: boolean | null
          working_hours?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          team_id?: string | null
          agent_name?: string
          is_active?: boolean | null
          auto_approve_messages?: boolean | null
          require_human_review?: boolean | null
          max_daily_touches?: number | null
          max_touches_per_prospect?: number | null
          min_delay_between_touches_hours?: number | null
          discovery_enabled?: boolean | null
          discovery_interval_minutes?: number | null
          min_intent_score?: number | null
          max_new_prospects_per_day?: number | null
          preferred_channels?: string[] | null
          linkedin_enabled?: boolean | null
          phone_enabled?: boolean | null
          qualification_framework?: string | null
          auto_qualify_threshold?: number | null
          handoff_threshold?: number | null
          enable_learning?: boolean | null
          ab_testing_enabled?: boolean | null
          working_hours?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      bdr_tasks: {
        Row: {
          id: string
          team_id: string | null
          prospect_id: string | null
          company_profile_id: string | null
          task_type: string
          status: string
          priority: number | null
          config: Json | null
          workflow_id: string | null
          workflow_step: number | null
          scheduled_for: string | null
          started_at: string | null
          completed_at: string | null
          result: Json | null
          error: string | null
          retry_count: number | null
          max_retries: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          team_id?: string | null
          prospect_id?: string | null
          company_profile_id?: string | null
          task_type: string
          status?: string
          priority?: number | null
          config?: Json | null
          workflow_id?: string | null
          workflow_step?: number | null
          scheduled_for?: string | null
          started_at?: string | null
          completed_at?: string | null
          result?: Json | null
          error?: string | null
          retry_count?: number | null
          max_retries?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          team_id?: string | null
          prospect_id?: string | null
          company_profile_id?: string | null
          task_type?: string
          status?: string
          priority?: number | null
          config?: Json | null
          workflow_id?: string | null
          workflow_step?: number | null
          scheduled_for?: string | null
          started_at?: string | null
          completed_at?: string | null
          result?: Json | null
          error?: string | null
          retry_count?: number | null
          max_retries?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      bdr_activities: {
        Row: {
          id: string
          team_id: string | null
          prospect_id: string | null
          task_id: string | null
          activity_type: string
          channel: string | null
          direction: string | null
          subject: string | null
          message_preview: string | null
          full_content: string | null
          metadata: Json | null
          was_automated: boolean | null
          required_approval: boolean | null
          approved_by: string | null
          approved_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          team_id?: string | null
          prospect_id?: string | null
          task_id?: string | null
          activity_type: string
          channel?: string | null
          direction?: string | null
          subject?: string | null
          message_preview?: string | null
          full_content?: string | null
          metadata?: Json | null
          was_automated?: boolean | null
          required_approval?: boolean | null
          approved_by?: string | null
          approved_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          team_id?: string | null
          prospect_id?: string | null
          task_id?: string | null
          activity_type?: string
          channel?: string | null
          direction?: string | null
          subject?: string | null
          message_preview?: string | null
          full_content?: string | null
          metadata?: Json | null
          was_automated?: boolean | null
          required_approval?: boolean | null
          approved_by?: string | null
          approved_at?: string | null
          created_at?: string
        }
      }
      bdr_handoffs: {
        Row: {
          id: string
          team_id: string | null
          prospect_id: string | null
          company_profile_id: string | null
          handoff_type: string
          priority: string | null
          qualification_score: number | null
          bant_breakdown: Json | null
          executive_summary: string
          key_insights: Json | null
          conversation_summary: string | null
          suggested_next_steps: Json | null
          assigned_to: string | null
          assigned_at: string | null
          status: string
          handled_at: string | null
          handler_notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          team_id?: string | null
          prospect_id?: string | null
          company_profile_id?: string | null
          handoff_type: string
          priority?: string | null
          qualification_score?: number | null
          bant_breakdown?: Json | null
          executive_summary: string
          key_insights?: Json | null
          conversation_summary?: string | null
          suggested_next_steps?: Json | null
          assigned_to?: string | null
          assigned_at?: string | null
          status?: string
          handled_at?: string | null
          handler_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          team_id?: string | null
          prospect_id?: string | null
          company_profile_id?: string | null
          handoff_type?: string
          priority?: string | null
          qualification_score?: number | null
          bant_breakdown?: Json | null
          executive_summary?: string
          key_insights?: Json | null
          conversation_summary?: string | null
          suggested_next_steps?: Json | null
          assigned_to?: string | null
          assigned_at?: string | null
          status?: string
          handled_at?: string | null
          handler_notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      bdr_performance_metrics: {
        Row: {
          id: string
          team_id: string | null
          agent_config_id: string | null
          metric_date: string
          prospects_discovered: number | null
          emails_sent: number | null
          linkedin_messages: number | null
          phone_calls: number | null
          email_opens: number | null
          email_clicks: number | null
          replies_received: number | null
          conversations_started: number | null
          meetings_scheduled: number | null
          prospects_qualified: number | null
          prospects_handed_off: number | null
          avg_qualification_score: number | null
          tasks_completed: number | null
          tasks_failed: number | null
          avg_task_duration_seconds: number | null
          pipeline_generated_usd: number | null
          deals_closed: number | null
          revenue_generated_usd: number | null
          email_response_rate: number | null
          linkedin_response_rate: number | null
          overall_response_rate: number | null
          decision_accuracy: number | null
          human_overrides: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          team_id?: string | null
          agent_config_id?: string | null
          metric_date?: string
          prospects_discovered?: number | null
          emails_sent?: number | null
          linkedin_messages?: number | null
          phone_calls?: number | null
          email_opens?: number | null
          email_clicks?: number | null
          replies_received?: number | null
          conversations_started?: number | null
          meetings_scheduled?: number | null
          prospects_qualified?: number | null
          prospects_handed_off?: number | null
          avg_qualification_score?: number | null
          tasks_completed?: number | null
          tasks_failed?: number | null
          avg_task_duration_seconds?: number | null
          pipeline_generated_usd?: number | null
          deals_closed?: number | null
          revenue_generated_usd?: number | null
          email_response_rate?: number | null
          linkedin_response_rate?: number | null
          overall_response_rate?: number | null
          decision_accuracy?: number | null
          human_overrides?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          team_id?: string | null
          agent_config_id?: string | null
          metric_date?: string
          prospects_discovered?: number | null
          emails_sent?: number | null
          linkedin_messages?: number | null
          phone_calls?: number | null
          email_opens?: number | null
          email_clicks?: number | null
          replies_received?: number | null
          conversations_started?: number | null
          meetings_scheduled?: number | null
          prospects_qualified?: number | null
          prospects_handed_off?: number | null
          avg_qualification_score?: number | null
          tasks_completed?: number | null
          tasks_failed?: number | null
          avg_task_duration_seconds?: number | null
          pipeline_generated_usd?: number | null
          deals_closed?: number | null
          revenue_generated_usd?: number | null
          email_response_rate?: number | null
          linkedin_response_rate?: number | null
          overall_response_rate?: number | null
          decision_accuracy?: number | null
          human_overrides?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      company_research_sources: {
        Row: {
          id: string
          company_profile_id: string | null
          source_type: string
          source_name: string
          source_data: Json
          quality_score: number | null
          confidence: number | null
          last_updated: string
          created_at: string
        }
        Insert: {
          id?: string
          company_profile_id?: string | null
          source_type: string
          source_name: string
          source_data?: Json
          quality_score?: number | null
          confidence?: number | null
          last_updated?: string
          created_at?: string
        }
        Update: {
          id?: string
          company_profile_id?: string | null
          source_type?: string
          source_name?: string
          source_data?: Json
          quality_score?: number | null
          confidence?: number | null
          last_updated?: string
          created_at?: string
        }
      }
      company_training_sessions: {
        Row: {
          id: string
          company_profile_id: string
          training_type: string
          affected_agents: Json | null
          knowledge_sources_count: number | null
          embeddings_generated: number | null
          training_status: string | null
          validation_score: number | null
          metrics: Json | null
          error_message: string | null
          triggered_by: string | null
          created_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          company_profile_id: string
          training_type: string
          affected_agents?: Json | null
          knowledge_sources_count?: number | null
          embeddings_generated?: number | null
          training_status?: string | null
          validation_score?: number | null
          metrics?: Json | null
          error_message?: string | null
          triggered_by?: string | null
          created_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          company_profile_id?: string
          training_type?: string
          affected_agents?: Json | null
          knowledge_sources_count?: number | null
          embeddings_generated?: number | null
          training_status?: string | null
          validation_score?: number | null
          metrics?: Json | null
          error_message?: string | null
          triggered_by?: string | null
          created_at?: string
          completed_at?: string | null
        }
      }
      integration_marketplace: {
        Row: {
          id: string
          provider_key: string
          name: string
          description: string | null
          category: string
          logo_url: string | null
          website_url: string | null
          documentation_url: string | null
          setup_complexity: string | null
          pricing_tier: string | null
          required_scopes: string[] | null
          supported_features: Json | null
          is_featured: boolean | null
          install_count: number | null
          average_rating: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          provider_key: string
          name: string
          description?: string | null
          category: string
          logo_url?: string | null
          website_url?: string | null
          documentation_url?: string | null
          setup_complexity?: string | null
          pricing_tier?: string | null
          required_scopes?: string[] | null
          supported_features?: Json | null
          is_featured?: boolean | null
          install_count?: number | null
          average_rating?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          provider_key?: string
          name?: string
          description?: string | null
          category?: string
          logo_url?: string | null
          website_url?: string | null
          documentation_url?: string | null
          setup_complexity?: string | null
          pricing_tier?: string | null
          required_scopes?: string[] | null
          supported_features?: Json | null
          is_featured?: boolean | null
          install_count?: number | null
          average_rating?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      integration_providers: {
        Row: {
          id: string
          name: string
          category: string
          description: string | null
          logo_url: string | null
          auth_type: string
          config_schema: Json | null
          capabilities: Json | null
          is_active: boolean | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          category: string
          description?: string | null
          logo_url?: string | null
          auth_type: string
          config_schema?: Json | null
          capabilities?: Json | null
          is_active?: boolean | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          category?: string
          description?: string | null
          logo_url?: string | null
          auth_type?: string
          config_schema?: Json | null
          capabilities?: Json | null
          is_active?: boolean | null
          created_at?: string
          updated_at?: string
        }
      }
      activities: {
        Row: {
          id: string
          team_id: string | null
          prospect_id: string | null
          activity_type: string
          subject: string | null
          notes: string | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          team_id?: string | null
          prospect_id?: string | null
          activity_type: string
          subject?: string | null
          notes?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          team_id?: string | null
          prospect_id?: string | null
          activity_type?: string
          subject?: string | null
          notes?: string | null
          metadata?: Json | null
          created_at?: string
        }
      }
    }
    Functions: {
      match_knowledge_documents: {
        Args: {
          query_embedding: string
          match_threshold: number
          match_count: number
        }
        Returns: {
          id: string
          company_profile_id: string
          source_type: string
          source_id: string
          chunk_text: string
          chunk_index: number
          similarity: number
        }[]
      }
      get_daily_tasks: {
        Args: {
          user_id: string
        }
        Returns: {
          id: string
          title: string
          type: string
          priority: string
          due_date: string
          prospect_name: string
          company: string
        }[]
      }
      analyze_pipeline_health: {
        Args: {
          team_id: string
        }
        Returns: {
          health_score: number
          pipeline_coverage: number
          win_rate: number
          velocity: number
          at_risk_deals: number
          recommendations: Json
        }
      }
    }
  }
}

// Helper types for easier access
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]
export type TableRow<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type TableInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type TableUpdate<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']
