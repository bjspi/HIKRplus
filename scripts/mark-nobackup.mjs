import { mkdir, writeFile } from "node:fs/promises";

const directories = ["dist", "node_modules"];

await Promise.all(
  directories.map(async (directory) => {
    await mkdir(directory, { recursive: true });
    await writeFile(
      `${directory}/.nobackup`,
      "This directory contains generated build output and should be skipped by local backup/sync tools.\n",
      "utf8"
    );
  })
);
