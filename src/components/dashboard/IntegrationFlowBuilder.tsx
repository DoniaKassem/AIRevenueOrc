import React, { useState, useEffect } from 'react';
import {
  Plus,
  Play,
  Save,
  Trash2,
  Settings,
  GitBranch,
  Zap,
  Clock,
  Code,
  Globe,
  ChevronRight,
  Edit2,
} from 'lucide-react';
import {
  createFlow,
  updateFlow,
  deleteFlow,
  getFlows,
  executeFlow,
  type FlowNode,
  type FlowEdge,
  type FlowDefinition,
} from '../../lib/flowEngine';
import { useAuth } from '../../contexts/AuthContext';

interface IntegrationFlowBuilderProps {
  onNavigate: (view: string) => void;
  flowId?: string;
}

const NODE_TYPES = [
  { type: 'trigger', label: 'Trigger', icon: Zap, color: 'blue', description: 'Start the flow' },
  { type: 'action', label: 'Action', icon: GitBranch, color: 'green', description: 'Perform an action' },
  { type: 'condition', label: 'Condition', icon: GitBranch, color: 'yellow', description: 'Branch logic' },
  { type: 'transform', label: 'Transform', icon: Code, color: 'purple', description: 'Transform data' },
  { type: 'delay', label: 'Delay', icon: Clock, color: 'orange', description: 'Wait for duration' },
  { type: 'http_request', label: 'HTTP Request', icon: Globe, color: 'indigo', description: 'Make API call' },
];

