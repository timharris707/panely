export interface EngineEventLike {
  speaker: string;
  type: string;
}

export function determineNextRoundtableAgent(agents: string[], events: EngineEventLike[]) {
  const agentEvents = events.filter(
    (event) =>
      event.speaker !== "the user" &&
      event.speaker !== "System" &&
      event.type !== "start" &&
      event.type !== "complete" &&
      event.type !== "human-directive"
  );

  const seenInCurrentRound = new Set<string>();
  for (const event of agentEvents) {
    if (seenInCurrentRound.has(event.speaker)) {
      seenInCurrentRound.clear();
    }
    seenInCurrentRound.add(event.speaker);
  }

  for (const agentId of agents) {
    if (!seenInCurrentRound.has(agentId)) {
      return { agentId, isNewRound: seenInCurrentRound.size === 0 };
    }
  }

  return { agentId: agents[0], isNewRound: true };
}

export function countCompletedRoundtableRounds(agents: string[], events: EngineEventLike[]) {
  const agentCount = agents.length;
  if (agentCount === 0) return 0;
  const workerEvents = events.filter(
    (event) => event.type === "worker" || event.type === "supervisor" || event.type === "moderator"
  );
  return Math.floor(workerEvents.length / agentCount);
}

export function isRoundLimitReached(rounds: number | "persistent" | undefined, completedRounds: number) {
  if (!rounds || rounds === "persistent") return false;
  return completedRounds >= rounds;
}
