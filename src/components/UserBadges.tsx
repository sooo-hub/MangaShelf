import type { UserName } from "../types/manga";

const USER_COLORS: Record<UserName, { bg: string; color: string }> = {
  爽: { bg: "#dbeafe", color: "#1d4ed8" },
  杏: { bg: "#fce7f3", color: "#be185d" },
};

interface Props {
  users: UserName[];
}

export function UserBadges({ users }: Props) {
  if (!users || users.length === 0) return null;
  return (
    <div className="flex gap-1">
      {users.map((u) => (
        <span
          key={u}
          style={{ background: USER_COLORS[u]?.bg ?? "#f1f5f9", color: USER_COLORS[u]?.color ?? "#64748b" }}
          className="text-[10px] px-2 py-px rounded-full font-bold"
        >
          {u}
        </span>
      ))}
    </div>
  );
}
