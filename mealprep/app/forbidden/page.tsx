export default function Forbidden() {
  return <div className="min-h-screen flex items-center justify-center p-8 text-center"><div><h1 className="text-3xl mb-2">No access</h1><p className="text-sm text-ink-2">Your role does not include this area. Ask an administrator if you need it.</p><a href="/dashboard" className="btn-secondary mt-4">Back to dashboard</a></div></div>;
}
