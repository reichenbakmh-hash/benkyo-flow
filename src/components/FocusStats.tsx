import { BarChart3, Flame, Clock } from "lucide-react";
import { computeStudyStreak, isoDateDaysAgo } from "../lib/dateUtils";
import type { Subject, StudySession } from "../lib/storage";

interface FocusStatsProps {
  subjects: Subject[];
  studySessions: StudySession[];
}

const DAY_LABELS = ["D", "L", "M", "M", "J", "V", "S"];

function sumMinutes(sessions: StudySession[], predicate: (s: StudySession) => boolean): number {
  return sessions.filter(predicate).reduce((total, s) => total + s.minutes, 0);
}

export default function FocusStats({ subjects, studySessions }: FocusStatsProps) {
  const today = isoDateDaysAgo(0);
  const weekDates = new Set(Array.from({ length: 7 }, (_, i) => isoDateDaysAgo(i)));

  const minutesToday = sumMinutes(studySessions, (s) => s.date === today);
  const minutesWeek = sumMinutes(studySessions, (s) => weekDates.has(s.date));
  const streak = computeStudyStreak(studySessions);

  const bySubject = new Map<string, number>();
  for (const s of studySessions) {
    if (!weekDates.has(s.date)) continue;
    const key = s.subjectId ?? "none";
    bySubject.set(key, (bySubject.get(key) ?? 0) + s.minutes);
  }
  const topSubjects = [...bySubject.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([subjectId, minutes]) => ({
      minutes,
      name: subjectId === "none" ? "Sans matière" : subjects.find((sub) => sub.id === subjectId)?.name ?? "Matière supprimée",
    }));

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const iso = isoDateDaysAgo(6 - i);
    const minutes = sumMinutes(studySessions, (s) => s.date === iso);
    const weekday = new Date(iso + "T00:00:00").getDay();
    return { iso, minutes, label: DAY_LABELS[weekday] };
  });
  const maxDayMinutes = Math.max(1, ...last7Days.map((d) => d.minutes));

  if (studySessions.length === 0) {
    return (
      <div className="bf-panel bf-focus-stats">
        <div className="bf-panel__header">
          <h2>Statistiques de focus</h2>
        </div>
        <p className="bf-pomodoro__hint">Termine une première session pour voir tes statistiques ici.</p>
      </div>
    );
  }

  return (
    <div className="bf-panel bf-focus-stats">
      <div className="bf-panel__header">
        <h2>Statistiques de focus</h2>
      </div>

      <div className="bf-focus-stats__summary">
        <div className="bf-focus-stats__summary-item">
          <Clock size={16} />
          <span className="bf-focus-stats__summary-value">{minutesToday} min</span>
          <span className="bf-focus-stats__summary-label">aujourd'hui</span>
        </div>
        <div className="bf-focus-stats__summary-item">
          <BarChart3 size={16} />
          <span className="bf-focus-stats__summary-value">{minutesWeek} min</span>
          <span className="bf-focus-stats__summary-label">7 derniers jours</span>
        </div>
        <div className="bf-focus-stats__summary-item">
          <Flame size={16} />
          <span className="bf-focus-stats__summary-value">{streak.current}</span>
          <span className="bf-focus-stats__summary-label">
            jour{streak.current > 1 ? "s" : ""} de suite (record : {streak.best})
          </span>
        </div>
      </div>

      <div className="bf-focus-stats__chart">
        {last7Days.map((d) => (
          <div key={d.iso} className="bf-focus-stats__bar-wrap">
            <div className="bf-focus-stats__bar-track">
              <div
                className="bf-focus-stats__bar"
                style={{ height: `${Math.max(4, (d.minutes / maxDayMinutes) * 100)}%` }}
                title={`${d.minutes} min`}
              />
            </div>
            <span className="bf-focus-stats__bar-label">{d.label}</span>
          </div>
        ))}
      </div>

      {topSubjects.length > 0 && (
        <div className="bf-focus-stats__subjects">
          {topSubjects.map((s) => (
            <div key={s.name} className="bf-focus-stats__subject-row">
              <span className="bf-focus-stats__subject-name">{s.name}</span>
              <div className="bf-focus-stats__subject-track">
                <div
                  className="bf-focus-stats__subject-fill"
                  style={{ width: `${Math.max(4, (s.minutes / topSubjects[0].minutes) * 100)}%` }}
                />
              </div>
              <span className="bf-focus-stats__subject-minutes">{s.minutes} min</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
