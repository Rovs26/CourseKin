export const routes = {
  dashboard: "/dashboard",
  projects: "/projects",
  newProject: "/projects/new",
  templates: "/template",
  settings: "/settings",
  account: "/settings/account",
  billing: "/settings/billing",
  projectOverview: (projectId: string) => `/projects/${projectId}`,
  projectReviewer: (projectId: string) => `/projects/${projectId}/reviewer`,
  projectSources: (projectId: string) => `/projects/${projectId}/sources`,
  projectSettings: (projectId: string) => `/projects/${projectId}/settings`,
  projectExport: (projectId: string) => `/projects/${projectId}/reviewer/export`,
};