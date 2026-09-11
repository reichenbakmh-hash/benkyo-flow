import { useEffect, useRef, useState } from "react";
import { Play, Pause, SkipForward, RotateCcw, Settings2, Timer as TimerIcon, Coffee, BookOpen, X, Save, Volume2, VolumeX } from "lucide-react";
import {
  type PomodoroPhase,
  type PomodoroPreset,
  type PomodoroRunState,
  type PomodoroSettings,
  PHASE_LABEL,
  POMODORO_PRESETS,
  clampPomodoroSettings,
  freshRunState,
  loadPomodoroRunState,
  savePomodoroRunState,
  phaseDurationMs,
  getRemainingMs,
  getElapsedMs,
  formatMMSS,
  nextPhaseAfterWork,
} from "../lib/pomodoro";
import { AmbientSoundEngine, AMBIENT_SOUNDS, type AmbientSoundId } from "../lib/ambientSound";
import { showLocalNotification } from "../lib/notifications";
import { makeId } from "../lib/storage";
import type { Subject, StudySession } from "../lib/storage";
import CustomSelect from "./CustomSelect";
import FocusStats from "./FocusStats";

interface PomodoroTimerProps {
  subjects: Subject[];
  settings: PomodoroSettings;
  onSettingsChange: (s: PomodoroSettings) => void;
  customPresets: PomodoroPreset[];
  onCustomPresetsChange: (presets: PomodoroPreset[]) => void;
  ambientSoundId: AmbientSoundId;
  ambientVolume: number;
  onAmbientSoundChange: (id: AmbientSoundId) => void;
  onAmbientVolumeChange: (volume: number) => void;
  studySessions: StudySession[];
  onAddStudySession: (s: StudySession) => void;
  onToast: (message: string, tone?: "success" | "info" | "danger") => void;
}

