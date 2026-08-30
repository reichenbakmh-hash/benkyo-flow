// ---------------------------------------------------------------------------
// Benkyo Flow — Partage du planning hebdomadaire
// ---------------------------------------------------------------------------
// Rendu entièrement via l'API Canvas 2D native (aucune dépendance ajoutée).
// L'image obtenue sert à la fois pour le téléchargement / partage PNG et,
// affichée en plein cadre dans une zone dédiée à l'impression, pour
// l'export « PDF » via la boîte de dialogue d'impression du navigateur
// (Enregistrer en PDF) — une seule source de vérité pour les deux formats.
// ---------------------------------------------------------------------------

import type { SubjectColor } from "./storage";

export interface PlanningHomeworkItem {
  title: string;
  subjectName: string | null;
  subjectColor: SubjectColor | null;
  statusLabel: string;
}

export interface PlanningSessionItem {
  subjectName: string | null;
  subjectColor: SubjectColor | null;
  minutes: number;
}

export interface PlanningDay {
  dateLabel: string; // ex. "Lundi 1 septembre"
  isToday: boolean;
  homework: PlanningHomeworkItem[];
  sessions: PlanningSessionItem[];
}

export interface WeeklyPlanningData {
  weekLabel: string; // ex. "Semaine du 1 au 7 septembre 2026"
  ownerName: string;
  days: PlanningDay[];
}

const SUBJECT_COLOR_HEX: Record<SubjectColor, string> = {
  blue: "#3b7ddd",
  green: "#16a163",
  orange: "#f0632e",
  purple: "#6d28d9",
  red: "#e23e57",
  teal: "#00a99b",
  pink: "#d6339c",
  yellow: "#e8a317",
};

function colorHex(c: SubjectColor | null): string {
  return c ? SUBJECT_COLOR_HEX[c] : "#9a97b8";
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let low = 0;
  let high = text.length;
  const ellipsis = "…";
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    const candidate = text.slice(0, mid).trimEnd() + ellipsis;
    if (ctx.measureText(candidate).width <= maxWidth) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  return low <= 0 ? ellipsis : text.slice(0, low).trimEnd() + ellipsis;
}

const PAGE_WIDTH = 900;
const MARGIN = 40;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

// Calcule la hauteur nécessaire pour un jour avant de dessiner (pour
// dimensionner le canvas d'un seul passage, sans redessiner).
function measureDayHeight(day: PlanningDay): number {
  let h = 34; // en-tête du jour
  if (day.homework.length === 0 && day.sessions.length === 0) {
    h += 28; // ligne "rien de prévu"
  } else {
    h += day.homework.length * 26;
    h += day.sessions.length * 24;
  }
  return h + 18; // marge basse
}

