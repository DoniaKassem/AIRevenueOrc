import { useState } from 'react';
import Modal from '../common/Modal';
import { Sparkles, Loader, CheckCircle, XCircle, Clock } from 'lucide-react';
import { enrichContactWithWaterfall, EnrichmentResult } from '../../lib/enrichmentWaterfall';

interface EnrichContactFormProps {
  isOpen: boolean;
  onClose: () => void;
  prospectId: string;
  currentData: {
    email?: string;
    firstName?: string;
    lastName?: string;
    company?: string;
    linkedinUrl?: string;
  };
  onSuccess?: () => void;
}

export default function EnrichContactForm({
  isOpen,
  onClose,
  prospectId,
  currentData,
  onSuccess,
}: EnrichContactFormProps) {
  const [enriching, setEnriching] = useState(false);
  const [result, setResult] = useState<EnrichmentResult | null>(null);
  const [error, setError] = useState('');

  const handleEnrich = async () => {
    setEnriching(true);
    setError('');
    setResult(null);

    try {
      const defaultTeamId = '00000000-0000-0000-0000-000000000001';

      const enrichmentResult = await enrichContactWithWaterfall(
        prospectId,
        defaultTeamId,
        {
          email: currentData.email,
          firstName: currentData.firstName,
          lastName: currentData.lastName,
          company: currentData.company,
          linkedinUrl: currentData.linkedinUrl,
        },
        'full_profile'
      );

      setResult(enrichmentResult);

      if (enrichmentResult.success && onSuccess) {
        setTimeout(() => {
          onSuccess();
          handleClose();
        }, 2000);
      }
    } catch (err: any) {
      setError(err.message || 'Enrichment failed. Please try again.');
    } finally {
      setEnriching(false);
    }
  };

  const handleClose = () => {
    setResult(null);
    setError('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Enrich Contact Data">
      <div className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <Sparkles className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-900">
                Waterfall Enrichment Strategy
              </p>
              <p className="text-xs text-blue-700 mt-1">
                We'll try multiple data providers in sequence (Clearbit → ZoomInfo → Apollo
                → Hunter → PDL) until we find enriched data for this contact.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
          <h4 className="text-sm font-medium text-slate-900 mb-3">Current Data</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">Email:</span>
              <span className="font-medium text-slate-900">
                {currentData.email || 'Not provided'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Name:</span>
              <span className="font-medium text-slate-900">
                {currentData.firstName || currentData.lastName
                  ? `${currentData.firstName || ''} ${currentData.lastName || ''}`.trim()
                  : 'Not provided'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Company:</span>
              <span className="font-medium text-slate-900">
                {currentData.company || 'Not provided'}
              </span>
            </div>
          </div>
        </div>

        {result && (
          <div
            className={`rounded-lg p-4 border ${
              result.success
                ? 'bg-green-50 border-green-200'
                : 'bg-red-50 border-red-200'
            }`}
          >
            <div className="flex items-start space-x-3">
              {result.success ? (
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              ) : (
                <XCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              )}
              <div className="flex-1">
                <p className="text-sm font-medium mb-2">
                  {result.success ? (
                    <>
                      Success! Enriched by <strong>{result.provider}</strong>
                    </>
                  ) : (
                    'Enrichment Failed'
                  )}
                </p>

                <div className="text-xs space-y-1 mb-3">
                  <div>
                    Providers Tried: <strong>{result.attemptsCount}</strong>
                  </div>
                  <div>
                    Duration: <strong>{(result.totalDuration / 1000).toFixed(2)}s</strong>
                  </div>
                  <div>
                    Credits Used: <strong>{result.creditsConsumed}</strong>
                  </div>
                </div>

                <div className="border-t pt-2 mt-2">
                  <p className="text-xs font-medium mb-2">Waterfall Log:</p>
                  <div className="space-y-1">
                    {result.waterfallLog.map((log, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="flex items-center space-x-2">
                          {log.status === 'success' ? (
                            <CheckCircle className="w-3 h-3 text-green-600" />
                          ) : (
                            <XCircle className="w-3 h-3 text-slate-400" />
                          )}
                          <span>{log.provider}</span>
                        </span>
                        <span className="text-slate-600">
                          {(log.duration / 1000).toFixed(2)}s
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {result.success && result.data && (
                  <div className="border-t pt-2 mt-2">
                    <p className="text-xs font-medium mb-2">Enriched Fields:</p>
                    <div className="space-y-1 text-xs">
                      {Object.entries(result.data).map(([key, value]) => (
                        <div key={key} className="flex justify-between">
                          <span className="text-slate-600 capitalize">
                            {key.replace(/_/g, ' ')}:
                          </span>
                          <span className="font-medium text-slate-900 max-w-[200px] truncate">
                            {String(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between pt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition"
          >
            {result?.success ? 'Close' : 'Cancel'}
          </button>

          {!result?.success && (
            <button
              onClick={handleEnrich}
              disabled={enriching || !currentData.email}
              className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {enriching ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  <span>Enriching...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Start Enrichment</span>
                </>
              )}
            </button>
          )}
        </div>

        {!currentData.email && (
          <p className="text-xs text-amber-600 text-center">
            Email address is required to enrich contact data
          </p>
        )}
      </div>
    </Modal>
  );
}
