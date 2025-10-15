import { useState } from 'react';
import { Linkedin, MessageCircle, TrendingUp, Target, Copy, Check } from 'lucide-react';
import { SOCIAL_SELLING_PLAYBOOKS, generateLinkedInConnectionRequest, generateValueShareMessage, generateMeetingRequestMessage } from '../../lib/socialSellingPlaybook';

export default function SocialSellingView() {
  const [selectedPlaybook, setSelectedPlaybook] = useState(SOCIAL_SELLING_PLAYBOOKS[0]);
  const [firstName, setFirstName] = useState('Sarah');
  const [company, setCompany] = useState('TechCorp');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const connectionRequest = generateLinkedInConnectionRequest(firstName, company, 'we both follow AI trends');
  const valueShare = generateValueShareMessage(firstName, 'Technology', 'improving sales efficiency');
  const meetingRequest = generateMeetingRequestMessage(firstName, company, 'increase revenue by 30%');

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            Social Selling Playbooks
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Proven strategies for building relationships on LinkedIn
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {SOCIAL_SELLING_PLAYBOOKS.map((playbook, idx) => (
          <button
            key={idx}
            onClick={() => setSelectedPlaybook(playbook)}
            className={`text-left p-6 rounded-xl border-2 transition ${
              selectedPlaybook.name === playbook.name
                ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-blue-400'
            }`}
          >
            <div className="text-2xl mb-2">
              {idx === 0 ? '🤝' : idx === 1 ? '⚡' : '📚'}
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-white mb-2">
              {playbook.name}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
              {playbook.description}
            </p>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Target: {playbook.target_persona}
            </div>
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center">
          <Target className="w-5 h-5 mr-2" />
          Playbook Steps
        </h3>
        <div className="space-y-4">
          {selectedPlaybook.steps.map((step, idx) => (
            <div key={idx} className="border-l-4 border-blue-600 pl-6 py-3 bg-slate-50 dark:bg-slate-900/50 rounded-r">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-1">
                    <span className="flex items-center justify-center w-8 h-8 bg-blue-600 text-white rounded-full text-sm font-bold">
                      {step.step_number}
                    </span>
                    <h4 className="font-semibold text-slate-900 dark:text-white">
                      {step.action}
                    </h4>
                    <span className="px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs rounded capitalize">
                      {step.platform}
                    </span>
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                    ⏰ {step.timing}
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                {step.tips.map((tip, tipIdx) => (
                  <div key={tipIdx} className="flex items-start text-sm">
                    <span className="text-blue-600 dark:text-blue-400 mr-2">•</span>
                    <span className="text-slate-700 dark:text-slate-300">{tip}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <h4 className="font-semibold text-green-900 dark:text-green-300 mb-2 flex items-center">
            <TrendingUp className="w-4 h-4 mr-2" />
            Success Metrics
          </h4>
          <div className="space-y-1">
            {selectedPlaybook.success_metrics.map((metric, idx) => (
              <div key={idx} className="text-sm text-green-800 dark:text-green-400 flex items-start">
                <span className="mr-2">✓</span>
                <span>{metric}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center">
          <MessageCircle className="w-5 h-5 mr-2" />
          Message Templates
        </h3>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              First Name
            </label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Company
            </label>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
            />
          </div>
        </div>

        <div className="space-y-4">
          {[
            { title: 'Connection Request', message: connectionRequest, icon: '👋' },
            { title: 'Value Share Message', message: valueShare, icon: '💎' },
            { title: 'Meeting Request', message: meetingRequest, icon: '📅' },
          ].map((template, idx) => (
            <div key={idx} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-slate-900 dark:text-white flex items-center">
                  <span className="mr-2">{template.icon}</span>
                  {template.title}
                </h4>
                <button
                  onClick={() => copyToClipboard(template.message.message, idx)}
                  className="flex items-center space-x-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition"
                >
                  {copiedIndex === idx ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900/50 rounded p-3 mb-3">
                <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                  {template.message.message}
                </p>
              </div>
              <div className="flex items-start space-x-4 text-xs">
                <div className="flex-1">
                  <div className="text-slate-500 dark:text-slate-400 mb-1">⏰ Timing:</div>
                  <div className="text-slate-700 dark:text-slate-300">{template.message.timing}</div>
                </div>
              </div>
              <div className="mt-3 space-y-1">
                <div className="text-xs text-slate-500 dark:text-slate-400">Best Practices:</div>
                {template.message.best_practices.slice(0, 2).map((practice, pIdx) => (
                  <div key={pIdx} className="text-xs text-slate-600 dark:text-slate-400 flex items-start">
                    <span className="mr-1">•</span>
                    <span>{practice}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-6 text-white">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Linkedin className="w-5 h-5 mr-2" />
          LinkedIn Best Practices
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {[
            'Optimize profile with professional photo',
            'Post consistently (2-3x per week)',
            'Engage before sending requests',
            'Personalize every connection',
            'Wait 3-5 days before pitching',
            'Share value with no strings',
            'Comment thoughtfully on posts',
            'Use Sales Navigator for search',
            'Track all interactions in CRM',
            'Follow up within 24 hours',
          ].map((practice, idx) => (
            <div key={idx} className="flex items-start text-sm">
              <span className="mr-2">✓</span>
              <span className="opacity-90">{practice}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
