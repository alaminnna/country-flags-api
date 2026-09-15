'use client';

import Link from 'next/link';
import type { CountryTile } from './horizon-data';

export function FlagTile({ country }: { country: CountryTile }) {
  return (
    <Link
      href={`/country/${country.code}`}
      className="horizon-tile"
      aria-label={country.name}
      title={country.name}
    >
      <img
        src={`/assets/v1/icons/32x24/${country.code}.png`}
        alt=""
        width={32}
        height={24}
        loading="lazy"
        decoding="async"
        draggable={false}
      />
    </Link>
  );
}
