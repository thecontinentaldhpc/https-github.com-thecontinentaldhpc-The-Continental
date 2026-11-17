import { useEffect, useState } from 'react';
import {
  formatIstTime,
  getIstDateParts,
  msUntilNextIstMidnight,
  type IstDateParts,
} from '../lib/dateIst';

export interface LiveIstClock extends IstDateParts {
  currentTimeIst: string;
  nowMs: number;
}

function buildLiveClock(initialIst?: IstDateParts): LiveIstClock {
  const now = new Date();
  const parts = initialIst ?? getIstDateParts(now);
  return {
    ...parts,
    currentTimeIst: formatIstTime(now),
    nowMs: now.getTime(),
  };
}

export function useIstClock(initialIst?: IstDateParts): LiveIstClock {
  const [ist, setIst] = useState<LiveIstClock>(() => buildLiveClock(initialIst));

  useEffect(() => {
    setIst(buildLiveClock());

    const intervalId = setInterval(() => {
      setIst(buildLiveClock());
    }, 15_000);

    let timeoutId: ReturnType<typeof setTimeout>;
    const scheduleNextMidnight = () => {
      const waitMs = msUntilNextIstMidnight();
      timeoutId = setTimeout(() => {
        setIst(buildLiveClock());
        scheduleNextMidnight();
      }, waitMs);
    };

    scheduleNextMidnight();
    return () => {
      clearInterval(intervalId);
      clearTimeout(timeoutId);
    };
  }, []);

  return ist;
}
