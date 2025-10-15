import { useEffect, useState } from 'react';
import { CheckCircle, Circle, Clock, AlertTriangle, ChevronRight, Calendar } from 'lucide-react';
import { Task, generateDailyTasks, getTaskUrgency } from '../../lib/taskPrioritization';

export default function DailyTasksView() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all');
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadTasks();
  }, []);

  async function loadTasks() {
    setLoading(true);
    try {
      const realTasks = await generateDailyTasks('00000000-0000-0000-0000-000000000001');
      setTasks(realTasks);
    } catch (error) {
      console.error('Error loading tasks:', error);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }

  const toggleTask = (taskId: string) => {
    const newCompleted = new Set(completedTasks);
    if (newCompleted.has(taskId)) {
      newCompleted.delete(taskId);
    } else {
      newCompleted.add(taskId);
    }
    setCompletedTasks(newCompleted);
  };

  const filteredTasks =
    filter === 'all' ? tasks : tasks.filter(t => t.urgency === filter);

  const totalEstimatedTime = filteredTasks
    .filter(t => !completedTasks.has(t.id))
    .reduce((sum, t) => sum + t.estimated_minutes, 0);

  const getUrgencyColor = (urgency: Task['urgency']) => {
    switch (urgency) {
      case 'critical':
        return 'border-red-500 bg-red-50 dark:bg-red-900/20';
      case 'high':
        return 'border-orange-500 bg-orange-50 dark:bg-orange-900/20';
      case 'medium':
        return 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20';
      case 'low':
        return 'border-blue-500 bg-blue-50 dark:bg-blue-900/20';
    }
  };

  const getUrgencyBadgeColor = (urgency: Task['urgency']) => {
    switch (urgency) {
      case 'critical':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
      case 'high':
        return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'low':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
    }
  };

  const getTypeIcon = (type: Task['type']) => {
    switch (type) {
      case 'call':
        return '📞';
      case 'email':
        return '📧';
      case 'meeting':
        return '🤝';
      case 'demo':
        return '🖥️';
      case 'follow_up':
        return '🔄';
      case 'research':
        return '🔍';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/3 animate-pulse"></div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="h-24 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"
            ></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            Your Daily Tasks
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            AI-prioritized tasks to maximize your impact today
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-right">
            <div className="text-sm text-slate-600 dark:text-slate-400">Est. Time</div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {Math.floor(totalEstimatedTime / 60)}h {totalEstimatedTime % 60}m
            </div>
          </div>
          <button
            onClick={loadTasks}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="flex items-center space-x-2 bg-white dark:bg-slate-800 rounded-lg p-2 border border-slate-200 dark:border-slate-700">
        {(['all', 'critical', 'high', 'medium', 'low'] as const).map(level => (
          <button
            key={level}
            onClick={() => setFilter(level)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              filter === level
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            {level.charAt(0).toUpperCase() + level.slice(1)}
            {level !== 'all' && (
              <span className="ml-2 text-xs">
                ({tasks.filter(t => t.urgency === level).length})
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <div className="text-sm text-slate-600 dark:text-slate-400">Total Tasks</div>
          <div className="text-3xl font-bold text-slate-900 dark:text-white mt-1">
            {tasks.length}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <div className="text-sm text-slate-600 dark:text-slate-400">Completed</div>
          <div className="text-3xl font-bold text-green-600 dark:text-green-400 mt-1">
            {completedTasks.size}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <div className="text-sm text-slate-600 dark:text-slate-400">Critical</div>
          <div className="text-3xl font-bold text-red-600 dark:text-red-400 mt-1">
            {tasks.filter(t => t.urgency === 'critical').length}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <div className="text-sm text-slate-600 dark:text-slate-400">Progress</div>
          <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-1">
            {Math.round((completedTasks.size / tasks.length) * 100)}%
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {filteredTasks.map(task => {
          const isCompleted = completedTasks.has(task.id);

          return (
            <div
              key={task.id}
              className={`border-l-4 rounded-lg p-5 transition ${
                isCompleted
                  ? 'bg-slate-50 dark:bg-slate-800/50 opacity-60'
                  : `bg-white dark:bg-slate-800 ${getUrgencyColor(task.urgency)}`
              }`}
            >
              <div className="flex items-start space-x-4">
                <button
                  onClick={() => toggleTask(task.id)}
                  className="mt-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition"
                >
                  {isCompleted ? (
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  ) : (
                    <Circle className="w-6 h-6" />
                  )}
                </button>

                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">{getTypeIcon(task.type)}</span>
                      <h3
                        className={`text-lg font-semibold ${
                          isCompleted
                            ? 'line-through text-slate-500 dark:text-slate-400'
                            : 'text-slate-900 dark:text-white'
                        }`}
                      >
                        {task.title}
                      </h3>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getUrgencyBadgeColor(
                          task.urgency
                        )}`}
                      >
                        {task.urgency.toUpperCase()}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        Score: {task.priority_score}
                      </span>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center text-sm text-slate-600 dark:text-slate-400">
                        <Clock className="w-4 h-4 mr-1" />
                        {task.estimated_minutes}min
                      </div>
                      {task.due_date && (
                        <div className="flex items-center text-sm text-orange-600 dark:text-orange-400">
                          <Calendar className="w-4 h-4 mr-1" />
                          {new Date(task.due_date).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                    {task.description}
                  </p>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 text-sm">
                      <div>
                        <span className="text-slate-500 dark:text-slate-400">Prospect:</span>{' '}
                        <span className="font-medium text-slate-900 dark:text-white">
                          {task.prospect_name}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 dark:text-slate-400">Company:</span>{' '}
                        <span className="font-medium text-slate-900 dark:text-white">
                          {task.company}
                        </span>
                      </div>
                      {task.context.deal_value && (
                        <div>
                          <span className="text-slate-500 dark:text-slate-400">Value:</span>{' '}
                          <span className="font-medium text-green-600 dark:text-green-400">
                            ${(task.context.deal_value / 1000).toFixed(0)}K
                          </span>
                        </div>
                      )}
                    </div>
                    <button className="flex items-center space-x-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium">
                      <span>View Details</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredTasks.length === 0 && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🎉</div>
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
            All caught up!
          </h3>
          <p className="text-slate-600 dark:text-slate-400">
            No {filter !== 'all' ? filter : ''} tasks to show right now.
          </p>
        </div>
      )}
    </div>
  );
}
