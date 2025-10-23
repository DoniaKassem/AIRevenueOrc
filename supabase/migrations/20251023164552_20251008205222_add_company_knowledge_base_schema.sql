/*
  # Company Knowledge Base Schema

  1. New Tables
    - `company_profiles` - Stores organization information
    - `knowledge_documents` - Stores uploaded PDF files
    - `knowledge_websites` - Stores website URLs and content
    - `knowledge_embeddings` - Stores vector embeddings
    - `company_training_sessions` - Tracks knowledge updates
    - `knowledge_usage_logs` - Tracks knowledge source references

  2. Extensions
    - Enable pgvector extension for vector similarity search

  3. Security
    - Enable RLS on all tables
    - Team-based access control
*/

-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Company Profiles Table
CREATE TABLE IF NOT EXISTS company_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  industry text,
  website_url text,
  company_description text,
  mission_statement text,
  value_propositions jsonb DEFAULT '[]',
  products_services jsonb DEFAULT '[]',
  target_customers text,
  ideal_customer_profile jsonb DEFAULT '{}',
  brand_voice jsonb DEFAULT '{"tone": "professional", "formality": "balanced", "style": "helpful"}',
  messaging_guidelines text,
  communication_dos jsonb DEFAULT '[]',
  communication_donts jsonb DEFAULT '[]',
  spokesperson_enabled boolean DEFAULT false,
  knowledge_completeness_score integer DEFAULT 0 CHECK (knowledge_completeness_score >= 0 AND knowledge_completeness_score <= 100),
  last_trained_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE company_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view team company profiles"
  ON company_profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.team_id = company_profiles.team_id
    )
  );

CREATE POLICY "Users can insert team company profiles"
  ON company_profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.team_id = company_profiles.team_id
    )
  );

CREATE POLICY "Users can update team company profiles"
  ON company_profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.team_id = company_profiles.team_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.team_id = company_profiles.team_id
    )
  );

-- Knowledge Documents Table
CREATE TABLE IF NOT EXISTS knowledge_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_profile_id uuid NOT NULL REFERENCES company_profiles(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_size bigint,
  file_type text,
  storage_path text NOT NULL,
  document_type text CHECK (document_type IN ('pdf', 'website', 'manual', 'other')),
  extracted_text text,
  content_chunks jsonb DEFAULT '[]',
  processing_status text DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
  processing_error text,
  metadata jsonb DEFAULT '{}',
  uploaded_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view team knowledge documents"
  ON knowledge_documents FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_profiles
      JOIN profiles ON profiles.team_id = company_profiles.team_id
      WHERE company_profiles.id = knowledge_documents.company_profile_id
      AND profiles.id = auth.uid()
    )
  );

CREATE POLICY "Users can insert team knowledge documents"
  ON knowledge_documents FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_profiles
      JOIN profiles ON profiles.team_id = company_profiles.team_id
      WHERE company_profiles.id = knowledge_documents.company_profile_id
      AND profiles.id = auth.uid()
    )
  );

CREATE POLICY "Users can update team knowledge documents"
  ON knowledge_documents FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_profiles
      JOIN profiles ON profiles.team_id = company_profiles.team_id
      WHERE company_profiles.id = knowledge_documents.company_profile_id
      AND profiles.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_profiles
      JOIN profiles ON profiles.team_id = company_profiles.team_id
      WHERE company_profiles.id = knowledge_documents.company_profile_id
      AND profiles.id = auth.uid()
    )
  );

CREATE POLICY "Users can delete team knowledge documents"
  ON knowledge_documents FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_profiles
      JOIN profiles ON profiles.team_id = company_profiles.team_id
      WHERE company_profiles.id = knowledge_documents.company_profile_id
      AND profiles.id = auth.uid()
    )
  );

-- Knowledge Websites Table
CREATE TABLE IF NOT EXISTS knowledge_websites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_profile_id uuid NOT NULL REFERENCES company_profiles(id) ON DELETE CASCADE,
  url text NOT NULL,
  page_title text,
  crawled_content text,
  content_sections jsonb DEFAULT '[]',
  last_synced_at timestamptz,
  sync_status text DEFAULT 'pending' CHECK (sync_status IN ('pending', 'syncing', 'completed', 'failed')),
  sync_error text,
  auto_sync_enabled boolean DEFAULT false,
  sync_frequency_hours integer DEFAULT 168,
  metadata jsonb DEFAULT '{}',
  added_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE knowledge_websites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view team knowledge websites"
  ON knowledge_websites FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_profiles
      JOIN profiles ON profiles.team_id = company_profiles.team_id
      WHERE company_profiles.id = knowledge_websites.company_profile_id
      AND profiles.id = auth.uid()
    )
  );

