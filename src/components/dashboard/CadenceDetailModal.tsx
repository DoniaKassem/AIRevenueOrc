import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import Modal from '../common/Modal';
import { Mail, Phone, Users, MessageSquare, Target, Clock, Play, Pause } from 'lucide-react';

interface CadenceStep {
  id: string;
  step_number: number;
  type: 'email' | 'call' | 'linkedin' | 'sms' | 'task';
  delay_days: number;
  delay_hours: number;
  content: string | null;
}

interface CadenceDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  cadenceId: string;
  cadenceName: string;
  cadenceDescription: string | null;
  isActive: boolean;
}

export default function CadenceDetailModal({
  isOpen,
  onClose,
  cadenceId,
  cadenceName,
  cadenceDescription,
  isActive,
}: CadenceDetailModalProps) {
  const [steps, setSteps] = useState<CadenceStep[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && cadenceId) {
      loadSteps();
    }
  }, [isOpen, cadenceId]);

  async function loadSteps() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('cadence_steps')
        .select('*')
        .eq('cadence_id', cadenceId)
        .order('step_number', { ascending: true });

      if (error) throw error;
      setSteps(data || []);
    } catch (error) {
      console.error('Error loading cadence steps:', error);
    } finally {
      setLoading(false);
    }
  }

  const stepIcons: Record<string, typeof Mail> = {
    email: Mail,
    call: Phone,
    linkedin: Users,
    sms: MessageSquare,
    task: Target,
  };

  const stepColors: Record<string, string> = {
    email: 'bg-blue-100 text-blue-600',
    call: 'bg-green-100 text-green-600',
    linkedin: 'bg-purple-100 text-purple-600',
    sms: 'bg-amber-100 text-amber-600',
    task: 'bg-slate-100 text-slate-600',
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={cadenceName}>
      <div className="space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div className="flex-1">
            <p className="text-sm text-slate-600">
              {cadenceDescription || 'No description provided'}
            </p>
          </div>
          <div className="ml-4">
            <span
              className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium ${
                isActive
                  ? 'bg-green-100 text-green-700'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              {isActive ? (
                <>
                  <Play className="w-3 h-3 mr-1" />
                  Active
                </>
              ) : (
                <>
                  <Pause className="w-3 h-3 mr-1" />
                  Paused
                </>
              )}
            </span>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-slate-900 mb-4">
            Cadence Steps ({steps.length})
          </h3>

          {loading ? (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-slate-500 mt-2">Loading steps...</p>
            </div>
          ) : steps.length === 0 ? (
            <div className="text-center py-8 bg-slate-50 rounded-lg border border-slate-200">
              <Target className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm text-slate-600">No steps configured yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {steps.map((step, index) => {
                const Icon = stepIcons[step.type] || Target;
                const colorClass = stepColors[step.type] || stepColors.task;

                return (
                  <div
                    key={step.id}
                    className="relative bg-white border border-slate-200 rounded-lg p-4 hover:border-blue-300 transition"
                  >
                    {index < steps.length - 1 && (
                      <div className="absolute left-8 top-full w-0.5 h-3 bg-slate-200" />
                    )}

                    <div className="flex items-start space-x-4">
                      <div className={`p-2 rounded-lg ${colorClass}`}>
                        <Icon className="w-5 h-5" />
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-medium text-slate-900">
                            Step {step.step_number}: {step.type.charAt(0).toUpperCase() + step.type.slice(1)}
                          </h4>
                          <div className="flex items-center space-x-1 text-xs text-slate-500">
                            <Clock className="w-3 h-3" />
                            <span>
                              {step.delay_days > 0 && `${step.delay_days}d `}
                              {step.delay_hours > 0 && `${step.delay_hours}h`}
                              {step.delay_days === 0 && step.delay_hours === 0 && 'Immediate'}
                            </span>
                          </div>
                        </div>

                        {step.content && (
                          <p className="text-sm text-slate-600">{step.content}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-slate-200">
          <div className="text-sm text-slate-600">
            Total duration: {steps.reduce((acc, step) => acc + step.delay_days, 0)} days
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
