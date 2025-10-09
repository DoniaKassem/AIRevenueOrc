interface TimelineData {
  period: string;
  revenue: number;
  deals: number;
}

interface RevenueTimelineChartProps {
  data: TimelineData[];
}

export default function RevenueTimelineChart({ data }: RevenueTimelineChartProps) {
  const maxRevenue = Math.max(...data.map(d => d.revenue));

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between space-x-2 h-64">
        {data.map((item, index) => {
          const height = maxRevenue > 0 ? (item.revenue / maxRevenue) * 100 : 0;

          return (
            <div key={index} className="flex-1 flex flex-col items-center">
              <div className="w-full flex flex-col justify-end h-full">
                <div className="relative group">
                  <div
                    className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-lg transition-all duration-300 hover:from-blue-700 hover:to-blue-500 cursor-pointer"
                    style={{ height: `${height}%`, minHeight: '4px' }}
                  >
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                      ${(item.revenue / 1000).toFixed(0)}K
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-2 text-center">
                <p className="text-xs font-medium text-slate-700">{item.period}</p>
                <p className="text-xs text-slate-500">{item.deals} deals</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-center space-x-6 pt-4 border-t border-slate-200">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-gradient-to-t from-blue-600 to-blue-400 rounded" />
          <span className="text-xs text-slate-600">Revenue</span>
        </div>
      </div>
    </div>
  );
}
