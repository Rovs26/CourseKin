import { Suspense } from "react";
import { ShareCapture } from "@/features/share/share-capture";

export default function SharePage() {
  return (
    <Suspense fallback={null}>
      <ShareCapture />
    </Suspense>
  );
}
