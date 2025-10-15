import { useState, useEffect } from 'react';
import DashboardLayout from './components/layout/DashboardLayout';
import DashboardHome from './components/dashboard/DashboardHome';
import ProspectsView from './components/dashboard/ProspectsView';
import CadencesView from './components/dashboard/CadencesView';
import PipelineView from './components/dashboard/PipelineView';
import ConversationsView from './components/dashboard/ConversationsView';
import AIAgentsView from './components/dashboard/AIAgentsView';
import AnalyticsView from './components/dashboard/AnalyticsView';
import AdvancedAnalyticsView from './components/dashboard/AdvancedAnalyticsView';
import SettingsView from './components/dashboard/SettingsView';
import KnowledgeBaseView from './components/dashboard/KnowledgeBaseView';
import DailyTasksView from './components/dashboard/DailyTasksView';
import PipelineHealthView from './components/dashboard/PipelineHealthView';
import KeyboardShortcuts from './components/common/KeyboardShortcuts';
import { ThemeProvider } from './contexts/ThemeContext';
import { UndoRedoProvider } from './contexts/UndoRedoContext';

function App() {
  const [currentView, setCurrentView] = useState('');

  useEffect(() => {
    const handleHashChange = () => {
      setCurrentView(window.location.hash.slice(1));
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  const renderView = () => {
    switch (currentView) {
      case 'prospects':
        return <ProspectsView />;
      case 'cadences':
        return <CadencesView />;
      case 'pipeline':
        return <PipelineView />;
      case 'conversations':
        return <ConversationsView />;
      case 'ai':
        return <AIAgentsView />;
      case 'knowledge':
        return <KnowledgeBaseView />;
      case 'analytics':
        return <AnalyticsView />;
      case 'advanced-analytics':
        return <AdvancedAnalyticsView />;
      case 'tasks':
        return <DailyTasksView />;
      case 'health':
        return <PipelineHealthView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <DashboardHome />;
    }
  };

  return (
    <ThemeProvider>
      <UndoRedoProvider>
        <DashboardLayout currentView={currentView}>{renderView()}</DashboardLayout>
        <KeyboardShortcuts onNavigate={setCurrentView} />
      </UndoRedoProvider>
    </ThemeProvider>
  );
}

export default App;
