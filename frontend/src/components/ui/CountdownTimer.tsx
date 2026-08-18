import { useEffect, useState } from 'react';
import { formatCountdown } from '../../lib/scheduling';

interface CountdownTimerProps {
  targetDate: string; // ISO string
  onExpired?: () => void;
  className?: string;
  compact?: boolean;
}

export default function CountdownTimer({
  targetDate,
  onExpired,
  className = '',
  compact = false,
}: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState(() => {
    const ms = new Date(targetDate).getTime() - Date.now();
    return ms > 0 ? formatCountdown(ms) : null;
  });

  useEffect(() => {
    const tick = () => {
      const ms = new Date(targetDate).getTime() - Date.now();
      if (ms <= 0) {
        setTimeLeft(null);
        onExpired?.();
        return;
      }
      setTimeLeft(formatCountdown(ms));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetDate, onExpired]);

  if (!timeLeft) return null;

  if (compact) {
    return (
      <span className={`font-bold text-primary-400 tabular-nums ${className}`}>
        {timeLeft.days > 0 && `${timeLeft.days}d `}
        {String(timeLeft.hours).padStart(2, '0')}h{' '}
        {String(timeLeft.minutes).padStart(2, '0')}m{' '}
        {String(timeLeft.seconds).padStart(2, '0')}s
      </span>
    );
  }

  const units = [
    { label: 'Days', value: timeLeft.days },
    { label: 'Hours', value: timeLeft.hours },
    { label: 'Mins', value: timeLeft.minutes },
    { label: 'Secs', value: timeLeft.seconds },
  ];

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {units.map(({ label, value }, i) => (
        <div key={label} className="flex items-center gap-2">
          <div className="flex flex-col items-center">
            <div className="bg-dark-900 border border-white/10 rounded-lg px-2.5 py-1 min-w-[3rem] text-center">
              <span className="text-xl font-black text-white tabular-nums">
                {String(value).padStart(2, '0')}
              </span>
            </div>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">
              {label}
            </span>
          </div>
          {i < 3 && (
            <span className="text-primary-400 font-black text-xl mb-3 select-none">:</span>
          )}
        </div>
      ))}
    </div>
  );
}
