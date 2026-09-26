"use client";

import { useAdmin } from "@/lib/admin-store";
import { Badge, EmptyRow, Panel, PanelHead, Table, formatDate, initial } from "@/components/ui";

export default function UsersPage() {
  const { data, busy, patch } = useAdmin();

  return (
    <Panel>
      <PanelHead
        title="Users"
        description="Review profiles and control account access."
        action={<span className="muted">{data.users.length} shown</span>}
      />
      <Table head={["User", "Role", "Status", "Joined", "Action"]}>
        {data.users.map((user) => (
          <tr key={user.id}>
            <td>
              <div className="cell-user">
                <span className="avatar" aria-hidden="true">
                  {initial(user.display_name || user.email)}
                </span>
                <span>
                  <span className="cell-title">{user.display_name || "Unnamed user"}</span>
                  <span className="cell-sub">{user.email || "No email"}</span>
                </span>
              </div>
            </td>
            <td style={{ textTransform: "capitalize" }}>{user.role}</td>
            <td>
              <Badge tone={user.is_banned ? "critical" : "positive"}>
                {user.is_banned ? "Banned" : "Active"}
              </Badge>
            </td>
            <td>{formatDate(user.created_at)}</td>
            <td>
              <button
                type="button"
                className={user.is_banned ? "btn btn--outline btn--sm" : "btn btn--danger btn--sm"}
                disabled={busy}
                onClick={() => void patch(`/api/admin/users/${user.id}`, { is_banned: !user.is_banned })}
              >
                {user.is_banned ? "Unban" : "Ban user"}
              </button>
            </td>
          </tr>
        ))}
        {!data.users.length && <EmptyRow colSpan={5} text="No users yet. New accounts will appear here." />}
      </Table>
    </Panel>
  );
}
