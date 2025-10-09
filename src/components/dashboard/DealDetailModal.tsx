import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import Modal from '../common/Modal';
import { DollarSign, Calendar, TrendingUp, AlertCircle, Target, Building, User } from 'lucide-react';

interface DealDetails {
  id: string;
  deal_name: string;
  amount: number;
  stage: string;
  probability: number;
  risk_score: number;
  expected_close_date: string | null;
  forecast_category: string;
  company_name: string | null;
  created_at: string;
}

interface DealDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  dealId: string;
}

export default function DealDetailModal({ isOpen, onClose, dealId }: DealDetailModalProps) {
  const [deal, setDeal] = useState<DealDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && dealId) {
      loadDeal();
    }
  }, [isOpen, dealId]);

  async function loadDeal() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('deals')
        .select('*')
        .eq('id', dealId)
        .single();

      if (error) throw error;
      setDeal(data);
    } catch (error) {
      console.error('Error loading deal:', error);
    } finally {
      setLoading(false);
    }
  }

  const stageLabels: Record<string, string> = {
    discovery: 'Discovery',
    qualification: 'Qualification',
    proposal: 'Proposal',
    negotiation: 'Negotiation',
    closed_won: 'Closed Won',
    closed_lost: 'Closed Lost',
  };

  const stageColors: Record<string, string> = {
    discovery: 'bg-blue-100 text-blue-700',
    qualification: 'bg-purple-100 text-purple-700',
    proposal: 'bg-amber-100 text-amber-700',
    negotiation: 'bg-orange-100 text-orange-700',
    closed_won: 'bg-green-100 text-green-700',
    closed_lost: 'bg-slate-100 text-slate-700',
  };

  const forecastColors: Record<string, string> = {
    commit: 'bg-green-100 text-green-700',
    best_case: 'bg-blue-100 text-blue-700',
    pipeline: 'bg-slate-100 text-slate-700',
    omitted: 'bg-red-100 text-red-700',
  };

  if (loading) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Loading...">
        <div className="text-center py-8">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-500 mt-2">Loading deal details...</p>
        </div>
      </Modal>
    );
  }

  if (!deal) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Error">
        <div className="text-center py-8">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-3" />
          <p className="text-slate-600">Failed to load deal details</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={deal.deal_name}>
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
            <div className="flex items-center space-x-3 mb-2">
              <div className="bg-blue-600 p-2 rounded-lg">
                <DollarSign className="w-5 h-5 text-white" />
              </div>
              <span className="text-sm font-medium text-blue-900">Deal Value</span>
            </div>
            <p className="text-2xl font-bold text-blue-900">
              ${deal.amount.toLocaleString()}
            </p>
            <p className="text-xs text-blue-700 mt-1">
              Weighted: ${((deal.amount * deal.probability) / 100).toLocaleString()}
            </p>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 border border-purple-200">
            <div className="flex items-center space-x-3 mb-2">
              <div className="bg-purple-600 p-2 rounded-lg">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <span className="text-sm font-medium text-purple-900">Probability</span>
            </div>
            <div className="flex items-end space-x-2">
              <p className="text-2xl font-bold text-purple-900">{deal.probability}%</p>
            </div>
            <div className="w-full bg-purple-200 rounded-full h-2 mt-2">
              <div
                className="bg-purple-600 h-2 rounded-full transition-all"
                style={{ width: `${deal.probability}%` }}
              />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between py-3 border-b border-slate-200">
            <div className="flex items-center space-x-3">
              <Target className="w-5 h-5 text-slate-600" />
              <span className="text-sm font-medium text-slate-700">Stage</span>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                stageColors[deal.stage] || stageColors.discovery
              }`}
            >
              {stageLabels[deal.stage] || deal.stage}
            </span>
          </div>

          <div className="flex items-center justify-between py-3 border-b border-slate-200">
            <div className="flex items-center space-x-3">
              <TrendingUp className="w-5 h-5 text-slate-600" />
              <span className="text-sm font-medium text-slate-700">Forecast Category</span>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                forecastColors[deal.forecast_category] || forecastColors.pipeline
              }`}
            >
              {deal.forecast_category.replace('_', ' ').toUpperCase()}
            </span>
          </div>

          {deal.company_name && (
            <div className="flex items-center justify-between py-3 border-b border-slate-200">
              <div className="flex items-center space-x-3">
                <Building className="w-5 h-5 text-slate-600" />
                <span className="text-sm font-medium text-slate-700">Company</span>
              </div>
              <span className="text-sm text-slate-900 font-medium">{deal.company_name}</span>
            </div>
          )}

          <div className="flex items-center justify-between py-3 border-b border-slate-200">
            <div className="flex items-center space-x-3">
              <Calendar className="w-5 h-5 text-slate-600" />
              <span className="text-sm font-medium text-slate-700">Expected Close</span>
            </div>
            <span className="text-sm text-slate-900">
              {deal.expected_close_date
                ? new Date(deal.expected_close_date).toLocaleDateString()
                : 'Not set'}
            </span>
          </div>

          <div className="flex items-center justify-between py-3 border-b border-slate-200">
            <div className="flex items-center space-x-3">
              <AlertCircle className="w-5 h-5 text-slate-600" />
              <span className="text-sm font-medium text-slate-700">Risk Score</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-32 bg-slate-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    deal.risk_score > 70
                      ? 'bg-red-600'
                      : deal.risk_score > 40
                      ? 'bg-amber-600'
                      : 'bg-green-600'
                  }`}
                  style={{ width: `${deal.risk_score}%` }}
                />
              </div>
              <span className="text-sm font-medium text-slate-900">{deal.risk_score}</span>
            </div>
          </div>
        </div>

        {deal.risk_score > 70 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-900 mb-1">High Risk Deal</p>
                <p className="text-xs text-red-700">
                  This deal has a high risk score. Consider reviewing the deal criteria and
                  engaging with the prospect.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-4 border-t border-slate-200">
          <p className="text-xs text-slate-500">
            Created {new Date(deal.created_at).toLocaleDateString()}
          </p>
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
