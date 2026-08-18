import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  icon: LucideIcon;
  color?: 'orange' | 'green' | 'blue' | 'purple' | 'amber';
}

const colorMap = {
  orange: 'from-orange-500/10 to-orange-500/5 text-orange-400 border-orange-500/20',
  green: 'from-emerald-500/10 to-emerald-500/5 text-emerald-400 border-emerald-500/20',
  blue: 'from-blue-500/10 to-blue-500/5 text-blue-400 border-blue-500/20',
  purple: 'from-purple-500/10 to-purple-500/5 text-purple-400 border-purple-500/20',
  amber: 'from-amber-500/10 to-amber-500/5 text-amber-400 border-amber-500/20',
};

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  trend,
  icon: Icon,
  color = 'orange',
}) => {
  return (
    <div className="bg-[#131B2B] border border-slate-800 rounded-2xl p-5 shadow-sm hover:border-slate-700 transition-colors">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{title}</span>
        <div className={`p-2.5 rounded-xl bg-gradient-to-br border ${colorMap[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl sm:text-3xl font-extrabold text-white font-mono">{value}</span>
        {trend && (
          <span
            className={`text-xs font-bold px-1.5 py-0.5 rounded-md ${
              trend.isPositive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
            }`}
          >
            {trend.isPositive ? '+' : ''}{trend.value}%
          </span>
        )}
      </div>
      {subtitle && <p className="mt-1 text-xs text-slate-400">{subtitle}</p>}
    </div>
  );
};
