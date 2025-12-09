import { CustomerTable } from "@/components/customer-table";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Customer } from "@shared/schema";
import { AddCustomerDialog } from "./customers-form";

export default function CustomersPage() {
  const { data: customers, isLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const handleExport = () => {
    if (!customers) return;
    const csv = [
      ["Name", "Email", "Phone", "Company", "Status"],
      ...customers.map((c) => [
        c.name,
        c.email,
        c.phone || "",
        (c as any).companyName || "",
        c.status,
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "customers.csv";
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Customers</h1>
          <p className="text-muted-foreground mt-1">
            Manage your customer database and interactions
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={!customers || customers.length === 0}
            data-testid="button-export-customers"
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <AddCustomerDialog />
        </div>
      </div>

      <CustomerTable customers={customers} isLoading={isLoading} />

      {customers && customers.length > 0 && (
        <div className="text-sm text-muted-foreground">
          Showing {customers.length} customers
        </div>
      )}
    </div>
  );
}
