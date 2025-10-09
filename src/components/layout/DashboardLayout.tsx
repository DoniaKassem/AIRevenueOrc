import { ReactNode } from 'react';
import {
  LayoutDashboard,
  Users,
  Target,
  Mail,
  Phone,
  TrendingUp,
  Settings,
  Sparkles,
  MessageSquare,
  BarChart3,
  Book,
  LineChart,
} from 'lucide-react';
import AIAssistantChat from '../common/AIAssistantChat';
import GlobalSearch from '../common/GlobalSearch';

interface DashboardLayoutProps {
  children: ReactNode;
  onDataRefresh?: () => void;
}

export default function DashboardLayout({ children, onDataRefresh }: DashboardLayoutProps) {
  const defaultTeamId = '00000000-0000-0000-0000-000000000001';
  const navigation = [
    { name: 'Dashboard', icon: LayoutDashboard, href: '#' },
    { name: 'Prospects', icon: Users, href: '#prospects' },
    { name: 'Cadences', icon: Target, href: '#cadences' },
    { name: 'Pipeline', icon: TrendingUp, href: '#pipeline' },
    { name: 'Conversations', icon: MessageSquare, href: '#conversations' },
    { name: 'Analytics', icon: BarChart3, href: '#analytics' },
    { name: 'Advanced Analytics', icon: LineChart, href: '#advanced-analytics' },
    { name: 'AI Agents', icon: Sparkles, href: '#ai' },
    { name: 'Knowledge Base', icon: Book, href: '#knowledge' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-br from-blue-600 to-cyan-600 p-2 rounded-lg">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">RevOrch</h1>
              <p className="text-xs text-slate-500">Revenue Platform</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navigation.map((item) => (
            <a
              key={item.name}
              href={item.href}
              className="flex items-center space-x-3 px-3 py-2.5 rounded-lg text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition"
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.name}</span>
            </a>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-200">
          <a
            href="#settings"
            className="w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-100 transition"
          >
            <Settings className="w-4 h-4" />
            <span className="text-sm">Settings</span>
          </a>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="p-4 border-b border-slate-200 bg-white flex items-center justify-between">
          <GlobalSearch />
          <div className="flex items-center space-x-3">
            <span className="text-sm text-slate-600">Quick Actions</span>
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
