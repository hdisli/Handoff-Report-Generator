#!/usr/bin/env node
import { execSync, spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";

function run(cmd, fallback = "") {
  try {
    return execSync(cmd, { encoding: "utf8" }).trim();
  } catch {
    return fallback;
  }
}

function runSmoke(cmd) {
  if (!cmd) return null;

  const result = spawnSync(cmd, {
    shell: true,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  const mergedOutput = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
  const outputLines = mergedOutput ? mergedOutput.split("\n") : [];

  return {
    command: cmd,
    ok: result.status === 0,
    exitCode: result.status ?? (result.error ? -1 : 0),
    outputPreview: outputLines.slice(-12),
  };
}

function parseNumstat(output) {
  if (!output) return { files: 0, insertions: 0, deletions: 0 };
  return output
    .split("\n")
    .filter(Boolean)
    .reduce(
      (acc, line) => {
        const [added, removed] = line.split("\t");
        acc.files += 1;
        acc.insertions += Number.isFinite(Number(added)) ? Number(added) : 0;
        acc.deletions += Number.isFinite(Number(removed)) ? Number(removed) : 0;
        return acc;
      },
      { files: 0, insertions: 0, deletions: 0 },
    );
}

function section(title, content) {
  return `## ${title}\n${content}`;
}

function hasChangesIn(changedFiles, predicate) {
  return changedFiles.some((file) => predicate(file));
}

const args = process.argv.slice(2);
const outIndex = args.indexOf("--out");
const outPath = outIndex >= 0 ? args[outIndex + 1] : "";
const smokeIndex = args.indexOf("--smoke-cmd");
const smokeCmd = smokeIndex >= 0 ? args[smokeIndex + 1] : "";

const branch = run("git rev-parse --abbrev-ref HEAD", "unknown");
const hasOriginMain = run("git show-ref --verify --quiet refs/remotes/origin/main && echo yes || echo no", "no") === "yes";
const hasLocalMain = run("git show-ref --verify --quiet refs/heads/main && echo yes || echo no", "no") === "yes";
const base = hasOriginMain
  ? run("git merge-base HEAD origin/main", "HEAD~1")
  : hasLocalMain
    ? run("git merge-base HEAD main", "HEAD~1")
    : "HEAD~1";
const shortSha = run("git rev-parse --short HEAD", "-");
const lastCommit = run("git log -1 --pretty=%s", "-");

const changedFiles = run(`git diff --name-only ${base}...HEAD`)
  .split("\n")
  .filter(Boolean);
const stat = parseNumstat(run(`git diff --numstat ${base}...HEAD`));
const openTodos = run("git grep -nE '\\b(TODO|FIXME)\\b' -- ':!package-lock.json'", "")
  .split("\n")
  .filter(Boolean);

const riskSignals = [
  {
    label: "Schema/Backend-Änderung erkannt",
    active: hasChangesIn(changedFiles, (file) => file.startsWith("convex/") || file.includes("schema")),
  },
  {
    label: "Umgebungs-/Config-Datei geändert",
    active: hasChangesIn(changedFiles, (file) => /(^|\/)\.env|next\.config|tsconfig|eslint\.config/.test(file)),
  },
  {
    label: "Abhängigkeiten verändert (package-lock/package.json)",
    active: hasChangesIn(changedFiles, (file) => file.endsWith("package.json") || file.endsWith("package-lock.json")),
  },
  {
    label: "Großer Diff (>300 Zeilen gesamt)",
    active: stat.insertions + stat.deletions > 300,
  },
];

const smokeResult = runSmoke(smokeCmd);

const now = new Date();
const stamp = now.toLocaleString("de-DE", { timeZone: "Europe/Berlin" });

const markdown = [
  "# Handoff Report",
  "",
  `- Stand: ${stamp} (Europe/Berlin)`,
  `- Branch: \`${branch}\``,
  `- Letzter Commit: \`${shortSha}\` – ${lastCommit}`,
  `- Diff gegen main: ${stat.files} Dateien, +${stat.insertions} / -${stat.deletions}`,
  "",
  section(
    "Änderungen",
    changedFiles.length
      ? changedFiles.map((file) => `- ${file}`).join("\n")
      : "- Keine Änderungen gegenüber main.",
  ),
  "",
  section(
    "Risiko-Signale",
    riskSignals.some((signal) => signal.active)
      ? riskSignals
          .filter((signal) => signal.active)
          .map((signal) => `- ⚠️ ${signal.label}`)
          .join("\n")
      : "- ✅ Keine automatisch erkannten Risiko-Signale.",
  ),
  "",
  section(
    "Smoke-Check",
    !smokeResult
      ? "- Nicht ausgeführt (optional via `--smoke-cmd \"<kommando>\"`)."
      : [
          `- Kommando: \`${smokeResult.command}\``,
          `- Ergebnis: ${smokeResult.ok ? "✅ erfolgreich" : `❌ fehlgeschlagen (Exit ${smokeResult.exitCode})`}`,
          "- Ausgabe (letzte Zeilen):",
          ...(smokeResult.outputPreview.length
            ? smokeResult.outputPreview.map((line) => `  - ${line}`)
            : ["  - (keine Ausgabe)"]),
        ].join("\n"),
  ),
  "",
  section(
    "Review-Fokus",
    [
      "- Prüfen, ob die Änderungen dem Ziel entsprechen (Scope passt).",
      "- Risiko prüfen: API/Schema/Breaking Changes?",
      "- UX- und Fehlerszenarien kurz durchklicken.",
      "- Test-Status ergänzen (lokal/CI).",
    ].join("\n"),
  ),
  "",
  section(
    "Offene TODO/FIXME",
    openTodos.length ? openTodos.map((line) => `- ${line}`).join("\n") : "- Keine offenen TODO/FIXME-Treffer.",
  ),
  "",
  section(
    "Nächste Schritte (Template)",
    [
      "1. [ ] Reviewer benennen",
      "2. [ ] Testhinweise im PR-Text ergänzen",
      "3. [ ] Nach Feedback: gezielte Follow-up Commits",
    ].join("\n"),
  ),
  "",
].join("\n");

if (outPath) {
  writeFileSync(outPath, markdown, "utf8");
  console.log(`Handoff-Report geschrieben: ${outPath}`);
} else {
  console.log(markdown);
}
