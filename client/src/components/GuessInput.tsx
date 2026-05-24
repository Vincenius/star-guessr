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
    const guess = isNaN(parsed) || parsed < 0 ? 0 : Math.min(parsed, 1000000);
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

  React.useEffect(() => {
    setValue('');
    setSubmitted(false);
    setTimerRunning(true);
    secondsRemainingRef.current = 90;
  }, [timerKey]);

  const parsed = parseInt(value, 10);
  const preview = !isNaN(parsed) && parsed > 0 ? formatStars(parsed) : null;

  return (
    <div className="bg-white border border-[#d0d7de] rounded-md overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2.5 bg-[#f6f8fa] border-b border-[#d0d7de] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-yellow-500 text-base">★</span>
          <span className="text-sm font-semibold text-[#1f2328]">Your guess</span>
        </div>
        <span className="text-xs text-[#656d76] tabular-nums">
          Round {round + 1} / {totalRounds}
        </span>
      </div>

      <div className="p-4 space-y-4">
        {/* Timer */}
        <Timer
          key={timerKey}
          durationSeconds={90}
          running={timerRunning && !disabled}
          onExpire={handleTimerExpire}
          onTick={handleTimerTick}
        />

        {/* Input */}
        <div className="space-y-2">
          <label className="block text-xs font-medium text-[#656d76]">
            How many GitHub stars does this repo have?
          </label>
          <div className="relative">
            <input
              type="number"
              min="0"
              max="1000000"
              value={value}
              onChange={e => setValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !submitted && handleButtonClick()}
              disabled={submitted || disabled}
              placeholder="e.g. 12500"
              className="w-full border border-[#d0d7de] rounded-md px-3 py-2.5 text-base text-[#1f2328] focus:outline-none focus:border-[#0969da] focus:ring-2 focus:ring-[#0969da]/20 disabled:bg-[#f6f8fa] disabled:text-[#656d76] font-mono placeholder:font-sans placeholder:text-[#8c959f]"
            />
            {preview && !submitted && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#8c959f] pointer-events-none">
                ≈ {preview}
              </span>
            )}
          </div>
        </div>

        {/* Submit button */}
        <button
          onClick={handleButtonClick}
          disabled={submitted || disabled || value === ''}
          className="w-full py-2.5 bg-[#2da44e] hover:bg-[#2c974b] active:bg-[#298e46] text-white text-sm font-semibold rounded-md disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 border border-[#1f883d] border-opacity-40"
        >
          <span className="text-base leading-none">★</span>
          <span>{submitted ? 'Submitted!' : 'Submit Guess'}</span>
        </button>

        {submitted && (
          <p className="text-xs text-center text-[#656d76] animate-pulse">Waiting for reveal…</p>
        )}
      </div>
    </div>
  );
}
