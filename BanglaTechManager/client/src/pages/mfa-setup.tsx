import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { Shield, QrCode, Key } from "lucide-react";

export default function MFASetupPage() {
  const { toast } = useToast();
  const [verificationCode, setVerificationCode] = useState("");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  const { data: mfaStatus } = useQuery<{ enabled: boolean }>({
    queryKey: ["/api/auth/mfa/status"],
  });

  const setupMutation = useMutation({
    mutationFn: () => api.post("/auth/mfa/setup"),
    onSuccess: (data: any) => {
      setQrCode(data.qrCode);
      setBackupCodes(data.backupCodes || []);
      toast({
        title: "MFA Setup Started",
        description: "Scan the QR code with your authenticator app",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to setup MFA",
        variant: "destructive",
      });
    },
  });

  const verifyMutation = useMutation({
    mutationFn: (code: string) => api.post("/auth/mfa/verify", { code }),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "MFA enabled successfully",
      });
      setVerificationCode("");
      setQrCode(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Invalid verification code",
        variant: "destructive",
      });
    },
  });

  const disableMutation = useMutation({
    mutationFn: () => api.post("/auth/mfa/disable"),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "MFA disabled",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to disable MFA",
        variant: "destructive",
      });
    },
  });

  const handleVerify = () => {
    if (verificationCode.length !== 6) {
      toast({
        title: "Invalid Code",
        description: "Please enter a 6-digit code",
        variant: "destructive",
      });
      return;
    }
    verifyMutation.mutate(verificationCode);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Multi-Factor Authentication</h1>
        <p className="text-muted-foreground mt-1">
          Add an extra layer of security to your account
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                MFA Status
              </CardTitle>
              <CardDescription>
                Two-factor authentication status
              </CardDescription>
            </div>
            <Switch
              checked={mfaStatus?.enabled || false}
              disabled
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {!mfaStatus?.enabled ? (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Setup MFA</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Use an authenticator app (Google Authenticator, Authy, etc.) to generate verification codes.
                </p>
                <Button onClick={() => setupMutation.mutate()}>
                  <QrCode className="h-4 w-4 mr-2" />
                  Start Setup
                </Button>
              </div>

              {qrCode && (
                <div className="space-y-4 p-4 border rounded-lg">
                  <div>
                    <Label className="text-sm font-semibold">Scan QR Code</Label>
                    <p className="text-xs text-muted-foreground mb-2">
                      Scan this QR code with your authenticator app
                    </p>
                    <div className="flex justify-center p-4 bg-white rounded border">
                      <img src={qrCode} alt="QR Code" className="w-48 h-48" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Enter Verification Code</Label>
                    <Input
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="000000"
                      maxLength={6}
                    />
                    <Button onClick={handleVerify} disabled={verificationCode.length !== 6}>
                      Verify & Enable
                    </Button>
                  </div>

                  {backupCodes.length > 0 && (
                    <div className="space-y-2 p-4 bg-muted rounded-lg">
                      <div className="flex items-center gap-2">
                        <Key className="h-4 w-4" />
                        <Label className="text-sm font-semibold">Backup Codes</Label>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Save these codes in a safe place. You can use them if you lose access to your authenticator.
                      </p>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        {backupCodes.map((code, i) => (
                          <div key={i} className="p-2 bg-background rounded font-mono text-sm">
                            {code}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <p className="text-sm font-medium text-green-800 dark:text-green-200">
                  ✓ Multi-factor authentication is enabled
                </p>
              </div>
              <Button
                variant="destructive"
                onClick={() => {
                  if (confirm("Are you sure you want to disable MFA? This reduces your account security.")) {
                    disableMutation.mutate();
                  }
                }}
              >
                Disable MFA
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

