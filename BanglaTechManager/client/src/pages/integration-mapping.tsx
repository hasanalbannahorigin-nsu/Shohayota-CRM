import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { useLocation } from "wouter";

interface Mapping {
  id?: string;
  sourceType: "provider_field" | "static" | "transform";
  sourceField?: string;
  targetType: "ticket" | "customer" | "message" | "custom_field";
  targetField: string;
  transform?: {
    type?: "regex" | "static" | "expression";
    pattern?: string;
    replacement?: string;
    defaultValue?: any;
  };
}

export default function IntegrationMappingPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const integrationId = new URLSearchParams(window.location.search).get("id") || "";

  const { data: integration } = useQuery({
    queryKey: ["/api/integrations", integrationId],
    enabled: !!integrationId,
  });

  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [newMapping, setNewMapping] = useState<Mapping>({
    sourceType: "provider_field",
    targetType: "ticket",
    targetField: "",
  });

  const saveMutation = useMutation({
    mutationFn: async (mappings: Mapping[]) => {
      const res = await api.post(`/api/integrations/${integrationId}/mapping`, { mappings });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations", integrationId] });
      toast({
        title: "Success",
        description: "Mappings saved successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save mappings",
        variant: "destructive",
      });
    },
  });

  const addMapping = () => {
    if (!newMapping.targetField) {
      toast({
        title: "Error",
        description: "Target field is required",
        variant: "destructive",
      });
      return;
    }

    setMappings([...mappings, { ...newMapping, id: Date.now().toString() }]);
    setNewMapping({
      sourceType: "provider_field",
      targetType: "ticket",
      targetField: "",
    });
  };

  const removeMapping = (id: string) => {
    setMappings(mappings.filter((m) => m.id !== id));
  };

  const saveMappings = () => {
    saveMutation.mutate(mappings);
  };

  if (!integration) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate("/integrations")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Integrations
        </Button>
        <div className="text-center py-8">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate("/integrations")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-semibold">Field Mapping</h1>
          <p className="text-muted-foreground mt-1">
            Configure how {integration.connector?.displayName} fields map to CRM fields
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add New Mapping</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <Label>Source Type</Label>
              <Select
                value={newMapping.sourceType}
                onValueChange={(value: any) =>
                  setNewMapping({ ...newMapping, sourceType: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="provider_field">Provider Field</SelectItem>
                  <SelectItem value="static">Static Value</SelectItem>
                  <SelectItem value="transform">Transform</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {newMapping.sourceType === "provider_field" && (
              <div>
                <Label>Source Field</Label>
                <Input
                  placeholder="e.g., subject, body, from"
                  value={newMapping.sourceField || ""}
                  onChange={(e) =>
                    setNewMapping({ ...newMapping, sourceField: e.target.value })
                  }
                />
              </div>
            )}

            <div>
              <Label>Target Type</Label>
              <Select
                value={newMapping.targetType}
                onValueChange={(value: any) =>
                  setNewMapping({ ...newMapping, targetType: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ticket">Ticket</SelectItem>
                  <SelectItem value="customer">Customer</SelectItem>
                  <SelectItem value="message">Message</SelectItem>
                  <SelectItem value="custom_field">Custom Field</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Target Field</Label>
              <Input
                placeholder="e.g., title, description"
                value={newMapping.targetField}
                onChange={(e) =>
                  setNewMapping({ ...newMapping, targetField: e.target.value })
                }
              />
            </div>
          </div>

          <Button onClick={addMapping} className="mt-4">
            <Plus className="h-4 w-4 mr-2" />
            Add Mapping
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current Mappings</CardTitle>
        </CardHeader>
        <CardContent>
          {mappings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No mappings configured. Add mappings above.
            </div>
          ) : (
            <div className="space-y-4">
              {mappings.map((mapping) => (
                <div
                  key={mapping.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1 grid grid-cols-4 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground">Source</div>
                      <div className="font-medium">
                        {mapping.sourceType === "provider_field"
                          ? mapping.sourceField || "N/A"
                          : mapping.sourceType}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">→</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Target</div>
                      <div className="font-medium">
                        {mapping.targetType}.{mapping.targetField}
                      </div>
                    </div>
                    <div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeMapping(mapping.id!)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {mappings.length > 0 && (
            <Button onClick={saveMappings} className="mt-4 w-full" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving..." : "Save Mappings"}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

