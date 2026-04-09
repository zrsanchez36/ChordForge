import ChordForgeStudio from "@/components/chord-forge-studio";
import { SHOWCASE_SESSION } from "@/lib/chord-forge";

export default function HomePage() {
  return (
    <main className="page-shell">
      <ChordForgeStudio initialSession={SHOWCASE_SESSION} />
    </main>
  );
}
