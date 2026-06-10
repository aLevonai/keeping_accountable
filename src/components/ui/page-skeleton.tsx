// Pulse skeleton blocks — used for loading states across all pages

function Bone({ className }: { className: string }) {
  return <div className={`bg-[--border] rounded-lg animate-pulse ${className}`} />;
}

export function HomeSkeleton() {
  return (
    <div className="px-5 pt-4 pb-4">
      {/* Header */}
      <div className="mb-5">
        <Bone className="h-2.5 w-24 mb-2 rounded-full" />
        <Bone className="h-7 w-48 rounded-xl" />
      </div>

      {/* Partner split card */}
      <div className="mx-0 mb-5 bg-[--surface] rounded-2xl border border-[--border] overflow-hidden">
        <div className="flex">
          <div className="flex-1 p-3.5 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Bone className="w-7 h-7 rounded-full" />
              <Bone className="h-3 w-16 rounded-full" />
            </div>
            <Bone className="h-8 w-12 rounded-lg" />
          </div>
          <div className="w-px bg-[--border]" />
          <div className="flex-1 p-3.5 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Bone className="w-7 h-7 rounded-full" />
              <Bone className="h-3 w-16 rounded-full" />
            </div>
            <Bone className="h-8 w-12 rounded-lg" />
          </div>
        </div>
        <div className="bg-[--surface-alt] px-4 py-2.5 flex items-center gap-3">
          <Bone className="h-2.5 w-16 rounded-full" />
          <Bone className="flex-1 h-1 rounded-full" />
          <Bone className="h-2.5 w-10 rounded-full" />
        </div>
      </div>

      {/* Section label */}
      <Bone className="h-2.5 w-14 mb-3 rounded-full" />

      {/* Goal rows */}
      {[0, 1, 2].map((i) => (
        <div key={i} className="py-3 border-b border-[--border] flex items-center gap-3">
          <div className="flex-1 flex flex-col gap-2">
            <Bone className="h-3.5 w-40 rounded-full" />
            <div className="flex items-center gap-1.5">
              <Bone className="h-2 w-14 rounded-full" />
              <Bone className="h-[3px] w-24 rounded-full" />
              <Bone className="h-2 w-6 rounded-full" />
            </div>
          </div>
          <Bone className="w-8 h-8 rounded-full flex-shrink-0" />
        </div>
      ))}
    </div>
  );
}

export function GoalsSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="bg-[--surface] rounded-2xl border border-[--border] p-3.5 flex flex-col gap-3">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-1.5 flex-1">
              <Bone className="h-4 w-40 rounded-full" />
              <Bone className="h-2.5 w-12 rounded-full" />
            </div>
            <Bone className="w-7 h-7 rounded-full flex-shrink-0" />
          </div>
          <div className="flex items-center gap-1.5">
            <Bone className="h-[3px] flex-1 rounded-full" />
            <Bone className="h-2.5 w-8 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function JournalSkeleton() {
  return (
    <div className="px-4 pt-14 pb-4">
      {/* Header */}
      <div className="flex items-baseline justify-between mb-5">
        <Bone className="h-7 w-24 rounded-xl" />
        <Bone className="h-3 w-20 rounded-full" />
      </div>

      {/* Two-column polaroid grid */}
      <div className="flex gap-2.5">
        <div className="flex-1 flex flex-col gap-2.5">
          {[0, 1].map((i) => (
            <div key={i} className="bg-white rounded-sm p-2 pb-6 shadow-[0_2px_8px_rgba(0,0,0,0.10)]">
              <Bone className="w-full aspect-square rounded-none" />
              <div className="mt-2 flex flex-col gap-1">
                <Bone className="h-2 w-20 rounded-full" />
                <Bone className="h-2 w-14 rounded-full" />
              </div>
            </div>
          ))}
        </div>
        <div className="flex-1 flex flex-col gap-2.5 pt-6">
          {[0, 1].map((i) => (
            <div key={i} className="bg-white rounded-sm p-2 pb-6 shadow-[0_2px_8px_rgba(0,0,0,0.10)]">
              <Bone className="w-full aspect-square rounded-none" />
              <div className="mt-2 flex flex-col gap-1">
                <Bone className="h-2 w-16 rounded-full" />
                <Bone className="h-2 w-20 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function GoalDetailSkeleton() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="px-5 pt-14 pb-6 flex flex-col gap-4 border-b border-[--border]">
        <Bone className="w-9 h-9 rounded-2xl" />
        <div className="flex flex-col gap-2">
          <Bone className="h-6 w-48 rounded-xl" />
          <Bone className="h-3 w-28 rounded-full" />
        </div>
        {/* Progress card */}
        <div className="bg-[--surface] rounded-2xl border border-[--border] px-4 py-3 flex items-center gap-4">
          <Bone className="w-14 h-14 rounded-full flex-shrink-0" />
          <div className="flex flex-col gap-2 flex-1">
            <Bone className="h-4 w-32 rounded-full" />
            <Bone className="h-3 w-20 rounded-full" />
          </div>
        </div>
      </div>

      {/* Buttons */}
      <div className="px-4 py-4 border-b border-[--border] flex flex-col gap-2">
        <Bone className="h-14 w-full rounded-2xl" />
      </div>

      {/* History */}
      <div className="px-4 py-4 flex flex-col gap-3">
        <Bone className="h-2.5 w-14 rounded-full" />
        {[0, 1].map((i) => (
          <div key={i} className="bg-[--surface] rounded-2xl border border-[--border] overflow-hidden">
            <Bone className="w-full aspect-video rounded-none" />
            <div className="px-3 py-2 flex justify-between">
              <Bone className="h-3 w-32 rounded-full" />
              <Bone className="h-3 w-16 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
