/**
 * Enrichment Workflow View
 * Complete UI for the Salesforce → ZoomInfo → HubSpot → LinkedIn → AI Outreach workflow
 */

import React, { useState, useEffect } from 'react';
import {
  Database,
  Linkedin,
  Mail,
  Search,
  Sparkles,
  Check,
  Clock,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  Copy,
  Send,
  Building,
  User,
  Target,
  TrendingUp,
  Zap,
  FileText,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

// Types
interface ProspectSignals {
  contact: {
    email: string;
    emailVerified: boolean;
    phone?: string;
    linkedinUrl?: string;
  };
  professional: {
    title: string;
    headline?: string;
    department?: string;
    seniority?: string;
    skills?: string[];
  };
  company: {
    name: string;
    industry?: string;
    employeeCount?: number;
    technologies?: string[];
  };
  intent: {
    signals: Array<{ type: string; description: string; confidence: number }>;
    score: number;
    buyingStage?: string;
  };
  research: {
    companyNews?: Array<{ title: string; date: string }>;
    painPoints?: string[];
  };
  metadata: {
    sources: string[];
    qualityScore: number;
    completeness: number;
  };
}

interface TalkingPoint {
  type: string;
  content: string;
  signal: string;
  confidence: number;
  priority: number;
}

interface GeneratedEmail {
  subject: string;
  body: string;
  previewText: string;
  alternativeSubjects: string[];
  signalsUsed: string[];
  metadata?: {
    optimized?: boolean;
    optimizationChanges?: string[];
    expectedImprovements?: string[];
  };
}

interface BuyerPersona {
  archetype: string;
  communicationStyle: string;
  buyingRole: string;
  riskTolerance: string;
  primaryMotivations: string[];
  expectedObjections: string[];
  valueDrivers: string[];
}

interface AdvancedPersonalization {
  persona: BuyerPersona;
  competitiveContext: {
    currentSolutions: string[];
    likelyPainWithCurrent: string[];
    differentiators: string[];
  };
  triggerAnalysis: {
    trigger: string;
    urgencyLevel: string;
    recommendedAngle: string;
  } | null;
  strategy: {
    primaryAngle: string;
    emotionalAppeal: string;
    ctaStyle: string;
  };
  emailVariants: Array<{
    variant: string;
    angle: string;
    body: string;
    strengths: string[];
  }>;
  personalizationDepth: number;
  confidenceScore: number;
  reasoningChain: string[];
}

interface IndustryMessaging {
  industryRelevantOpener: string;
  industryPainPoint: string;
  industryValueProp: string;
  industryTermsUsed: string[];
  industryTrend: string;
}

interface PipelineStep {
  id: string;
  name: string;
  icon: React.ReactNode;
  status: 'pending' | 'running' | 'completed' | 'failed';
  duration?: number;
  dataPoints?: number;
}

const EnrichmentWorkflowView: React.FC = () => {
  // State
  const [selectedProspect, setSelectedProspect] = useState<string | null>(null);
  const [prospects, setProspects] = useState<any[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [signals, setSignals] = useState<ProspectSignals | null>(null);
  const [talkingPoints, setTalkingPoints] = useState<TalkingPoint[]>([]);
  const [generatedEmail, setGeneratedEmail] = useState<GeneratedEmail | null>(null);
  const [showEmailEditor, setShowEmailEditor] = useState(false);
  const [emailType, setEmailType] = useState<'cold_outreach' | 'follow_up' | 'trigger_based'>('cold_outreach');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    signals: true,
    talkingPoints: true,
    email: true,
    persona: true,
    industry: false,
    variants: false,
  });

  // Advanced AI features state
  const [enableAdvancedMode, setEnableAdvancedMode] = useState(false);
  const [advancedPersonalization, setAdvancedPersonalization] = useState<AdvancedPersonalization | null>(null);
  const [industryMessaging, setIndustryMessaging] = useState<IndustryMessaging | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  // Helper function to get auth token
  const getAuthToken = (): string | null => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      setError('Authentication required. Please log in.');
      return null;
    }
    return token;
  };

  // Base pipeline steps
  const basePipelineSteps: PipelineStep[] = [
    { id: 'salesforce', name: 'Salesforce', icon: <Database className="h-4 w-4" />, status: 'pending' },
    { id: 'zoominfo', name: 'ZoomInfo', icon: <Target className="h-4 w-4" />, status: 'pending' },
    { id: 'hubspot', name: 'HubSpot', icon: <Building className="h-4 w-4" />, status: 'pending' },
    { id: 'linkedin', name: 'LinkedIn', icon: <Linkedin className="h-4 w-4" />, status: 'pending' },
    { id: 'research', name: 'Deep Research', icon: <Search className="h-4 w-4" />, status: 'pending' },
    { id: 'ai', name: 'AI Compose', icon: <Sparkles className="h-4 w-4" />, status: 'pending' },
  ];

  // Advanced pipeline steps (added when advanced mode is on)
  const advancedPipelineSteps: PipelineStep[] = [
    ...basePipelineSteps.slice(0, 5),
    { id: 'persona', name: 'Buyer Persona', icon: <User className="h-4 w-4" />, status: 'pending' },
    { id: 'industry', name: 'Industry Intel', icon: <Building className="h-4 w-4" />, status: 'pending' },
    { id: 'ai', name: 'AI Compose', icon: <Sparkles className="h-4 w-4" />, status: 'pending' },
    { id: 'optimize', name: 'Optimize', icon: <TrendingUp className="h-4 w-4" />, status: 'pending' },
  ];

  const [pipelineSteps, setPipelineSteps] = useState<PipelineStep[]>(basePipelineSteps);

  // Update pipeline steps when advanced mode changes
  useEffect(() => {
    setPipelineSteps(enableAdvancedMode ? advancedPipelineSteps : basePipelineSteps);
  }, [enableAdvancedMode]);

  // Load prospects
  useEffect(() => {
    loadProspects();
  }, []);

  const loadProspects = async () => {
    const token = getAuthToken();
    if (!token) return;

    try {
      const response = await fetch('/api/v1/prospects?limit=20', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        setProspects(data.data || []);
        setError(null);
      } else {
        setError(data.error || 'Failed to load prospects');
      }
    } catch (err) {
      console.error('Failed to load prospects:', err);
      setError('Failed to load prospects. Please try again.');
    }
  };

  const runPipeline = async () => {
    if (!selectedProspect) return;

    const token = getAuthToken();
    if (!token) return;

    setIsRunning(true);
    setCurrentStep(0);
    setSignals(null);
    setTalkingPoints([]);
    setGeneratedEmail(null);
    setAdvancedPersonalization(null);
    setIndustryMessaging(null);
    setSelectedVariant(0);
    setError(null);

    // Reset steps
    const currentSteps = enableAdvancedMode ? advancedPipelineSteps : basePipelineSteps;
    setPipelineSteps(currentSteps.map(s => ({ ...s, status: 'pending' as const })));

    try {
      // Simulate step-by-step progress for better UX
      for (let i = 0; i < currentSteps.length; i++) {
        setCurrentStep(i);
        setPipelineSteps(steps =>
          steps.map((s, idx) => ({
            ...s,
            status: idx === i ? 'running' : idx < i ? 'completed' : 'pending',
          }))
        );

        // Small delay for visual feedback
        await new Promise(resolve => setTimeout(resolve, 400));
      }

      // Choose endpoint based on mode
      const endpoint = enableAdvancedMode ? '/api/v1/pipeline/run-advanced' : '/api/v1/pipeline/run';

      // Run actual pipeline
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          prospectId: selectedProspect,
          ...(enableAdvancedMode ? {
            productContext: {
              productName: 'AI Revenue Orchestrator',
              valueProps: ['Automate sales workflows', 'AI-powered personalization', 'Multi-source enrichment'],
              targetPersonas: ['VP Sales', 'Revenue Operations', 'Sales Managers'],
              competitors: ['Outreach', 'Salesloft', 'Apollo'],
            },
          } : {
            options: {
              enableDeepResearch: true,
              enableAIEnhancement: true,
              emailType,
            },
          }),
        }),
      });

      const result = await response.json();

      if (result.success) {
        // Update steps with actual results
        setPipelineSteps(steps =>
          steps.map(s => {
            const stepResult = result.data.steps?.find((r: any) => r.step.includes(s.id));
            return {
              ...s,
              status: stepResult?.status === 'completed' ? 'completed' : stepResult?.status === 'failed' ? 'failed' : 'completed',
              duration: stepResult?.duration,
              dataPoints: stepResult?.data?.dataPoints,
            };
          })
        );

        // Get signals from enriched prospect
        const signalsResponse = await fetch(`/api/v1/pipeline/status/${selectedProspect}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        const signalsResult = await signalsResponse.json();
        if (signalsResult.success && signalsResult.data.signals) {
          setSignals(signalsResult.data.signals);
        }

        // Get talking points
        const talkingPointsResponse = await fetch('/api/v1/pipeline/get-talking-points', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ prospectId: selectedProspect }),
        });
        const talkingPointsResult = await talkingPointsResponse.json();
        if (talkingPointsResult.success) {
          const allPoints = [
            ...(talkingPointsResult.data.openers || []),
            ...(talkingPointsResult.data.painPoints || []),
            ...(talkingPointsResult.data.valueProps || []),
            ...(talkingPointsResult.data.triggers || []),
          ];
          setTalkingPoints(allPoints);
        }

        // Set generated email
        if (result.data.generatedEmail) {
          setGeneratedEmail(result.data.generatedEmail);
        }

        // Set advanced personalization data (if advanced mode)
        if (result.data.advancedPersonalization) {
          setAdvancedPersonalization(result.data.advancedPersonalization);
        }

        // Set industry messaging (if available)
        if (result.data.industryMessaging) {
          setIndustryMessaging(result.data.industryMessaging);
        }
      }
    } catch (err) {
      console.error('Pipeline failed:', err);
      setError(err instanceof Error ? err.message : 'Pipeline execution failed. Please try again.');
      setPipelineSteps(steps =>
        steps.map(s => ({ ...s, status: s.status === 'running' ? 'failed' : s.status }))
      );
    } finally {
      setIsRunning(false);
    }
  };

  const regenerateEmail = async () => {
    if (!selectedProspect) return;

    const token = getAuthToken();
    if (!token) return;

    try {
      const response = await fetch('/api/v1/pipeline/generate-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          prospectId: selectedProspect,
          emailType,
        }),
      });

      const result = await response.json();
      if (result.success) {
        setGeneratedEmail(result.data);
        setError(null);
      } else {
        setError(result.error || 'Failed to regenerate email');
      }
    } catch (error) {
      console.error('Email regeneration failed:', error);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <Check className="h-4 w-4 text-green-500" />;
      case 'running':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-600 bg-green-100';
    if (confidence >= 60) return 'text-yellow-600 bg-yellow-100';
    return 'text-gray-600 bg-gray-100';
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          AI-Powered Enrichment Workflow
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Salesforce → ZoomInfo → HubSpot → LinkedIn → Deep Research → AI Outreach
        </p>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-500 hover:text-red-700 dark:hover:text-red-300"
          >
            &times;
          </button>
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left Column - Prospect Selection */}
        <div className="col-span-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <User className="h-5 w-5" />
              Select Prospect
            </h2>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {prospects.map(prospect => (
                <button
                  key={prospect.id}
                  onClick={() => setSelectedProspect(prospect.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedProspect === prospect.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <div className="font-medium text-gray-900 dark:text-white">
                    {prospect.first_name} {prospect.last_name}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {prospect.title} at {prospect.company}
                  </div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {prospect.email}
                  </div>
                </button>
              ))}
            </div>

            {/* Email Type Selection */}
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email Type
              </label>
              <select
                value={emailType}
                onChange={(e) => setEmailType(e.target.value as any)}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="cold_outreach">Cold Outreach</option>
                <option value="follow_up">Follow Up</option>
                <option value="trigger_based">Trigger Based</option>
              </select>
            </div>

            {/* Advanced AI Mode Toggle */}
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Advanced AI Mode
                  </span>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Buyer persona, industry insights, A/B variants
                  </p>
                </div>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={enableAdvancedMode}
                    onChange={(e) => setEnableAdvancedMode(e.target.checked)}
                    className="sr-only"
                  />
                  <div
                    className={`w-10 h-6 rounded-full transition-colors ${
                      enableAdvancedMode ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                    onClick={() => setEnableAdvancedMode(!enableAdvancedMode)}
                  >
                    <div
                      className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform mt-1 ${
                        enableAdvancedMode ? 'translate-x-5' : 'translate-x-1'
                      }`}
                    />
                  </div>
                </div>
              </label>
              {enableAdvancedMode && (
                <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-xs text-blue-700 dark:text-blue-300">
                  <Sparkles className="h-3 w-3 inline mr-1" />
                  Multi-step AI reasoning enabled with buyer persona analysis, competitive context, and email optimization.
                </div>
              )}
            </div>

            {/* Run Button */}
            <button
              onClick={runPipeline}
              disabled={!selectedProspect || isRunning}
              className={`w-full mt-4 py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors ${
                !selectedProspect || isRunning
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {isRunning ? (
                <>
                  <RefreshCw className="h-5 w-5 animate-spin" />
                  Running Pipeline...
                </>
              ) : (
                <>
                  <Zap className="h-5 w-5" />
                  Run Enrichment Pipeline
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column - Pipeline & Results */}
        <div className="col-span-8 space-y-6">
          {/* Pipeline Steps */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-4">
              Pipeline Progress
            </h2>

            <div className="flex items-center justify-between">
              {pipelineSteps.map((step, idx) => (
                <React.Fragment key={step.id}>
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-colors ${
                        step.status === 'completed'
                          ? 'bg-green-100 border-green-500'
                          : step.status === 'running'
                          ? 'bg-blue-100 border-blue-500'
                          : step.status === 'failed'
                          ? 'bg-red-100 border-red-500'
                          : 'bg-gray-100 border-gray-300 dark:bg-gray-700 dark:border-gray-600'
                      }`}
                    >
                      {step.status === 'running' ? (
                        <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />
                      ) : step.status === 'completed' ? (
                        <Check className="h-5 w-5 text-green-500" />
                      ) : step.status === 'failed' ? (
                        <AlertCircle className="h-5 w-5 text-red-500" />
                      ) : (
                        <span className="text-gray-400">{step.icon}</span>
                      )}
                    </div>
                    <span className="text-xs mt-2 text-gray-600 dark:text-gray-400 text-center">
                      {step.name}
                    </span>
                    {step.dataPoints && (
                      <span className="text-xs text-green-600">+{step.dataPoints} pts</span>
                    )}
                  </div>
                  {idx < pipelineSteps.length - 1 && (
                    <ArrowRight className="h-4 w-4 text-gray-400 flex-shrink-0 mx-2" />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Signals Panel */}
          {signals && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
              <button
                onClick={() => toggleSection('signals')}
                className="w-full p-4 flex items-center justify-between text-left"
              >
                <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Enriched Signals
                  <span className="text-sm font-normal text-gray-500">
                    ({signals.metadata.sources.length} sources, {signals.metadata.qualityScore}% quality)
                  </span>
                </h2>
                {expandedSections.signals ? (
                  <ChevronDown className="h-5 w-5 text-gray-400" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-gray-400" />
                )}
              </button>

              {expandedSections.signals && (
                <div className="p-4 pt-0 grid grid-cols-3 gap-4">
                  {/* Contact Info */}
                  <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <h3 className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">
                      Contact
                    </h3>
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-2">
                        <Mail className="h-3 w-3 text-gray-400" />
                        <span className="text-gray-900 dark:text-white">{signals.contact.email}</span>
                        {signals.contact.emailVerified && (
                          <Check className="h-3 w-3 text-green-500" />
                        )}
                      </div>
                      {signals.contact.phone && (
                        <div className="text-gray-600 dark:text-gray-400">{signals.contact.phone}</div>
                      )}
                      {signals.contact.linkedinUrl && (
                        <div className="flex items-center gap-1 text-blue-600">
                          <Linkedin className="h-3 w-3" />
                          LinkedIn
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Professional Info */}
                  <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <h3 className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">
                      Professional
                    </h3>
                    <div className="space-y-1 text-sm">
                      <div className="text-gray-900 dark:text-white font-medium">
                        {signals.professional.title}
                      </div>
                      {signals.professional.department && (
                        <div className="text-gray-600 dark:text-gray-400">
                          {signals.professional.department}
                        </div>
                      )}
                      {signals.professional.seniority && (
                        <div className="text-gray-600 dark:text-gray-400">
                          {signals.professional.seniority}
                        </div>
                      )}
                      {signals.professional.skills && signals.professional.skills.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {signals.professional.skills.slice(0, 3).map((skill, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Company Info */}
                  <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <h3 className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">
                      Company
                    </h3>
                    <div className="space-y-1 text-sm">
                      <div className="text-gray-900 dark:text-white font-medium">
                        {signals.company.name}
                      </div>
                      {signals.company.industry && (
                        <div className="text-gray-600 dark:text-gray-400">
                          {signals.company.industry}
                        </div>
                      )}
                      {signals.company.employeeCount && (
                        <div className="text-gray-600 dark:text-gray-400">
                          {signals.company.employeeCount.toLocaleString()} employees
                        </div>
                      )}
                      {signals.company.technologies && signals.company.technologies.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {signals.company.technologies.slice(0, 3).map((tech, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs"
                            >
                              {tech}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Intent Signals */}
                  {signals.intent.signals.length > 0 && (
                    <div className="col-span-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                      <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-300 mb-2 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        Intent Signals (Score: {signals.intent.score}/100)
                      </h3>
                      <div className="grid grid-cols-2 gap-2">
                        {signals.intent.signals.slice(0, 4).map((signal, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                          >
                            <span
                              className={`px-2 py-0.5 rounded text-xs ${getConfidenceColor(
                                signal.confidence
                              )}`}
                            >
                              {signal.confidence}%
                            </span>
                            <span>{signal.description}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Talking Points Panel */}
          {talkingPoints.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
              <button
                onClick={() => toggleSection('talkingPoints')}
                className="w-full p-4 flex items-center justify-between text-left"
              >
                <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Talking Points
                  <span className="text-sm font-normal text-gray-500">
                    ({talkingPoints.length} points)
                  </span>
                </h2>
                {expandedSections.talkingPoints ? (
                  <ChevronDown className="h-5 w-5 text-gray-400" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-gray-400" />
                )}
              </button>

              {expandedSections.talkingPoints && (
                <div className="p-4 pt-0 space-y-3">
                  {talkingPoints.slice(0, 8).map((point, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded"
                    >
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          point.type === 'opener'
                            ? 'bg-green-100 text-green-700'
                            : point.type === 'pain_point'
                            ? 'bg-red-100 text-red-700'
                            : point.type === 'value_prop'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {point.type.replace('_', ' ')}
                      </span>
                      <div className="flex-1">
                        <p className="text-sm text-gray-900 dark:text-white">{point.content}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Source: {point.signal} | Confidence: {point.confidence}%
                        </p>
                      </div>
                      <button
                        onClick={() => copyToClipboard(point.content)}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                      >
                        <Copy className="h-4 w-4 text-gray-400" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Generated Email Panel */}
          {generatedEmail && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
              <button
                onClick={() => toggleSection('email')}
                className="w-full p-4 flex items-center justify-between text-left"
              >
                <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Generated Email
                  <span className="text-sm font-normal text-green-600">
                    Ready to send
                  </span>
                </h2>
                {expandedSections.email ? (
                  <ChevronDown className="h-5 w-5 text-gray-400" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-gray-400" />
                )}
              </button>

              {expandedSections.email && (
                <div className="p-4 pt-0">
                  {/* Subject Line */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Subject Line
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={generatedEmail.subject}
                        readOnly
                        className="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                      <button
                        onClick={() => copyToClipboard(generatedEmail.subject)}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                      >
                        <Copy className="h-4 w-4 text-gray-400" />
                      </button>
                    </div>
                    {generatedEmail.alternativeSubjects.length > 0 && (
                      <div className="mt-2">
                        <span className="text-xs text-gray-500">Alternatives: </span>
                        {generatedEmail.alternativeSubjects.map((alt, i) => (
                          <button
                            key={i}
                            onClick={() => copyToClipboard(alt)}
                            className="text-xs text-blue-600 hover:underline mr-2"
                          >
                            {alt}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Email Body */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Email Body
                    </label>
                    <div className="relative">
                      <textarea
                        value={generatedEmail.body}
                        readOnly
                        rows={10}
                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm"
                      />
                      <button
                        onClick={() => copyToClipboard(generatedEmail.body)}
                        className="absolute top-2 right-2 p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                      >
                        <Copy className="h-4 w-4 text-gray-400" />
                      </button>
                    </div>
                  </div>

                  {/* Signals Used */}
                  {generatedEmail.signalsUsed.length > 0 && (
                    <div className="mb-4">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Signals used:{' '}
                      </span>
                      {generatedEmail.signalsUsed.map((signal, i) => (
                        <span
                          key={i}
                          className="inline-block px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs mr-1"
                        >
                          {signal.replace('_', ' ')}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={regenerateEmail}
                      className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Regenerate
                    </button>
                    <button
                      onClick={() => {
                        copyToClipboard(`Subject: ${generatedEmail.subject}\n\n${generatedEmail.body}`);
                      }}
                      className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                    >
                      <Copy className="h-4 w-4" />
                      Copy All
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                      <Send className="h-4 w-4" />
                      Send Email
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Advanced Personalization Panels */}
          {advancedPersonalization && (
            <>
              {/* Buyer Persona Panel */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                <button
                  onClick={() => toggleSection('persona')}
                  className="w-full p-4 flex items-center justify-between text-left"
                >
                  <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Buyer Persona Analysis
                    <span className="text-sm font-normal text-purple-600">
                      {advancedPersonalization.persona.archetype}
                    </span>
                  </h2>
                  {expandedSections.persona ? (
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  )}
                </button>

                {expandedSections.persona && (
                  <div className="p-4 pt-0">
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      {/* Communication Style */}
                      <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                        <h4 className="text-xs font-medium text-purple-600 dark:text-purple-400 uppercase mb-1">
                          Communication Style
                        </h4>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white capitalize">
                          {advancedPersonalization.persona.communicationStyle}
                        </p>
                      </div>

                      {/* Buying Role */}
                      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <h4 className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase mb-1">
                          Buying Role
                        </h4>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white capitalize">
                          {advancedPersonalization.persona.buyingRole.replace('_', ' ')}
                        </p>
                      </div>

                      {/* Risk Tolerance */}
                      <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <h4 className="text-xs font-medium text-green-600 dark:text-green-400 uppercase mb-1">
                          Risk Tolerance
                        </h4>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white capitalize">
                          {advancedPersonalization.persona.riskTolerance}
                        </p>
                      </div>
                    </div>

                    {/* Motivations & Objections */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">
                          Primary Motivations
                        </h4>
                        <div className="space-y-1">
                          {advancedPersonalization.persona.primaryMotivations.slice(0, 4).map((m, i) => (
                            <div key={i} className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2">
                              <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                              {m}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">
                          Expected Objections
                        </h4>
                        <div className="space-y-1">
                          {advancedPersonalization.persona.expectedObjections.slice(0, 4).map((o, i) => (
                            <div key={i} className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2">
                              <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                              {o}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Strategy Summary */}
                    <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">
                        Recommended Strategy
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                          Angle: {advancedPersonalization.strategy.primaryAngle}
                        </span>
                        <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
                          Appeal: {advancedPersonalization.strategy.emotionalAppeal}
                        </span>
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                          CTA: {advancedPersonalization.strategy.ctaStyle}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Email Variants Panel */}
              {advancedPersonalization.emailVariants && advancedPersonalization.emailVariants.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                  <button
                    onClick={() => toggleSection('variants')}
                    className="w-full p-4 flex items-center justify-between text-left"
                  >
                    <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      A/B Email Variants
                      <span className="text-sm font-normal text-gray-500">
                        ({advancedPersonalization.emailVariants.length} variants)
                      </span>
                    </h2>
                    {expandedSections.variants ? (
                      <ChevronDown className="h-5 w-5 text-gray-400" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-gray-400" />
                    )}
                  </button>

                  {expandedSections.variants && (
                    <div className="p-4 pt-0">
                      {/* Variant Selector */}
                      <div className="flex gap-2 mb-4">
                        {advancedPersonalization.emailVariants.map((variant, idx) => (
                          <button
                            key={idx}
                            onClick={() => setSelectedVariant(idx)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                              selectedVariant === idx
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                            }`}
                          >
                            {variant.variant.replace('-', ' ')}
                          </button>
                        ))}
                      </div>

                      {/* Selected Variant - with bounds check */}
                      {advancedPersonalization.emailVariants[selectedVariant] ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                            {advancedPersonalization.emailVariants[selectedVariant].angle}
                          </span>
                          {advancedPersonalization.emailVariants[selectedVariant].strengths?.slice(0, 2).map((s, i) => (
                            <span key={i} className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                              {s}
                            </span>
                          ))}
                        </div>

                        <textarea
                          value={advancedPersonalization.emailVariants[selectedVariant].body}
                          readOnly
                          rows={8}
                          className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                        />

                        <button
                          onClick={() => copyToClipboard(advancedPersonalization.emailVariants[selectedVariant].body)}
                          className="flex items-center gap-2 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm"
                        >
                          <Copy className="h-4 w-4" />
                          Copy Variant
                        </button>
                      </div>
                      ) : (
                        <div className="text-sm text-gray-500">Select a variant to view</div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* AI Reasoning Chain */}
              {advancedPersonalization.reasoningChain && advancedPersonalization.reasoningChain.length > 0 && (
                <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-purple-500" />
                    AI Reasoning Chain
                  </h3>
                  <div className="space-y-1">
                    {advancedPersonalization.reasoningChain.map((step, i) => (
                      <div key={i} className="text-xs text-gray-600 dark:text-gray-400 flex items-start gap-2">
                        <span className="text-purple-500 font-mono">{i + 1}.</span>
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex gap-4 text-xs">
                    <span className="text-gray-600 dark:text-gray-400">
                      Personalization Depth: <span className="font-semibold text-purple-600">{advancedPersonalization.personalizationDepth}%</span>
                    </span>
                    <span className="text-gray-600 dark:text-gray-400">
                      Confidence: <span className="font-semibold text-blue-600">{advancedPersonalization.confidenceScore}%</span>
                    </span>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Industry Messaging Panel */}
          {industryMessaging && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
              <button
                onClick={() => toggleSection('industry')}
                className="w-full p-4 flex items-center justify-between text-left"
              >
                <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  Industry-Specific Messaging
                </h2>
                {expandedSections.industry ? (
                  <ChevronDown className="h-5 w-5 text-gray-400" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-gray-400" />
                )}
              </button>

              {expandedSections.industry && (
                <div className="p-4 pt-0 space-y-3">
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <h4 className="text-xs font-medium text-blue-600 uppercase mb-1">Industry Opener</h4>
                    <p className="text-sm text-gray-900 dark:text-white">{industryMessaging.industryRelevantOpener}</p>
                  </div>

                  <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <h4 className="text-xs font-medium text-red-600 uppercase mb-1">Industry Pain Point</h4>
                    <p className="text-sm text-gray-900 dark:text-white">{industryMessaging.industryPainPoint}</p>
                  </div>

                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <h4 className="text-xs font-medium text-green-600 uppercase mb-1">Industry Value Prop</h4>
                    <p className="text-sm text-gray-900 dark:text-white">{industryMessaging.industryValueProp}</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs text-gray-500">Industry Terms:</span>
                    {industryMessaging.industryTermsUsed.map((term, i) => (
                      <span key={i} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs">
                        {term}
                      </span>
                    ))}
                  </div>

                  <div className="text-xs text-gray-500">
                    <span className="font-medium">Current Trend:</span> {industryMessaging.industryTrend}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EnrichmentWorkflowView;