const PHASE_TONE: Record<PomodoroPhase, string> = {
  work: "var(--bf-primary)",
  short_break: "var(--bf-success)",
  long_break: "var(--bf-accent)",
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function PomodoroTimer({
  subjects,
  settings,
  onSettingsChange,
  customPresets,
  onCustomPresetsChange,
  ambientSoundId,
  ambientVolume,
  onAmbientSoundChange,
  onAmbientVolumeChange,
  studySessions,
  onAddStudySession,
  onToast,
}: PomodoroTimerProps) {
  const [run, setRun] = useState<PomodoroRunState>(() => loadPomodoroRunState(settings));
  const [, forceTick] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draftSettings, setDraftSettings] = useState<PomodoroSettings>(settings);
  const [newPresetName, setNewPresetName] = useState("");
  const runRef = useRef(run);
  runRef.current = run;
  const ambientEngineRef = useRef<AmbientSoundEngine | null>(null);

  function getAmbientEngine(): AmbientSoundEngine {
    if (!ambientEngineRef.current) {
      ambientEngineRef.current = new AmbientSoundEngine();
    }
    return ambientEngineRef.current;
  }

  useEffect(() => setDraftSettings(settings), [settings]);

  // Persiste l'état du minuteur à chaque changement.
  useEffect(() => savePomodoroRunState(run), [run]);

  // Le son d'ambiance ne tourne que pendant une phase de travail active, et
  // se coupe automatiquement en pause ou à l'arrêt du minuteur.
  useEffect(() => {
    const engine = getAmbientEngine();
    if (run.running && run.phase === "work" && ambientSoundId !== "none") {
      engine.play(ambientSoundId, ambientVolume);
    } else {
      engine.stop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run.running, run.phase, ambientSoundId]);

  useEffect(() => {
    ambientEngineRef.current?.setVolume(ambientVolume);
  }, [ambientVolume]);

  useEffect(() => {
    return () => ambientEngineRef.current?.dispose();
  }, []);

  // Un seul intervalle, qui recalcule toujours le temps restant à partir de
  // `endAt` (voir lib/pomodoro.ts) : aucune dérive possible, même si les
  // ticks sont espacés par le navigateur en arrière-plan.
  useEffect(() => {
    const id = window.setInterval(() => {
      forceTick((t) => t + 1);
      const current = runRef.current;
      if (current.running && getRemainingMs(current) <= 0) {
        completePhase(true);
      }
    }, 1000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function logStudySessionIfMeaningful(minutes: number, subjectId: string | null) {
    if (minutes < 1) return;
    onAddStudySession({
      id: makeId("study"),
      subjectId,
      minutes,
      date: todayISO(),
      createdAt: Date.now(),
    });
  }

  function completePhase(natural: boolean) {
    const current = runRef.current;

    if (current.phase === "work") {
      const elapsedMinutes = natural ? settings.workMinutes : Math.round(getElapsedMs(current) / 60000);
      logStudySessionIfMeaningful(elapsedMinutes, current.subjectId);
      const completedWorkSessions = current.completedWorkSessions + 1;
      const nextPhase = nextPhaseAfterWork(completedWorkSessions, settings);
      onToast(
        elapsedMinutes >= 1
          ? `Session enregistrée : ${elapsedMinutes} min. Place à la pause !`
          : "Pause !",
        "success"
      );
      showLocalNotification("Pomodoro — Pause !", {
        body: elapsedMinutes >= 1 ? `${elapsedMinutes} min de travail enregistrées. Fais une pause.` : "Fais une pause.",
        tag: "bf-pomodoro-phase",
      });
      const durationMs = phaseDurationMs(nextPhase, settings);
      setRun({ ...current, phase: nextPhase, running: false, endAt: null, remainingMs: durationMs, durationMs, completedWorkSessions });
    } else {
      onToast("Pause terminée, prêt·e pour une nouvelle session ?", "info");
      showLocalNotification("Pomodoro — C'est reparti", {
        body: "La pause est terminée. Prêt·e pour une nouvelle session de travail ?",
        tag: "bf-pomodoro-phase",
      });
      const durationMs = phaseDurationMs("work", settings);
      setRun({ ...current, phase: "work", running: false, endAt: null, remainingMs: durationMs, durationMs });
    }
  }

  function handleStart() {
    setRun((prev) => {
      const remaining = getRemainingMs(prev);
      const duration = remaining > 0 ? remaining : prev.durationMs;
      return { ...prev, running: true, endAt: Date.now() + duration, remainingMs: duration };
    });
  }

  function handlePause() {
    setRun((prev) => ({ ...prev, running: false, remainingMs: getRemainingMs(prev), endAt: null }));
  }

  function handleSkip() {
    completePhase(false);
  }

  function handleReset() {
    setRun((prev) => {
      if (prev.phase === "work") {
        const elapsedMinutes = Math.round(getElapsedMs(prev) / 60000);
        logStudySessionIfMeaningful(elapsedMinutes, prev.subjectId);
        if (elapsedMinutes >= 1) onToast(`Session partielle enregistrée : ${elapsedMinutes} min.`, "info");
      }
      return freshRunState(settings, prev.subjectId);
    });
  }

  function handleSubjectChange(subjectId: string) {
    setRun((prev) => ({ ...prev, subjectId: subjectId || null }));
  }

  function applyPreset(preset: PomodoroSettings) {
    setDraftSettings(preset);
  }

  function saveCurrentAsPreset() {
    const label = newPresetName.trim();
    if (!label) return;
    const preset: PomodoroPreset = {
      id: makeId("preset"),
      label,
      settings: clampPomodoroSettings(draftSettings),
      custom: true,
    };
    onCustomPresetsChange([...customPresets, preset]);
    setNewPresetName("");
    onToast(`Modèle « ${label} » enregistré.`, "success");
  }

  function deletePreset(id: string) {
    onCustomPresetsChange(customPresets.filter((p) => p.id !== id));
  }

  function saveSettings() {
    const clean = clampPomodoroSettings(draftSettings);
    onSettingsChange(clean);
    // Si le minuteur est à l'arrêt (pas en cours), on aligne tout de suite
    // la durée affichée sur les nouveaux réglages, sans perdre une session
    // active.
    setRun((prev) => {
      if (prev.running) return prev;
      const durationMs = phaseDurationMs(prev.phase, clean);
      return { ...prev, durationMs, remainingMs: durationMs };
    });
    setSettingsOpen(false);
    onToast("Réglages du minuteur enregistrés.", "success");
  }

  const remainingMs = getRemainingMs(run);
  const progress = 1 - remainingMs / Math.max(1, run.durationMs);
  const radius = 92;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - Math.min(1, Math.max(0, progress)));
  const tone = PHASE_TONE[run.phase];
  const PhaseIcon = run.phase === "work" ? BookOpen : Coffee;
  const activeSubject = subjects.find((s) => s.id === run.subjectId) ?? null;

  return (
    <>
      <div className="bf-page-heading">
        <h1>Session</h1>
        <p>Un minuteur Pomodoro qui enregistre automatiquement tes minutes d'étude.</p>
      </div>

      <div className="bf-pomodoro">
        <div className="bf-pomodoro__ring-wrap">
          <svg viewBox="0 0 200 200" className="bf-pomodoro__ring">
            <circle cx="100" cy="100" r={radius} className="bf-pomodoro__ring-bg" />
            <circle
              cx="100"
              cy="100"
              r={radius}
              className="bf-pomodoro__ring-fill"
              style={{
                stroke: tone,
                strokeDasharray: circumference,
                strokeDashoffset: dashOffset,
              }}
            />
          </svg>
          <div className="bf-pomodoro__center">
            <span className="bf-pomodoro__phase-icon" style={{ color: tone }}>
              <PhaseIcon size={22} strokeWidth={2} />
            </span>
            <span className="bf-pomodoro__time">{formatMMSS(remainingMs)}</span>
            <span className="bf-pomodoro__phase-label">{PHASE_LABEL[run.phase]}</span>
          </div>
        </div>

        <div className="bf-pomodoro__controls">
          {!run.running ? (
            <button className="bf-btn primary bf-pomodoro__main-btn" onClick={handleStart}>
              <Play size={17} /> {remainingMs < run.durationMs ? "Reprendre" : "Démarrer une session"}
            </button>
          ) : (
            <button className="bf-btn primary bf-pomodoro__main-btn" onClick={handlePause}>
              <Pause size={17} /> Mettre en pause
            </button>
          )}
          <button className="bf-btn ghost small" onClick={handleSkip} title="Passer à la phase suivante">
            <SkipForward size={15} /> <span className="bf-btn-label">Passer</span>
          </button>
          <button className="bf-btn ghost small" onClick={handleReset} title="Réinitialiser">
            <RotateCcw size={15} /> <span className="bf-btn-label">Réinitialiser</span>
          </button>
          <button className="bf-btn ghost small" onClick={() => setSettingsOpen((v) => !v)} title="Réglages du minuteur">
            <Settings2 size={15} /> <span className="bf-btn-label">Réglages</span>
          </button>
        </div>

        <div className="bf-pomodoro__meta">
          <div className="bf-field" style={{ maxWidth: 260 }}>
            <label htmlFor="pomodoro-subject">Matière associée</label>
            <CustomSelect
              id="pomodoro-subject"
              value={run.subjectId ?? ""}
              onChange={handleSubjectChange}
              options={[
                { value: "", label: "Aucune matière précise" },
                ...subjects.map((s) => ({ value: s.id, label: s.name })),
              ]}
            />
          </div>
          <div className="bf-pomodoro__stat">
            <TimerIcon size={14} />
            <span>
              {run.completedWorkSessions} session{run.completedWorkSessions > 1 ? "s" : ""} de travail terminée
              {run.completedWorkSessions > 1 ? "s" : ""} depuis la dernière pause longue
            </span>
          </div>
          <div className="bf-field bf-pomodoro__ambient" style={{ maxWidth: 260 }}>
            <label htmlFor="pomodoro-ambient">Ambiance sonore</label>
            <CustomSelect
              id="pomodoro-ambient"
              value={ambientSoundId}
              onChange={(v) => onAmbientSoundChange(v as AmbientSoundId)}
              options={AMBIENT_SOUNDS.map((s) => ({ value: s.id, label: s.label }))}
            />
            {ambientSoundId !== "none" && (
              <div className="bf-pomodoro__ambient-volume">
                {ambientVolume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={ambientVolume}
                  onChange={(e) => onAmbientVolumeChange(Number(e.target.value))}
                  aria-label="Volume du son d'ambiance"
                />
              </div>
            )}
          </div>
        </div>

        {settingsOpen && (
          <div className="bf-panel bf-pomodoro__settings">
            <div className="bf-panel__header">
              <h2>Personnaliser les durées</h2>
            </div>
            <div className="bf-pomodoro__presets">
              {POMODORO_PRESETS.map((p) => (
                <button key={p.id} type="button" className="bf-tag bf-pomodoro__preset-btn" onClick={() => applyPreset(p.settings)}>
                  {p.label}
                </button>
              ))}
              {customPresets.map((p) => (
                <span key={p.id} className="bf-pomodoro__preset-custom">
                  <button type="button" className="bf-tag bf-pomodoro__preset-btn" onClick={() => applyPreset(p.settings)}>
                    {p.label}
                  </button>
                  <button
                    type="button"
                    className="bf-pomodoro__preset-remove"
                    onClick={() => deletePreset(p.id)}
                    aria-label={`Supprimer le modèle ${p.label}`}
                    title="Supprimer ce modèle"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
            <div className="bf-pomodoro__preset-save">
              <input
                type="text"
                placeholder="Nom du modèle (ex. Révisions du soir)"
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                maxLength={40}
              />
              <button type="button" className="bf-btn ghost small" onClick={saveCurrentAsPreset} disabled={!newPresetName.trim()}>
                <Save size={14} /> <span className="bf-btn-label">Enregistrer comme modèle</span>
              </button>
            </div>
            <div className="bf-pomodoro__settings-grid">
              <div className="bf-field">
                <label htmlFor="pf-work">Travail (min)</label>
                <input
                  id="pf-work"
                  type="number"
                  min={1}
                  max={180}
                  value={draftSettings.workMinutes}
                  onChange={(e) => setDraftSettings((d) => ({ ...d, workMinutes: Number(e.target.value) }))}
                />
              </div>
              <div className="bf-field">
                <label htmlFor="pf-break">Pause courte (min)</label>
                <input
                  id="pf-break"
                  type="number"
                  min={1}
                  max={60}
                  value={draftSettings.breakMinutes}
                  onChange={(e) => setDraftSettings((d) => ({ ...d, breakMinutes: Number(e.target.value) }))}
                />
              </div>
              <div className="bf-field">
                <label htmlFor="pf-long-break">Pause longue (min)</label>
                <input
                  id="pf-long-break"
                  type="number"
                  min={1}
                  max={90}
                  value={draftSettings.longBreakMinutes}
                  onChange={(e) => setDraftSettings((d) => ({ ...d, longBreakMinutes: Number(e.target.value) }))}
                />
              </div>
              <div className="bf-field">
                <label htmlFor="pf-cycles">Sessions avant pause longue</label>
                <input
                  id="pf-cycles"
                  type="number"
                  min={2}
                  max={10}
                  value={draftSettings.sessionsBeforeLongBreak}
                  onChange={(e) => setDraftSettings((d) => ({ ...d, sessionsBeforeLongBreak: Number(e.target.value) }))}
                />
              </div>
            </div>
            <button className="bf-btn primary small" onClick={saveSettings}>
              Enregistrer les réglages
            </button>
          </div>
        )}

        {activeSubject && (
          <p className="bf-pomodoro__hint">
            Les minutes seront enregistrées sur <strong>{activeSubject.name}</strong> à la fin de chaque session de travail.
          </p>
        )}
      </div>

      <FocusStats subjects={subjects} studySessions={studySessions} />
    </>
  );
}
