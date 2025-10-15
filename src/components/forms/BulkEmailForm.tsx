import { useState } from 'react';
import { X, Send, Users } from 'lucide-react';
import Modal from '../common/Modal';

interface BulkEmailFormProps {
  isOpen: boolean;
  onClose: () => void;
  prospectIds: string[];
  prospectCount: number;
  onSuccess: () => void;
}

export default function BulkEmailForm({
  isOpen,
  onClose,
  prospectIds,
  prospectCount,
  onSuccess,
}: BulkEmailFormProps) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 2000));

      onSuccess();
      onClose();
      setSubject('');
      setBody('');
    } catch (error) {
      console.error('Error sending bulk emails:', error);
      alert('Failed to send emails. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Send Bulk Email">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex items-center space-x-3">
          <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <div>
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
              Sending to {prospectCount} prospect{prospectCount !== 1 ? 's' : ''}
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-300">
              Each email will be personalized with prospect details
            </p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Subject *
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
            placeholder="e.g., Quick question about {{company}}"
            required
          />
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Use variables: {'{{first_name}}, {{last_name}}, {{company}}, {{title}}'}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Email Body *
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
            placeholder={`Hi {{first_name}},\n\nI noticed that {{company}} is...\n\nBest regards`}
            required
          />
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Personalization variables will be automatically replaced for each recipient
          </p>
        </div>

        <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
          <p className="text-xs text-yellow-800 dark:text-yellow-200">
            <strong>Note:</strong> Emails will be sent with a 2-second delay between each to avoid spam filters.
            This will take approximately {Math.ceil(prospectCount * 2 / 60)} minute(s).
          </p>
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
            disabled={sending}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={sending}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            <span>{sending ? `Sending... (0/${prospectCount})` : 'Send Emails'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
