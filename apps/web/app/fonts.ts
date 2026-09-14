import localFont from "next/font/local";

/**
 * Self-hosted fonts (no build-time dependency on Google Fonts).
 * Classic template: Manrope. Bauhaus Mix template: Archivo Black (display), Space Grotesk (body),
 * Permanent Marker (graffiti accents), Rubik Mono One (poster numerals). Neo template: Orbitron (display).
 */
export const manrope = localFont({ src: "./fonts/manrope.woff2", variable: "--font-manrope", weight: "400 800", display: "swap" });
export const spaceGrotesk = localFont({ src: "./fonts/space-grotesk.woff2", variable: "--font-grotesk", weight: "300 700", display: "swap" });
export const archivoBlack = localFont({ src: "./fonts/archivo-black.woff2", variable: "--font-archivo", weight: "400", display: "swap" });
export const permanentMarker = localFont({ src: "./fonts/permanent-marker.woff2", variable: "--font-marker", weight: "400", display: "swap" });
export const rubikMonoOne = localFont({ src: "./fonts/rubik-mono-one.woff2", variable: "--font-rubik-mono", weight: "400", display: "swap" });
export const orbitron = localFont({ src: "./fonts/orbitron.woff2", variable: "--font-orbitron", weight: "400 900", display: "swap" });

export const fontVariables = [manrope.variable, spaceGrotesk.variable, archivoBlack.variable, permanentMarker.variable, rubikMonoOne.variable, orbitron.variable].join(" ");
