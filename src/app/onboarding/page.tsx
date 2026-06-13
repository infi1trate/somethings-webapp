import { Suspense } from "react";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";

// useSearchParams (inside the wizard) needs a Suspense boundary.
export default function OnboardingPage() {
  return (
    <Suspense>
      <OnboardingWizard />
    </Suspense>
  );
}
