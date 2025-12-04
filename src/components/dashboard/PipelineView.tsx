import { useEffect, useState } from 'react';
import { TrendingUp, DollarSign, Target, AlertCircle, Plus, Download } from 'lucide-react';
import AddDealForm from '../forms/AddDealForm';
import DealDetailModal from './DealDetailModal';
import { exportToCSV } from '../../utils/exportCSV';

interface Deal {
  id: string;
  name: string;
  amount: number;
  stage: string;
  probability: number;
  risk_score: number;
  close_date: string | null;
  forecast_category: string;
}

export default function PipelineView() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [selectedDeals, setSelectedDeals] = useState<Set<string>>(new Set());
  const [showBulkStageModal, setShowBulkStageModal] = useState(false);
  const [bulkStage, setBulkStage] = useState('');

  useEffect(() => {
    loadDeals();
  }, []);

  async function loadDeals() {
    try {
      const response = await fetch('/api/deals');
      const result = await response.json();

      if (!result.success) throw new Error('Failed to load deals');
      setDeals(result.data || []);
    } catch (error) {
      console.error('Error loading deals:', error);
    } finally {
      setLoading(false);
    }
  }

  const stages = [
    'discovery',
    'qualification',
    'proposal',
    'negotiation',
    'closed_won',
    'closed_lost',
  ];

  const stageLabels: Record<string, string> = {
    discovery: 'Discovery',
    qualification: 'Qualification',
    proposal: 'Proposal',
    negotiation: 'Negotiation',
    closed_won: 'Closed Won',
    closed_lost: 'Closed Lost',
  };

  const totalValue = deals.reduce((sum, deal) => sum + deal.amount, 0);
  const weightedValue = deals.reduce(
    (sum, deal) => sum + deal.amount * (deal.probability / 100),
    0
  );

  const handleExport = () => {
    const exportData = deals.map((d) => ({
      name: d.name,
      amount: d.amount,
      stage: d.stage,
      probability: d.probability,
      risk_score: d.risk_score,
      forecast_category: d.forecast_category,
      close_date: d.close_date,
    }));
    exportToCSV(exportData, 'deals');
  };
  const highRiskDeals = deals.filter((d) => d.risk_score > 70).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Pipeline</h1>
          <p className="text-slate-600 mt-1">
            Track deals and forecast revenue across stages
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleExport}
            className="flex items-center space-x-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-lg transition"
          >
            <Download className="w-5 h-5" />
            <span>Export</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg transition"
          >
            <Plus className="w-5 h-5" />
            <span>Add Deal</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          {
            label: 'Total Pipeline',
            value: `$${(totalValue / 1000).toFixed(0)}K`,
            icon: DollarSign,
            color: 'blue',
          },
          {
            label: 'Weighted Pipeline',
            value: `$${(weightedValue / 1000).toFixed(0)}K`,
            icon: TrendingUp,
            color: 'green',
          },
          {
            label: 'Active Deals',
            value: deals.length,
            icon: Target,
            color: 'purple',
          },
          {
            label: 'High Risk',
            value: highRiskDeals,
            icon: AlertCircle,
            color: 'red',
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
              <div className={`bg-${stat.color}-100 p-3 rounded-lg`}>
                <stat.icon className={`w-6 h-6 text-${stat.color}-600`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <p className="text-slate-500">Loading pipeline...</p>
        </div>
      ) : deals.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            <TrendingUp className="w-8 h-8 text-blue-600" />
          </div>
          <h3 className="text-xl font-semibold text-slate-900 mb-2">
            No deals in pipeline
          </h3>
          <p className="text-slate-600 mb-6">
            Add your first deal to start tracking revenue
          </p>
          <button className="inline-flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition">
            <Plus className="w-5 h-5" />
            <span>Create Your First Deal</span>
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="grid grid-cols-6 gap-4 p-4">
            {stages.map((stage) => {
              const stageDeals = deals.filter((d) => d.stage === stage);
              const stageValue = stageDeals.reduce((sum, d) => sum + d.amount, 0);

              return (
                <div key={stage} className="space-y-3">
                  <div className="border-b border-slate-200 pb-3">
                    <h3 className="font-semibold text-slate-900 text-sm">
                      {stageLabels[stage]}
                    </h3>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-slate-600">
                        {stageDeals.length} deals
                      </span>
                      <span className="text-xs font-medium text-slate-900">
                        ${(stageValue / 1000).toFixed(0)}K
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {stageDeals.map((deal) => (
                      <div
                        key={deal.id}
                        onClick={() => {
                          setSelectedDealId(deal.id);
                          setShowDetailModal(true);
                        }}
                        className="bg-slate-50 rounded-lg p-3 border border-slate-200 hover:border-blue-300 hover:shadow-sm transition cursor-pointer"
                      >
                        <h4 className="font-medium text-slate-900 text-sm mb-1 truncate">
                          {deal.name}
                        </h4>
                        <p className="text-sm font-semibold text-blue-600 mb-2">
                          ${(deal.amount / 1000).toFixed(0)}K
                        </p>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-600">
                            {deal.probability}%
                          </span>
                          {deal.risk_score > 70 && (
                            <span className="text-red-600 flex items-center">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              Risk
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <AddDealForm
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={loadDeals}
      />

      {selectedDealId && (
        <DealDetailModal
          isOpen={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedDealId(null);
          }}
          dealId={selectedDealId}
        />
      )}
    </div>
  );
}
