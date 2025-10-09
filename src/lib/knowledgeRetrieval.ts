import { supabase } from './supabase';

export interface CompanyKnowledge {
  company_name: string;
  industry?: string;
  company_description?: string;
  mission_statement?: string;
  value_propositions: string[];
  products_services: any[];
  target_customers?: string;
  ideal_customer_profile: any;
  brand_voice: {
    tone: string;
    formality: string;
    style: string;
  };
  messaging_guidelines?: string;
  communication_dos: string[];
  communication_donts: string[];
  spokesperson_enabled: boolean;
}

export interface RelevantKnowledge {
  company_profile: CompanyKnowledge;
  relevant_chunks: Array<{
    text: string;
    source_type: string;
    metadata: any;
    similarity: number;
  }>;
}

export async function getCompanyProfile(
  teamId: string
): Promise<CompanyKnowledge | null> {
  try {
    const { data, error } = await supabase
      .from('company_profiles')
      .select('*')
      .eq('team_id', teamId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching company profile:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in getCompanyProfile:', error);
    return null;
  }
}

export async function searchKnowledgeBase(
  companyProfileId: string,
  query: string,
  limit: number = 5
): Promise<
  Array<{
    text: string;
    source_type: string;
    metadata: any;
    similarity: number;
  }>
> {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    const embeddingResponse = await fetch(
      'https://api.openai.com/v1/embeddings',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          input: query,
          model: 'text-embedding-3-small',
        }),
      }
    );

    if (!embeddingResponse.ok) {
      console.error('Failed to generate query embedding');
      return [];
    }

    const embeddingData = await embeddingResponse.json();
    const queryEmbedding = embeddingData.data[0].embedding;

    const { data, error } = await supabase.rpc('match_knowledge_embeddings', {
      query_embedding: queryEmbedding,
      match_threshold: 0.7,
      match_count: limit,
      p_company_profile_id: companyProfileId,
    });

    if (error) {
      console.error('Error searching knowledge base:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in searchKnowledgeBase:', error);
    return [];
  }
}

export async function getRelevantKnowledge(
  teamId: string,
  context: string
): Promise<RelevantKnowledge | null> {
  try {
    const companyProfile = await getCompanyProfile(teamId);

    if (!companyProfile) {
      return null;
    }

    const { data: profileData } = await supabase
      .from('company_profiles')
      .select('id')
      .eq('team_id', teamId)
      .maybeSingle();

    if (!profileData) {
      return {
        company_profile: companyProfile,
        relevant_chunks: [],
      };
    }

    const relevantChunks = await searchKnowledgeBase(profileData.id, context);

    return {
      company_profile: companyProfile,
      relevant_chunks: relevantChunks,
    };
  } catch (error) {
    console.error('Error in getRelevantKnowledge:', error);
    return null;
  }
}

export function buildCompanyContext(knowledge: RelevantKnowledge): string {
  const { company_profile, relevant_chunks } = knowledge;

  let context = `# Company Information\n\n`;
  context += `Company: ${company_profile.company_name}\n`;

  if (company_profile.industry) {
    context += `Industry: ${company_profile.industry}\n`;
  }

  if (company_profile.company_description) {
    context += `\nAbout: ${company_profile.company_description}\n`;
  }

  if (company_profile.mission_statement) {
    context += `\nMission: ${company_profile.mission_statement}\n`;
  }

  if (
    company_profile.value_propositions &&
    company_profile.value_propositions.length > 0
  ) {
    context += `\n## Value Propositions\n`;
    company_profile.value_propositions.forEach((vp: string) => {
      context += `- ${vp}\n`;
    });
  }

  if (
    company_profile.products_services &&
    company_profile.products_services.length > 0
  ) {
    context += `\n## Products & Services\n`;
    company_profile.products_services.forEach((ps: any) => {
      context += `- ${typeof ps === 'string' ? ps : ps.name || JSON.stringify(ps)}\n`;
    });
  }

  if (company_profile.target_customers) {
    context += `\n## Target Customers\n${company_profile.target_customers}\n`;
  }

  context += `\n## Brand Voice\n`;
  context += `Tone: ${company_profile.brand_voice.tone}\n`;
  context += `Formality: ${company_profile.brand_voice.formality}\n`;
  context += `Style: ${company_profile.brand_voice.style}\n`;

  if (company_profile.messaging_guidelines) {
    context += `\n## Messaging Guidelines\n${company_profile.messaging_guidelines}\n`;
  }

  if (
    company_profile.communication_dos &&
    company_profile.communication_dos.length > 0
  ) {
    context += `\n## Communication DOs\n`;
    company_profile.communication_dos.forEach((item: string) => {
      context += `✓ ${item}\n`;
    });
  }

  if (
    company_profile.communication_donts &&
    company_profile.communication_donts.length > 0
  ) {
    context += `\n## Communication DON'Ts\n`;
    company_profile.communication_donts.forEach((item: string) => {
      context += `✗ ${item}\n`;
    });
  }

  if (relevant_chunks && relevant_chunks.length > 0) {
    context += `\n## Relevant Knowledge Base Content\n`;
    relevant_chunks.forEach((chunk, idx) => {
      context += `\n### Source ${idx + 1} (${chunk.source_type})\n`;
      context += `${chunk.text}\n`;
    });
  }

  return context;
}

export async function logKnowledgeUsage(
  companyProfileId: string,
  agentType: string,
  taskType: string,
  knowledgeSources: string[],
  contextRetrieved: string,
  usageContext: any = {}
): Promise<void> {
  try {
    await supabase.from('knowledge_usage_logs').insert({
      company_profile_id: companyProfileId,
      agent_type: agentType,
      task_type: taskType,
      knowledge_sources_used: knowledgeSources,
      context_retrieved: contextRetrieved,
      usage_context: usageContext,
    });
  } catch (error) {
    console.error('Error logging knowledge usage:', error);
  }
}
