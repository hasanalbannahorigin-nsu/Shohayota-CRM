import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { Save } from "lucide-react";

interface TenantConfig {
  branding?: {
    logo?: string;
    primaryColor?: string;
    secondaryColor?: string;
  };
  features?: {
    voice?: boolean;
    whatsapp?: boolean;
    analytics?: boolean;
    ai?: boolean;
  };
  customFields?: Record<string, any>;
}

export function TenantConfiguration() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<TenantConfig>({
    branding: { primaryColor: "#22c55e", secondaryColor: "#3b82f6" },
    features: { voice: true, whatsapp: false, analytics: true, ai: false },
  });

  const { data: currentConfig } = useQuery<TenantConfig>({
    queryKey: ["/api/tenants/config"],
  });

  useEffect(() => {
    if (currentConfig) {
      setConfig(currentConfig);
    }
  }, [currentConfig]);

  const updateMutation = useMutation({
    mutationFn: (updates: TenantConfig) => api.patch("/tenants/config", updates),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Configuration updated",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/tenants/config"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update configuration",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    updateMutation.mutate(config);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <Label className="text-base font-semibold">Branding</Label>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="space-y-2">
              <Label>Primary Color</Label>
              <Input
                type="color"
                value={config.branding?.primaryColor || "#22c55e"}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    branding: { ...config.branding, primaryColor: e.target.value },
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Secondary Color</Label>
              <Input
                type="color"
                value={config.branding?.secondaryColor || "#3b82f6"}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    branding: { ...config.branding, secondaryColor: e.target.value },
                  })
                }
              />
            </div>
          </div>
        </div>

        <div>
          <Label className="text-base font-semibold">Features</Label>
          <div className="space-y-3 mt-2">
            <div className="flex items-center justify-between">
              <Label>Voice Calls</Label>
              <Switch
                checked={config.features?.voice || false}
                onCheckedChange={(checked) =>
                  setConfig({
                    ...config,
                    features: { ...config.features, voice: checked },
                  })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>WhatsApp Integration</Label>
              <Switch
                checked={config.features?.whatsapp || false}
                onCheckedChange={(checked) =>
                  setConfig({
                    ...config,
                    features: { ...config.features, whatsapp: checked },
                  })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Analytics</Label>
              <Switch
                checked={config.features?.analytics || false}
                onCheckedChange={(checked) =>
                  setConfig({
                    ...config,
                    features: { ...config.features, analytics: checked },
                  })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>AI Features</Label>
              <Switch
                checked={config.features?.ai || false}
                onCheckedChange={(checked) =>
                  setConfig({
                    ...config,
                    features: { ...config.features, ai: checked },
                  })
                }
              />
            </div>
          </div>
        </div>
      </div>

      <Button onClick={handleSave} disabled={updateMutation.isPending}>
        <Save className="h-4 w-4 mr-2" />
        {updateMutation.isPending ? "Saving..." : "Save Configuration"}
      </Button>
    </div>
  );
}

