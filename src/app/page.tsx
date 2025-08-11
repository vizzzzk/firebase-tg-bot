
"use client";

import { useState, useRef, useEffect, useTransition } from 'react';
import { Bot, Send, User, Loader } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from "@/hooks/use-toast";
import ChatMessage, { type Message } from '@/components/chat-message';
import { sendMessage } from './actions';
import { BotResponsePayload } from '@/lib/bot-logic';

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initial message from the bot
     const initialBotMessage: Message = {
        id: crypto.randomUUID(),
        role: 'bot',
        content: "Hello! I am Webot, your NIFTY options analysis assistant. Type 'start' to begin.",
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

    if (response.type === 'error') {
        botMessage.content = response.message;
        botMessage.payload = undefined; // Don't render a payload for errors
    } else if (response.type === 'expiries') {
        botMessage.content = "Here are the available expiry dates for NIFTY 50.";
    } else if (response.type === 'analysis') {
        botMessage.content = `Analysis for expiry ${response.opportunities[0]?.strike ? `around strike ${response.opportunities[0].strike}` : ''}:`;
    }

    setMessages(prev => [...prev, userMessage, botMessage]);
  }
  
  const handleSendMessage = (messageText: string) => {
    const trimmedInput = messageText.trim();
    if (!trimmedInput || isPending) return;

    // Add user message optimistically, but we'll re-add it in processAndSetMessages
    // to keep the order correct. This just clears the input field.
    const tempUserMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmedInput,
    };
    setMessages(prev => [...prev, tempUserMessage]);
    setInput('');
    
    startTransition(async () => {
      // Remove the temp message
      setMessages(prev => prev.slice(0, prev.length-1));

      const result = await sendMessage(trimmedInput);
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
            <ChatMessage key={msg.id} {...msg} onExpirySelect={handleExpirySelect} />
          ))}
          {isPending && (
             <ChatMessage id="thinking" role="bot" content={<div className="flex items-center gap-2"><Loader className="w-4 h-4 animate-spin" /> Thinking...</div>} onExpirySelect={() => {}} />
          )}
        </CardContent>
        <div className="border-t p-4 bg-background/80 backdrop-blur-sm rounded-b-2xl">
          <form onSubmit={handleSubmit} className="flex items-center gap-3">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type 'start' to begin..."
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
