import Modal from '../common/Modal';
import { Brain, Target, MessageSquare, TrendingUp, Lightbulb } from 'lucide-react';

interface TrainingInsightsModalProps {
  isOpen: boolean;
  onClose: () => void;
  trainingData: any;
}

export default function TrainingInsightsModal({
  isOpen,
  onClose,
  trainingData,
}: TrainingInsightsModalProps) {
  if (!trainingData?.metrics) {
    return null;
  }

  const { overview, competitive_analysis, messaging_guidelines, sales_intelligence, agent_training_data, knowledge_gaps, recommendations } = trainingData.metrics;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Deep Research Insights">
      <div className="space-y-6 max-h-[600px] overflow-y-auto">
        {overview && (
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <div className="flex items-center space-x-2 mb-3">
              <Brain className="w-5 h-5 text-blue-600" />
              <h3 className="font-semibold text-slate-900">Company Overview</h3>
            </div>
            <p className="text-sm text-slate-700 mb-3">{overview.summary}</p>
            {overview.key_offerings && overview.key_offerings.length > 0 && (
              <div>
                <p className="text-sm font-medium text-slate-700 mb-2">Key Offerings:</p>
                <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
                  {overview.key_offerings.map((offering: string, idx: number) => (
                    <li key={idx}>{offering}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {competitive_analysis && (
          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <div className="flex items-center space-x-2 mb-3">
              <TrendingUp className="w-5 h-5 text-green-600" />
              <h3 className="font-semibold text-slate-900">Competitive Analysis</h3>
            </div>
            <p className="text-sm text-slate-700 mb-3">{competitive_analysis.market_position}</p>
            {competitive_analysis.differentiators && competitive_analysis.differentiators.length > 0 && (
              <div>
                <p className="text-sm font-medium text-slate-700 mb-2">Key Differentiators:</p>
                <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
                  {competitive_analysis.differentiators.map((diff: string, idx: number) => (
                    <li key={idx}>{diff}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {messaging_guidelines && (
          <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
            <div className="flex items-center space-x-2 mb-3">
              <MessageSquare className="w-5 h-5 text-purple-600" />
              <h3 className="font-semibold text-slate-900">Messaging Guidelines</h3>
            </div>
            {messaging_guidelines.brand_voice && (
              <div className="mb-3">
                <p className="text-sm font-medium text-slate-700 mb-1">Brand Voice:</p>
                <div className="flex space-x-4 text-sm text-slate-600">
                  <span>Tone: <strong>{messaging_guidelines.brand_voice.tone}</strong></span>
                  <span>Style: <strong>{messaging_guidelines.brand_voice.style}</strong></span>
                  <span>Formality: <strong>{messaging_guidelines.brand_voice.formality}</strong></span>
                </div>
              </div>
            )}
            {messaging_guidelines.key_messages && messaging_guidelines.key_messages.length > 0 && (
              <div className="mb-3">
                <p className="text-sm font-medium text-slate-700 mb-2">Key Messages:</p>
                <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
                  {messaging_guidelines.key_messages.map((msg: string, idx: number) => (
                    <li key={idx}>{msg}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              {messaging_guidelines.communication_dos && messaging_guidelines.communication_dos.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-green-700 mb-2">✓ DOs:</p>
                  <ul className="text-xs text-slate-600 space-y-1">
                    {messaging_guidelines.communication_dos.map((item: string, idx: number) => (
                      <li key={idx} className="flex items-start">
                        <span className="text-green-600 mr-1">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {messaging_guidelines.communication_donts && messaging_guidelines.communication_donts.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-red-700 mb-2">✗ DON'Ts:</p>
                  <ul className="text-xs text-slate-600 space-y-1">
                    {messaging_guidelines.communication_donts.map((item: string, idx: number) => (
                      <li key={idx} className="flex items-start">
                        <span className="text-red-600 mr-1">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {sales_intelligence && (
          <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
            <div className="flex items-center space-x-2 mb-3">
              <Target className="w-5 h-5 text-orange-600" />
              <h3 className="font-semibold text-slate-900">Sales Intelligence</h3>
            </div>
            {sales_intelligence.ideal_customer_traits && sales_intelligence.ideal_customer_traits.length > 0 && (
              <div className="mb-3">
                <p className="text-sm font-medium text-slate-700 mb-2">Ideal Customer Traits:</p>
                <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
                  {sales_intelligence.ideal_customer_traits.map((trait: string, idx: number) => (
                    <li key={idx}>{trait}</li>
                  ))}
                </ul>
              </div>
            )}
            {sales_intelligence.buying_signals && sales_intelligence.buying_signals.length > 0 && (
              <div className="mb-3">
                <p className="text-sm font-medium text-slate-700 mb-2">Buying Signals:</p>
                <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
                  {sales_intelligence.buying_signals.map((signal: string, idx: number) => (
                    <li key={idx}>{signal}</li>
                  ))}
                </ul>
              </div>
            )}
            {sales_intelligence.common_objections && sales_intelligence.common_objections.length > 0 && (
              <div>
                <p className="text-sm font-medium text-slate-700 mb-2">Common Objections & Responses:</p>
                <div className="space-y-2">
                  {sales_intelligence.common_objections.map((obj: any, idx: number) => (
                    <div key={idx} className="bg-white rounded p-2 text-sm">
                      <p className="font-medium text-slate-700">{obj.objection}</p>
                      <p className="text-slate-600 text-xs mt-1">{obj.response}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {agent_training_data && (
          <div className="bg-cyan-50 rounded-lg p-4 border border-cyan-200">
            <div className="flex items-center space-x-2 mb-3">
              <Brain className="w-5 h-5 text-cyan-600" />
              <h3 className="font-semibold text-slate-900">AI Agent Training Data</h3>
            </div>
            {agent_training_data.must_know_facts && agent_training_data.must_know_facts.length > 0 && (
              <div className="mb-3">
                <p className="text-sm font-medium text-slate-700 mb-2">Must-Know Facts:</p>
                <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
                  {agent_training_data.must_know_facts.map((fact: string, idx: number) => (
                    <li key={idx}>{fact}</li>
                  ))}
                </ul>
              </div>
            )}
            {agent_training_data.faq_responses && agent_training_data.faq_responses.length > 0 && (
              <div>
                <p className="text-sm font-medium text-slate-700 mb-2">FAQ Responses:</p>
                <div className="space-y-2">
                  {agent_training_data.faq_responses.map((faq: any, idx: number) => (
                    <div key={idx} className="bg-white rounded p-2 text-sm">
                      <p className="font-medium text-slate-700">{faq.question}</p>
                      <p className="text-slate-600 text-xs mt-1">{faq.answer}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {knowledge_gaps && knowledge_gaps.length > 0 && (
          <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
            <div className="flex items-center space-x-2 mb-3">
              <Lightbulb className="w-5 h-5 text-yellow-600" />
              <h3 className="font-semibold text-slate-900">Knowledge Gaps</h3>
            </div>
            <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
              {knowledge_gaps.map((gap: string, idx: number) => (
                <li key={idx}>{gap}</li>
              ))}
            </ul>
          </div>
        )}

        {recommendations && recommendations.length > 0 && (
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <div className="flex items-center space-x-2 mb-3">
              <Lightbulb className="w-5 h-5 text-slate-600" />
              <h3 className="font-semibold text-slate-900">Recommendations</h3>
            </div>
            <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
              {recommendations.map((rec: string, idx: number) => (
                <li key={idx}>{rec}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}
