import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Modal from '../common/Modal';
import { Building, Sparkles } from 'lucide-react';

interface CompanyProfileFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  existingProfile?: any;
  teamId?: string;
}

export default function CompanyProfileForm({
  isOpen,
  onClose,
  onSuccess,
  existingProfile,
  teamId,
}: CompanyProfileFormProps) {
  const [formData, setFormData] = useState({
    company_name: '',
    industry: '',
    website_url: '',
    company_description: '',
    mission_statement: '',
    target_customers: '',
    spokesperson_enabled: false,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (existingProfile) {
      setFormData({
        company_name: existingProfile.company_name || '',
        industry: existingProfile.industry || '',
        website_url: existingProfile.website_url || '',
        company_description: existingProfile.company_description || '',
        mission_statement: existingProfile.mission_statement || '',
        target_customers: existingProfile.target_customers || '',
        spokesperson_enabled: existingProfile.spokesperson_enabled || false,
      });
    }
  }, [existingProfile]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!teamId) {
      console.error('Team ID is required to create a company profile');
      return;
    }
    setLoading(true);

    try {
      if (existingProfile) {
        await supabase
          .from('company_profiles')
          .update({
            ...formData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingProfile.id);
      } else {
        await supabase.from('company_profiles').insert({
          ...formData,
          team_id: teamId,
        });
      }

      onSuccess();
      onClose();
      setFormData({
        company_name: '',
        industry: '',
        website_url: '',
        company_description: '',
        mission_statement: '',
        target_customers: '',
        spokesperson_enabled: false,
      });
    } catch (error) {
      console.error('Error saving company profile:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={existingProfile ? 'Edit Company Profile' : 'Create Company Profile'}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Company Name *
          </label>
          <div className="relative">
            <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              required
              value={formData.company_name}
              onChange={(e) =>
                setFormData({ ...formData, company_name: e.target.value })
              }
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg"
              placeholder="Acme Corporation"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Industry
            </label>
            <input
              type="text"
              value={formData.industry}
              onChange={(e) =>
                setFormData({ ...formData, industry: e.target.value })
              }
              className="w-full px-4 py-2 border border-slate-300 rounded-lg"
              placeholder="Software, Healthcare, etc."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Website URL
            </label>
            <input
              type="url"
              value={formData.website_url}
              onChange={(e) =>
                setFormData({ ...formData, website_url: e.target.value })
              }
              className="w-full px-4 py-2 border border-slate-300 rounded-lg"
              placeholder="https://example.com"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Company Description
          </label>
          <textarea
            value={formData.company_description}
            onChange={(e) =>
              setFormData({ ...formData, company_description: e.target.value })
            }
            rows={3}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg"
            placeholder="Brief overview of what your company does..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Mission Statement
          </label>
          <textarea
            value={formData.mission_statement}
            onChange={(e) =>
              setFormData({ ...formData, mission_statement: e.target.value })
            }
            rows={2}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg"
            placeholder="Your company's mission and purpose..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Target Customers
          </label>
          <textarea
            value={formData.target_customers}
            onChange={(e) =>
              setFormData({ ...formData, target_customers: e.target.value })
            }
            rows={2}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg"
            placeholder="Describe your ideal customers and target market..."
          />
        </div>

        <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <input
              type="checkbox"
              id="spokesperson_enabled"
              checked={formData.spokesperson_enabled}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  spokesperson_enabled: e.target.checked,
                })
              }
              className="mt-1 w-4 h-4 text-blue-600 rounded"
            />
            <div className="flex-1">
              <label
                htmlFor="spokesperson_enabled"
                className="flex items-center space-x-2 font-medium text-slate-900 cursor-pointer"
              >
                <Sparkles className="w-5 h-5 text-blue-600" />
                <span>Enable AI Spokesperson Mode</span>
              </label>
              <p className="text-sm text-slate-600 mt-1">
                When enabled, all AI agents will use company knowledge to ensure
                responses align with your brand voice and messaging guidelines
              </p>
            </div>
          </div>
        </div>

        <div className="flex space-x-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-6 py-2.5 border border-slate-300 rounded-lg hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading
              ? 'Saving...'
              : existingProfile
              ? 'Update Profile'
              : 'Create Profile'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
