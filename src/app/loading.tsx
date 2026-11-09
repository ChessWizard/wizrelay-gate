import { Skeleton } from '@/shared/ui/primitives';

/** The board's shape while it loads: rows, not a spinner. */
export default function Loading() {
  return (
    <div className="page" aria-busy="true">
      <Skeleton width={240} height={28} />
      <section className="tiles">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <div className="tile" key={index} aria-busy="true">
            <Skeleton width={90} height={11} />
            <Skeleton width={56} height={24} />
            <Skeleton width={120} height={11} />
          </div>
        ))}
      </section>
      <div className="relays">
        {[0, 1, 2, 3, 4].map((index) => (
          <div className="relay" key={index} aria-busy="true">
            <Skeleton width={180} height={16} />
            <Skeleton height={16} />
            <Skeleton width={90} height={16} />
          </div>
        ))}
      </div>
    </div>
  );
}
