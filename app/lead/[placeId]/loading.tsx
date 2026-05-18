export default function LeadDetailLoading() {
  return (
    <main className="min-h-screen bg-f10-bg flex flex-col">
      {/* Header */}
      <header className="w-full border-b border-f10-border bg-white px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-f10-primary flex items-center justify-center">
            <span className="text-white text-xs font-body font-semibold">F10</span>
          </div>
          <span className="font-heading text-xl font-semibold text-f10-text tracking-wide">
            Simporic
          </span>
        </div>
        <div className="h-4 w-24 bg-f10-tint rounded animate-pulse" />
      </header>

      <div className="flex-1 max-w-3xl mx-auto w-full px-8 py-12">

        {/* Business header skeleton */}
        <div className="mb-8">
          <div className="h-5 w-28 bg-f10-tint rounded-full animate-pulse mb-4" />
          <div className="h-11 w-3/4 bg-f10-tint rounded-lg animate-pulse mb-3" />
          <div className="h-4 w-40 bg-f10-tint rounded animate-pulse" />
        </div>

        {/* Stats row skeleton */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-f10-tint rounded-f10 px-5 py-4 text-center animate-pulse">
              <div className="h-7 w-16 bg-white/60 rounded mx-auto mb-2" />
              <div className="h-3 w-12 bg-white/60 rounded mx-auto" />
            </div>
          ))}
        </div>

        {/* Contact info skeleton */}
        <div className="bg-white rounded-f10 border border-f10-border p-6 mb-6">
          <div className="h-6 w-44 bg-f10-tint rounded animate-pulse mb-4" />
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded bg-f10-tint animate-pulse shrink-0" />
              <div className="h-4 w-2/3 bg-f10-tint rounded animate-pulse" />
            </div>
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded bg-f10-tint animate-pulse shrink-0" />
              <div className="h-4 w-36 bg-f10-tint rounded animate-pulse" />
            </div>
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded bg-f10-tint animate-pulse shrink-0" />
              <div className="h-4 w-48 bg-f10-tint rounded animate-pulse" />
            </div>
          </div>
        </div>

        {/* Business snapshot skeleton */}
        <div className="bg-white rounded-f10 border border-f10-border p-6 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-5 h-5 rounded-full bg-f10-tint animate-pulse" />
            <div className="h-6 w-40 bg-f10-tint rounded animate-pulse" />
          </div>
          <div className="space-y-2">
            <div className="h-3.5 w-full bg-f10-tint rounded animate-pulse" />
            <div className="h-3.5 w-11/12 bg-f10-tint rounded animate-pulse" />
            <div className="h-3.5 w-4/5 bg-f10-tint rounded animate-pulse" />
            <div className="h-3.5 w-full bg-f10-tint rounded animate-pulse" />
            <div className="h-3.5 w-3/4 bg-f10-tint rounded animate-pulse" />
          </div>
        </div>

        {/* Business hours skeleton */}
        <div className="bg-white rounded-f10 border border-f10-border p-6 mb-8">
          <div className="h-6 w-36 bg-f10-tint rounded animate-pulse mb-4" />
          <div className="space-y-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-4 bg-f10-tint rounded animate-pulse" style={{ width: `${55 + (i % 3) * 12}%` }} />
            ))}
          </div>
        </div>

        {/* AI Receptionist orb skeleton */}
        <div className="mb-6 bg-white rounded-f10 border border-f10-border p-8 flex flex-col items-center gap-4">
          <div className="w-24 h-24 rounded-full bg-f10-tint animate-pulse" />
          <div className="h-4 w-48 bg-f10-tint rounded animate-pulse" />
          <div className="h-3 w-36 bg-f10-tint rounded animate-pulse" />
        </div>

        {/* Proposal generator skeleton */}
        <div className="bg-white rounded-f10 border border-f10-border p-6">
          <div className="h-6 w-48 bg-f10-tint rounded animate-pulse mb-4" />
          <div className="h-10 w-full bg-f10-tint rounded animate-pulse" />
        </div>

      </div>

      {/* Footer */}
      <footer className="bg-f10-footer border-t border-f10-border px-8 py-5 text-center">
        <p className="font-body text-xs text-gray-400">
          Simporic
        </p>
      </footer>
    </main>
  );
}
