
"use client";

import { useState, useRef, useEffect, useTransition } from 'react';
import { Bot, User, Loader, Rocket, HelpCircle, KeyRound, Newspaper, Send, Briefcase, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from "@/hooks/use-toast";
import ChatMessage, { type Message } from '@/components/chat-message';
import { sendMessage } from './actions';
import { BotResponsePayload, Portfolio } from '@/lib/bot-logic';

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [portfolio, setPortfolio] = useState<Portfolio>({ positions: [], initialFunds: 400000, realizedPnL: 0 });
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initial message from the bot
     const initialBotMessage: Message = {
        id: crypto.randomUUID(),
        role: 'bot',
        content: "Hello! I am Webot, your NIFTY options analysis assistant. Type 'start' or use the menu below to begin.",
      };
    setMessages([initialBotMessage]);
  }, []);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const processAndSetMessages = (userInput: string, response: BotResponsePayload) => {
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userInput,
    };

    const botMessage: Message = {
      id: crypto.randomUUID(),
      role: 'bot',
      content: '', // Content will be handled by payload renderer
      payload: response,
    };
    
    // If the response contains a new access token, store it.
    if (response.accessToken) {
        setAccessToken(response.accessToken);
    }
    
    if (response.portfolio) {
      setPortfolio(response.portfolio);
    }

    if (response.type === 'error') {
        // For error messages, we display them directly. If there's an auth URL, we render it as a clickable link.
        if(response.authUrl) {
           botMessage.content = (
            <div>
              <p>{response.message}</p>
              <a href={response.authUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline font-semibold mt-2 inline-block">
                Click here to authorize with Upstox
              </a>
              <p className="text-xs mt-2 text-muted-foreground">After authorizing, you will be redirected. Copy the `code` from the new URL's address bar and paste it in the chat.</p>
            </div>
          );
        } else {
           botMessage.content = response.message;
        }
        botMessage.payload = undefined; // Don't render a payload for errors
    } else if (response.type === 'expiries') {
        botMessage.content = "Here are the available expiry dates for NIFTY 50.";
    } else if (response.type === 'analysis') {
        botMessage.content = `Analysis for expiry ${response.opportunities[0]?.strike ? `around strike ${response.opportunities[0].strike}` : ''}:`;
    } else if (response.type === 'paper-trade' || response.type === 'portfolio' || response.type === 'close-position') {
        botMessage.content = response.message;
        botMessage.payload = undefined;
    }

    setMessages(prev => [...prev, userMessage, botMessage]);
  }
  
  const handleSendMessage = (messageText: string) => {
    const trimmedInput = messageText.trim();
    if (!trimmedInput || isPending) return;

    const tempUserMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmedInput,
    };
    // Add user message optimistically to the chat
    setMessages(prev => [...prev, tempUserMessage]);
    setInput('');
    
    startTransition(async () => {
      // Remove the optimistic user message to avoid duplication
      setMessages(prev => prev.slice(0, prev.length-1));

      const result = await sendMessage(trimmedInput, accessToken, portfolio);
      processAndSetMessages(trimmedInput, result);
    });
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    handleSendMessage(input);
  };
  
  const handleExpirySelect = (expiry: string) => {
      handleSendMessage(`exp:${expiry}`);
  }
  
  const handleCommandClick = (command: string) => {
      if (command.startsWith('/paper') || command.startsWith('/close')) {
          setInput(command);
          // Focus the input field after setting the command
          const inputElement = document.querySelector('input[aria-label="Chat input"]');
          if (inputElement) {
            (inputElement as HTMLInputElement).focus();
          }
      } else {
        handleSendMessage(command);
      }
  }
  
  const handlePaperTrade = () => {
      const lastAnalysisMessage = messages.slice().reverse().find(msg => msg.payload?.type === 'analysis');
      if (lastAnalysisMessage) {
        const payload = lastAnalysisMessage.payload as BotResponsePayload & { type: 'analysis' };
        if (payload.tradeRecommendation?.tradeCommand) {
            setInput(payload.tradeRecommendation.tradeCommand);
            const inputElement = document.querySelector('input[aria-label="Chat input"]');
            if (inputElement) {
                (inputElement as HTMLInputElement).focus();
            }
        } else {
            toast({
                title: "No Recommendation Found",
                description: "Run an analysis to get a trade recommendation first.",
                variant: "destructive"
            })
        }
      } else {
          toast({
                title: "No Analysis Found",
                description: "Run an analysis to get a trade recommendation first.",
                variant: "destructive"
            })
      }
  }


  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-2xl h-[90vh] flex flex-col shadow-2xl rounded-2xl">
        <CardHeader className="border-b">
          <div className="flex items-center gap-3">
            <Bot className="w-8 h-8 text-primary" />
            <div>
              <CardTitle className="text-2xl font-bold font-headline">Webot</CardTitle>
              <CardDescription>Professional NIFTY Options Analysis</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent ref={chatContainerRef} className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((msg) => (
            <ChatMessage key={msg.id} {...msg} onExpirySelect={handleExpirySelect} onCommandClick={handleCommandClick} />
          ))}
          {isPending && (
             <ChatMessage id="thinking" role="bot" content={<div className="flex items-center gap-2"><Loader className="w-4 h-4 animate-spin" /> Thinking...</div>} onExpirySelect={() => {}} onCommandClick={() => {}} />
          )}
        </CardContent>
        <div className="border-t p-4 bg-background/80 backdrop-blur-sm rounded-b-2xl">
           <div className="flex gap-2 mb-3 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => handleCommandClick('start')} disabled={isPending}><Rocket /> Start</Button>
              <Button variant="outline" size="sm" onClick={() => handleCommandClick('auth')} disabled={isPending}><KeyRound /> Auth</Button>
              <Button variant="outline" size="sm" onClick={handlePaperTrade} disabled={isPending}><Newspaper /> Paper Trade</Button>
              <Button variant="outline" size="sm" onClick={() => handleCommandClick('/portfolio')} disabled={isPending}><Briefcase /> Portfolio</Button>
              <Button variant="outline" size="sm" onClick={() => setInput('/close ')} disabled={isPending}><XCircle /> Close</Button>
              <Button variant="outline" size="sm" onClick={() => handleCommandClick('help')} disabled={isPending}><HelpCircle /> Help</Button>
          </div>
          <form onSubmit={handleSubmit} className="flex items-center gap-3">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message or use the menu..."
              className="flex-1 bg-white dark:bg-slate-800"
              disabled={isPending}
              aria-label="Chat input"
            />
            <Button type="submit" size="icon" disabled={!input.trim() || isPending} aria-label="Send message">
              <Send className="w-5 h-5" />
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
