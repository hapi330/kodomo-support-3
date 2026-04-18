#!/usr/bin/env node

import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PROJECT_DIR = process.cwd();
const LOCK_FILE_PATH = join(PROJECT_DIR, ".next", "dev", "lock");
const DEFAULT_TARGET_PORTS = [3000, 3001];
const CURRENT_USER = process.env.USER ?? "";
const TARGET_PORTS = parseTargetPorts(process.env.NEXT_DEV_CLEAN_PORTS);

function parseTargetPorts(raw) {
  if (!raw) {
    return DEFAULT_TARGET_PORTS;
  }
  const parsed = raw
    .split(",")
    .map((value) => Number.parseInt(value.trim(), 10))
    .filter((value) => Number.isInteger(value) && value > 0);
  return parsed.length > 0 ? [...new Set(parsed)] : DEFAULT_TARGET_PORTS;
}

function getListeningPidsByPort(port) {
  try {
    const output = execFileSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (!output) return [];
    return [...new Set(output.split("\n").map((line) => line.trim()).filter(Boolean))];
  } catch {
    return [];
  }
}

function getProcessInfo(pid) {
  try {
    const output = execFileSync("ps", ["-p", pid, "-o", "user=,command="], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (!output) {
      return { user: "", command: "" };
    }
    const [user, ...parts] = output.split(/\s+/);
    return { user, command: parts.join(" ") };
  } catch {
    return { user: "", command: "" };
  }
}

function getLockPid() {
  try {
    const lockRaw = readFileSync(LOCK_FILE_PATH, "utf8");
    const lock = JSON.parse(lockRaw);
    return typeof lock.pid === "number" && Number.isInteger(lock.pid) ? String(lock.pid) : null;
  } catch {
    return null;
  }
}

function isTargetNextDevProcess(user, command) {
  if (CURRENT_USER && user && user !== CURRENT_USER) {
    return false;
  }
  const isNextDevLike =
    command.includes("next dev") ||
    command.includes("/next/dist/bin/next") ||
    command.includes("next-dev-server");
  return isNextDevLike;
}

function isAlive(pid) {
  const check = spawnSync("kill", ["-0", pid], { stdio: "ignore" });
  return check.status === 0;
}

function stopPid(pid) {
  spawnSync("kill", [pid], { stdio: "ignore" });
  for (let i = 0; i < 20; i += 1) {
    if (!isAlive(pid)) {
      return;
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
  }
  if (isAlive(pid)) {
    spawnSync("kill", ["-9", pid], { stdio: "ignore" });
  }
}

const targetPids = new Set();

const lockPid = getLockPid();
if (lockPid) {
  if (!isAlive(lockPid)) {
    console.log(`Skipping lock PID ${lockPid}: process is not alive`);
  } else {
    console.log(`Using lock PID ${lockPid} from .next/dev/lock`);
    targetPids.add(lockPid);
  }
}

for (const port of TARGET_PORTS) {
  for (const pid of getListeningPidsByPort(port)) {
    const { user, command } = getProcessInfo(pid);
    if (isTargetNextDevProcess(user, command)) {
      targetPids.add(pid);
    }
  }
}

if (targetPids.size > 0) {
  console.log(`Stopping stale next dev server(s): ${[...targetPids].join(", ")}`);
  for (const pid of targetPids) {
    stopPid(pid);
  }
} else {
  console.log("No stale next dev server found");
}
