"use client";

import { getAgentByAnyId } from "@/config/agents";

interface AgentAvatarProps {
  /** Agent ID — any variant: "henry", "Henry", "t1", "backend-eng", etc. */
  agentId: string;
  /** Diameter in px (default 40) */
  size?: number;
  /** Optional border color override. Defaults to agent's division color. */
  borderColor?: string;
  /** Border width in px (default 2) */
  borderWidth?: number;
  /** Additional className */
  className?: string;
  /** Show letter fallback circle if no avatar found (default: true) */
  showFallback?: boolean;
  /** Title tooltip */
  title?: string;
}

export function getAgentInitial(agentIdOrName: string) {
  const agent = getAgentByAnyId(agentIdOrName);
  const label = agent?.name ?? agentIdOrName;
  const match = label.match(/[A-Za-z0-9]/);
  return (match?.[0] ?? "?").toUpperCase();
}

/**
 * AgentAvatar — renders a round initial badge with division-color border.
 */
export function AgentAvatar({
  agentId,
  size = 40,
  borderColor,
  borderWidth = 2,
  className = "",
  showFallback = true,
  title,
}: AgentAvatarProps) {
  const agent = getAgentByAnyId(agentId);
  const border = borderColor ?? agent?.divisionColor ?? "#6b7280";
  const label = title ?? (agent?.name ?? agentId);
  const initial = getAgentInitial(agentId);

  if (!showFallback) return null;

  return (
    <div
      title={label}
      className={`rounded-full flex items-center justify-center flex-shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        minWidth: size,
        border: `${borderWidth}px solid ${border}`,
        backgroundColor: `${border}20`,
        color: "var(--text-primary)",
        fontFamily: "var(--font-heading)",
        fontSize: Math.max(size * 0.42, 11),
        fontWeight: 800,
        lineHeight: 1,
        boxShadow: `0 0 0 1px ${border}30`,
      }}
    >
      {initial}
    </div>
  );
}

/**
 * AgentAvatarWithFallback — compatibility wrapper for older call sites.
 */
export function AgentAvatarWithFallback(props: AgentAvatarProps) {
  return <AgentAvatar {...props} />;
}

/**
 * AvatarStack — shows a row of overlapping agent avatars (max 4 + overflow badge).
 */
export function AvatarStack({
  agentIds,
  size = 28,
  max = 4,
}: {
  agentIds: string[];
  size?: number;
  max?: number;
}) {
  const visible = agentIds.slice(0, max);
  const overflow = agentIds.length - max;

  return (
    <div className="flex items-center" style={{ gap: `-${size * 0.3}px` }}>
      {visible.map((id, i) => (
        <div
          key={id}
          style={{
            marginLeft: i === 0 ? 0 : -(size * 0.3),
            zIndex: visible.length - i,
            position: "relative",
          }}
        >
          <AgentAvatar agentId={id} size={size} borderWidth={2} />
        </div>
      ))}
      {overflow > 0 && (
        <div
          className="rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
          style={{
            width: size,
            height: size,
            minWidth: size,
            marginLeft: -(size * 0.3),
            backgroundColor: "var(--surface-elevated)",
            border: "2px solid var(--border)",
            color: "var(--text-muted)",
            fontSize: Math.max(size * 0.3, 9),
            zIndex: 0,
            position: "relative",
          }}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}
