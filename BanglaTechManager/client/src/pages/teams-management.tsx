import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { Plus, Users, Trash2, UserPlus, UserMinus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Team {
  id: string;
  name: string;
  description?: string;
  memberCount?: number;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role?: string;
}

interface TenantUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export default function TeamsManagementPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });

  const { data: teams = [], isLoading } = useQuery<Team[]>({
    queryKey: ["/api/teams"],
  });

  const { data: users = [] } = useQuery<TenantUser[]>({
    queryKey: ["/api/tenants/users"],
  });

  const { data: members = [], isLoading: membersLoading } = useQuery<TeamMember[]>({
    queryKey: ["/api/teams", selectedTeamId, "members"],
    enabled: !!selectedTeamId,
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => api.post("/teams", data),
    onSuccess: () => {
      toast({ title: "Success", description: "Team created successfully" });
      setDialogOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      // Select the newest team on refresh
      setSelectedTeamId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create team",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/teams/${id}`),
    onSuccess: () => {
      toast({ title: "Success", description: "Team deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      if (selectedTeamId === id) {
        setSelectedTeamId(null);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete team",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this team?")) {
      deleteMutation.mutate(id);
    }
  };

  const resetForm = () => {
    setFormData({ name: "", description: "" });
    setEditingTeam(null);
  };

  const addMemberMutation = useMutation({
    mutationFn: (userId: string) => {
      if (!selectedTeamId) throw new Error("Select a team first");
      return api.post(`/teams/${selectedTeamId}/members`, { userId });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Member added" });
      setSelectedUserId(undefined);
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      queryClient.invalidateQueries({ queryKey: ["/api/teams", selectedTeamId, "members"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add member",
        variant: "destructive",
      });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) => {
      if (!selectedTeamId) throw new Error("Select a team first");
      return api.delete(`/teams/${selectedTeamId}/members/${userId}`);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Member removed" });
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      queryClient.invalidateQueries({ queryKey: ["/api/teams", selectedTeamId, "members"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove member",
        variant: "destructive",
      });
    },
  });

  const availableUsers = useMemo(() => {
    const memberIds = new Set((members || []).map((m) => m.id));
    return users.filter((u) => !memberIds.has(u.id));
  }, [users, members]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Teams</h1>
          <p className="text-muted-foreground mt-1">
            Organize users into teams for better collaboration
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Team
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Team</DialogTitle>
              <DialogDescription>
                Create a new team to group users together
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Team Name</Label>
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
            <div className="text-center py-8">Loading teams...</div>
          ) : teams.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No teams yet. Create your first team!
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Team Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teams.map((team) => (
                  <TableRow
                    key={team.id}
                    className={selectedTeamId === team.id ? "bg-muted/50" : ""}
                    onClick={() => setSelectedTeamId(team.id)}
                    data-testid={`team-row-${team.id}`}
                    style={{ cursor: "pointer" }}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        {team.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {team.description || "-"}
                    </TableCell>
                    <TableCell>{team.memberCount ?? 0}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(team.id)}
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Members
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!selectedTeamId ? (
            <div className="text-muted-foreground text-sm">
              Select a team to view and manage members.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-3 items-end">
                <div className="min-w-[240px] space-y-2">
                  <Label>Add member</Label>
                  <Select
                    value={selectedUserId}
                    onValueChange={(val) => setSelectedUserId(val)}
                  >
                    <SelectTrigger data-testid="select-user">
                      <SelectValue placeholder="Choose a user" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableUsers.length === 0 ? (
                        <SelectItem value="none" disabled>
                          All users are already in this team
                        </SelectItem>
                      ) : (
                        availableUsers.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name} ({u.email})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  disabled={!selectedUserId || availableUsers.length === 0 || addMemberMutation.isPending}
                  onClick={() => selectedUserId && addMemberMutation.mutate(selectedUserId)}
                  className="gap-2"
                  data-testid="button-add-member"
                >
                  <UserPlus className="h-4 w-4" />
                  Add to team
                </Button>
              </div>

              <div className="border rounded-lg">
                {membersLoading ? (
                  <div className="p-4 text-sm text-muted-foreground">Loading members...</div>
                ) : (members?.length || 0) === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground">No members yet.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {members!.map((member) => (
                        <TableRow key={member.id}>
                          <TableCell>{member.name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{member.email}</TableCell>
                          <TableCell className="capitalize">{member.role || "—"}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeMemberMutation.mutate(member.id)}
                              data-testid={`remove-${member.id}`}
                            >
                              <UserMinus className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

