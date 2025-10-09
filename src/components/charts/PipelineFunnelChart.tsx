interface FunnelData {
  stage: string;
  count: number;
  value: number;
}

interface PipelineFunnelChartProps {
  data: FunnelData[];
}

export default function PipelineFunnelChart({ data }: PipelineFunnelChartProps) {
  const maxCount = Math.max(...data.map(d => d.count));

  const stageColors: Record<number, string> = {
    0: 'bg-blue-500',
    1: 'bg-cyan-500',
    2: 'bg-teal-500',
    3: 'bg-green-500',
    4: 'bg-emerald-500',
  };

  const stageLabels: Record<string, string> = {
    discovery: 'Discovery',
    qualification: 'Qualification',
    proposal: 'Proposal',
    negotiation: 'Negotiation',
    closed_won: 'Closed Won',
  };

  return (
    <div className="space-y-4">
      {data.map((item, index) => {
        const width = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
        const conversionRate = index > 0
          ? ((item.count / data[index - 1].count) * 100).toFixed(1)
          : '100';

        return (
          <div key={item.stage} className="relative">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-700">
                {stageLabels[item.stage] || item.stage}
              </span>
              <div className="flex items-center space-x-4">
                <span className="text-xs text-slate-600">
                  {item.count} deals
                </span>
                <span className="text-xs font-medium text-slate-900">
                  ${(item.value / 1000).toFixed(0)}K
                </span>
                {index > 0 && (
                  <span className={`text-xs font-medium ${
                    parseFloat(conversionRate) >= 50 ? 'text-green-600' : 'text-amber-600'
                  }`}>
                    {conversionRate}% conversion
                  </span>
                )}
              </div>
            </div>

            <div className="relative h-12 bg-slate-100 rounded-lg overflow-hidden">
              <div
                className={`h-full ${stageColors[index] || 'bg-slate-500'} transition-all duration-500 flex items-center justify-center`}
                style={{ width: `${width}%` }}
              >
                {width > 20 && (
                  <span className="text-white font-medium text-sm">
                    {item.count}
                  </span>
                )}
              </div>
            </div>

            {index < data.length - 1 && (
              <div className="flex justify-center my-2">
                <div className="w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-slate-300" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
