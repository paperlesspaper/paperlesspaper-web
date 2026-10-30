import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

// Only inspect this container. Never print environment variables, service data,
// credentials, or attempt to change host policy as part of diagnosis.
export async function diagnoseSandbox() {
  const read = (path: string) =>
    readFile(path, "utf8")
      .then((value) => value.trim())
      .catch(() => "unavailable");
  const status = await read("/proc/self/status");
  const probes = [
    ["--user", "--map-root-user", "true"],
    ["--user", "--map-root-user", "--net", "true"],
    ["--user", "--map-root-user", "--pid", "--fork", "true"],
  ].map((args) => {
    const result = spawnSync("unshare", args, {
      timeout: 2_000,
      maxBuffer: 4096,
      encoding: "utf8",
    });
    return {
      args,
      status: result.status,
      error: result.error?.message || result.stderr.trim(),
    };
  });
  return {
    uid: process.getuid?.(),
    appArmor: await read("/proc/self/attr/current"),
    security: status
      .split("\n")
      .filter((line) => /^(Cap(Eff|Bnd)|NoNewPrivs|Seccomp)/.test(line)),
    unprivilegedUserNamespaces: await read(
      "/proc/sys/kernel/unprivileged_userns_clone"
    ),
    appArmorUserNamespaceRestriction: await read(
      "/proc/sys/kernel/apparmor_restrict_unprivileged_userns"
    ),
    probes,
  };
}
