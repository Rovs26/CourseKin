"use client";

import { useCallback, useEffect, useState } from "react";
import { createProject, listProjects } from "@/lib/reviewflow-api";
import type { Project } from "@/types/project";

type NewProjectInput = Omit<Project, "id" | "created_at" | "updated_at">;

export function useMockProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      setError(null);
      const response = await listProjects();
      const nextProjects = [...response.items].sort((a, b) =>
        b.created_at.localeCompare(a.created_at)
      );
      setProjects(nextProjects);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load projects."
      );
      setProjects([]);
    } finally {
      setIsReady(true);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const addProject = async (input: NewProjectInput) => {
    const newProject = await createProject(input);

    setProjects((current) => {
      const withoutDuplicate = current.filter(
        (project) => project.id !== newProject.id
      );

      return [newProject, ...withoutDuplicate].sort((a, b) =>
        b.created_at.localeCompare(a.created_at)
      );
    });

    setIsReady(true);
    return newProject;
  };

  return {
    projects,
    isReady,
    error,
    addProject,
    refetch,
  };
}