export function renderWeeklyPlanningCanvas(data: WeeklyPlanningData): HTMLCanvasElement {
  const headerHeight = 118;
  const footerHeight = 40;
  const daysHeight = data.days.reduce((sum, d) => sum + measureDayHeight(d) + 14, 0);
  const emptyWeekExtra = data.days.every((d) => d.homework.length === 0 && d.sessions.length === 0) ? 0 : 0;
  const pageHeight = headerHeight + daysHeight + footerHeight + emptyWeekExtra;

  const scale = 2; // rendu net (écrans retina, impression)
  const canvas = document.createElement("canvas");
  canvas.width = PAGE_WIDTH * scale;
  canvas.height = pageHeight * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.scale(scale, scale);

  // --- Fond -----------------------------------------------------------------
  ctx.fillStyle = "#fafaff";
  ctx.fillRect(0, 0, PAGE_WIDTH, pageHeight);

  // --- En-tête ----------------------------------------------------------------
  const headerGradient = ctx.createLinearGradient(0, 0, PAGE_WIDTH, 0);
  headerGradient.addColorStop(0, "#14283f");
  headerGradient.addColorStop(1, "#1e3a5f");
  ctx.fillStyle = headerGradient;
  ctx.fillRect(0, 0, PAGE_WIDTH, headerHeight);

  ctx.fillStyle = "#ffffff";
  ctx.font = "700 15px 'Segoe UI', Arial, sans-serif";
  ctx.fillText("Benkyō Flow", MARGIN, 38);

  ctx.font = "700 26px 'Segoe UI', Arial, sans-serif";
  ctx.fillText(data.weekLabel, MARGIN, 72);

  ctx.font = "400 14px 'Segoe UI', Arial, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.78)";
  ctx.fillText(`Planning de ${data.ownerName}`, MARGIN, 96);

  // --- Jours ------------------------------------------------------------------
  let y = headerHeight + 24;

  data.days.forEach((day) => {
    const dayHeight = measureDayHeight(day);
    const cardTop = y;
    const cardBottom = y + dayHeight;

    // Carte du jour
    ctx.fillStyle = day.isToday ? "#fff4e8" : "#ffffff";
    ctx.strokeStyle = day.isToday ? "#f4820c" : "#e9e7f5";
    ctx.lineWidth = day.isToday ? 1.6 : 1;
    roundRect(ctx, MARGIN, cardTop, CONTENT_WIDTH, dayHeight, 12);
    ctx.fill();
    ctx.stroke();

    // Titre du jour
    ctx.fillStyle = "#17172b";
    ctx.font = "700 15px 'Segoe UI', Arial, sans-serif";
    ctx.fillText(day.dateLabel, MARGIN + 18, cardTop + 24);
    if (day.isToday) {
      ctx.font = "700 11px 'Segoe UI', Arial, sans-serif";
      ctx.fillStyle = "#f4820c";
      ctx.fillText("AUJOURD'HUI", MARGIN + CONTENT_WIDTH - 100, cardTop + 23);
    }

    let rowY = cardTop + 44;

    if (day.homework.length === 0 && day.sessions.length === 0) {
      ctx.font = "400 13px 'Segoe UI', Arial, sans-serif";
      ctx.fillStyle = "#a7a3c0";
      ctx.fillText("Rien de prévu.", MARGIN + 18, rowY);
      rowY += 24;
    } else {
      day.homework.forEach((h) => {
        ctx.fillStyle = colorHex(h.subjectColor);
        ctx.beginPath();
        ctx.arc(MARGIN + 24, rowY - 4, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = "600 13px 'Segoe UI', Arial, sans-serif";
        ctx.fillStyle = "#17172b";
        const label = h.subjectName ? `${h.title} — ${h.subjectName}` : h.title;
        ctx.fillText(truncate(ctx, label, CONTENT_WIDTH - 220), MARGIN + 36, rowY);

        ctx.font = "400 11.5px 'Segoe UI', Arial, sans-serif";
        ctx.fillStyle = "#6b6b85";
        ctx.fillText(h.statusLabel, MARGIN + CONTENT_WIDTH - 90, rowY);

        rowY += 26;
      });

      day.sessions.forEach((s) => {
        ctx.fillStyle = colorHex(s.subjectColor);
        ctx.beginPath();
        ctx.rect(MARGIN + 20, rowY - 10, 8, 8);
        ctx.fill();

        ctx.font = "400 12.5px 'Segoe UI', Arial, sans-serif";
        ctx.fillStyle = "#3d3d5c";
        const label = `${s.minutes} min d'étude${s.subjectName ? ` — ${s.subjectName}` : ""}`;
        ctx.fillText(truncate(ctx, label, CONTENT_WIDTH - 60), MARGIN + 36, rowY);

        rowY += 24;
      });
    }

    y = cardBottom + 14;
  });

  // --- Pied de page -------------------------------------------------------------
  ctx.font = "400 11px 'Segoe UI', Arial, sans-serif";
  ctx.fillStyle = "#a7a3c0";
  ctx.fillText("Généré avec Benkyō Flow", MARGIN, pageHeight - 16);

  return canvas;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("La génération de l'image a échoué."));
    }, "image/png");
  });
}

export function downloadCanvasImage(canvas: HTMLCanvasElement, filename: string): void {
  const url = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export type ShareResult = "shared" | "downloaded" | "cancelled";

// Tente le partage natif (Web Share API avec fichier) ; retombe sur un
// téléchargement classique si l'appareil/navigateur ne le supporte pas.
export async function sharePlanningImage(canvas: HTMLCanvasElement, filename: string, title: string): Promise<ShareResult> {
  const blob = await canvasToBlob(canvas);
  const file = new File([blob], filename, { type: "image/png" });
  const nav = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean;
    share?: (data: { files: File[]; title?: string }) => Promise<void>;
  };

  if (nav.canShare && nav.canShare({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file], title });
      return "shared";
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return "cancelled";
      // tombe en secours sur le téléchargement ci-dessous
    }
  }
  downloadCanvasImage(canvas, filename);
  return "downloaded";
}
