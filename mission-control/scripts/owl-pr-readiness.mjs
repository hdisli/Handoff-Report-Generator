#!/usr/bin/env node
import { execSync } from "node:child_process";

function run(cmd) {
  try {
    const out = execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
    return { ok: true, out };
  } catch (error) {
    const out = String(error?.stderr || error?.stdout || error?.message || "").trim();
    return { ok: false, out };
  }
}

function parseArgs(argv) {
  return {
    json: argv.includes("--json"),
    strict: argv.includes("--strict"),
  };
}

const args = parseArgs(process.argv.slice(2));

const branch = run("git rev-parse --abbrev-ref HEAD");
const remote = run("git remote get-url origin");
const statusPorcelain = run("git status --porcelain");
const aheadBehind = run("git rev-list --left-right --count @{upstream}...HEAD");
const ghAuth = run("gh auth status");

let ahead = null;
let behind = null;
if (aheadBehind.ok) {
  const [behindRaw, aheadRaw] = aheadBehind.out.split(/\s+/);
  behind = Number(behindRaw);
  ahead = Number(aheadRaw);
}

const checks = [
  {
    key: "git_branch",
    ok: branch.ok,
    detail: branch.ok ? branch.out : "Kein Git-Branch ermittelbar.",
  },
  {
    key: "origin_remote",
    ok: remote.ok,
    detail: remote.ok ? remote.out : "Remote origin fehlt.",
  },
  {
    key: "working_tree_clean",
    ok: statusPorcelain.ok && statusPorcelain.out.length === 0,
    detail:
      statusPorcelain.ok && statusPorcelain.out.length === 0
        ? "Arbeitsverzeichnis sauber."
        : `Uncommitted Changes erkannt:\n${statusPorcelain.out || "(nicht lesbar)"}`,
  },
  {
    key: "upstream_sync",
    ok: aheadBehind.ok ? (behind ?? 0) === 0 : false,
    detail: aheadBehind.ok
      ? `Ahead=${ahead ?? "?"}, Behind=${behind ?? "?"}`
      : "Kein Upstream konfiguriert (oder nicht lesbar).",
  },
  {
    key: "github_auth",
    ok: ghAuth.ok,
    detail: ghAuth.ok ? "GitHub CLI authentifiziert." : ghAuth.out || "gh auth status fehlgeschlagen.",
  },
];

const blockers = checks.filter((c) => !c.ok).map((c) => c.key);
const ready = blockers.length === 0;

const prCommand = branch.ok
  ? `git push -u origin ${branch.out} && gh pr create --fill`
  : "git push -u origin <branch> && gh pr create --fill";

const output = {
  ready,
  blockers,
  checks,
  nextCommands: [
    "npm run check",
    prCommand,
    "gh pr view --web",
  ],
};

if (args.json) {
  console.log(JSON.stringify(output, null, 2));
} else {
  console.log("Owl Live Ops · PR Readiness");
  console.log(`Ready: ${ready ? "YES" : "NO"}`);
  for (const c of checks) {
    console.log(`- [${c.ok ? "ok" : "x"}] ${c.key}: ${c.detail}`);
  }
  console.log("\nNächste Kommandos:");
  for (const cmd of output.nextCommands) {
    console.log(`  - ${cmd}`);
  }
}

if (args.strict && !ready) {
  process.exit(1);
}
