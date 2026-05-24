import React, { useEffect, useState, useRef } from 'react';

interface Props {
  durationSeconds: number;
  running: boolean;
  onExpire: () => void;
  onTick?: (secondsRemaining: number) => void;
}

export function Timer({ durationSeconds, running, onExpire, onTick }: Props) {
  const [secondsLeft, setSecondsLeft] = useState(durationSeconds);
  const expiredRef = useRef(false);

  useEffect(() => {
    setSecondsLeft(durationSeconds);
    expiredRef.current = false;
  }, [durationSeconds]);

  useEffect(() => {
    if (!running) return;

    const interval = setInterval(() => {
      setSecondsLeft(prev => {
        const next = prev - 1;
        onTick?.(next);
        if (next <= 0 && !expiredRef.current) {
          expiredRef.current = true;
          clearInterval(interval);
          onExpire();
          return 0;
        }
        return Math.max(0, next);
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [running, onExpire, onTick]);

  const pct = secondsLeft / durationSeconds;
  const color =
    secondsLeft > 30 ? 'bg-green-500' : secondsLeft > 10 ? 'bg-yellow-400' : 'bg-red-500';
  const textColor =
    secondsLeft > 30 ? 'text-green-700' : secondsLeft > 10 ? 'text-yellow-700' : 'text-red-600';

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-xs text-gray-500 font-medium">Time</span>
        <span className={`text-lg font-bold tabular-nums ${textColor}`}>{secondsLeft}s</span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${color}`}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
    </div>
  );
}

export function useTimerRef(durationSeconds: number, running: boolean): React.MutableRefObject<number> {
  const ref = useRef(durationSeconds);

  useEffect(() => {
    ref.current = durationSeconds;
    if (!running) return;

    const interval = setInterval(() => {
      ref.current = Math.max(0, ref.current - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [durationSeconds, running]);

  return ref;
}
