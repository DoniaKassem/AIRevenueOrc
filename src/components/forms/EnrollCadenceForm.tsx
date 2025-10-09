import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Modal from '../common/Modal';
import { Target, Users } from 'lucide-react';

interface EnrollCadenceFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  prospectIds: string[];
}

export default function EnrollCadenceForm({
  isOpen,
  onClose,
  onSuccess,
  prospectIds,
}: EnrollCadenceFormProps) {
  const [cadences, setCadences] = useState<any[]>([]);
  const [selectedCadence, setSelectedCadence] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadCadences();
    }
  }, [isOpen]);

  async function loadCadences() {
    const { data } = await supabase
      .from('cadences')
      .select('*')
      .eq('is_active', true)
      .order('name');
    setCadences(data || []);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const enrollments = prospectIds.map((prospectId) => ({
        cadence_id: selectedCadence,
        prospect_id: prospectId,
        status: 'active',
        current_step: 1,
        enrolled_at: new Date().toISOString(),
      }));

      const { error: enrollError } = await supabase
        .from('cadence_enrollments')
        .insert(enrollments);

      if (enrollError) throw enrollError;

      setSelectedCadence('');
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to enroll prospects');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Enroll Prospects in Cadence"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center space-x-2 text-blue-700">
            <Users className="w-5 h-5" />
            <span className="font-medium">
              {prospectIds.length} prospect{prospectIds.length !== 1 ? 's' : ''}{' '}
              selected
            </span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Select Cadence *
          </label>
          <select
            value={selectedCadence}
            onChange={(e) => setSelectedCadence(e.target.value)}
            required
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Choose a cadence...</option>
            {cadences.map((cadence) => (
              <option key={cadence.id} value={cadence.id}>
                {cadence.name}
              </option>
            ))}
          </select>
          {cadences.length === 0 && (
            <p className="text-sm text-slate-500 mt-1">
              No active cadences available. Create one first.
            </p>
          )}
        </div>

        {selectedCadence && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <div className="flex items-start space-x-2">
              <Target className="w-5 h-5 text-slate-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-slate-900">
                  {cadences.find((c) => c.id === selectedCadence)?.name}
                </p>
                <p className="text-xs text-slate-600 mt-1">
                  {cadences.find((c) => c.id === selectedCadence)?.description ||
                    'No description'}
                </p>
              </div>
            </div>
          </div>
        )}

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
            disabled={loading || !selectedCadence}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:opacity-50"
          >
            {loading ? 'Enrolling...' : 'Enroll Prospects'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
