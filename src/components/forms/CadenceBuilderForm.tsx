import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Modal from '../common/Modal';
import { Plus, Trash2, Mail, Phone, Linkedin, MessageSquare, CheckSquare } from 'lucide-react';

interface CadenceBuilderFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface CadenceStep {
  step_number: number;
  type: 'email' | 'call' | 'linkedin' | 'sms' | 'task';
  delay_days: number;
  delay_hours: number;
  template_id?: string;
  content?: string;
}

const DEFAULT_TEAM_ID = '00000000-0000-0000-0000-000000000001';

export default function CadenceBuilderForm({
  isOpen,
  onClose,
  onSuccess,
}: CadenceBuilderFormProps) {
  const [templates, setTemplates] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_active: true,
  });
  const [steps, setSteps] = useState<CadenceStep[]>([
    { step_number: 1, type: 'email', delay_days: 0, delay_hours: 0 },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
    }
  }, [isOpen]);

  async function loadTemplates() {
    const { data } = await supabase
      .from('email_templates')
      .select('id, name')
      .eq('is_active', true);
    setTemplates(data || []);
  }

  const addStep = () => {
    setSteps([
      ...steps,
      {
        step_number: steps.length + 1,
        type: 'email',
        delay_days: 1,
        delay_hours: 0,
      },
    ]);
  };

  const removeStep = (index: number) => {
    const newSteps = steps.filter((_, i) => i !== index);
    setSteps(
      newSteps.map((step, i) => ({ ...step, step_number: i + 1 }))
    );
  };

  const updateStep = (index: number, field: string, value: any) => {
    const newSteps = [...steps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setSteps(newSteps);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data: cadence, error: cadenceError } = await supabase
        .from('cadences')
        .insert({
          ...formData,
          team_id: DEFAULT_TEAM_ID,
        })
        .select()
        .single();

      if (cadenceError) throw cadenceError;

      const stepsToInsert = steps.map((step) => ({
        cadence_id: cadence.id,
        ...step,
      }));

      const { error: stepsError } = await supabase
        .from('cadence_steps')
        .insert(stepsToInsert);

      if (stepsError) throw stepsError;

      setFormData({ name: '', description: '', is_active: true });
      setSteps([{ step_number: 1, type: 'email', delay_days: 0, delay_hours: 0 }]);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create cadence');
    } finally {
      setLoading(false);
    }
  };

  const getStepIcon = (type: string) => {
    switch (type) {
      case 'email':
        return <Mail className="w-5 h-5" />;
      case 'call':
        return <Phone className="w-5 h-5" />;
      case 'linkedin':
        return <Linkedin className="w-5 h-5" />;
      case 'sms':
        return <MessageSquare className="w-5 h-5" />;
      case 'task':
        return <CheckSquare className="w-5 h-5" />;
      default:
        return <Mail className="w-5 h-5" />;
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Cadence">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Cadence Name *
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            placeholder="e.g., Enterprise Outbound Sequence"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            rows={2}
            placeholder="Brief description of this cadence"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
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
          <label className="text-sm text-slate-700">Active</label>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-slate-900">Cadence Steps</h3>
            <button
              type="button"
              onClick={addStep}
              className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-700"
            >
              <Plus className="w-4 h-4" />
              <span>Add Step</span>
            </button>
          </div>

          <div className="space-y-4 max-h-96 overflow-y-auto">
            {steps.map((step, index) => (
              <div
                key={index}
                className="border border-slate-200 rounded-lg p-4 bg-slate-50"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <div className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium">
                      {step.step_number}
                    </div>
                    <span className="text-sm font-medium text-slate-900">
                      Step {step.step_number}
                    </span>
                  </div>
                  {steps.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeStep(index)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Type
                    </label>
                    <select
                      value={step.type}
                      onChange={(e) => updateStep(index, 'type', e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="email">Email</option>
                      <option value="call">Call</option>
                      <option value="linkedin">LinkedIn</option>
                      <option value="sms">SMS</option>
                      <option value="task">Task</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Delay (days)
                    </label>
                    <input
                      type="number"
                      value={step.delay_days}
                      onChange={(e) =>
                        updateStep(index, 'delay_days', parseInt(e.target.value))
                      }
                      min="0"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {step.type === 'email' && (
                  <div className="mt-3">
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Email Template
                    </label>
                    <select
                      value={step.template_id || ''}
                      onChange={(e) =>
                        updateStep(index, 'template_id', e.target.value)
                      }
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select template...</option>
                      {templates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {step.type !== 'email' && (
                  <div className="mt-3">
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Instructions/Notes
                    </label>
                    <textarea
                      value={step.content || ''}
                      onChange={(e) => updateStep(index, 'content', e.target.value)}
                      rows={2}
                      placeholder={`Instructions for ${step.type}...`}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
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
            {loading ? 'Creating...' : 'Create Cadence'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
