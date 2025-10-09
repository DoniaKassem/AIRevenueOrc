import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Modal from '../common/Modal';

interface LogCallFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  prospectId?: string;
}

export default function LogCallForm({
  isOpen,
  onClose,
  onSuccess,
  prospectId,
}: LogCallFormProps) {
  const [prospects, setProspects] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    prospect_id: prospectId || '',
    duration_seconds: '',
    disposition: 'connected',
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && !prospectId) {
      loadProspects();
    }
  }, [isOpen, prospectId]);

  async function loadProspects() {
    const { data } = await supabase
      .from('prospects')
      .select('id, first_name, last_name, company')
      .order('first_name');
    setProspects(data || []);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { error: insertError } = await supabase.from('call_logs').insert({
        prospect_id: formData.prospect_id,
        duration_seconds: parseInt(formData.duration_seconds) || 0,
        disposition: formData.disposition,
        notes: formData.notes,
      });

      if (insertError) throw insertError;

      setFormData({
        prospect_id: prospectId || '',
        duration_seconds: '',
        disposition: 'connected',
        notes: '',
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to log call');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Log Call">
      <form onSubmit={handleSubmit} className="space-y-4">
        {!prospectId && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Prospect *
            </label>
            <select
              value={formData.prospect_id}
              onChange={(e) =>
                setFormData({ ...formData, prospect_id: e.target.value })
              }
              required
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select prospect...</option>
              {prospects.map((prospect) => (
                <option key={prospect.id} value={prospect.id}>
                  {prospect.first_name} {prospect.last_name}
                  {prospect.company && ` - ${prospect.company}`}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Duration (seconds)
            </label>
            <input
              type="number"
              value={formData.duration_seconds}
              onChange={(e) =>
                setFormData({ ...formData, duration_seconds: e.target.value })
              }
              min="0"
              placeholder="e.g., 300"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Disposition
            </label>
            <select
              value={formData.disposition}
              onChange={(e) =>
                setFormData({ ...formData, disposition: e.target.value })
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="connected">Connected</option>
              <option value="left_voicemail">Left Voicemail</option>
              <option value="no_answer">No Answer</option>
              <option value="busy">Busy</option>
              <option value="wrong_number">Wrong Number</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Notes
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) =>
              setFormData({ ...formData, notes: e.target.value })
            }
            rows={6}
            placeholder="What was discussed? Next steps? Key takeaways?"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end space-x-3 pt-4">
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
            {loading ? 'Logging...' : 'Log Call'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
