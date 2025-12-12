import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Bot, User, Loader, AlertCircle, Lightbulb, Mic, MicOff, Volume2, VolumeX, Wifi, WifiOff } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { getToken } from "@/lib/auth";

interface AIMessage {
  id: string;
  content: string;
  sender: "user" | "ai" | "system";
  timestamp: string;
  type?: "answer" | "error" | "suggestion";
  provider?: "gemini" | "rule";
}

export default function AIAssistantLive() {
  const [messages, setMessages] = useState<AIMessage[]>([
    {
      id: "1",
      content:
        "Hello! 👋 I'm your AI-powered CRM assistant with live chat and voice support.\n\n🎤 Click the microphone to speak\n💬 Type or use live chat for real-time responses\n🔊 Enable voice responses to hear AI replies\n\nJust ask me anything about your CRM!",
      sender: "ai",
      timestamp: new Date().toLocaleTimeString(),
      type: "answer",
    },
  ]);
  const [input, setInput] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  // Initialize WebSocket connection
  useEffect(() => {
    connectWebSocket();
    initializeSpeech();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  // Initialize speech recognition and synthesis
  const initializeSpeech = () => {
    // Text-to-speech
    if ('speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis;
    }

    // Speech-to-text (Web Speech API)
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setIsListening(false);
        setIsRecording(false);
        
        // Auto-send after speech recognition
        setTimeout(() => {
          handleSend(transcript);
        }, 500);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        setIsRecording(false);
        toast({
          title: "Speech Recognition Error",
          description: "Could not recognize speech. Please try again.",
          variant: "destructive",
        });
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
        setIsRecording(false);
      };
    }
  };

  // Connect to WebSocket
  const connectWebSocket = () => {
    try {
      const token = getToken();
      if (!token) {
        toast({
          title: "Authentication Required",
          description: "Please log in to use live chat",
          variant: "destructive",
        });
        return;
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/ai-chat?token=${token}`;
      
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setIsConnected(true);
        console.log('✅ WebSocket connected');
        toast({
          title: "Connected",
          description: "Live chat is now active!",
        });
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'pong') {
            return; // Heartbeat response
          }

          if (data.type === 'system') {
            // System messages (connection status, etc.)
            if (data.content.includes('Connected')) {
              return; // Don't show connection message
            }
          }

          if (data.type === 'user' || data.type === 'ai') {
            const message: AIMessage = {
              id: data.id || `msg-${Date.now()}`,
              content: data.content,
              sender: data.type,
              timestamp: new Date(data.timestamp).toLocaleTimeString(),
              provider: data.provider,
            };
            setMessages((prev) => [...prev, message]);

            // Text-to-speech for AI responses if enabled
            if (data.type === 'ai' && isVoiceEnabled && synthRef.current) {
              speakText(data.content);
            }
          }

          if (data.type === 'error') {
            toast({
              title: "Error",
              description: data.content,
              variant: "destructive",
            });
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnected(false);
        toast({
          title: "Connection Error",
          description: "Live chat unavailable, using HTTP fallback",
          variant: "default",
        });
      };

      ws.onclose = (event) => {
        setIsConnected(false);
        console.log('🔌 WebSocket disconnected', event.code, event.reason);
        
        // Only attempt to reconnect if not a normal closure
        if (event.code !== 1000) {
          setTimeout(() => {
            if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
              connectWebSocket();
            }
          }, 3000);
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      setIsConnected(false);
    }
  };

  // Send message via WebSocket or fallback to HTTP
  const sendMessage = (content: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      // Send via WebSocket (live chat)
      wsRef.current.send(JSON.stringify({
        type: 'chat',
        content: content,
      }));
    } else {
      // Fallback to HTTP
      sendViaHTTP(content);
    }
  };

  // Fallback HTTP method
  const sendViaHTTP = async (query: string) => {
    try {
      const res = await fetch('/api/v1/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ query }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to get response');
      }

      const data = await res.json();
      if (data.success && data.data) {
        const aiMsg: AIMessage = {
          id: `ai-${Date.now()}`,
          content: data.data.text,
          sender: 'ai',
          timestamp: new Date().toLocaleTimeString(),
          provider: data.data.provider,
        };
        setMessages((prev) => [...prev, aiMsg]);

        if (isVoiceEnabled && synthRef.current) {
          speakText(data.data.text);
        }
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error: any) {
      console.error('HTTP fallback error:', error);
      const errorMsg: AIMessage = {
        id: `error-${Date.now()}`,
        content: `⚠️ ${error.message || 'Failed to get response. Please try again.'}`,
        sender: 'ai',
        timestamp: new Date().toLocaleTimeString(),
        type: 'error',
      };
      setMessages((prev) => [...prev, errorMsg]);
      
      toast({
        title: "Error",
        description: error.message || "Failed to get AI response",
        variant: "destructive",
      });
    }
  };

  // Handle send button
  const handleSend = (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText) return;

    const userMessage: AIMessage = {
      id: `user-${Date.now()}`,
      content: messageText,
      sender: "user",
      timestamp: new Date().toLocaleTimeString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    sendMessage(messageText);
    
    if (!text) {
      setInput("");
    }
  };

  // Start/stop voice recording
  const toggleVoiceRecording = () => {
    if (!recognitionRef.current) {
      toast({
        title: "Not Supported",
        description: "Speech recognition is not available in your browser",
        variant: "destructive",
      });
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      setIsRecording(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
      setIsRecording(true);
    }
  };

  // Toggle text-to-speech
  const toggleVoiceResponse = () => {
    setIsVoiceEnabled(!isVoiceEnabled);
    if (isVoiceEnabled && synthRef.current) {
      synthRef.current.cancel(); // Stop any ongoing speech
    }
  };

  // Speak text using Web Speech API
  const speakText = (text: string) => {
    if (!synthRef.current) return;

    // Clean text (remove markdown, emojis, etc.)
    const cleanText = text
      .replace(/[#*_`]/g, '')
      .replace(/\n/g, ' ')
      .substring(0, 500); // Limit length

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 0.8;
    
    synthRef.current.speak(utterance);
  };

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const exampleQueries = [
    "Show open tickets",
    "Customer summary",
    "Generate report",
    "High priority items",
  ];

  const getMessageIcon = (message: AIMessage) => {
    if (message.sender === "user") {
      return <User className="h-4 w-4" />;
    }
    switch (message.type) {
      case "error":
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      case "suggestion":
        return <Lightbulb className="h-4 w-4 text-yellow-500" />;
      default:
        return <Bot className="h-4 w-4 text-primary" />;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">AI Assistant - Live Chat & Voice</h1>
        <p className="text-muted-foreground mt-1">
          Real-time AI chat with voice input and speech output
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card className="h-[600px] flex flex-col">
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-primary" />
                  <CardTitle>AI Assistant</CardTitle>
                  <Badge variant={isConnected ? "default" : "destructive"} className="ml-2">
                    {isConnected ? (
                      <>
                        <Wifi className="h-3 w-3 mr-1" />
                        Live
                      </>
                    ) : (
                      <>
                        <WifiOff className="h-3 w-3 mr-1" />
                        Offline
                      </>
                    )}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    Powered by Gemini AI
                  </Badge>
                </div>
              </div>
            </CardHeader>

            <ScrollArea
              ref={scrollRef}
              className="flex-1 p-6 space-y-4 overflow-hidden"
            >
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${
                      message.sender === "user" ? "flex-row-reverse" : ""
                    }`}
                  >
                    <div
                      className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                        message.sender === "user"
                          ? "bg-primary text-primary-foreground"
                          : message.sender === "system"
                          ? "bg-blue-500 text-white"
                          : "bg-muted"
                      }`}
                    >
                      {getMessageIcon(message)}
                    </div>
                    <div
                      className={`flex flex-col gap-2 max-w-xl ${
                        message.sender === "user" ? "items-end" : ""
                      }`}
                    >
                      <div
                        className={`rounded-lg px-4 py-3 whitespace-pre-wrap ${
                          message.sender === "user"
                            ? "bg-primary text-primary-foreground"
                            : message.sender === "system"
                            ? "bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100"
                            : "bg-muted"
                        }`}
                      >
                        <p className="text-sm">{message.content}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {message.timestamp}
                        </span>
                        {message.provider && message.sender === "ai" && (
                          <Badge variant="outline" className="text-xs">
                            {message.provider}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="p-4 border-t space-y-3">
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Ask me anything or click mic to speak..."
                  disabled={isRecording}
                  className="flex-1"
                />
                <Button
                  onClick={toggleVoiceRecording}
                  variant={isRecording ? "destructive" : "outline"}
                  size="icon"
                  disabled={!recognitionRef.current}
                  title={isRecording ? "Stop recording" : "Start voice input"}
                >
                  {isRecording ? (
                    <MicOff className="h-4 w-4" />
                  ) : (
                    <Mic className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  onClick={toggleVoiceResponse}
                  variant={isVoiceEnabled ? "default" : "outline"}
                  size="icon"
                  title={isVoiceEnabled ? "Disable voice responses" : "Enable voice responses"}
                >
                  {isVoiceEnabled ? (
                    <Volume2 className="h-4 w-4" />
                  ) : (
                    <VolumeX className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isRecording}
                  size="icon"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>💡 Tip: Press Shift+Enter for new line, Enter to send</span>
                {isRecording && (
                  <span className="text-red-500 animate-pulse">🎤 Listening...</span>
                )}
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-4 lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Commands</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {exampleQueries.map((query, index) => (
                <Button
                  key={index}
                  variant="outline"
                  className="w-full justify-start text-left text-sm"
                  onClick={() => {
                    setInput(query);
                    setTimeout(() => handleSend(query), 100);
                  }}
                  disabled={isRecording}
                >
                  {query}
                </Button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Features</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="space-y-1">
                <p className="font-medium flex items-center gap-2">
                  {isConnected ? (
                    <><Wifi className="h-4 w-4 text-green-500" /> Live Chat</>
                  ) : (
                    <><WifiOff className="h-4 w-4 text-gray-500" /> HTTP Fallback</>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  Real-time WebSocket communication
                </p>
              </div>
              <div className="space-y-1">
                <p className="font-medium flex items-center gap-2">
                  <Mic className="h-4 w-4" /> Voice Input
                </p>
                <p className="text-xs text-muted-foreground">
                  Speak your questions
                </p>
              </div>
              <div className="space-y-1">
                <p className="font-medium flex items-center gap-2">
                  {isVoiceEnabled ? (
                    <><Volume2 className="h-4 w-4 text-green-500" /> Voice Output</>
                  ) : (
                    <><VolumeX className="h-4 w-4" /> Text Only</>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  Hear AI responses aloud
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tips</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-muted-foreground">
              <p>✓ Click mic icon to speak</p>
              <p>✓ Enable voice for audio responses</p>
              <p>✓ Live chat provides instant replies</p>
              <p>✓ Works offline with HTTP fallback</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

