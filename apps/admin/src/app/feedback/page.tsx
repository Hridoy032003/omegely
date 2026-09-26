"use client";

import { useAdmin } from "@/lib/admin-store";
import { Badge, EmptyRow, Panel, PanelHead, Table, formatDate, statusTone } from "@/components/ui";

const STATUSES = ["open", "reviewing", "resolved", "dismissed"] as const;

export default function FeedbackPage() {
  const { data, busy, patch } = useAdmin();

  return (
    <Panel>
      <PanelHead
        title="Feedback & support"
        description="Read what users need and track follow-up."
        action={<span className="muted">{data.feedback.length} total</span>}
      />
      <Table head={["Type", "Message", "Contact", "Created", "Set status"]}>
        {data.feedback.map((item) => (
          <tr key={item.id}>
            <td>
              <Badge tone={item.kind === "safety" ? "critical" : item.kind === "bug" ? "caution" : "brand"}>
                {item.kind}
              </Badge>
            </td>
            <td>
              <span className="cell-title">{item.message}</span>
              {item.page_url && <span className="cell-sub">{item.page_url}</span>}
            </td>
            <td>{item.email || "Anonymous"}</td>
            <td>{formatDate(item.created_at)}</td>
            <td>
              <select
                className="select"
                aria-label="Feedback status"
                value={item.status}
                disabled={busy}
                onChange={(event) =>
                  void patch(`/api/admin/feedback/${item.id}`, { status: event.target.value })
                }
              >
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status[0].toUpperCase() + status.slice(1)}
                  </option>
                ))}
              </select>
            </td>
          </tr>
        ))}
        {!data.feedback.length && <EmptyRow colSpan={5} text="No feedback yet." />}
      </Table>
    </Panel>
  );
}
