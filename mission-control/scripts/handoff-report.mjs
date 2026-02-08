#!/usr/bin/env node
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

function run(cmd, fallback = "") {
  try {
    return execSync(cmd, { encoding: "utf8" }).trim();
  } catch {
    return fallback;
  }
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

const args = process.argv.slice(2);
const outIndex = args.indexOf("--out");
const outPath = outIndex >= 0 ? args[outIndex + 1] : "";

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
