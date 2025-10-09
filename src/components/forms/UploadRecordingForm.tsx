import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import Modal from '../common/Modal';
import { Upload, FileAudio } from 'lucide-react';

interface UploadRecordingFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const DEFAULT_TEAM_ID = '00000000-0000-0000-0000-000000000001';

export default function UploadRecordingForm({
  isOpen,
  onClose,
  onSuccess,
}: UploadRecordingFormProps) {
  const [formData, setFormData] = useState({
    title: '',
    type: 'call',
    duration_seconds: '',
    started_at: '',
  });
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      if (!formData.title) {
        setFormData({
          ...formData,
          title: selectedFile.name.replace(/\.[^/.]+$/, ''),
        });
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const conversationData = {
        title: formData.title,
        type: formData.type,
        duration_seconds: parseInt(formData.duration_seconds) || 0,
        started_at: formData.started_at || new Date().toISOString(),
        analysis_status: 'pending',
        team_id: DEFAULT_TEAM_ID,
      };

      const { data: conversation, error: insertError } = await supabase
        .from('conversations')
        .insert(conversationData)
        .select()
        .single();

      if (insertError) throw insertError;

      if (conversation) {
        const { error: functionError } = await supabase.functions.invoke(
          'ai-conversation-analyzer',
          {
            body: {
              conversation_id: conversation.id,
              file_name: file?.name || 'recording.mp3',
            },
          }
        );

        if (functionError) {
          console.error('Analysis function error:', functionError);
        }
      }

      setFormData({
        title: '',
        type: 'call',
        duration_seconds: '',
        started_at: '',
      });
      setFile(null);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to upload recording');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Upload Recording">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Audio/Video File
          </label>
          <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-blue-400 transition">
            <input
              type="file"
              accept="audio/*,video/*"
              onChange={handleFileChange}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="cursor-pointer flex flex-col items-center"
            >
              {file ? (
                <>
                  <FileAudio className="w-12 h-12 text-blue-600 mb-2" />
                  <p className="text-sm font-medium text-slate-900">
                    {file.name}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    className="text-xs text-blue-600 hover:text-blue-700 mt-2"
                  >
                    Change file
                  </button>
                </>
              ) : (
                <>
                  <Upload className="w-12 h-12 text-slate-400 mb-2" />
                  <p className="text-sm font-medium text-slate-900">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    MP3, WAV, MP4, or other audio/video formats
                  </p>
                </>
              )}
            </label>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Title *
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            required
            placeholder="e.g., Discovery Call with Acme Corp"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Type
            </label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="call">Call</option>
              <option value="meeting">Meeting</option>
              <option value="demo">Demo</option>
              <option value="presentation">Presentation</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Duration (seconds)
            </label>
            <input
              type="number"
              value={formData.duration_seconds}
              onChange={(e) =>
                setFormData({ ...formData, duration_seconds: e.target.value })
              }
              min="0"
              placeholder="e.g., 1800"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Date & Time
          </label>
          <input
            type="datetime-local"
            value={formData.started_at}
            onChange={(e) =>
              setFormData({ ...formData, started_at: e.target.value })
            }
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900">
            After upload, AI will automatically analyze the conversation for insights,
            sentiment, action items, and recommendations.
          </p>
        </div>

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
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:opacity-50"
          >
            {loading ? 'Uploading...' : 'Upload & Analyze'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
