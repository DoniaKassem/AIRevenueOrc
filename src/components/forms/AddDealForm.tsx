import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import Modal from '../common/Modal';

interface AddDealFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const DEFAULT_TEAM_ID = '00000000-0000-0000-0000-000000000001';

export default function AddDealForm({
  isOpen,
  onClose,
  onSuccess,
}: AddDealFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    stage: 'discovery',
    probability: '25',
    close_date: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { error: insertError } = await supabase.from('deals').insert({
        name: formData.name,
        amount: parseFloat(formData.amount),
        stage: formData.stage,
        probability: parseFloat(formData.probability),
        close_date: formData.close_date || null,
        team_id: DEFAULT_TEAM_ID,
      });

      if (insertError) throw insertError;

      setFormData({
        name: '',
        amount: '',
        stage: 'discovery',
        probability: '25',
        close_date: '',
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to add deal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add New Deal">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Deal Name *
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            placeholder="e.g., Acme Corp - Enterprise License"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Amount ($) *
            </label>
            <input
              type="number"
              value={formData.amount}
              onChange={(e) =>
                setFormData({ ...formData, amount: e.target.value })
              }
              required
              min="0"
              step="0.01"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Probability (%)
            </label>
            <input
              type="number"
              value={formData.probability}
              onChange={(e) =>
                setFormData({ ...formData, probability: e.target.value })
              }
              min="0"
              max="100"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Stage
          </label>
          <select
            value={formData.stage}
            onChange={(e) => setFormData({ ...formData, stage: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="discovery">Discovery</option>
            <option value="qualification">Qualification</option>
            <option value="proposal">Proposal</option>
            <option value="negotiation">Negotiation</option>
            <option value="closed_won">Closed Won</option>
            <option value="closed_lost">Closed Lost</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Expected Close Date
          </label>
          <input
            type="date"
            value={formData.close_date}
            onChange={(e) =>
              setFormData({ ...formData, close_date: e.target.value })
            }
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
            {loading ? 'Adding...' : 'Add Deal'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
