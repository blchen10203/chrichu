"use client";

import { useEffect, useRef, useState } from "react";

export function Timer({ seconds, onExpire }: { seconds: number; onExpire: () => void }) {
  const [left, setLeft] = useState(seconds);
  const expire = useRef(onExpire);
  useEffect(() => {
    expire.current = onExpire;
  });

  // The clock exists only after mount. Checking a deadline (not counting ticks) survives a slept tab.
  useEffect(() => {
    const deadline = Date.now() + seconds * 1000;
    const id = setInterval(() => {
      const ms = deadline - Date.now();
      if (ms <= 0) {
        clearInterval(id);
        setLeft(0);
        expire.current();
      } else {
        setLeft(Math.ceil(ms / 1000));
      }
    }, 250);
    return () => clearInterval(id);
  }, [seconds]);

  return (
    <div role="timer" aria-label="Time left" className={`font-display text-lg font-bold ${left <= 5 ? "text-red" : ""}`}>
      {left}s
    </div>
  );
}
