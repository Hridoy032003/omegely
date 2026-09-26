"use client";

import { useAdmin } from "@/lib/admin-store";
import { Badge, EmptyRow, Panel, PanelHead, Table, formatDate, statusTone } from "@/components/ui";

const STATUSES = ["open", "reviewing", "resolved", "dismissed"] as const;

export default function ReportsPage() {
  const { data, busy, patch } = useAdmin();

  return (
    <Panel>
      <PanelHead
        title="Safety reports"
        description="Review reports and record the decision."
        action={<span className="muted">{data.reports.length} total</span>}
      />
      <Table head={["Reason", "Target", "Status", "Created", "Set status"]}>
        {data.reports.map((report) => (
          <tr key={report.id}>
            <td>
              <span className="cell-title">{report.reason}</span>
              <span className="cell-sub">{report.details || "No additional details"}</span>
            </td>
            <td className="mono">
              {report.target_user_id ? report.target_user_id.slice(0, 8) : "Guest session"}
            </td>
            <td>
              <Badge tone={statusTone(report.status)}>{report.status}</Badge>
            </td>
            <td>{formatDate(report.created_at)}</td>
            <td>
              <select
                className="select"
                aria-label={`Status for report ${report.reason}`}
                value={report.status}
                disabled={busy}
                onChange={(event) =>
                  void patch(`/api/admin/reports/${report.id}`, { status: event.target.value })
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
        {!data.reports.length && <EmptyRow colSpan={5} text="No safety reports yet." />}
      </Table>
    </Panel>
  );
}
