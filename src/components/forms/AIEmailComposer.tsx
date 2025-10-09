import { useState } from 'react';
import Modal from '../common/Modal';
import { Sparkles, RefreshCw, Copy, Check } from 'lucide-react';
import { generateEmailContent } from '../../lib/openai';

interface AIEmailComposerProps {
  isOpen: boolean;
  onClose: () => void;
  prospectName: string;
  prospectTitle?: string;
  prospectCompany?: string;
  onUseEmail?: (subject: string, body: string) => void;
}

export default function AIEmailComposer({
  isOpen,
  onClose,
  prospectName,
  prospectTitle,
  prospectCompany,
  onUseEmail,
}: AIEmailComposerProps) {
  const [emailPurpose, setEmailPurpose] = useState('');
  const [keyPoints, setKeyPoints] = useState('');
  const [tone, setTone] = useState<'professional' | 'casual' | 'friendly'>('professional');
  const [generatedSubject, setGeneratedSubject] = useState('');
  const [generatedBody, setGeneratedBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (!emailPurpose.trim()) {
      setError('Please describe the email purpose');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const keyPointsArray = keyPoints
        .split('\n')
        .map((p) => p.trim())
        .filter((p) => p.length > 0);

      const defaultTeamId = '00000000-0000-0000-0000-000000000001';

      const result = await generateEmailContent({
        prospectName,
        prospectTitle,
        prospectCompany,
        emailPurpose,
        keyPoints: keyPointsArray,
        tone,
        teamId: defaultTeamId,
      });

      setGeneratedSubject(result.subject);
      setGeneratedBody(result.body);
    } catch (err: any) {
      setError(err.message || 'Failed to generate email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    const fullEmail = `Subject: ${generatedSubject}\n\n${generatedBody}`;
    navigator.clipboard.writeText(fullEmail);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUse = () => {
    if (onUseEmail) {
      onUseEmail(generatedSubject, generatedBody);
    }
    onClose();
  };

  const handleClose = () => {
    setEmailPurpose('');
    setKeyPoints('');
    setGeneratedSubject('');
    setGeneratedBody('');
    setError('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="AI Email Composer">
      <div className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <Sparkles className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-blue-900">
                Composing for: {prospectName}
              </p>
              {(prospectTitle || prospectCompany) && (
                <p className="text-xs text-blue-700 mt-1">
                  {prospectTitle && <span>{prospectTitle}</span>}
                  {prospectTitle && prospectCompany && <span> at </span>}
                  {prospectCompany && <span>{prospectCompany}</span>}
                </p>
              )}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Email Purpose *
          </label>
          <textarea
            value={emailPurpose}
            onChange={(e) => setEmailPurpose(e.target.value)}
            placeholder="e.g., Initial outreach to introduce our sales automation platform and schedule a demo"
            rows={3}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Key Points to Include (Optional)
          </label>
          <textarea
            value={keyPoints}
            onChange={(e) => setKeyPoints(e.target.value)}
            placeholder="One point per line&#10;e.g., Noticed their company recently raised Series B&#10;We helped similar companies increase pipeline by 40%&#10;Low-friction 15-minute demo"
            rows={4}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Tone
          </label>
          <div className="flex space-x-2">
            {(['professional', 'casual', 'friendly'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTone(t)}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition ${
                  tone === t
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {!generatedSubject ? (
          <button
            onClick={handleGenerate}
            disabled={loading || !emailPurpose.trim()}
            className="w-full flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Generating...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                <span>Generate Email</span>
              </>
            )}
          </button>
        ) : (
          <div className="space-y-4">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <div className="mb-3">
                <label className="text-xs font-medium text-slate-600 uppercase tracking-wide">
                  Subject
                </label>
                <p className="text-sm text-slate-900 mt-1 font-medium">
                  {generatedSubject}
                </p>
              </div>
              <div className="border-t border-slate-200 pt-3">
                <label className="text-xs font-medium text-slate-600 uppercase tracking-wide">
                  Body
                </label>
                <p className="text-sm text-slate-900 mt-2 whitespace-pre-wrap leading-relaxed">
                  {generatedBody}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="flex items-center space-x-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition disabled:opacity-50"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Regenerate</span>
              </button>
              <button
                onClick={handleCopy}
                className="flex items-center space-x-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-green-600" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy</span>
                  </>
                )}
              </button>
              {onUseEmail && (
                <button
                  onClick={handleUse}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
                >
                  Use This Email
                </button>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
