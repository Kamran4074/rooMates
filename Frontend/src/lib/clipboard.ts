import { useState } from "react";

// navigator.clipboard only exists in secure contexts (HTTPS or localhost). On
// plain http over a LAN IP it's undefined, so fall back to the legacy
// hidden-textarea + execCommand("copy") path instead of crashing.
export async function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Permission denied etc. - try the fallback below.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
}

// Copies text and briefly remembers which item was copied, for "Copied!" feedback.
export function useCopyFeedback(durationMs = 1500) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  async function copy(text: string, key: string = text) {
    if (!(await copyText(text))) return;
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((current) => (current === key ? null : current)), durationMs);
  }

  return { copiedKey, copy };
}
