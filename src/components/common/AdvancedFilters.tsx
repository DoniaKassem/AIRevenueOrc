import { useState } from 'react';
import { Filter, X, Save, Tag } from 'lucide-react';
import Modal from './Modal';

interface FilterConfig {
  field: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'between';
  value: string | number;
  value2?: string | number;
}

interface SavedFilter {
  id: string;
  name: string;
  filters: FilterConfig[];
}

interface AdvancedFiltersProps {
  fields: Array<{
    name: string;
    label: string;
    type: 'text' | 'number' | 'date' | 'select';
    options?: string[];
  }>;
  onApplyFilters: (filters: FilterConfig[]) => void;
  savedFilters?: SavedFilter[];
  onSaveFilter?: (name: string, filters: FilterConfig[]) => void;
}

export default function AdvancedFilters({
  fields,
  onApplyFilters,
  savedFilters = [],
  onSaveFilter,
}: AdvancedFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState<FilterConfig[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [filterName, setFilterName] = useState('');

  const operators = [
    { value: 'equals', label: 'Equals' },
    { value: 'contains', label: 'Contains' },
    { value: 'greater_than', label: 'Greater than' },
    { value: 'less_than', label: 'Less than' },
    { value: 'between', label: 'Between' },
  ];

  const addFilter = () => {
    setActiveFilters([
      ...activeFilters,
      { field: fields[0].name, operator: 'equals', value: '' },
    ]);
  };

  const updateFilter = (index: number, updates: Partial<FilterConfig>) => {
    const newFilters = [...activeFilters];
    newFilters[index] = { ...newFilters[index], ...updates };
    setActiveFilters(newFilters);
  };

  const removeFilter = (index: number) => {
    setActiveFilters(activeFilters.filter((_, i) => i !== index));
  };

  const applyFilters = () => {
    onApplyFilters(activeFilters);
    setIsOpen(false);
  };

  const clearFilters = () => {
    setActiveFilters([]);
    onApplyFilters([]);
  };

  const loadSavedFilter = (saved: SavedFilter) => {
    setActiveFilters(saved.filters);
    onApplyFilters(saved.filters);
    setIsOpen(false);
  };

  const saveCurrentFilter = () => {
    if (filterName.trim() && onSaveFilter) {
      onSaveFilter(filterName, activeFilters);
      setFilterName('');
      setShowSaveModal(false);
    }
  };

  return (
    <>
      <div className="flex items-center space-x-2">
        <button
          onClick={() => setIsOpen(true)}
          className={`flex items-center space-x-2 px-4 py-2 border rounded-lg transition ${
            activeFilters.length > 0
              ? 'bg-blue-50 border-blue-300 text-blue-700'
              : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Filter className="w-4 h-4" />
          <span>Filters</span>
          {activeFilters.length > 0 && (
            <span className="bg-blue-600 text-white text-xs font-medium px-2 py-0.5 rounded-full">
              {activeFilters.length}
            </span>
          )}
        </button>

        {savedFilters.length > 0 && (
          <div className="flex items-center space-x-1">
            {savedFilters.slice(0, 3).map((saved) => (
              <button
                key={saved.id}
                onClick={() => loadSavedFilter(saved)}
                className="flex items-center space-x-1 px-3 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 text-xs transition"
              >
                <Tag className="w-3 h-3" />
                <span>{saved.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Advanced Filters"
      >
        <div className="space-y-4">
          <div className="space-y-3">
            {activeFilters.map((filter, index) => {
              const field = fields.find((f) => f.name === filter.field);
              return (
                <div
                  key={index}
                  className="flex items-center space-x-2 p-3 bg-slate-50 rounded-lg"
                >
                  <select
                    value={filter.field}
                    onChange={(e) => updateFilter(index, { field: e.target.value })}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  >
                    {fields.map((f) => (
                      <option key={f.name} value={f.name}>
                        {f.label}
                      </option>
                    ))}
                  </select>

                  <select
                    value={filter.operator}
                    onChange={(e) =>
                      updateFilter(index, {
                        operator: e.target.value as FilterConfig['operator'],
                      })
                    }
                    className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  >
                    {operators.map((op) => (
                      <option key={op.value} value={op.value}>
                        {op.label}
                      </option>
                    ))}
                  </select>

                  {field?.type === 'select' && field.options ? (
                    <select
                      value={filter.value}
                      onChange={(e) => updateFilter(index, { value: e.target.value })}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    >
                      <option value="">Select...</option>
                      {field.options.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field?.type === 'number' ? 'number' : 'text'}
                      value={filter.value}
                      onChange={(e) => updateFilter(index, { value: e.target.value })}
                      placeholder="Value"
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                  )}

                  {filter.operator === 'between' && (
                    <input
                      type={field?.type === 'number' ? 'number' : 'text'}
                      value={filter.value2 || ''}
                      onChange={(e) => updateFilter(index, { value2: e.target.value })}
                      placeholder="To"
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                  )}

                  <button
                    onClick={() => removeFilter(index)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>

          <button
            onClick={addFilter}
            className="w-full px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition"
          >
            + Add Filter
          </button>

          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
            <div className="flex items-center space-x-2">
              <button
                onClick={clearFilters}
                className="text-sm text-slate-600 hover:text-slate-900"
              >
                Clear All
              </button>
              {onSaveFilter && activeFilters.length > 0 && (
                <button
                  onClick={() => setShowSaveModal(true)}
                  className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-700"
                >
                  <Save className="w-3 h-3" />
                  <span>Save Preset</span>
                </button>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={applyFilters}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        title="Save Filter Preset"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Preset Name
            </label>
            <input
              type="text"
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              placeholder="e.g., High Priority Prospects"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-200">
            <button
              onClick={() => setShowSaveModal(false)}
              className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              onClick={saveCurrentFilter}
              disabled={!filterName.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save Preset
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
