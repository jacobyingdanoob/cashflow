import type { GameState, Player, SpaceKind, TutorialTopic } from "./types";

export const tutorialTopics: TutorialTopic[] = [
  "intro",
  "portfolio",
  "debt",
  "space",
  "event",
  "space-opportunity",
  "space-market",
  "space-life",
  "space-payday",
  "space-special",
  "asset-1",
  "asset-2",
  "asset-3",
];
export function queueTutorial(s: GameState, topic: TutorialTopic) {
  s.tutorialQueue ??= [];
  if (
    s.config.tutorials &&
    !s.tutorialSeen.includes(topic) &&
    !s.tutorialQueue.includes(topic)
  )
    s.tutorialQueue.push(topic);
}

/** Fired by actual rule effects, never inferred from an overwritten UI log. */
export function introduceSpace(s: GameState, player: Player, kind: SpaceKind) {
  if (!player.human || !s.config.tutorials) return;
  const topic: Partial<Record<SpaceKind, TutorialTopic>> = {
    opportunity: "space-opportunity",
    business: "space-opportunity",
    market: "space-market",
    expense: "space-life",
    baby: "event",
    audit: "event",
    lawsuit: "event",
    payday: "space-payday",
    charity: "space-special",
    downsized: "space-special",
    divorce: "space-special",
  };
  const spaceTopic = topic[kind];
  if (spaceTopic) queueTutorial(s, spaceTopic);
  if (kind === "opportunity" || kind === "business") {
    // One new asset concept per visit, over the first three opportunity visits.
    const lesson = (["asset-1", "asset-2", "asset-3"] as const).find(
      (key) => !s.tutorialSeen.includes(key) && !s.tutorialQueue.includes(key),
    );
    if (lesson) queueTutorial(s, lesson);
  }
}
