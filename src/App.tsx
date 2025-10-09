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
      case 'settings':
        return <SettingsView />;
      default:
        return <DashboardHome />;
    }
  };

  return <DashboardLayout>{renderView()}</DashboardLayout>;
}

export default App;
