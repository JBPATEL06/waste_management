import React from 'react';

export function TableSkeleton({ columns = 6, rows = 5 }) {
  return (
    <div className="animate-pulse space-y-3 p-4" role="status" aria-label="Loading table">
      {Array.from({ length: rows }, (_, row) => (
        <div
          key={row}
          className="grid gap-3"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: columns }, (_, column) => (
            <div key={column} className="h-5 rounded bg-slate-200" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="animate-pulse space-y-5 py-6" role="status" aria-label="Loading details">
      <div className="h-8 w-56 rounded bg-slate-200" />
      <div className="h-4 w-80 max-w-full rounded bg-slate-200" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="h-32 rounded-xl bg-slate-200" />
        <div className="h-32 rounded-xl bg-slate-200" />
      </div>
      <div className="h-56 rounded-xl bg-slate-200" />
    </div>
  );
}

export function ValueSkeleton() {
  return <span className="inline-block h-6 w-12 animate-pulse rounded bg-slate-200 align-middle" aria-label="Loading value" />;
}
