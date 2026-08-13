import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";

interface Project {
  id: string;
  code: string;
  name: string;
  siteName: string;
  siteSupervisorId?: string | null;
  siteSupervisorName?: string | null;
  siteSupervisorEmail?: string | null;
  siteSupervisorRole?: string | null;
  siteManagerId?: string | null;
  siteManagerName?: string | null;
  siteManagerEmail?: string | null;
  siteManagerRole?: string | null;
  isActive: boolean;
  taskCount: number;
  openTaskCount: number;
}

interface ProjectContextValue {
  currentProjectId: string | null;
  setCurrentProjectId: (id: string) => void;
  projects: Project[];
  currentProject: Project | undefined;
  isLoading: boolean;
  error: Error | null;
}

const ProjectContext = createContext<ProjectContextValue | undefined>(undefined);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);

  const {
    data,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      console.log("[project-context] loading projects");
      const result = await api.getProjects();
      console.log("[project-context] loaded projects", {
        count: result.items.length,
      });
      return result;
    },
  });

  const projects = data?.items ?? [];
  const currentProject = projects.find((p) => p.id === currentProjectId);

  // Auto-select first project when projects load
  useEffect(() => {
    if (projects.length > 0 && !currentProjectId) {
      console.log("[project-context] selecting initial project", {
        projectId: projects[0].id,
      });
      setCurrentProjectId(projects[0].id);
    }
  }, [projects, currentProjectId]);

  return (
    <ProjectContext.Provider
      value={{
        currentProjectId,
        setCurrentProjectId,
        projects,
        currentProject,
        isLoading,
        error: error as Error | null,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error("useProject must be used within a ProjectProvider");
  }
  return context;
}