export default function IntegrationFlowBuilder({
  onNavigate,
  flowId,
}: IntegrationFlowBuilderProps) {
  const { user } = useAuth();
  const [flows, setFlows] = useState<any[]>([]);
  const [selectedFlow, setSelectedFlow] = useState<any | null>(null);
  const [flowName, setFlowName] = useState('');
  const [flowDescription, setFlowDescription] = useState('');
  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [edges, setEdges] = useState<FlowEdge[]>([]);
  const [selectedNode, setSelectedNode] = useState<FlowNode | null>(null);
  const [showNodeConfig, setShowNodeConfig] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [executing, setExecuting] = useState(false);

  useEffect(() => {
    loadFlows();
  }, [user]);

  useEffect(() => {
    if (flowId) {
      const flow = flows.find(f => f.id === flowId);
      if (flow) {
        loadFlow(flow);
      }
    }
  }, [flowId, flows]);

  async function loadFlows() {
    if (!user?.team_id) return;

    const flowsData = await getFlows(user.team_id);
    setFlows(flowsData);
  }

  function loadFlow(flow: any) {
    setSelectedFlow(flow);
    setFlowName(flow.name);
    setFlowDescription(flow.description || '');
    setNodes(flow.flow_definition?.nodes || []);
    setEdges(flow.flow_definition?.edges || []);
    setIsEditMode(true);
  }

  function handleAddNode(nodeType: string) {
    const newNode: FlowNode = {
      id: `node_${Date.now()}`,
      type: nodeType as any,
      label: NODE_TYPES.find(t => t.type === nodeType)?.label || nodeType,
      config: {},
      position: { x: 100, y: nodes.length * 150 + 100 },
    };

    setNodes([...nodes, newNode]);

    // Auto-connect to previous node if exists
    if (nodes.length > 0) {
      const previousNode = nodes[nodes.length - 1];
      const newEdge: FlowEdge = {
        id: `edge_${Date.now()}`,
        source: previousNode.id,
        target: newNode.id,
      };
      setEdges([...edges, newEdge]);
    }
  }

  function handleRemoveNode(nodeId: string) {
    setNodes(nodes.filter(n => n.id !== nodeId));
    setEdges(edges.filter(e => e.source !== nodeId && e.target !== nodeId));
    if (selectedNode?.id === nodeId) {
      setSelectedNode(null);
      setShowNodeConfig(false);
    }
  }

  function handleUpdateNode(nodeId: string, config: any) {
    setNodes(nodes.map(node =>
      node.id === nodeId ? { ...node, config: { ...node.config, ...config } } : node
    ));
  }

  async function handleSaveFlow() {
    if (!user?.team_id || !user?.id) return;

    if (!flowName.trim()) {
      alert('Please enter a flow name');
      return;
    }

    if (nodes.length === 0) {
      alert('Please add at least one node to the flow');
      return;
    }

    setSaving(true);

    try {
      const flowDefinition: FlowDefinition = {
        nodes,
        edges,
        version: '1.0',
      };

      if (selectedFlow) {
        // Update existing flow
        const success = await updateFlow(selectedFlow.id, {
          name: flowName,
          description: flowDescription,
          flowDefinition,
        });

        if (success) {
          alert('Flow updated successfully!');
          await loadFlows();
        } else {
          alert('Failed to update flow');
        }
      } else {
        // Create new flow
        const triggerNode = nodes.find(n => n.type === 'trigger');
        const flowId = await createFlow(
          user.team_id,
          flowName,
          flowDescription,
          triggerNode ? 'manual' : 'schedule',
          {},
          flowDefinition,
          user.id
        );

        if (flowId) {
          alert('Flow created successfully!');
          await loadFlows();
          setIsEditMode(true);
        } else {
          alert('Failed to create flow');
        }
      }
    } catch (error) {
      console.error('Error saving flow:', error);
      alert('An error occurred while saving the flow');
    } finally {
      setSaving(false);
    }
  }

  async function handleExecuteFlow() {
    if (!selectedFlow) {
      alert('Please save the flow before executing');
      return;
    }

    setExecuting(true);

    try {
      const result = await executeFlow(selectedFlow.id, {});

      if (result.status === 'completed') {
        alert(`Flow executed successfully in ${result.duration}ms`);
      } else {
        alert(`Flow execution failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Error executing flow:', error);
      alert('An error occurred while executing the flow');
    } finally {
      setExecuting(false);
    }
  }

  async function handleDeleteFlow() {
    if (!selectedFlow) return;

    if (!confirm(`Are you sure you want to delete "${selectedFlow.name}"?`)) {
      return;
    }

    const success = await deleteFlow(selectedFlow.id);

    if (success) {
      alert('Flow deleted successfully');
      setSelectedFlow(null);
      setNodes([]);
      setEdges([]);
      setFlowName('');
      setFlowDescription('');
      setIsEditMode(false);
      await loadFlows();
    } else {
      alert('Failed to delete flow');
    }
  }

  function handleNewFlow() {
    setSelectedFlow(null);
    setNodes([]);
    setEdges([]);
    setFlowName('');
    setFlowDescription('');
    setIsEditMode(false);
    setSelectedNode(null);
    setShowNodeConfig(false);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Flow Builder</h1>
          <p className="text-sm text-gray-600 mt-1">
            Create automated workflows between your integrations
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleNewFlow}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Plus className="w-4 h-4" />
            New Flow
          </button>
          <button
            onClick={() => onNavigate('control-center')}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Back to Control Center
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Sidebar - Existing Flows */}
        <div className="col-span-3 space-y-4">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-3">Your Flows</h3>
            <div className="space-y-2">
              {flows.map(flow => (
                <button
                  key={flow.id}
                  onClick={() => loadFlow(flow)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedFlow?.id === flow.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="font-medium text-sm text-gray-900">{flow.name}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {flow.execution_count || 0} executions
                  </div>
                </button>
              ))}
              {flows.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">
                  No flows yet. Create your first flow!
                </p>
              )}
            </div>
          </div>

          {/* Node Types */}
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-3">Add Node</h3>
            <div className="space-y-2">
              {NODE_TYPES.map(nodeType => {
                const Icon = nodeType.icon;
                return (
                  <button
                    key={nodeType.type}
                    onClick={() => handleAddNode(nodeType.type)}
                    className="w-full flex items-center gap-3 p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    <Icon className={`w-5 h-5 text-${nodeType.color}-600`} />
                    <div className="flex-1 text-left">
                      <div className="text-sm font-medium text-gray-900">{nodeType.label}</div>
                      <div className="text-xs text-gray-500">{nodeType.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Main Canvas */}
        <div className="col-span-9 space-y-4">
          {/* Flow Info */}
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Flow name..."
                value={flowName}
                onChange={(e) => setFlowName(e.target.value)}
                className="w-full text-lg font-semibold border-0 border-b-2 border-gray-200 focus:border-blue-500 focus:ring-0 px-0"
              />
              <textarea
                placeholder="Flow description..."
                value={flowDescription}
                onChange={(e) => setFlowDescription(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={2}
              />
            </div>
          </div>

          {/* Flow Canvas */}
          <div className="bg-white p-6 rounded-lg border border-gray-200 min-h-[500px]">
            {nodes.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Zap className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 mb-2">No nodes yet</p>
                  <p className="text-sm text-gray-500">
                    Add nodes from the sidebar to build your flow
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {nodes.map((node, index) => {
                  const nodeTypeConfig = NODE_TYPES.find(t => t.type === node.type);
                  const Icon = nodeTypeConfig?.icon || Zap;

                  return (
                    <div key={node.id}>
                      {/* Node Card */}
                      <div
                        className={`relative p-4 rounded-lg border-2 transition-all cursor-pointer ${
                          selectedNode?.id === node.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                        onClick={() => {
                          setSelectedNode(node);
                          setShowNodeConfig(true);
                        }}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg bg-${nodeTypeConfig?.color}-100`}>
                              <Icon className={`w-5 h-5 text-${nodeTypeConfig?.color}-600`} />
                            </div>
                            <div>
                              <h4 className="font-medium text-gray-900">{node.label}</h4>
                              <p className="text-xs text-gray-500 mt-1">
                                {nodeTypeConfig?.description}
                              </p>
                              {Object.keys(node.config).length > 0 && (
                                <div className="mt-2 text-xs text-gray-600">
                                  <code className="bg-gray-100 px-2 py-1 rounded">
                                    {JSON.stringify(node.config).slice(0, 50)}...
                                  </code>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedNode(node);
                                setShowNodeConfig(true);
                              }}
                              className="p-1 hover:bg-gray-100 rounded"
                            >
                              <Edit2 className="w-4 h-4 text-gray-400" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveNode(node.id);
                              }}
                              className="p-1 hover:bg-gray-100 rounded"
                            >
                              <Trash2 className="w-4 h-4 text-red-400" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Connector Arrow */}
                      {index < nodes.length - 1 && (
                        <div className="flex items-center justify-center py-2">
                          <ChevronRight className="w-6 h-6 text-gray-400 transform rotate-90" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Node Configuration Panel */}
          {showNodeConfig && selectedNode && (
            <div className="bg-white p-4 rounded-lg border border-blue-500">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Configure: {selectedNode.label}</h3>
                <button
                  onClick={() => {
                    setShowNodeConfig(false);
                    setSelectedNode(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>

              <div className="space-y-3">
                {/* Generic configuration inputs based on node type */}
                {selectedNode.type === 'action' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Action Type
                      </label>
                      <select
                        value={selectedNode.config.actionType || ''}
                        onChange={(e) => handleUpdateNode(selectedNode.id, { actionType: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select action...</option>
                        <option value="create_prospect">Create Prospect</option>
                        <option value="update_deal">Update Deal</option>
                        <option value="send_email">Send Email</option>
                        <option value="create_activity">Create Activity</option>
                      </select>
                    </div>
                  </>
                )}

                {selectedNode.type === 'condition' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Condition
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., email contains 'gmail'"
                      value={selectedNode.config.condition || ''}
                      onChange={(e) => handleUpdateNode(selectedNode.id, { condition: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}

                {selectedNode.type === 'delay' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Delay (milliseconds)
                    </label>
                    <input
                      type="number"
                      placeholder="1000"
                      value={selectedNode.config.delayMs || ''}
                      onChange={(e) => handleUpdateNode(selectedNode.id, { delayMs: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}

                {selectedNode.type === 'http_request' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        URL
                      </label>
                      <input
                        type="url"
                        placeholder="https://api.example.com/endpoint"
                        value={selectedNode.config.url || ''}
                        onChange={(e) => handleUpdateNode(selectedNode.id, { url: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Method
                      </label>
                      <select
                        value={selectedNode.config.method || 'GET'}
                        onChange={(e) => handleUpdateNode(selectedNode.id, { method: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="GET">GET</option>
                        <option value="POST">POST</option>
                        <option value="PUT">PUT</option>
                        <option value="DELETE">DELETE</option>
                      </select>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex gap-3">
              <button
                onClick={handleSaveFlow}
                disabled={saving || nodes.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    {selectedFlow ? 'Update Flow' : 'Save Flow'}
                  </>
                )}
              </button>

              {selectedFlow && (
                <button
                  onClick={handleExecuteFlow}
                  disabled={executing}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {executing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Executing...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      Test Flow
                    </>
                  )}
                </button>
              )}
            </div>

            {selectedFlow && (
              <button
                onClick={handleDeleteFlow}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                <Trash2 className="w-4 h-4" />
                Delete Flow
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
