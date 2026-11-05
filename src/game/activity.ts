import type { ActivityNotice } from "./types";

export function noticeRelatesToPlayer(notice: ActivityNotice, player: string) {
  return (
    (notice.kind !== "cycle" && notice.player === player) ||
    notice.changes.some(
      (change) =>
        change.player === player &&
        Object.entries(change.before).some(
          ([key, value]) =>
            value !== change.after[key as keyof typeof change.after],
        ),
    )
  );
}
