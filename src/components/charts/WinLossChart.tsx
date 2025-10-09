interface WinLossData {
  period: string;
  won: number;
  lost: number;
}

interface WinLossChartProps {
  data: WinLossData[];
}

export default function WinLossChart({ data }: WinLossChartProps) {
  const maxValue = Math.max(...data.map(d => d.won + d.lost));

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between space-x-2 h-64">
        {data.map((item, index) => {
          const total = item.won + item.lost;
          const wonHeight = maxValue > 0 ? (item.won / maxValue) * 100 : 0;
          const lostHeight = maxValue > 0 ? (item.lost / maxValue) * 100 : 0;
          const winRate = total > 0 ? ((item.won / total) * 100).toFixed(0) : '0';

          return (
            <div key={index} className="flex-1 flex flex-col items-center">
              <div className="w-full flex flex-col justify-end h-full space-y-1">
                <div className="relative group">
                  <div
                    className="w-full bg-gradient-to-t from-green-600 to-green-400 rounded-t-lg transition-all hover:from-green-700 hover:to-green-500 cursor-pointer"
                    style={{ height: `${wonHeight}%`, minHeight: item.won > 0 ? '4px' : '0' }}
                  >
                    {item.won > 0 && (
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                        Won: {item.won}
                      </div>
                    )}
                  </div>
                </div>

                <div className="relative group">
                  <div
                    className="w-full bg-gradient-to-t from-red-600 to-red-400 transition-all hover:from-red-700 hover:to-red-500 cursor-pointer"
                    style={{ height: `${lostHeight}%`, minHeight: item.lost > 0 ? '4px' : '0' }}
                  >
                    {item.lost > 0 && (
                      <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                        Lost: {item.lost}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-3 text-center">
                <p className="text-xs font-medium text-slate-700">{item.period}</p>
                <p className="text-xs text-green-600 font-medium">{winRate}% win</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-center space-x-6 pt-4 border-t border-slate-200">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-gradient-to-t from-green-600 to-green-400 rounded" />
          <span className="text-xs text-slate-600">Won</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-gradient-to-t from-red-600 to-red-400 rounded" />
          <span className="text-xs text-slate-600">Lost</span>
        </div>
      </div>
    </div>
  );
}
