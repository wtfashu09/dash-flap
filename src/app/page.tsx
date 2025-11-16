import { SoarScapeGame } from '@/components/game/soar-scape';
import { Toaster } from "@/components/ui/toaster";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="w-full h-screen">
        <SoarScapeGame />
      </div>
      <Toaster />
    </main>
  );
}
