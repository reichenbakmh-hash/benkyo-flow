import { useMemo, useState } from "react";
import { Share2, Download, Printer, X } from "lucide-react";
import { renderWeeklyPlanningCanvas, sharePlanningImage, downloadCanvasImage } from "../lib/canvasShare";
import type { WeeklyPlanningData } from "../lib/canvasShare";
import type { Homework, Subject, StudySession } from "../lib/storage";

interface SharePlanningButtonProps {
  homework: Homework[];
  subjects: Subject[];
  studySessions: StudySession[];
  ownerName: string;
  onToast: (message: string, tone?: "success" | "info" | "danger") => void;
}

const DAY_LABELS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const MONTH_LABELS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0 = dimanche
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  d.setHours(0, 0, 0, 0);
  return d;
}

function buildWeekDates(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function subjectMeta(subjects: Subject[], subjectId: string | null) {
  const subject = subjectId ? subjects.find((s) => s.id === subjectId) ?? null : null;
  return { name: subject?.name ?? null, color: subject?.color ?? null };
}

export function buildWeeklyPlanningData(
  homework: Homework[],
  subjects: Subject[],
  studySessions: StudySession[],
  ownerName: string
): WeeklyPlanningData {
  const monday = startOfWeek(new Date());
  const weekDates = buildWeekDates(monday);
  const todayStr = toISODate(new Date());
  const sunday = weekDates[6];

  const weekLabel = `Semaine du ${monday.getDate()} au ${sunday.getDate()} ${MONTH_LABELS[sunday.getMonth()]} ${sunday.getFullYear()}`;

  const days = weekDates.map((date, i) => {
    const iso = toISODate(date);
    const dayHomework = homework
      .filter((h) => h.dueDate === iso)
      .map((h) => {
        const meta = subjectMeta(subjects, h.subjectId);
        return {
          title: h.title,
          subjectName: meta.name,
          subjectColor: meta.color,
          statusLabel: h.status === "done" ? "Terminé" : h.status === "in_progress" ? "En cours" : "À faire",
        };
      });
    const daySessions = studySessions
      .filter((s) => s.date === iso)
      .map((s) => {
        const meta = subjectMeta(subjects, s.subjectId);
        return { minutes: s.minutes, subjectName: meta.name, subjectColor: meta.color };
      });
    return {
      dateLabel: `${DAY_LABELS[i]} ${date.getDate()} ${MONTH_LABELS[date.getMonth()]}`,
      isToday: iso === todayStr,
      homework: dayHomework,
      sessions: daySessions,
    };
  });

  return { weekLabel, ownerName, days };
}

export default function SharePlanningButton({ homework, subjects, studySessions, ownerName, onToast }: SharePlanningButtonProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const data = useMemo(
    () => buildWeeklyPlanningData(homework, subjects, studySessions, ownerName),
    [homework, subjects, studySessions, ownerName]
  );

  const canvas = useMemo(() => renderWeeklyPlanningCanvas(data), [data]);
  const previewUrl = useMemo(() => canvas.toDataURL("image/png"), [canvas]);
  const filename = `benkyo-flow-planning-${new Date().toISOString().slice(0, 10)}.png`;

  async function handleShare() {
    setBusy(true);
    try {
      const result = await sharePlanningImage(canvas, filename, "Mon planning — Benkyō Flow");
      if (result === "downloaded") onToast("Partage indisponible ici : image téléchargée à la place.", "info");
      else if (result === "shared") onToast("Planning partagé.", "success");
    } catch {
      onToast("Le partage a échoué.", "danger");
    } finally {
      setBusy(false);
    }
  }

  function handleDownload() {
    downloadCanvasImage(canvas, filename);
    onToast("Image du planning téléchargée.", "success");
  }

  function handlePrint() {
    window.print();
  }

  return (
    <>
      <div className="bf-share-planning__actions">
        <button className="bf-btn ghost small" onClick={() => setPreviewOpen(true)}>
          <Share2 size={15} /> <span className="bf-btn-label">Partager le planning</span>
        </button>
      </div>

      {previewOpen && (
        <div className="bf-modal-backdrop" onClick={() => setPreviewOpen(false)}>
          <div className="bf-modal bf-share-planning__modal" onClick={(e) => e.stopPropagation()}>
            <div className="bf-share-planning__modal-header">
              <h2>{data.weekLabel}</h2>
              <button className="bf-icon-btn" onClick={() => setPreviewOpen(false)} aria-label="Fermer">
                <X size={18} />
              </button>
            </div>
            <div className="bf-share-planning__preview">
              <img src={previewUrl} alt="Aperçu du planning de la semaine" />
            </div>
            <div className="bf-modal__actions">
              <button className="bf-btn ghost small" onClick={handlePrint}>
                <Printer size={15} /> <span className="bf-btn-label">Imprimer / PDF</span>
              </button>
              <button className="bf-btn ghost small" onClick={handleDownload}>
                <Download size={15} /> <span className="bf-btn-label">Télécharger</span>
              </button>
              <button className="bf-btn primary small" onClick={handleShare} disabled={busy}>
                <Share2 size={15} /> <span className="bf-btn-label">{busy ? "Partage…" : "Partager"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Zone imprimable seule : isolée via la règle @media print (voir index.css),
          invisible à l'écran, affichée en plein cadre à l'impression / export PDF. */}
      <div className="bf-print-area">
        <img src={previewUrl} alt={`Planning — ${data.weekLabel}`} />
      </div>
    </>
  );
}
