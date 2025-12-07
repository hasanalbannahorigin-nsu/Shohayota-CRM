import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { Plus, Clock, Edit, Trash2, AlertTriangle } from "lucide-react";

interface SLAPolicy {
  id: string;
  name: string;
  description?: string;
  targetResolutionMinutes: number;
  isActive: boolean;
}

export default function SLAManagementPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<SLAPolicy | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    targetResolutionMinutes: 60,
    isActive: true,
  });

  const { data: policies = [], isLoading } = useQuery<SLAPolicy[]>({
    queryKey: ["/api/sla/policies"],
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => api.post("/sla/policies", data),
    onSuccess: () => {
      toast({ title: "Success", description: "SLA policy created successfully" });
      setDialogOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["/api/sla/policies"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create SLA policy",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/sla/policies/${id}`),
    onSuccess: () => {
      toast({ title: "Success", description: "SLA policy deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/sla/policies"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete SLA policy",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this SLA policy?")) {
      deleteMutation.mutate(id);
    }
  };

  const resetForm = () => {
    setFormData({ name: "", description: "", targetResolutionMinutes: 60, isActive: true });
    setEditingPolicy(null);
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} minutes`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours} hours`;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">SLA Policies</h1>
          <p className="text-muted-foreground mt-1">
            Define service level agreements for ticket resolution
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create SLA Policy
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create SLA Policy</DialogTitle>
              <DialogDescription>
                Define target resolution times and escalation rules
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Policy Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Target Resolution Time (minutes)</Label>
                <Input
                  type="number"
                  value={formData.targetResolutionMinutes}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      targetResolutionMinutes: parseInt(e.target.value) || 60,
                    })
                  }
                  min={1}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  {formatDuration(formData.targetResolutionMinutes)}
                </p>
              </div>
              <div className="flex items-center justify-between">
                <Label>Active</Label>
                <Switch
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="text-center py-8">Loading SLA policies...</div>
          ) : policies.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No SLA policies yet. Create your first policy!
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Policy Name</TableHead>
                  <TableHead>Target Resolution</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {policies.map((policy) => (
                  <TableRow key={policy.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        {policy.name}
                      </div>
                      {policy.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {policy.description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      {formatDuration(policy.targetResolutionMinutes)}
                    </TableCell>
                    <TableCell>
                      {policy.isActive ? (
                        <Badge className="bg-green-500">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(policy.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

