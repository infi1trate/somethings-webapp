import Link from "next/link";
import { Wordmark } from "@/components/brand";
import { DoodleScatter } from "@/components/doodles";
import { Button } from "@/components/ui/button";

// Dev entry point. In production a mentor lands on /invite/[token] from an email.
export default function Home() {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-[#fff2ea] to-[#faf6ef] px-6 text-center">
      <DoodleScatter className="opacity-70" />
      <div className="relative flex max-w-md flex-col items-center gap-6">
        <Wordmark className="h-6" />
        <div className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight">
            Mentor onboarding — prototype
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            In the real flow, mentors arrive here from an email invite. Use the demo
            link below to walk through setup.
          </p>
        </div>
        <Button asChild size="lg">
          <Link href="/invite/demo-invite-token">Open a demo invite</Link>
        </Button>
      </div>
    </main>
  );
}
