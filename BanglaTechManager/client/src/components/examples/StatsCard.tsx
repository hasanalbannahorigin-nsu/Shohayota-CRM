import { StatsCard } from "../stats-card";
import { Users } from "lucide-react";

export default function StatsCardExample() {
  return (
    <div className="w-80">
      <StatsCard
        title="Total Customers"
        value="1,234"
        icon={Users}
        trend="+12% from last month"
      />
    </div>
  );
}
