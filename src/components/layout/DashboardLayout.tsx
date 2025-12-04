import { ReactNode, useState } from 'react';
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
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import AIAssistantChat from '../common/AIAssistantChat';
import GlobalSearch from '../common/GlobalSearch';
import NotificationCenter from '../common/NotificationCenter';
import { useTheme } from '../../contexts/ThemeContext';
import { useUndoRedo } from '../../contexts/UndoRedoContext';
import { useEffect } from 'react';

interface NavItem {
  name: string;
  icon: any;
  href: string;
  view: string;
}

interface NavSection {
  name: string;
  icon: any;
  items: NavItem[];
  defaultOpen?: boolean;
}

interface DashboardLayoutProps {
  children: ReactNode;
  currentView: string;
  onDataRefresh?: () => void;
}

export default function DashboardLayout({ children, currentView, onDataRefresh }: DashboardLayoutProps) {
  const defaultTeamId = '00000000-0000-0000-0000-000000000001';
  const { theme, effectiveTheme, setTheme } = useTheme();
  const { canUndo, canRedo, undo, redo } = useUndoRedo();

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    'Analytics & Insights': true,
    'Integrations': true,
  });

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

  const navigationSections: NavSection[] = [
    {
      name: 'Analytics & Insights',
      icon: BarChart3,
      defaultOpen: true,
      items: [
        { name: 'Dashboard', icon: LayoutDashboard, href: '#', view: '' },
        { name: 'Daily Tasks', icon: CheckSquare, href: '#tasks', view: 'tasks' },
        { name: 'Performance', icon: Award, href: '#performance', view: 'performance' },
        { name: 'Pipeline Health', icon: Activity, href: '#health', view: 'health' },
        { name: 'Analytics', icon: BarChart3, href: '#analytics', view: 'analytics' },
      ],
    },
    {
      name: 'Integrations',
      icon: Plug,
      defaultOpen: true,
      items: [
        { name: 'Integration Hub', icon: Plug, href: '#integration-hub', view: 'integration-hub' },
        { name: 'Integrations', icon: Plug, href: '#integrations', view: 'integrations' },
      ],
    },
  ];

  const standaloneNavigation: NavItem[] = [
    { name: 'Look-Alike Prospects', icon: UserCheck, href: '#lookalike', view: 'lookalike' },
    { name: 'Social Selling', icon: Linkedin, href: '#social', view: 'social' },
    { name: 'Research Center', icon: Search, href: '#research-center', view: 'research-center' },
    { name: 'Prospects', icon: Users, href: '#prospects', view: 'prospects' },
    { name: 'Cadences', icon: Target, href: '#cadences', view: 'cadences' },
    { name: 'Pipeline', icon: TrendingUp, href: '#pipeline', view: 'pipeline' },
    { name: 'Conversations', icon: MessageSquare, href: '#conversations', view: 'conversations' },
    { name: 'AI Agents', icon: Sparkles, href: '#ai', view: 'ai' },
    { name: 'Knowledge Base', icon: Book, href: '#knowledge', view: 'knowledge' },
  ];

  const isActive = (view: string) => currentView === view;

  const isSectionActive = (section: NavSection) => {
    return section.items.some(item => isActive(item.view));
  };

  const toggleSection = (sectionName: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionName]: !prev[sectionName],
    }));
  };

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

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navigationSections.map((section) => (
            <div key={section.name} className="mb-2">
              <button
                onClick={() => toggleSection(section.name)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition ${
                  isSectionActive(section)
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'
                }`}
                data-testid={`section-${section.name.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <div className="flex items-center space-x-3">
                  <section.icon className="w-5 h-5" />
                  <span className="font-medium">{section.name}</span>
                </div>
                {expandedSections[section.name] ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>
              {expandedSections[section.name] && (
                <div className="ml-4 mt-1 space-y-1">
                  {section.items.map((item) => (
                    <a
                      key={item.name}
                      href={item.href}
                      className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition ${
                        isActive(item.view)
                          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'
                      }`}
                      data-testid={`nav-${item.view || 'dashboard'}`}
                    >
                      <item.icon className="w-4 h-4" />
                      <span className="text-sm">{item.name}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}

          <div className="border-t border-slate-200 dark:border-slate-700 my-3 pt-3">
            {standaloneNavigation.map((item) => (
              <a
                key={item.name}
                href={item.href}
                className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg transition ${
                  isActive(item.view)
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'
                }`}
                data-testid={`nav-${item.view}`}
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.name}</span>
              </a>
            ))}
          </div>
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-slate-700 space-y-2">
          <button
            onClick={toggleTheme}
            className="w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
            title={`Theme: ${theme}`}
            data-testid="button-theme-toggle"
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
            data-testid="nav-settings"
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
              data-testid="button-undo"
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
              data-testid="button-redo"
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
