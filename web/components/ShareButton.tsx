"use client";

import { useState } from "react";
import { bigButton } from "@/components/RoundShell";

export function ShareButton({ text }: { text: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");

  async function share() {
    if (navigator.share) {
      await navigator.share({ text }).catch(() => {}); // cancelling is not an error
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setStatus("copied");
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("failed");
    }
  }

  return (
    <>
      <button type="button" aria-label="Share result" className={bigButton} onClick={share}>
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="5" cy="10" r="2.2" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="15" cy="4.5" r="2.2" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="15" cy="15.5" r="2.2" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M7 9 L13 5.5 M7 11 L13 14.5" stroke="currentColor" strokeWidth="2" />
        </svg>
        SHARE RESULT
      </button>
      <div role="status" className="text-center text-xs text-muted empty:hidden">
        {status === "copied" && "Copied"}
        {status === "failed" && "Could not copy"}
      </div>
      {status === "failed" && (
        <textarea readOnly rows={4} value={text} className="w-full rounded-xl border border-line bg-panel p-3 text-sm" onFocus={(e) => e.currentTarget.select()} />
      )}
    </>
  );
}
