export function Page({ title, intro, children, aside }: { title: string; intro?: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-7 md:py-10">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl">{title}</h1>
          {intro && <p className="text-ink-2 mt-1.5 max-w-prose">{intro}</p>}
        </div>
        {aside}
      </div>
      {children}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="card p-6 text-ink-2 leading-relaxed">{children}</div>;
}
