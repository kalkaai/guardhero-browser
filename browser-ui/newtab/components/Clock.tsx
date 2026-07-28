// Copyright (c) 2025 Guard Hero. All rights reserved.
//
// Clock.tsx — Live date/time display component.

import { useState, useEffect } from 'react';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function formatTime(date: Date): string {
  const h = date.getHours();
  const m = date.getMinutes().toString().padStart(2, '0');
  const hour12 = h % 12 || 12;
  const ampm = h < 12 ? 'AM' : 'PM';
  return `${hour12}:${m} ${ampm}`;
}

function formatDate(date: Date): string {
  return `${DAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

export function Clock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    // Update every second to keep the clock accurate
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="ntp-clock" aria-live="polite" aria-label="Current time">
      <div className="ntp-clock-time">{formatTime(now)}</div>
      <div className="ntp-clock-date">{formatDate(now)}</div>
    </div>
  );
}
