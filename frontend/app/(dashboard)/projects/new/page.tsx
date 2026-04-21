import { Suspense } from "react";
import { ProjectWizard } from "@/components/projects/project-wizard";

export default function NewProjectPage() {
  return (
    <Suspense>
      <ProjectWizard />
    </Suspense>
  );
}
