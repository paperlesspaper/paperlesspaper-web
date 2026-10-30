import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import os from "node:os";

async function identity(pid) {
  try {
    // Linux starttime distinguishes a restarted container's new PID 1 from its predecessor.
    const stat = await readFile(`/proc/${pid}/stat`, "utf8");
    return stat.slice(stat.lastIndexOf(")") + 2).split(" ")[19];
  } catch {
    return null;
  }
}

export async function acquireLock(file) {
  const lock = `${file}.lock`;
  const owner = {
    pid: process.pid,
    hostname: os.hostname(),
    start: await identity(process.pid),
  };
  try {
    await mkdir(lock);
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    const old = JSON.parse(await readFile(`${lock}/owner.json`, "utf8"));
    if (old.hostname !== owner.hostname)
      throw new Error("State volume belongs to another monitor instance");
    let active = true;
    try {
      process.kill(old.pid, 0);
    } catch (error) {
      if (error.code === "ESRCH") active = false;
      else throw error;
    }
    if (active && old.start && (await identity(old.pid)) !== old.start)
      active = false;
    if (active) throw new Error("Monitor is already running");
    await rm(lock, { recursive: true });
    await mkdir(lock);
  }
  await writeFile(`${lock}/owner.json`, JSON.stringify(owner), { mode: 0o600 });
  return () => rm(lock, { recursive: true });
}
