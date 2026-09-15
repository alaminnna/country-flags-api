import Link from 'next/link';
import { Compass, Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="page-shell flex min-h-[60vh] flex-col items-center justify-center pt-10 text-center">
      <p className="mono text-[0.75rem] font-bold uppercase tracking-[0.14em] text-primary">Error 404</p>
      <h1 className="display-1 mt-3">Lost at sea.</h1>
      <p className="body-scale mt-4 max-w-md text-soft">
        No country, flag or page lives at this URL. Check the address, or head back to explored waters.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link href="/" className="btn btn-primary btn-lg">
          <Home size={17} aria-hidden /> Go home
        </Link>
        <Link href="/explore" className="btn btn-secondary btn-lg">
          <Compass size={17} aria-hidden /> Explore countries
        </Link>
      </div>
    </div>
  );
}
