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
import LookAlikeProspectsView from './components/dashboard/LookAlikeProspectsView';
import PerformanceDashboardView from './components/dashboard/PerformanceDashboardView';
import SocialSellingView from './components/dashboard/SocialSellingView';
import IntegrationsView from './components/dashboard/IntegrationsView';
import IntegrationControlCenter from './components/dashboard/IntegrationControlCenter';
import IntegrationMarketplace from './components/dashboard/IntegrationMarketplace';
import IntegrationFlowBuilder from './components/dashboard/IntegrationFlowBuilder';
import ResearchCenter from './components/dashboard/ResearchCenter';
import KeyboardShortcuts from './components/common/KeyboardShortcuts';
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
    // Helper function to navigate between integration hub views
    const handleIntegrationNavigate = (view: string, integrationId?: string) => {
      if (view === 'control-center') {
        window.location.hash = 'integration-hub';
      } else if (view === 'marketplace') {
        window.location.hash = 'integration-marketplace';
      } else if (view === 'flow-builder') {
        window.location.hash = 'integration-flows';
      } else if (view === 'integration-details' && integrationId) {
        window.location.hash = `integration-details-${integrationId}`;
      }
    };

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
      case 'lookalike':
        return <LookAlikeProspectsView />;
      case 'performance':
        return <PerformanceDashboardView />;
      case 'social':
        return <SocialSellingView />;
      case 'integrations':
        return <IntegrationsView />;
      case 'integration-hub':
        return <IntegrationControlCenter onNavigate={handleIntegrationNavigate} />;
      case 'integration-marketplace':
        return <IntegrationMarketplace onNavigate={handleIntegrationNavigate} />;
      case 'integration-flows':
        return <IntegrationFlowBuilder onNavigate={handleIntegrationNavigate} />;
      case 'research-center':
        return <ResearchCenter />;
      case 'settings':
        return <SettingsView />;
      default:
        return <DashboardHome />;
    }
  };

  return (
    <UndoRedoProvider>
      <DashboardLayout currentView={currentView}>{renderView()}</DashboardLayout>
      <KeyboardShortcuts onNavigate={setCurrentView} />
    </UndoRedoProvider>
  );
}

export default App;
