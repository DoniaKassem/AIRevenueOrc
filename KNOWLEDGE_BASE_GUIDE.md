# Knowledge Base & Deep Research Guide

## Getting Started with Company Knowledge Training

Your AI agents can now be trained as company spokespersons using your company's knowledge. Here's how to set it up:

## Step 1: Create Your Company Profile

1. Navigate to **Knowledge Base** in the left sidebar
2. Click **"Create Company Profile"**
3. Fill in your company information:
   - Company Name (required)
   - Industry
   - Website URL
   - Company Description
   - Mission Statement
   - Target Customers
4. **Enable AI Spokesperson Mode** checkbox to activate company-aligned responses
5. Click **"Create Profile"**

## Step 2: Add Knowledge Sources

### Option A: Add Website URLs
1. In the Knowledge Base view, click **"Add URL"** under Website Sources
2. Enter your company website URL (e.g., https://yourcompany.com)
3. Click **"Add & Crawl"**
4. The system will automatically:
   - Crawl the website content
   - Extract text and sections
   - Generate embeddings for semantic search
   - Make it available to AI agents

### Option B: Upload Documents (Coming Soon)
- PDF documents can be uploaded for processing
- The system extracts text and creates searchable embeddings

## Step 3: Run OpenAI Deep Research

This is the **most powerful feature** - it analyzes your company comprehensively:

1. Click the **"Run OpenAI Deep Research"** button (gradient blue-purple button)
2. Wait for the analysis to complete (typically 30-60 seconds)
3. The system will:
   - Analyze your existing company profile
   - Review uploaded documents and crawled websites
   - Generate comprehensive insights about:
     - Company overview and business model
     - Competitive positioning
     - Brand voice and messaging guidelines
     - Sales intelligence and ideal customer profile
     - Common objections and responses
     - AI agent training recommendations
   - Automatically update your profile with:
     - Brand voice settings (tone, formality, style)
     - Communication DOs and DON'Ts
     - Ideal customer profile traits
     - Buying signals to watch for

## How AI Agents Use Company Knowledge

Once you have:
- Created a company profile
- Added knowledge sources (websites/documents)
- Run Deep Research
- **Enabled AI Spokesperson Mode**

All AI agents will automatically:

### Email Generation Agent
- Uses company value propositions in messaging
- Follows brand voice guidelines (tone, formality, style)
- Avoids communication DON'Ts
- References relevant company information

### Prospect Prioritization Agent
- Considers your ideal customer profile
- Evaluates prospects against your target market
- Identifies buying signals specific to your industry

### Deal Analysis Agent
- Applies company-specific qualification criteria
- Uses your win patterns and success factors
- Provides recommendations aligned with your sales process

### Conversation Analysis Agent
- Extracts insights relevant to your products/services
- Identifies mentions of competitors
- Tracks customer objections specific to your business

## Knowledge Retrieval

The system uses **semantic search with vector embeddings** to find relevant knowledge:
- When an AI agent needs context, it searches your knowledge base
- Relevant chunks are retrieved based on similarity to the current task
- Company context is automatically injected into AI prompts
- All knowledge usage is logged for analytics

## Monitoring & Analytics

### Knowledge Completeness Score
- Shows on the Knowledge Base dashboard
- Indicates how much training data is available
- Higher scores mean better AI agent performance

### Training Sessions
- Track when knowledge base is updated
- See which agents were affected
- View training metrics

### Usage Logs
- See which knowledge sources AI agents reference
- Track effectiveness of different knowledge types
- Identify gaps in your knowledge base

## Best Practices

1. **Start with Deep Research**: Run this first to get AI-generated insights
2. **Add Your Main Website**: Crawl your homepage, about page, and product pages
3. **Enable Spokesperson Mode**: This activates company-aligned responses
4. **Keep Knowledge Updated**: Re-run website crawls periodically
5. **Review AI Responses**: Ensure they align with your brand voice

## Troubleshooting

**AI agents not using company knowledge?**
- Verify "AI Spokesperson Mode" is enabled in your company profile
- Check that knowledge sources have completed processing
- Ensure you've run Deep Research at least once

**Website crawl failed?**
- Verify the URL is publicly accessible
- Try again - some sites may have rate limiting
- Check that the URL is valid and returns HTML content

**Deep Research taking too long?**
- This uses OpenAI's advanced model (GPT-4)
- Can take 30-60 seconds depending on data volume
- Wait for completion - results are comprehensive

## Technical Details

- **Embeddings Model**: OpenAI text-embedding-3-small (1536 dimensions)
- **Deep Research Model**: GPT-4
- **Agent Models**: GPT-4o-mini (fast and cost-effective)
- **Semantic Search**: pgvector with cosine similarity
- **Chunk Size**: 1000 characters with 200 character overlap
