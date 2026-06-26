"use client";

export type WorkspacePreference = {
  label: string;
  artifactTarget: string;
  path?: string;
  fileCount?: number;
  selectedAt: string;
};

const PREF_KEY = "panely.workspace.preference";

function savePreference(preference: WorkspacePreference) {
  window.localStorage.setItem(PREF_KEY, JSON.stringify(preference));
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = safeFileName(fileName);
  a.click();
  URL.revokeObjectURL(url);
}

function safeFileName(fileName: string) {
  return fileName.replace(/[/:\\?%*"<>|]/g, "-").replace(/\s+/g, " ").trim() || "panely-artifact";
}

export function defaultWorkspaceTarget() {
  return "./local-workspace/Panely";
}

export function getSavedWorkspacePreference(): WorkspacePreference | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(PREF_KEY);
  if (!raw) return null;
  try {
    const preference = JSON.parse(raw) as WorkspacePreference;
    if (!preference?.label || !preference?.selectedAt) return null;
    return preference;
  } catch {
    return null;
  }
}

export function rememberWorkspaceSelection(input: { label: string; artifactTarget: string; path?: string; fileCount?: number }): WorkspacePreference {
  const preference: WorkspacePreference = {
    label: input.label,
    artifactTarget: input.artifactTarget,
    path: input.path,
    fileCount: input.fileCount,
    selectedAt: new Date().toISOString(),
  };
  savePreference(preference);
  return preference;
}

export function rememberFallbackWorkspace(label: string, fileCount: number): WorkspacePreference {
  const cleanLabel = label.replace(/^\/+|\/+$/g, "") || "local-workspace";
  return rememberWorkspaceSelection({
    label: cleanLabel,
    artifactTarget: `./${cleanLabel}/Panely`,
    fileCount,
  });
}

export function clearWorkspacePreference() {
  if (typeof window !== "undefined") window.localStorage.removeItem(PREF_KEY);
}

export async function saveBlobAsArtifact(blob: Blob, fileName: string): Promise<"download"> {
  downloadBlob(blob, fileName);
  return "download";
}
