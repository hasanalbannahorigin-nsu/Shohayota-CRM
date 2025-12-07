import { TicketCard } from "../ticket-card";

export default function TicketCardExample() {
  return (
    <div className="w-96">
      <TicketCard
        id="TKT-1234"
        title="Email notification not working"
        description="Customer reports that they are not receiving email notifications for new tickets. This has been happening since yesterday."
        status="open"
        priority="high"
        category="bug"
        assignee="Rahim Ahmed"
        createdAt="2 hours ago"
      />
    </div>
  );
}
