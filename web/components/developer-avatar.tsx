'use client';

import { useState } from 'react';

/**
 * DeveloperAvatar — real profile photo with an initials fallback.
 * Never renders a broken-image hole: on error it swaps to a styled monogram.
 */
export function DeveloperAvatar({
  src,
  name,
  monogram = 'AA',
  size = 96,
}: {
  src: string;
  name: string;
  monogram?: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const dim = { width: size, height: size, borderRadius: Math.round(size * 0.29) };
  if (failed) {
    return (
      <span className="dev-avatar-fallback" style={{ ...dim, fontSize: Math.round(size * 0.36) }} aria-hidden>
        {monogram}
      </span>
    );
  }
  return (
    <img
      src={src}
      alt={`Profile photo of ${name}`}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      className="dev-avatar"
      style={dim}
      onError={() => setFailed(true)}
    />
  );
}
