'use client';

import { useEffect, useState } from 'react';
import { Timer } from 'lucide-react';

function timeUntilUtcMidnight() {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60_000;
  const next = new Date(utcMs);
  next.setUTCHours(24, 0, 0, 0);
  const diff = Math.max(0, next.getTime() - utcMs);
  return { hours: Math.floor(diff / 3_600_000), minutes: Math.floor((diff % 3_600_000) / 60_000), seconds: Math.floor((diff % 60_000) / 1_000) };
}

export function DailyCard() {
  const [daily, setDaily] = useState<{ dailyNumber: number; mode: string; difficulty: string } | null>(null);
  const [cd, setCd] = useState({ hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    fetch('/api/v1/quiz/meta')
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => { if (m?.daily) setDaily({ dailyNumber: m.daily.dailyNumber, mode: m.daily.mode, difficulty: m.daily.difficulty }); })
      .catch(() => {});
  }, []);

  useEffect(() => { setCd(timeUntilUtcMidnight()); const i = setInterval(() => setCd(timeUntilUtcMidnight()), 1000); return () => clearInterval(i); }, []);

  return (
    <div className="daily-card">
      <p className="small-scale font-bold">Flag Daily #{daily?.dailyNumber ?? '—'}</p>
      {daily && <p className="mono mt-1 text-[0.65rem] text-soft">{daily.mode} · {daily.difficulty}</p>}
      <p className="mono mt-2 text-[0.72rem] tabular-nums text-soft" aria-hidden>
        <Timer size={11} className="mr-1 inline" />
        {String(cd.hours).padStart(2, '0')}:{String(cd.minutes).padStart(2, '0')}:{String(cd.seconds).padStart(2, '0')}
      </p>
      <p className="sr-only">Resets daily at 00:00 UTC</p>
    </div>
  );
}
