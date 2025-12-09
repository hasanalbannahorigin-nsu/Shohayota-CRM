import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

interface CallRequestFormProps {
  open: boolean;
  onClose: () => void;
  ticketId?: string;
}

export function CallRequestForm({ open, onClose, ticketId }: CallRequestFormProps) {
  const [notes, setNotes] = useState("");
  const { toast } = useToast();

  const createCallRequestMutation = useMutation({
    mutationFn: async (data: { ticketId?: string; notes?: string }) => {
      const response = await fetch("/api/customers/me/calls", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          ticketId: data.ticketId || null,
          direction: "outbound",
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to request call");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Call request submitted",
        description: "An agent will contact you soon.",
      });
      setNotes("");
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createCallRequestMutation.mutate({
      ticketId: ticketId || undefined,
      notes,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request a Call</DialogTitle>
          <DialogDescription>
            Request a call with a support agent. We'll contact you as soon as possible.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {ticketId && (
            <div className="text-sm text-muted-foreground">
              This call request is associated with ticket #{ticketId}
            </div>
          )}
          <div>
            <Label htmlFor="notes">Additional Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Any additional information about your call request..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createCallRequestMutation.isPending}
            >
              {createCallRequestMutation.isPending ? "Submitting..." : "Request Call"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

