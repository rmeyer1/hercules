import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hercules",
  description: "Options income qualifier"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <div className="flex min-h-screen flex-col">
          <header className="border-b border-black/10 bg-white/70 backdrop-blur">
            <div className="mx-auto flex w-full max-w-[1100px] items-center justify-between px-4 py-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full border border-black/10 bg-ember" />
                <span className="text-sm font-semibold tracking-[0.2em] text-ink">
                  HERCULES
                </span>
              </div>
              <nav className="flex items-center gap-6 text-sm text-black/70">
                <span>Dashboard</span>
                <span>Screeners</span>
                <span>Risk</span>
              </nav>
            </div>
          </header>
          <main className="mx-auto flex w-full flex-1 flex-col gap-10 px-4 py-10">
            {children}
          </main>
          <footer className="border-t border-black/10 bg-white/80">
            <div className="mx-auto flex w-full max-w-[1100px] items-center justify-between px-4 py-6 text-xs text-black/60">
              <span>Built for disciplined income.</span>
              <span>Hercules MVP</span>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