CREATE POLICY "Users can insert team knowledge websites"
  ON knowledge_websites FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_profiles
      JOIN profiles ON profiles.team_id = company_profiles.team_id
      WHERE company_profiles.id = knowledge_websites.company_profile_id
      AND profiles.id = auth.uid()
    )
  );

CREATE POLICY "Users can update team knowledge websites"
  ON knowledge_websites FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_profiles
      JOIN profiles ON profiles.team_id = company_profiles.team_id
      WHERE company_profiles.id = knowledge_websites.company_profile_id
      AND profiles.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_profiles
      JOIN profiles ON profiles.team_id = company_profiles.team_id
      WHERE company_profiles.id = knowledge_websites.company_profile_id
      AND profiles.id = auth.uid()
    )
  );

CREATE POLICY "Users can delete team knowledge websites"
  ON knowledge_websites FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_profiles
      JOIN profiles ON profiles.team_id = company_profiles.team_id
      WHERE company_profiles.id = knowledge_websites.company_profile_id
      AND profiles.id = auth.uid()
    )
  );

-- Knowledge Embeddings Table
CREATE TABLE IF NOT EXISTS knowledge_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_profile_id uuid NOT NULL REFERENCES company_profiles(id) ON DELETE CASCADE,
  source_type text NOT NULL CHECK (source_type IN ('document', 'website', 'manual')),
  source_id uuid NOT NULL,
  chunk_text text NOT NULL,
  chunk_index integer NOT NULL,
  embedding vector(1536),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE knowledge_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view team knowledge embeddings"
  ON knowledge_embeddings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_profiles
      JOIN profiles ON profiles.team_id = company_profiles.team_id
      WHERE company_profiles.id = knowledge_embeddings.company_profile_id
      AND profiles.id = auth.uid()
    )
  );

CREATE POLICY "System can insert knowledge embeddings"
  ON knowledge_embeddings FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Company Training Sessions Table
CREATE TABLE IF NOT EXISTS company_training_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_profile_id uuid NOT NULL REFERENCES company_profiles(id) ON DELETE CASCADE,
  training_type text NOT NULL CHECK (training_type IN ('full', 'incremental', 'document_added', 'website_synced', 'profile_updated')),
  affected_agents jsonb DEFAULT '[]',
  knowledge_sources_count integer DEFAULT 0,
  embeddings_generated integer DEFAULT 0,
  training_status text DEFAULT 'pending' CHECK (training_status IN ('pending', 'in_progress', 'completed', 'failed')),
  validation_score integer CHECK (validation_score >= 0 AND validation_score <= 100),
  metrics jsonb DEFAULT '{}',
  error_message text,
  triggered_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE company_training_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view team training sessions"
  ON company_training_sessions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_profiles
      JOIN profiles ON profiles.team_id = company_profiles.team_id
      WHERE company_profiles.id = company_training_sessions.company_profile_id
      AND profiles.id = auth.uid()
    )
  );

-- Knowledge Usage Logs Table
CREATE TABLE IF NOT EXISTS knowledge_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_profile_id uuid NOT NULL REFERENCES company_profiles(id) ON DELETE CASCADE,
  agent_type text NOT NULL,
  task_type text NOT NULL,
  knowledge_sources_used jsonb DEFAULT '[]',
  context_retrieved text,
  was_helpful boolean,
  user_feedback text,
  usage_context jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE knowledge_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view team knowledge usage logs"
  ON knowledge_usage_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_profiles
      JOIN profiles ON profiles.team_id = company_profiles.team_id
      WHERE company_profiles.id = knowledge_usage_logs.company_profile_id
      AND profiles.id = auth.uid()
    )
  );

CREATE POLICY "System can insert knowledge usage logs"
  ON knowledge_usage_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_company_profiles_team_id ON company_profiles(team_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_company_profile_id ON knowledge_documents(company_profile_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_processing_status ON knowledge_documents(processing_status);
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_created_at ON knowledge_documents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_websites_company_profile_id ON knowledge_websites(company_profile_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_websites_sync_status ON knowledge_websites(sync_status);
CREATE INDEX IF NOT EXISTS idx_knowledge_websites_last_synced_at ON knowledge_websites(last_synced_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_embeddings_company_profile_id ON knowledge_embeddings(company_profile_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_embeddings_source ON knowledge_embeddings(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_training_sessions_company_profile_id ON company_training_sessions(company_profile_id);
CREATE INDEX IF NOT EXISTS idx_training_sessions_created_at ON company_training_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_usage_logs_company_profile_id ON knowledge_usage_logs(company_profile_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_usage_logs_agent_type ON knowledge_usage_logs(agent_type);
CREATE INDEX IF NOT EXISTS idx_knowledge_usage_logs_created_at ON knowledge_usage_logs(created_at DESC);

-- Create vector similarity index for embeddings
CREATE INDEX IF NOT EXISTS idx_knowledge_embeddings_vector ON knowledge_embeddings 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);