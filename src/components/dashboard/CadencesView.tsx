import { useEffect, useState } from 'react';
import { Target, Plus, Play, Pause, Users, Mail, Phone, MessageSquare } from 'lucide-react';
import CadenceBuilderForm from '../forms/CadenceBuilderForm';
import CadenceDetailModal from './CadenceDetailModal';

interface Cadence {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

interface CadenceStep {
  id: string;
  step_number: number;
  type: 'email' | 'call' | 'linkedin' | 'sms' | 'task';
  delay_days: number;
  delay_hours: number;
}

export default function CadencesView() {
  const [cadences, setCadences] = useState<Cadence[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBuilderModal, setShowBuilderModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedCadence, setSelectedCadence] = useState<Cadence | null>(null);

  useEffect(() => {
    loadCadences();
  }, []);

  async function loadCadences() {
    try {
      const response = await fetch('/api/cadences');
      const result = await response.json();

      if (!result.success) throw new Error('Failed to load cadences');
      setCadences(result.data || []);
    } catch (error) {
      console.error('Error loading cadences:', error);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Cadences</h1>
          <p className="text-slate-600 mt-1">
            Automated multi-channel sequences for outreach
          </p>
        </div>
        <button
          onClick={() => setShowBuilderModal(true)}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg transition"
        >
          <Plus className="w-5 h-5" />
          <span>Create Cadence</span>
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          {
            label: 'Active Cadences',
            value: cadences.filter((c) => c.is_active).length,
            icon: Play,
          },
          { label: 'Total Cadences', value: cadences.length, icon: Target },
          {
            label: 'Active Enrollments',
            value: 0,
            icon: Users,
          },
        ].map((stat, idx) => (
          <div key={idx} className="bg-white rounded-xl p-6 border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">{stat.label}</p>
                <p className="text-3xl font-bold text-slate-900 mt-2">
                  {stat.value}
                </p>
              </div>
              <div className="bg-green-100 p-3 rounded-lg">
                <stat.icon className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <p className="text-slate-500">Loading cadences...</p>
        </div>
      ) : cadences.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            <Target className="w-8 h-8 text-blue-600" />
          </div>
          <h3 className="text-xl font-semibold text-slate-900 mb-2">
            No cadences yet
          </h3>
          <p className="text-slate-600 mb-6">
            Create your first cadence to automate prospect outreach
          </p>
          <button className="inline-flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition">
            <Plus className="w-5 h-5" />
            <span>Create Your First Cadence</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cadences.map((cadence) => (
            <div
              key={cadence.id}
              onClick={() => {
                setSelectedCadence(cadence);
                setShowDetailModal(true);
              }}
              className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-lg transition cursor-pointer"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="bg-blue-100 p-2 rounded-lg">
                    <Target className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">
                      {cadence.name}
                    </h3>
                    <p className="text-sm text-slate-600">
                      {cadence.description || 'No description'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                <div className="flex items-center space-x-2">
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                      cadence.is_active
                        ? 'bg-green-100 text-green-700'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {cadence.is_active ? (
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
                <span className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                  View Details
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <CadenceBuilderForm
        isOpen={showBuilderModal}
        onClose={() => setShowBuilderModal(false)}
        onSuccess={loadCadences}
      />

      {selectedCadence && (
        <CadenceDetailModal
          isOpen={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedCadence(null);
          }}
          cadenceId={selectedCadence.id}
          cadenceName={selectedCadence.name}
          cadenceDescription={selectedCadence.description}
          isActive={selectedCadence.is_active}
        />
      )}
    </div>
  );
}
