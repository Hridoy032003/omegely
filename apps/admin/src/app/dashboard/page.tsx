"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useAdmin } from "@/lib/admin-store";
import ActivityChart from "@/components/ActivityChart";
import { Ban, Chat, Chevron, Inbox, Shield, Users } from "@/components/icons";
import { Badge, Empty, Kpi, Panel, PanelHead, formatDate, statusTone } from "@/components/ui";

export default function DashboardPage() {
  const { data } = useAdmin();

  const activity = useMemo(
    () =>
      [
        ...data.reports.map((report) => ({
          id: report.id,
          kind: "Safety report",
          title: report.reason,
          status: report.status,
          created_at: report.created_at,
          critical: true,
        })),
        ...data.feedback.map((item) => ({
          id: item.id,
          kind: "User feedback",
          title: item.message.replace(/^\[[^\]]+\]\s*/, ""),
          status: item.status,
          created_at: item.created_at,
          critical: false,
        })),
      ]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 6),
    [data.feedback, data.reports],
  );

  const series = useMemo(
    () => [
      { label: "Reports", colour: "#a5b4fc", dates: data.reports.map((report) => report.created_at) },
      { label: "Feedback", colour: "#7dd3fc", dates: data.feedback.map((item) => item.created_at) },
    ],
    [data.feedback, data.reports],
  );

  return (
    <>
      <div className="grid grid--kpi">
        <Kpi label="Total users" value={data.counts.users} hint="Registered accounts" icon={<Users />} />
        <Kpi
          label="Open reports"
          value={data.counts.openReports}
          hint="Waiting for a safety review"
          icon={<Shield />}
          alert={data.counts.openReports > 0}
        />
        <Kpi
          label="Open feedback"
          value={data.counts.openFeedback}
          hint="Waiting for a response"
          icon={<Inbox />}
          alert={data.counts.openFeedback > 0}
        />
        <Kpi label="Banned users" value={data.counts.banned} hint="Restricted accounts" icon={<Ban />} />
      </div>

      <Panel>
        <ActivityChart series={series} />
      </Panel>

      <div className="grid grid--split">
        <Panel>
          <PanelHead
            title="Recent activity"
            description="The latest reports and messages from your community."
            action={
              <Link href="/feedback" className="btn btn--ghost btn--sm">
                View feedback
              </Link>
            }
          />
          {activity.length ? (
            <div className="list">
              {activity.map((item) => (
                <div className="list-row" key={`${item.kind}-${item.id}`}>
                  <span className={item.critical ? "list-icon list-icon--critical" : "list-icon"}>
                    {item.critical ? <Shield /> : <Chat />}
                  </span>
                  <span className="list-copy">
                    <strong>{item.title}</strong>
                    <small>
                      {item.kind} · {formatDate(item.created_at)}
                    </small>
                  </span>
                  <Badge tone={statusTone(item.status)}>{item.status}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <Empty title="No activity yet" text="New reports and feedback will appear here." />
          )}
        </Panel>

        <Panel>
          <PanelHead title="Needs attention" description="Keep the community healthy." />
          <div className="jump-list">
            <Jump
              href="/reports"
              icon={<Shield />}
              title={`${data.counts.openReports} open reports`}
              text="Review safety concerns"
            />
            <Jump
              href="/feedback"
              icon={<Inbox />}
              title={`${data.counts.openFeedback} open feedback`}
              text="Understand user needs"
            />
            <Jump
              href="/users"
              icon={<Users />}
              title={`${data.counts.users} total users`}
              text="Review account activity"
            />
          </div>
        </Panel>
      </div>
    </>
  );
}

function Jump({
  href,
  icon,
  title,
  text,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <Link href={href} className="jump">
      <span className="list-icon">{icon}</span>
      <span className="jump-copy">
        <strong>{title}</strong>
        <small>{text}</small>
      </span>
      <Chevron className="chevron" width={16} height={16} />
    </Link>
  );
}
