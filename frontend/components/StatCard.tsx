import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  colorClass: string; // expects something like 'text-blue-500' or hex
  subtext?: string;
  onClick?: () => void;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, colorClass, subtext, onClick }) => {
  return (
    <div
      onClick={onClick}
      className={`bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-200 hover:border-slate-300 ${onClick ? 'cursor-pointer active:scale-95' : ''}`}
    >
      <div className="flex justify-between items-start">
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">{title}</p>
          <h3 className="text-3xl font-bold text-slate-900 tracking-tight leading-none">{value}</h3>
        </div>
        <div className={`p-2.5 rounded-lg ${colorClass}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>

      {subtext && (
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center">
          <p className="text-xs text-slate-500 font-semibold flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
            {subtext}
          </p>
        </div>
      )}
    </div>
  );
};

export default StatCard;