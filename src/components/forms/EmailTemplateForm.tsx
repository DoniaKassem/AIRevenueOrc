import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import Modal from '../common/Modal';
import { Code, Sparkles } from 'lucide-react';
import { generateEmailContent } from '../../lib/openai';

interface EmailTemplateFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const DEFAULT_TEAM_ID = '00000000-0000-0000-0000-000000000001';

const AVAILABLE_VARIABLES = [
  { name: '{{first_name}}', description: 'Prospect first name' },
  { name: '{{last_name}}', description: 'Prospect last name' },
  { name: '{{company}}', description: 'Company name' },
  { name: '{{title}}', description: 'Job title' },
  { name: '{{email}}', description: 'Email address' },
];

export default function EmailTemplateForm({
  isOpen,
  onClose,
  onSuccess,
}: EmailTemplateFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    body: '',
    is_active: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [showAiHelper, setShowAiHelper] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) return;

    setAiLoading(true);
    setError('');

    try {
      const result = await generateEmailContent({
        prospectName: '{{first_name}}',
        emailPurpose: aiPrompt,
        tone: 'professional',
      });

      setFormData({
        ...formData,
        subject: result.subject,
        body: result.body,
      });
      setShowAiHelper(false);
      setAiPrompt('');
    } catch (err: any) {
      setError(err.message || 'Failed to generate email');
    } finally {
      setAiLoading(false);
    }
  };

  const insertVariable = (variable: string, field: 'subject' | 'body') => {
    const textarea = document.getElementById(field) as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = formData[field];
      const before = text.substring(0, start);
      const after = text.substring(end);
      const newText = before + variable + after;

      setFormData({ ...formData, [field]: newText });

      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(
          start + variable.length,
          start + variable.length
        );
      }, 0);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { error: insertError } = await supabase
        .from('email_templates')
        .insert({
          ...formData,
          team_id: DEFAULT_TEAM_ID,
        });

      if (insertError) throw insertError;

      setFormData({
        name: '',
        subject: '',
        body: '',
        is_active: true,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create template');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Email Template">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3">
              <Sparkles className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  AI Email Assistant
                </h3>
                <p className="text-xs text-slate-600 mt-1">
                  Let AI write your email template for you
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowAiHelper(!showAiHelper)}
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              {showAiHelper ? 'Hide' : 'Show'}
            </button>
          </div>

          {showAiHelper && (
            <div className="mt-4 space-y-3">
              <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Describe the email you want... e.g., 'Write a follow-up email after a demo asking about next steps'"
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
              <button
                type="button"
                onClick={handleAiGenerate}
                disabled={aiLoading || !aiPrompt.trim()}
                className="w-full flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition disabled:opacity-50"
              >
                {aiLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Generate with AI</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Template Name *
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            placeholder="e.g., Initial Outreach"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-slate-700">
              Subject Line *
            </label>
            <div className="flex items-center space-x-1">
              {AVAILABLE_VARIABLES.slice(0, 3).map((v) => (
                <button
                  key={v.name}
                  type="button"
                  onClick={() => insertVariable(v.name, 'subject')}
                  className="text-xs px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 transition"
                  title={v.description}
                >
                  {v.name}
                </button>
              ))}
            </div>
          </div>
          <input
            id="subject"
            type="text"
            value={formData.subject}
            onChange={(e) =>
              setFormData({ ...formData, subject: e.target.value })
            }
            required
            placeholder="e.g., Quick question about {{company}}"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-slate-700">
              Email Body *
            </label>
          </div>
          <div className="mb-2 flex flex-wrap gap-1">
            {AVAILABLE_VARIABLES.map((v) => (
              <button
                key={v.name}
                type="button"
                onClick={() => insertVariable(v.name, 'body')}
                className="text-xs px-2 py-1 bg-blue-50 hover:bg-blue-100 rounded text-blue-700 transition"
                title={v.description}
              >
                {v.name}
              </button>
            ))}
          </div>
          <textarea
            id="body"
            value={formData.body}
            onChange={(e) => setFormData({ ...formData, body: e.target.value })}
            required
            rows={12}
            placeholder="Hi {{first_name}},&#10;&#10;I noticed that {{company}} is...&#10;&#10;Best regards"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
          />
          <p className="text-xs text-slate-500 mt-1">
            Use the variable buttons above to insert personalization tokens
          </p>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <Code className="w-4 h-4 text-slate-600" />
            <span className="text-sm font-medium text-slate-700">Preview</span>
          </div>
          <div className="text-sm text-slate-700 space-y-2">
            <p>
              <span className="font-medium">Subject:</span>{' '}
              {formData.subject || 'No subject'}
            </p>
            <div className="border-t border-slate-200 pt-2">
              <p className="whitespace-pre-wrap">
                {formData.body || 'No body content'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={formData.is_active}
            onChange={(e) =>
              setFormData({ ...formData, is_active: e.target.checked })
            }
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <label className="text-sm text-slate-700">Active template</label>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Template'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
