"use client";

// Browser-safe subpath: the shared index pulls in Node-only modules (dns, crypto).
import { AI_PROVIDER_PRESETS, aiProviderPreset } from "@oses/shared/ai-providers";
import { OsInput, OsSelect } from "./os-shell";

export interface AiProviderForm {
  provider: string;
  model: string;
  baseUrl: string;
  apiKey: string;
}

const GROUPS: Array<{ key: "hosted" | "open" | "local" | "custom"; label: string }> = [
  { key: "hosted", label: "Hosted models" },
  { key: "open", label: "Open-source models (hosted)" },
  { key: "local", label: "Self-hosted / local" },
  { key: "custom", label: "Custom" },
];

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#6b7280]">{children}</span>;
}

/**
 * Provider / model / key / endpoint fields shared by the platform page and the per-workspace operations panel.
 * Choosing a provider fills its default endpoint and model placeholder; local servers need no key.
 */
export function AiProviderFields({ value, onChange, hasSavedKey, extraOptions }: { value: AiProviderForm; onChange: (next: AiProviderForm) => void; hasSavedKey: boolean; extraOptions?: React.ReactNode }) {
  const preset = aiProviderPreset(value.provider);
  const showBaseUrl = preset ? preset.api === "openai" : false;
  function pick(provider: string) {
    const p = aiProviderPreset(provider);
    onChange({ ...value, provider, baseUrl: p?.baseUrl ?? "", model: p?.defaultModel ?? "" });
  }
  return (
    <>
      <label className="block">
        <FieldLabel>Provider</FieldLabel>
        <OsSelect value={value.provider} onChange={(e) => pick(e.target.value)} className="mt-1 w-full">
          {extraOptions}
          {GROUPS.map((g) => (
            <optgroup key={g.key} label={g.label}>
              {AI_PROVIDER_PRESETS.filter((p) => p.group === g.key).map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </optgroup>
          ))}
        </OsSelect>
        {preset && <span className="mt-1 block text-[11px] text-[#6b7280]">{preset.hint}</span>}
      </label>
      <label className="block">
        <FieldLabel>Model</FieldLabel>
        <OsInput value={value.model} onChange={(e) => onChange({ ...value, model: e.target.value })} placeholder={preset?.defaultModel || "model id"} className="mt-1 w-full" />
      </label>
      <label className="block">
        <FieldLabel>
          API key {preset?.keyOptional ? "(optional for local servers)" : ""} {hasSavedKey ? "(blank keeps the saved key)" : ""}
        </FieldLabel>
        <OsInput type="password" value={value.apiKey} onChange={(e) => onChange({ ...value, apiKey: e.target.value })} placeholder={hasSavedKey ? "••••••••" : preset?.keyOptional ? "leave empty or paste a key" : "paste the key"} className="mt-1 w-full" autoComplete="off" />
      </label>
      {showBaseUrl && (
        <label className="block">
          <FieldLabel>Endpoint (base URL)</FieldLabel>
          <OsInput value={value.baseUrl} onChange={(e) => onChange({ ...value, baseUrl: e.target.value })} placeholder={preset?.baseUrl ?? "https://host/v1"} className="mt-1 w-full" />
        </label>
      )}
    </>
  );
}
