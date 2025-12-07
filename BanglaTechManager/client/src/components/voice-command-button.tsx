import { Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export function VoiceCommandButton() {
  const [isListening, setIsListening] = useState(false);
  const { toast } = useToast();

  const toggleListening = () => {
    setIsListening(!isListening);
    console.log("Voice command:", !isListening ? "started" : "stopped");
    
    toast({
      title: isListening ? "Voice command stopped" : "Listening...",
      description: isListening
        ? "Voice recognition disabled"
        : 'Try saying "Show open tickets" or "Search customer Rahim"',
    });
  };

  return (
    <Button
      size="icon"
      variant={isListening ? "default" : "outline"}
      onClick={toggleListening}
      className={isListening ? "animate-pulse" : ""}
      data-testid="button-voice-command"
    >
      {isListening ? (
        <Mic className="h-5 w-5" />
      ) : (
        <MicOff className="h-5 w-5" />
      )}
    </Button>
  );
}
