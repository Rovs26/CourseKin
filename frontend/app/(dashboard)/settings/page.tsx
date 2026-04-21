"use client";

import { useEffect, useState } from "react";
import {
  Bell,
  LayoutTemplate,
  Monitor,
  Moon,
  ShieldCheck,
  Sparkles,
  Sun,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "reviewflow_ui_preferences_v1";

type ThemePreference = "light" | "dark" | "system";
type ExportMode = "plain" | "highlighted";
type PaperSize = "a4" | "letter";

type UiPreferences = {
  theme: ThemePreference;
  exportMode: ExportMode;
  paperSize: PaperSize;
  autoOpenReviewer: boolean;
  showGenerationHints: boolean;
  compactCards: boolean;
  rememberLastTemplate: boolean;
};

const defaultPreferences: UiPreferences = {
  theme: "system",
  exportMode: "plain",
  paperSize: "a4",
  autoOpenReviewer: true,
  showGenerationHints: true,
  compactCards: false,
  rememberLastTemplate: false,
};

function readPreferences(): UiPreferences {
  if (typeof window === "undefined") {
    return defaultPreferences;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return defaultPreferences;
    }

    return {
      ...defaultPreferences,
      ...JSON.parse(raw),
    };
  } catch {
    return defaultPreferences;
  }
}

function writePreferences(next: UiPreferences) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

function applyTheme(theme: ThemePreference) {
  if (typeof window === "undefined") {
    return;
  }

  const resolved =
    theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme;

  document.documentElement.classList.toggle("dark", resolved === "dark");
  document.documentElement.dataset.theme = resolved;
}

function ChoiceButton({
  active,
  label,
  onClick,
  icon,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant={active ? "default" : "outline"}
      className={cn(
        "justify-start rounded-xl",
        active
          ? "text-white"
          : "border-slate-200 bg-transparent text-slate-700 hover:bg-slate-50 hover:text-slate-900"
      )}
      onClick={onClick}
    >
      <span className="flex items-center gap-2">
        {icon}
        {label}
      </span>
    </Button>
  );
}

function ToggleRow({
  label,
  value,
  onToggle,
  note,
}: {
  label: string;
  value: boolean;
  onToggle: () => void;
  note?: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border p-4">
      <div className="pr-4">
        <p className="font-medium text-slate-900">{label}</p>
        {note ? <p className="mt-1 text-xs text-slate-500">{note}</p> : null}
      </div>

      <Button
        variant={value ? "default" : "outline"}
        className={cn(
          "min-w-[88px] rounded-xl",
          !value &&
            "border-slate-200 bg-transparent text-slate-700 hover:bg-slate-50 hover:text-slate-900"
        )}
        onClick={onToggle}
      >
        {value ? "On" : "Off"}
      </Button>
    </div>
  );
}

export default function SettingsPage() {
  const [preferences, setPreferences] = useState<UiPreferences>(
    defaultPreferences
  );

  useEffect(() => {
    const initial = readPreferences();
    setPreferences(initial);
    applyTheme(initial.theme);

    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const handleSystemThemeChange = () => {
      const current = readPreferences();

      if (current.theme === "system") {
        applyTheme("system");
      }
    };

    media.addEventListener("change", handleSystemThemeChange);

    return () => {
      media.removeEventListener("change", handleSystemThemeChange);
    };
  }, []);

  const updatePreferences = (patch: Partial<UiPreferences>) => {
    setPreferences((current) => {
      const next = {
        ...current,
        ...patch,
      };

      writePreferences(next);

      if (patch.theme) {
        applyTheme(next.theme);
      }

      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          Settings
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage appearance, export defaults, and workspace preferences.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <Sparkles className="h-5 w-5" />
              </div>
              <CardTitle className="text-xl text-slate-900">
                Appearance
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3">
            <ChoiceButton
              active={preferences.theme === "light"}
              label="Light"
              icon={<Sun className="h-4 w-4" />}
              onClick={() => updatePreferences({ theme: "light" })}
            />
            <ChoiceButton
              active={preferences.theme === "dark"}
              label="Dark"
              icon={<Moon className="h-4 w-4" />}
              onClick={() => updatePreferences({ theme: "dark" })}
            />
            <ChoiceButton
              active={preferences.theme === "system"}
              label="System"
              icon={<Monitor className="h-4 w-4" />}
              onClick={() => updatePreferences({ theme: "system" })}
            />
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <CardTitle className="text-xl text-slate-900">
                Export Defaults
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-900">Export Mode</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <ChoiceButton
                  active={preferences.exportMode === "plain"}
                  label="Plain"
                  onClick={() => updatePreferences({ exportMode: "plain" })}
                />
                <ChoiceButton
                  active={preferences.exportMode === "highlighted"}
                  label="Highlighted"
                  onClick={() =>
                    updatePreferences({ exportMode: "highlighted" })
                  }
                />
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-900">Paper Size</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <ChoiceButton
                  active={preferences.paperSize === "a4"}
                  label="A4"
                  onClick={() => updatePreferences({ paperSize: "a4" })}
                />
                <ChoiceButton
                  active={preferences.paperSize === "letter"}
                  label="Letter"
                  onClick={() => updatePreferences({ paperSize: "letter" })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <Sparkles className="h-5 w-5" />
              </div>
              <CardTitle className="text-xl text-slate-900">
                Workspace Preferences
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <ToggleRow
              label="Auto open reviewer after generation"
              value={preferences.autoOpenReviewer}
              onToggle={() =>
                updatePreferences({
                  autoOpenReviewer: !preferences.autoOpenReviewer,
                })
              }
            />
            <ToggleRow
              label="Show generation status hints"
              value={preferences.showGenerationHints}
              onToggle={() =>
                updatePreferences({
                  showGenerationHints: !preferences.showGenerationHints,
                })
              }
            />
            <ToggleRow
              label="Use compact dashboard cards"
              value={preferences.compactCards}
              onToggle={() =>
                updatePreferences({
                  compactCards: !preferences.compactCards,
                })
              }
            />
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <LayoutTemplate className="h-5 w-5" />
              </div>
              <CardTitle className="text-xl text-slate-900">
                Templates
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <ToggleRow
              label="Remember last selected template"
              value={preferences.rememberLastTemplate}
              onToggle={() =>
                updatePreferences({
                  rememberLastTemplate: !preferences.rememberLastTemplate,
                })
              }
            />
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <Bell className="h-5 w-5" />
              </div>
              <CardTitle className="text-xl text-slate-900">
                Notifications
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-xl border p-4">
              <p className="font-medium text-slate-900">Reviewer ready alerts</p>
              <p className="mt-1 text-xs text-slate-500">
                Placeholder for later backend wiring
              </p>
            </div>
            <div className="rounded-xl border p-4">
              <p className="font-medium text-slate-900">
                Source processing alerts
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Placeholder for later backend wiring
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <CardTitle className="text-xl text-slate-900">
                Privacy
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border p-4">
              <p className="font-medium text-slate-900">
                Store workspace settings locally only
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Current settings are persisted in localStorage for mock mode.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}