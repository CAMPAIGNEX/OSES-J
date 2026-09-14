/** UI templates selectable per workspace (Settings > Appearance). Shared by server and client code. */
export const UI_TEMPLATES = [
  { id: "classic", name: "Classic", description: "Clean, quiet and professional. Soft surfaces, Manrope type, solid icons." },
  { id: "bauhaus", name: "Bauhaus Mix", description: "Bauhaus geometry meets graffiti, mixed media and pop art: paper, ink, red / blue / yellow blocks, tape, markers and halftones." },
  { id: "neo", name: "Neo", description: "Futuristic and robotic: deep-space aurora, frosted glass surfaces, cyan / violet light, Orbitron type and subtle motion." },
] as const;

export type UiTemplate = (typeof UI_TEMPLATES)[number]["id"];
export const TEMPLATE_COOKIE = "oses_template";

export function normalizeTemplate(value: string | null | undefined): UiTemplate {
  return UI_TEMPLATES.some((t) => t.id === value) ? (value as UiTemplate) : "classic";
}
