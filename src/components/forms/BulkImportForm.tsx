import { useState, useRef } from 'react';
import { Upload, Download, CheckCircle, AlertCircle } from 'lucide-react';
import Modal from '../common/Modal';
import { supabase } from '../../lib/supabase';

interface BulkImportFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
}

const DEFAULT_TEAM_ID = '00000000-0000-0000-0000-000000000001';

export default function BulkImportForm({ isOpen, onClose, onSuccess }: BulkImportFormProps) {
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const csvContent = 'first_name,last_name,email,phone,title,company,status\n' +
      'John,Smith,john.smith@example.com,+1-555-0100,VP of Sales,Acme Corp,new\n' +
      'Jane,Doe,jane.doe@example.com,+1-555-0101,Marketing Director,TechStart,new';

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'prospect_import_template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const parseCSV = (text: string): any[] => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim());
    const prospects = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      if (values.length !== headers.length) continue;

      const prospect: any = {};
      headers.forEach((header, index) => {
        prospect[header] = values[index] || null;
      });
      prospects.push(prospect);
    }

    return prospects;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setResult(null);

    try {
      const text = await file.text();
      const prospects = parseCSV(text);

      if (prospects.length === 0) {
        throw new Error('No valid prospects found in file');
      }

      const errors: string[] = [];
      let successCount = 0;

      for (const prospect of prospects) {
        try {
          const { error } = await supabase.from('prospects').insert({
            team_id: DEFAULT_TEAM_ID,
            first_name: prospect.first_name,
            last_name: prospect.last_name,
            email: prospect.email,
            phone: prospect.phone,
            title: prospect.title,
            company: prospect.company,
            status: prospect.status || 'new',
            priority_score: 50,
          });

          if (error) {
            errors.push(`${prospect.email}: ${error.message}`);
          } else {
            successCount++;
          }
        } catch (err) {
          errors.push(`${prospect.email}: Failed to import`);
        }
      }

      setResult({
        success: successCount,
        failed: errors.length,
        errors: errors.slice(0, 10),
      });

      if (successCount > 0) {
        onSuccess();
      }
    } catch (error) {
      console.error('Import error:', error);
      setResult({
        success: 0,
        failed: 1,
        errors: [error instanceof Error ? error.message : 'Unknown error occurred'],
      });
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleClose = () => {
    setResult(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Bulk Import Prospects">
      <div className="space-y-4">
        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
            Import Instructions
          </h3>
          <ol className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-decimal list-inside">
            <li>Download the CSV template below</li>
            <li>Fill in your prospect data</li>
            <li>Upload the completed CSV file</li>
          </ol>
        </div>

        <button
          onClick={downloadTemplate}
          className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg transition"
        >
          <Download className="w-5 h-5" />
          <span>Download CSV Template</span>
        </button>

        <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-8 text-center">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            className="hidden"
            id="csv-upload"
            disabled={importing}
          />
          <label
            htmlFor="csv-upload"
            className={`cursor-pointer flex flex-col items-center ${
              importing ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <Upload className="w-12 h-12 text-slate-400 dark:text-slate-500 mb-3" />
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {importing ? 'Importing...' : 'Click to upload CSV file'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              CSV files only
            </p>
          </label>
        </div>

        {result && (
          <div className="space-y-3">
            <div
              className={`rounded-lg p-4 flex items-start space-x-3 ${
                result.success > 0
                  ? 'bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800'
                  : 'bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800'
              }`}
            >
              {result.success > 0 ? (
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
              )}
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  Import Complete
                </p>
                <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">
                  Successfully imported: <strong>{result.success}</strong> prospects
                </p>
                {result.failed > 0 && (
                  <p className="text-sm text-red-700 dark:text-red-300">
                    Failed: <strong>{result.failed}</strong> prospects
                  </p>
                )}
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <p className="text-xs font-semibold text-red-900 dark:text-red-100 mb-2">
                  Errors:
                </p>
                <ul className="text-xs text-red-800 dark:text-red-200 space-y-1">
                  {result.errors.map((error, idx) => (
                    <li key={idx}>• {error}</li>
                  ))}
                  {result.failed > result.errors.length && (
                    <li>• ... and {result.failed - result.errors.length} more</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end pt-4">
          <button
            onClick={handleClose}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
