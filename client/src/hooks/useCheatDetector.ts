import { useEffect, useCallback, useRef } from 'react';

export function useCheatDetector(
  isActive: boolean,
  onCheat: () => void
): void {
  const flaggedRef = useRef(false);

  const handleCheat = useCallback(() => {
    if (!isActive || flaggedRef.current) return;
    flaggedRef.current = true;
    onCheat();
  }, [isActive, onCheat]);

  useEffect(() => {
    const onBlur = () => handleCheat();
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') handleCheat();
    };

    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [handleCheat]);
}
