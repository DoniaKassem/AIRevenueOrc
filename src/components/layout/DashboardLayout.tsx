import { ReactNode } from 'react';
import {
  LayoutDashboard,
  Users,
  Target,
  TrendingUp,
  Settings,
  Sparkles,
  MessageSquare,
  BarChart3,
  Book,
  LineChart,
  Moon,
  Sun,
  Undo2,
  Redo2,
  CheckSquare,
  Activity,
  UserCheck,
  Award,
  Linkedin,
  Plug,
  Search,
} from 'lucide-react';
import AIAssistantChat from '../common/AIAssistantChat';
import GlobalSearch from '../common/GlobalSearch';
import NotificationCenter from '../common/NotificationCenter';
import { useTheme } from '../../contexts/ThemeContext';
import { useUndoRedo } from '../../contexts/UndoRedoContext';
import { useEffect } from 'react';

interface DashboardLayoutProps {
  children: ReactNode;
  currentView: string;
  onDataRefresh?: () => void;
}

export default function DashboardLayout({ children, currentView, onDataRefresh }: DashboardLayoutProps) {
  const defaultTeamId = '00000000-0000-0000-0000-000000000001';
  const { theme, effectiveTheme, setTheme } = useTheme();
  const { canUndo, canRedo, undo, redo } = useUndoRedo();

  useEffect(() => {
    const handleKeyboard = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [undo, redo]);

  const navigation = [
    { name: 'Dashboard', icon: LayoutDashboard, href: '#', view: '' },
    { name: 'Daily Tasks', icon: CheckSquare, href: '#tasks', view: 'tasks' },
    { name: 'Pipeline Health', icon: Activity, href: '#health', view: 'health' },
    { name: 'Look-Alike Prospects', icon: UserCheck, href: '#lookalike', view: 'lookalike' },
    { name: 'Performance', icon: Award, href: '#performance', view: 'performance' },
    { name: 'Social Selling', icon: Linkedin, href: '#social', view: 'social' },
    { name: 'Integration Hub', icon: Plug, href: '#integration-hub', view: 'integration-hub' },
    { name: 'Research Center', icon: Search, href: '#research-center', view: 'research-center' },
    { name: 'Integrations', icon: Plug, href: '#integrations', view: 'integrations' },
    { name: 'Prospects', icon: Users, href: '#prospects', view: 'prospects' },
    { name: 'Cadences', icon: Target, href: '#cadences', view: 'cadences' },
    { name: 'Pipeline', icon: TrendingUp, href: '#pipeline', view: 'pipeline' },
    { name: 'Conversations', icon: MessageSquare, href: '#conversations', view: 'conversations' },
    { name: 'Analytics', icon: BarChart3, href: '#analytics', view: 'analytics' },
    { name: 'AI Agents', icon: Sparkles, href: '#ai', view: 'ai' },
    { name: 'Knowledge Base', icon: Book, href: '#knowledge', view: 'knowledge' },
  ];

  const isActive = (view: string) => currentView === view;

  const toggleTheme = () => {
    if (theme === 'light') setTheme('dark');
    else if (theme === 'dark') setTheme('auto');
    else setTheme('light');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex transition-colors">
      <aside className="w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col transition-colors">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-br from-blue-600 to-cyan-600 p-2 rounded-lg">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">RevOrch</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">Revenue Platform</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navigation.map((item) => (
            <a
              key={item.name}
              href={item.href}
              className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg transition ${
                isActive(item.view)
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.name}</span>
            </a>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-slate-700 space-y-2">
          <button
            onClick={toggleTheme}
            className="w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
            title={`Theme: ${theme}`}
          >
            {effectiveTheme === 'dark' ? (
              <Moon className="w-4 h-4" />
            ) : (
              <Sun className="w-4 h-4" />
            )}
            <span className="text-sm capitalize">{theme}</span>
          </button>
          <a
            href="#settings"
            className={`w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-lg transition ${
              isActive('settings')
                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span className="text-sm">Settings</span>
          </a>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-between transition-colors">
          <GlobalSearch />
          <div className="flex items-center space-x-3">
            <button
              onClick={undo}
              disabled={!canUndo}
              className={`p-2 rounded-lg transition ${
                canUndo
                  ? 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700'
                  : 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
              }`}
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="w-5 h-5" />
            </button>
            <button
              onClick={redo}
              disabled={!canRedo}
              className={`p-2 rounded-lg transition ${
                canRedo
                  ? 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700'
                  : 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
              }`}
              title="Redo (Ctrl+Y)"
            >
              <Redo2 className="w-5 h-5" />
            </button>
            <NotificationCenter />
          </div>
        </div>
        <div className="p-8">{children}</div>
      </main>

      <AIAssistantChat
        teamId={defaultTeamId}
        onActionExecuted={onDataRefresh}
      />
    </div>
  );
}
