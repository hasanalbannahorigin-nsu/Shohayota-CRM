import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Phone, Mail } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useLocation } from "wouter";
import type { Customer } from "@shared/schema";

interface CustomerTableProps {
  customers?: Customer[];
  isLoading?: boolean;
}

export function CustomerTable({ customers = [], isLoading }: CustomerTableProps) {
  const [, navigate] = useLocation();

  if (isLoading) {
    return (
      <div className="rounded-md border p-8 text-center">
        <p className="text-muted-foreground">Loading customers...</p>
      </div>
    );
  }

  if (customers.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center">
        <p className="text-muted-foreground">No customers found</p>
      </div>
    );
  }

  const handleEdit = (id: string) => {
    navigate(`/customers/detail?id=${id}`);
  };

  const handleDelete = (id: string) => {
    console.log("Delete customer:", id);
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12"></TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {customers.map((customer) => (
            <TableRow key={customer.id} data-testid={`customer-row-${customer.id}`}>
              <TableCell>
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs">
                    {getInitials(customer.name)}
                  </AvatarFallback>
                </Avatar>
              </TableCell>
              <TableCell>
                <button
                  onClick={() => navigate(`/customers/detail?id=${customer.id}`)}
                  className="font-medium hover:underline text-left"
                >
                  {customer.name}
                </button>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Mail className="h-3 w-3 text-muted-foreground" />
                  <span className="text-sm font-mono">{customer.email}</span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Phone className="h-3 w-3 text-muted-foreground" />
                  <span className="text-sm font-mono">{customer.phone}</span>
                </div>
              </TableCell>
              <TableCell>{(customer as any).companyName || "—"}</TableCell>
              <TableCell>
                <Badge
                  variant={customer.status === "active" ? "default" : "secondary"}
                  data-testid={`status-${customer.id}`}
                >
                  {customer.status}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleEdit(customer.id)}
                    data-testid={`button-edit-${customer.id}`}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDelete(customer.id)}
                    data-testid={`button-delete-${customer.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
