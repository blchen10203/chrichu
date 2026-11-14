"use client";

import { useState } from "react";
import { bigButton, quietButton } from "@/components/RoundShell";

export function ShareButton({ text, quiet }: { text: string; quiet?: boolean }) {
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
      <button type="button" className={quiet ? quietButton : bigButton} onClick={share}>
        Share result
      </button>
      <div role="status" className="text-center text-xs text-muted empty:hidden">
        {status === "copied" && "Copied"}
        {status === "failed" && "Could not copy"}
      </div>
      {status === "failed" && (
        <textarea readOnly rows={4} value={text} className="w-full border border-line p-3 text-sm" onFocus={(e) => e.currentTarget.select()} />
      )}
    </>
  );
}
