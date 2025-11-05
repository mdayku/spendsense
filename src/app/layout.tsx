import "@/styles/globals.css";
import { Providers } from "./providers";
import Navigation from "@/components/Navigation";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <Providers>
          <Navigation />
          {children}
        </Providers>
      </body>
    </html>
  );
}

