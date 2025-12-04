import { useState, useEffect } from 'react';
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
    try {
      const response = await fetch('/api/email-templates');
      const result = await response.json();
      if (result.success) {
        setTemplates(result.data || []);
      }
    } catch (err) {
      console.error('Error loading templates:', err);
      setTemplates([]);
    }
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
      const cadenceResponse = await fetch('/api/cadences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          isActive: formData.is_active,
        }),
      });

      const cadenceResult = await cadenceResponse.json();

      if (!cadenceResult.success) {
        throw new Error(cadenceResult.error || 'Failed to create cadence');
      }

      const cadenceId = cadenceResult.data?.id;

      if (cadenceId && steps.length > 0) {
        const stepsResponse = await fetch('/api/cadence-steps', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            cadenceId,
            steps: steps.map(step => ({
              step_number: step.step_number,
              type: step.type,
              delay_days: step.delay_days,
              delay_hours: step.delay_hours,
              template_id: step.template_id || null,
              content: step.content || null,
            })),
          }),
        });

        const stepsResult = await stepsResponse.json();

        if (!stepsResult.success) {
          console.error('Warning: Failed to create steps:', stepsResult.error);
        }
      }

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
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Cadence Name *
          </label>
          <input
            type="text"
            data-testid="input-cadence-name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            placeholder="e.g., Enterprise Outbound Sequence"
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Description
          </label>
          <textarea
            data-testid="input-cadence-description"
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            rows={2}
            placeholder="Brief description of this cadence"
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
          />
        </div>

        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            data-testid="checkbox-cadence-active"
            checked={formData.is_active}
            onChange={(e) =>
              setFormData({ ...formData, is_active: e.target.checked })
            }
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <label className="text-sm text-slate-700 dark:text-slate-300">Active</label>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">Cadence Steps</h3>
            <button
              type="button"
              onClick={addStep}
              data-testid="button-add-step"
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
                className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-slate-50 dark:bg-slate-800"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <div className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium">
                      {step.step_number}
                    </div>
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      Step {step.step_number}
                    </span>
                  </div>
                  {steps.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeStep(index)}
                      data-testid={`button-remove-step-${index}`}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Type
                    </label>
                    <select
                      value={step.type}
                      onChange={(e) => updateStep(index, 'type', e.target.value)}
                      data-testid={`select-step-type-${index}`}
                      className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                    >
                      <option value="email">Email</option>
                      <option value="call">Call</option>
                      <option value="linkedin">LinkedIn</option>
                      <option value="sms">SMS</option>
                      <option value="task">Task</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Delay (days)
                    </label>
                    <input
                      type="number"
                      value={step.delay_days}
                      onChange={(e) =>
                        updateStep(index, 'delay_days', parseInt(e.target.value))
                      }
                      min="0"
                      data-testid={`input-step-delay-${index}`}
                      className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>

                {step.type === 'email' && (
                  <div className="mt-3">
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Email Template
                    </label>
                    <select
                      value={step.template_id || ''}
                      onChange={(e) =>
                        updateStep(index, 'template_id', e.target.value)
                      }
                      data-testid={`select-step-template-${index}`}
                      className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
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
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Instructions/Notes
                    </label>
                    <textarea
                      value={step.content || ''}
                      onChange={(e) => updateStep(index, 'content', e.target.value)}
                      rows={2}
                      placeholder={`Instructions for ${step.type}...`}
                      data-testid={`input-step-content-${index}`}
                      className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={onClose}
            data-testid="button-cancel-cadence"
            className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            data-testid="button-create-cadence"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Cadence'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
