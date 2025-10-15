import { useState } from 'react';
import { GripVertical, X, Plus, Settings as SettingsIcon } from 'lucide-react';

interface Widget {
  id: string;
  type: string;
  title: string;
  visible: boolean;
  order: number;
}

const AVAILABLE_WIDGETS = [
  { id: 'stats', type: 'stats', title: 'Key Metrics' },
  { id: 'pipeline', type: 'pipeline', title: 'Pipeline Overview' },
  { id: 'ai-insights', type: 'ai-insights', title: 'AI Insights' },
  { id: 'activity', type: 'activity', title: 'Recent Activity' },
  { id: 'leads', type: 'leads', title: 'Hot Leads' },
  { id: 'cadences', type: 'cadences', title: 'Active Cadences' },
];

export default function CustomizableDashboard() {
  const [widgets, setWidgets] = useState<Widget[]>(() => {
    const stored = localStorage.getItem('dashboard-widgets');
    if (stored) {
      return JSON.parse(stored);
    }
    return AVAILABLE_WIDGETS.map((w, i) => ({ ...w, visible: i < 4, order: i }));
  });

  const [isCustomizing, setIsCustomizing] = useState(false);

  const saveWidgets = (newWidgets: Widget[]) => {
    setWidgets(newWidgets);
    localStorage.setItem('dashboard-widgets', JSON.stringify(newWidgets));
  };

  const toggleWidget = (id: string) => {
    const updated = widgets.map(w =>
      w.id === id ? { ...w, visible: !w.visible } : w
    );
    saveWidgets(updated);
  };

  const moveWidget = (id: string, direction: 'up' | 'down') => {
    const index = widgets.findIndex(w => w.id === id);
    if (index === -1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= widgets.length) return;

    const updated = [...widgets];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    updated.forEach((w, i) => (w.order = i));
    saveWidgets(updated);
  };

  const visibleWidgets = widgets.filter(w => w.visible).sort((a, b) => a.order - b.order);

  const renderWidget = (widget: Widget) => {
    switch (widget.type) {
      case 'stats':
        return (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Key Metrics
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-3xl font-bold text-blue-600">47</div>
                <div className="text-sm text-slate-600 dark:text-slate-400">Active Prospects</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-green-600">$245K</div>
                <div className="text-sm text-slate-600 dark:text-slate-400">Pipeline Value</div>
              </div>
            </div>
          </div>
        );

      case 'pipeline':
        return (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Pipeline Overview
            </h3>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-600 dark:text-slate-400">Discovery</span>
                  <span className="text-slate-900 dark:text-white">12 deals</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                  <div className="bg-blue-600 h-2 rounded-full" style={{ width: '60%' }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-600 dark:text-slate-400">Proposal</span>
                  <span className="text-slate-900 dark:text-white">8 deals</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                  <div className="bg-green-600 h-2 rounded-full" style={{ width: '40%' }} />
                </div>
              </div>
            </div>
          </div>
        );

      case 'ai-insights':
        return (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              AI Insights
            </h3>
            <div className="space-y-3">
              <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  3 hot leads need follow-up today
                </p>
              </div>
              <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg p-3">
                <p className="text-sm font-medium text-green-900 dark:text-green-100">
                  Demo requests detected from 2 prospects
                </p>
              </div>
            </div>
          </div>
        );

      case 'activity':
        return (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Recent Activity
            </h3>
            <div className="space-y-3">
              <div className="text-sm">
                <div className="font-medium text-slate-900 dark:text-white">Email sent to John Smith</div>
                <div className="text-slate-500 dark:text-slate-400">2 hours ago</div>
              </div>
              <div className="text-sm">
                <div className="font-medium text-slate-900 dark:text-white">Call with Sarah Chen</div>
                <div className="text-slate-500 dark:text-slate-400">5 hours ago</div>
              </div>
            </div>
          </div>
        );

      case 'leads':
        return (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Hot Leads
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-slate-900 dark:text-white">Sarah Chen</div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">TechCorp</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-orange-600">Score: 85</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Burning</div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'cadences':
        return (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Active Cadences
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-slate-900 dark:text-white">Outbound Q4</div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">23 enrolled</div>
                </div>
                <div className="text-sm font-medium text-green-600">85% active</div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            My Dashboard
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Customize your view
          </p>
        </div>
        <button
          onClick={() => setIsCustomizing(!isCustomizing)}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg transition ${
            isCustomizing
              ? 'bg-blue-600 text-white'
              : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
          }`}
        >
          <SettingsIcon className="w-5 h-5" />
          <span>{isCustomizing ? 'Done Customizing' : 'Customize'}</span>
        </button>
      </div>

      {isCustomizing && (
        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-3">
            Widget Settings
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {widgets.map((widget) => (
              <div
                key={widget.id}
                className="bg-white dark:bg-slate-800 rounded-lg p-3 flex items-center justify-between"
              >
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={widget.visible}
                    onChange={() => toggleWidget(widget.id)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-slate-900 dark:text-white">
                    {widget.title}
                  </span>
                </div>
                {widget.visible && (
                  <div className="flex space-x-1">
                    <button
                      onClick={() => moveWidget(widget.id, 'up')}
                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      title="Move up"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => moveWidget(widget.id, 'down')}
                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      title="Move down"
                    >
                      ▼
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        {visibleWidgets.map((widget) => (
          <div key={widget.id} className="relative">
            {renderWidget(widget)}
          </div>
        ))}
      </div>

      {visibleWidgets.length === 0 && (
        <div className="text-center py-12">
          <p className="text-slate-500 dark:text-slate-400 mb-4">
            No widgets selected. Click "Customize" to add widgets.
          </p>
        </div>
      )}
    </div>
  );
}
