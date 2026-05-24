import React, { useState, useRef } from 'react';
import { Timer } from './Timer';
import { formatStars } from '../utils/scoring';

interface Props {
  onSubmit: (guess: number, secondsRemaining: number) => void;
  disabled: boolean;
  round: number;
  totalRounds: number;
  timerKey: number;
}

export function GuessInput({ onSubmit, disabled, round, totalRounds, timerKey }: Props) {
  const [value, setValue] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [timerRunning, setTimerRunning] = useState(true);
  const secondsRemainingRef = useRef(90);

  const handleSubmit = (secondsRemaining: number) => {
    if (submitted || disabled) return;
    const parsed = parseInt(value, 10);
    const guess = isNaN(parsed) || parsed < 0 ? 0 : parsed;
    setSubmitted(true);
    setTimerRunning(false);
    onSubmit(guess, secondsRemaining);
  };

  const handleTimerExpire = () => {
    if (submitted) return;
    handleSubmit(0);
  };

  const handleTimerTick = (s: number) => {
    secondsRemainingRef.current = s;
  };

  const handleButtonClick = () => {
    handleSubmit(secondsRemainingRef.current);
  };

  // Reset when round changes
  React.useEffect(() => {
    setValue('');
    setSubmitted(false);
    setTimerRunning(true);
    secondsRemainingRef.current = 90;
  }, [timerKey]);

  const parsed = parseInt(value, 10);
  const preview = !isNaN(parsed) && parsed > 0 ? formatStars(parsed) : null;

  return (
    <div className="space-y-4 p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span className="font-medium">Round {round + 1} / {totalRounds}</span>
      </div>

      <Timer
        key={timerKey}
        durationSeconds={90}
        running={timerRunning && !disabled}
        onExpire={handleTimerExpire}
        onTick={handleTimerTick}
      />

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Your guess — how many stars?
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="number"
              min="0"
              max="999999999"
              value={value}
              onChange={e => setValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !submitted && handleButtonClick()}
              disabled={submitted || disabled}
              placeholder="e.g. 12500"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
            />
            {preview && !submitted && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
                ≈ {preview}
              </span>
            )}
          </div>
          <button
            onClick={handleButtonClick}
            disabled={submitted || disabled || value === ''}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {submitted ? 'Submitted' : 'Submit'}
          </button>
        </div>
      </div>

      {submitted && (
        <p className="text-xs text-center text-gray-500 animate-pulse">Waiting for reveal…</p>
      )}
    </div>
  );
}
