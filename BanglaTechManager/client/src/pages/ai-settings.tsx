import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { Settings, Brain, DollarSign, Shield, Database } from "lucide-react";

interface AISettings {
  transcriptionEnabled: boolean;
  nluEnabled: boolean;
  botEnabled: boolean;
  ragEnabled: boolean;
  nlqEnabled: boolean;
  assistEnabled: boolean;
  defaultModelProvider: string;
  defaultModelName: string;
  embeddingModel: string;
  dailyCostCap?: number;
  monthlyCostCap?: number;
  piiRedactionEnabled: boolean;
  consentRequired: boolean;
  allowExternalModels: boolean;
  dataRetentionDays: number;
  rateLimitPerMinute: number;
  rateLimitPerHour: number;
  currentDailyCost?: number;
  currentMonthlyCost?: number;
}

export default function AISettingsPage() {
  const [settings, setSettings] = useState<AISettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await api.get<AISettings>("/ai/settings");
      setSettings(data);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load AI settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!settings) return;

    setSaving(true);
    try {
      await api.put("/ai/settings", settings);
      toast({
        title: "Success",
        description: "AI settings updated successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key: keyof AISettings, value: any) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
  };

  if (loading) {
    return <div className="p-6">Loading AI settings...</div>;
  }

  if (!settings) {
    return <div className="p-6">Failed to load settings</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">AI Settings</h1>
          <p className="text-muted-foreground mt-1">
            Configure AI features, models, and privacy controls
          </p>
        </div>
        <Button onClick={saveSettings} disabled={saving}>
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      <Tabs defaultValue="features" className="space-y-4">
        <TabsList>
          <TabsTrigger value="features">
            <Settings className="h-4 w-4 mr-2" />
            Features
          </TabsTrigger>
          <TabsTrigger value="models">
            <Brain className="h-4 w-4 mr-2" />
            Models
          </TabsTrigger>
          <TabsTrigger value="costs">
            <DollarSign className="h-4 w-4 mr-2" />
            Cost Control
          </TabsTrigger>
          <TabsTrigger value="privacy">
            <Shield className="h-4 w-4 mr-2" />
            Privacy
          </TabsTrigger>
        </TabsList>

        <TabsContent value="features" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>AI Features</CardTitle>
              <CardDescription>Enable or disable AI capabilities</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Speech Transcription</Label>
                  <p className="text-sm text-muted-foreground">
                    Convert call recordings to text with diarization
                  </p>
                </div>
                <Switch
                  checked={settings.transcriptionEnabled}
                  onCheckedChange={(checked) => updateSetting("transcriptionEnabled", checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Natural Language Understanding</Label>
                  <p className="text-sm text-muted-foreground">
                    Intent classification and entity extraction
                  </p>
                </div>
                <Switch
                  checked={settings.nluEnabled}
                  onCheckedChange={(checked) => updateSetting("nluEnabled", checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Conversational Bot</Label>
                  <p className="text-sm text-muted-foreground">
                    Automated customer support bot
                  </p>
                </div>
                <Switch
                  checked={settings.botEnabled}
                  onCheckedChange={(checked) => updateSetting("botEnabled", checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>RAG (Knowledge Base)</Label>
                  <p className="text-sm text-muted-foreground">
                    Retrieval-augmented generation with KB
                  </p>
                </div>
                <Switch
                  checked={settings.ragEnabled}
                  onCheckedChange={(checked) => updateSetting("ragEnabled", checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Natural Language Queries</Label>
                  <p className="text-sm text-muted-foreground">
                    Query data using natural language
                  </p>
                </div>
                <Switch
                  checked={settings.nlqEnabled}
                  onCheckedChange={(checked) => updateSetting("nlqEnabled", checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Agent Assist</Label>
                  <p className="text-sm text-muted-foreground">
                    Real-time suggestions for agents
                  </p>
                </div>
                <Switch
                  checked={settings.assistEnabled}
                  onCheckedChange={(checked) => updateSetting("assistEnabled", checked)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="models" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Model Configuration</CardTitle>
              <CardDescription>Configure AI models and providers</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Default Model Provider</Label>
                <Select
                  value={settings.defaultModelProvider}
                  onValueChange={(value) => updateSetting("defaultModelProvider", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="anthropic">Anthropic</SelectItem>
                    <SelectItem value="azure">Azure OpenAI</SelectItem>
                    <SelectItem value="local">Local/On-premise</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Default Model</Label>
                <Input
                  value={settings.defaultModelName}
                  onChange={(e) => updateSetting("defaultModelName", e.target.value)}
                  placeholder="gpt-4"
                />
              </div>

              <div className="space-y-2">
                <Label>Embedding Model</Label>
                <Input
                  value={settings.embeddingModel}
                  onChange={(e) => updateSetting("embeddingModel", e.target.value)}
                  placeholder="text-embedding-ada-002"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Allow External Models</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow calls to third-party AI providers
                  </p>
                </div>
                <Switch
                  checked={settings.allowExternalModels}
                  onCheckedChange={(checked) => updateSetting("allowExternalModels", checked)}
                />
              </div>

              <div className="space-y-2">
                <Label>Rate Limit (per minute)</Label>
                <Input
                  type="number"
                  value={settings.rateLimitPerMinute}
                  onChange={(e) => updateSetting("rateLimitPerMinute", parseInt(e.target.value))}
                />
              </div>

              <div className="space-y-2">
                <Label>Rate Limit (per hour)</Label>
                <Input
                  type="number"
                  value={settings.rateLimitPerHour}
                  onChange={(e) => updateSetting("rateLimitPerHour", parseInt(e.target.value))}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="costs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Cost Control</CardTitle>
              <CardDescription>Set spending limits and monitor usage</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Daily Cost Cap (cents)</Label>
                  <Input
                    type="number"
                    value={settings.dailyCostCap || ""}
                    onChange={(e) => updateSetting("dailyCostCap", e.target.value ? parseInt(e.target.value) : undefined)}
                    placeholder="No limit"
                  />
                  {settings.currentDailyCost !== undefined && (
                    <p className="text-sm text-muted-foreground">
                      Current: ${(settings.currentDailyCost / 100).toFixed(2)}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Monthly Cost Cap (cents)</Label>
                  <Input
                    type="number"
                    value={settings.monthlyCostCap || ""}
                    onChange={(e) => updateSetting("monthlyCostCap", e.target.value ? parseInt(e.target.value) : undefined)}
                    placeholder="No limit"
                  />
                  {settings.currentMonthlyCost !== undefined && (
                    <p className="text-sm text-muted-foreground">
                      Current: ${(settings.currentMonthlyCost / 100).toFixed(2)}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="privacy" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Privacy & Compliance</CardTitle>
              <CardDescription>Configure data protection and retention</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>PII Redaction</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically redact sensitive information
                  </p>
                </div>
                <Switch
                  checked={settings.piiRedactionEnabled}
                  onCheckedChange={(checked) => updateSetting("piiRedactionEnabled", checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Require Consent</Label>
                  <p className="text-sm text-muted-foreground">
                    Require user consent before processing
                  </p>
                </div>
                <Switch
                  checked={settings.consentRequired}
                  onCheckedChange={(checked) => updateSetting("consentRequired", checked)}
                />
              </div>

              <div className="space-y-2">
                <Label>Data Retention (days)</Label>
                <Input
                  type="number"
                  value={settings.dataRetentionDays}
                  onChange={(e) => updateSetting("dataRetentionDays", parseInt(e.target.value))}
                />
                <p className="text-sm text-muted-foreground">
                  AI artifacts will be deleted after this period
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

