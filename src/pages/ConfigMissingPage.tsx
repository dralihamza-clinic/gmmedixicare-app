import Icon from "../components/Icon";

export default function ConfigMissingPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-surface-container-low px-gutter text-center">
      <div className="max-w-lg flex flex-col items-center gap-3">
        <Icon name="settings" className="text-4xl text-secondary" />
        <h1 className="font-headline-md text-headline-md text-primary">
          Supabase isn't configured
        </h1>
        <p className="text-on-surface-variant text-sm">
          This build has no Supabase URL / key. Copy <code>.env.example</code> to{" "}
          <code>.env</code>, fill in <code>VITE_SUPABASE_URL</code> and{" "}
          <code>VITE_SUPABASE_ANON_KEY</code>, then run the app again (or rebuild the
          installer).
        </p>
      </div>
    </main>
  );
}
