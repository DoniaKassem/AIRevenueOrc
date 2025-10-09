/*
  # Update Knowledge Base Policies for Single-User Mode

  1. Changes
    - Remove authentication requirements from knowledge base tables
    - Add public access policies for single-user mode
    - Ensure compatibility with existing single-user setup

  2. Security
    - Public access enabled for all knowledge base operations
    - Consistent with other table policies in single-user mode
*/

-- Company Profiles - Update to public access
DROP POLICY IF EXISTS "Users can view team company profiles" ON company_profiles;
DROP POLICY IF EXISTS "Users can insert team company profiles" ON company_profiles;
DROP POLICY IF EXISTS "Users can update team company profiles" ON company_profiles;

CREATE POLICY "Public can manage company_profiles"
  ON company_profiles FOR ALL
  TO public
  USING (true);

-- Knowledge Documents - Update to public access
DROP POLICY IF EXISTS "Users can view team knowledge documents" ON knowledge_documents;
DROP POLICY IF EXISTS "Users can insert team knowledge documents" ON knowledge_documents;
DROP POLICY IF EXISTS "Users can update team knowledge documents" ON knowledge_documents;
DROP POLICY IF EXISTS "Users can delete team knowledge documents" ON knowledge_documents;

CREATE POLICY "Public can manage knowledge_documents"
  ON knowledge_documents FOR ALL
  TO public
  USING (true);

-- Knowledge Websites - Update to public access
DROP POLICY IF EXISTS "Users can view team knowledge websites" ON knowledge_websites;
DROP POLICY IF EXISTS "Users can insert team knowledge websites" ON knowledge_websites;
DROP POLICY IF EXISTS "Users can update team knowledge websites" ON knowledge_websites;
DROP POLICY IF EXISTS "Users can delete team knowledge websites" ON knowledge_websites;

CREATE POLICY "Public can manage knowledge_websites"
  ON knowledge_websites FOR ALL
  TO public
  USING (true);

-- Knowledge Embeddings - Update to public access
DROP POLICY IF EXISTS "Users can view team knowledge embeddings" ON knowledge_embeddings;
DROP POLICY IF EXISTS "System can insert knowledge embeddings" ON knowledge_embeddings;

CREATE POLICY "Public can manage knowledge_embeddings"
  ON knowledge_embeddings FOR ALL
  TO public
  USING (true);

-- Company Training Sessions - Update to public access
DROP POLICY IF EXISTS "Users can view team training sessions" ON company_training_sessions;

CREATE POLICY "Public can manage company_training_sessions"
  ON company_training_sessions FOR ALL
  TO public
  USING (true);

-- Knowledge Usage Logs - Update to public access
DROP POLICY IF EXISTS "Users can view team knowledge usage logs" ON knowledge_usage_logs;
DROP POLICY IF EXISTS "System can insert knowledge usage logs" ON knowledge_usage_logs;

CREATE POLICY "Public can manage knowledge_usage_logs"
  ON knowledge_usage_logs FOR ALL
  TO public
  USING (true);
