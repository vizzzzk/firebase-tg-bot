
"use client";

import { useState, useRef, useEffect, useTransition } from 'react';
import { Bot, User, Loader, Rocket, HelpCircle, KeyRound, Newspaper, Send, Briefcase, XCircle, RefreshCw, BookOpen, LogIn, LogOut, Mail, KeySquare, Eye, EyeOff, UserPlus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from "@/hooks/use-toast";
import ChatMessage, { type Message } from '@/components/chat-message';
import { sendMessage } from './actions';
import { BotResponsePayload, Portfolio, TradeHistoryItem } from '@/lib/bot-logic';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHeader, TableRow, TableHead } from '@/components/ui/table';
import { onAuthStateChanged, signOut, User as FirebaseUser, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getUserData, updateUserData } from './api/user-data/actions';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"


const initialPortfolio: Portfolio = { 
    positions: [], 
    initialFunds: 400000, 
    realizedPnL: 0, 
    blockedMargin: 0,
    winningTrades: 0,
    totalTrades: 0,
    tradeHistory: [],
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [portfolio, setPortfolio] = useState<Portfolio>(initialPortfolio);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  // Auth state
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isAuthPending, startAuthTransition] = useTransition();


  // Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setIsLoading(true);
      if (currentUser) {
        setUser(currentUser);
        try {
          const userData = await getUserData(currentUser.uid);
          if (userData) {
            setAccessToken(userData.accessToken || null);
            setPortfolio(userData.portfolio || initialPortfolio);
          } else {
            // New user, set initial state. Document will be created on first data update.
            setPortfolio(initialPortfolio);
            setAccessToken(null);
            updateUserData(currentUser.uid, { portfolio: initialPortfolio, accessToken: null });
          }
           const initialBotMessage: Message = {
            id: crypto.randomUUID(),
            role: 'bot',
            content: "Hello! I am Webot, your NIFTY options analysis assistant. Type 'start' or use the menu below to begin.",
          };
          if (messages.length === 0) {
            setMessages([initialBotMessage]);
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
          toast({ title: "Error", description: "Could not load your data.", variant: "destructive" });
          setPortfolio(initialPortfolio);
          setAccessToken(null);
        }
      } else {
        setUser(null);
        setMessages([]);
        setPortfolio(initialPortfolio);
        setAccessToken(null);
        // Reset auth flow state on logout
        setEmail('');
        setPassword('');
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [toast]);


  // Save state to Firestore whenever it changes for a logged-in user
  useEffect(() => {
    if (user && !isLoading) {
      updateUserData(user.uid, { accessToken, portfolio });
    }
  }, [accessToken, portfolio, user, isLoading]);


  const handleSignUp = async () => {
    startAuthTransition(async () => {
      if (!email || !password) {
        toast({ title: "Email and password are required", variant: "destructive" });
        return;
      }
      if (password.length < 6) {
        toast({ title: "Password must be at least 6 characters long", variant: "destructive" });
        return;
      }
      try {
        await createUserWithEmailAndPassword(auth, email, password);
        // onAuthStateChanged will handle setting the new user state
        toast({ title: "Success!", description: "Your account has been created and you are logged in." });
      } catch (error: any) {
        console.error("Sign up error:", error);
        let message = `An unknown error occurred. Code: ${error.code}. Message: ${error.message}`;
        if (error.code === 'auth/email-already-in-use') {
          message = "This email is already in use. Please sign in instead.";
        } else if (error.code === 'auth/invalid-email') {
          message = "Please enter a valid email address.";
        } else if (error.code === 'auth/weak-password') {
          message = "The password is too weak.";
        } else if (error.code === 'auth/operation-not-allowed' || error.code === 'auth/configuration-not-found') {
            message = "Email/password sign-up is not enabled in the Firebase project. Please enable it in the Firebase console.";
        } else if (error.code === 'auth/api-key-not-valid') {
            message = "The Firebase API Key is invalid. Please ensure it is correct in your project configuration.";
        }
        toast({ title: "Sign Up Failed", description: message, variant: "destructive" });
      }
    });
  };
  
  const handleSignIn = async () => {
    startAuthTransition(async () => {
      if (!email || !password) {
        toast({ title: "Email and password are required", variant: "destructive" });
        return;
      }
      try {
        await signInWithEmailAndPassword(auth, email, password);
         // onAuthStateChanged will handle setting the new user state
        toast({ title: "Success!", description: "You are now logged in." });
      } catch (error: any) {
         console.error("Sign in error:", error);
         let message = `An unknown error occurred. Code: ${error.code}.`;
         if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            message = "Invalid email or password. Please try again.";
         } else if (error.code === 'auth/api-key-not-valid') {
            message = "The Firebase API Key is invalid. Please ensure it is correct in your project configuration.";
        } else if (error.code === 'auth/operation-not-allowed' || error.code === 'auth/configuration-not-found') {
            message = "Email/password sign-in is not enabled in the Firebase project. Please enable it in the Firebase console.";
        }
        toast({ title: "Sign In Failed", description: message, variant: "destructive" });
      }
    });
  };

  const handleLogout = async () => {
    await signOut(auth);
    toast({ title: "Logged Out", description: "You have been successfully logged out." });
  };
  
  const resetPortfolio = () => {
    const clearedPortfolio = { ...initialPortfolio, lastActiveExpiry: portfolio.lastActiveExpiry };
    setPortfolio(clearedPortfolio);
    setAccessToken(null);
    toast({
      title: "Portfolio Reset",
      description: "Your paper trading portfolio has been cleared.",
    });
  }

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
    
    if (response.accessToken) {
        setAccessToken(response.accessToken);
    }
    
    if (response.portfolio) {
      setPortfolio(response.portfolio);
    }

    if (response.type === 'error') {
        if(response.authUrl) {
           botMessage.content = (
            <div>
              <p>{response.message}</p>
              <a href={response.authUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline font-semibold mt-2 inline-block">
                Click here to authorize with Upstox
              </a>
              <p className="text-xs mt-2 text-muted-foreground">After authorizing, you will be redirected. Copy the `code` from the new URL's address bar (or the full URL) and paste it in the chat.</p>
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
    } else if (response.type === 'reset') {
       return; 
    }

    setMessages(prev => [...prev, userMessage, botMessage]);
  }
  
  const handleSendMessage = (messageText: string) => {
    const trimmedInput = messageText.trim();
    if (!trimmedInput || isPending) return;

    if (trimmedInput.toLowerCase() === '/reset') {
      resetPortfolio();
      setInput('');
      return;
    }

    const tempUserMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmedInput,
    };
    setMessages(prev => [...prev, tempUserMessage]);
    setInput('');
    
    startTransition(async () => {
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

  const exportToCSV = (data: TradeHistoryItem[]) => {
    const headers = [
      'Trade ID', 'Instrument', 'Expiry', 'Action', 'Quantity (Lots)', 
      'Entry Time', 'Exit Time', 'Entry Price', 'Exit Price', 'Entry Delta', 'Exit Delta',
      'Gross P&L', 'Net P&L', 'Total Costs', 'Status'
    ];
    const rows = data.map(trade => [
      trade.id,
      `${trade.strike} ${trade.type}`,
      trade.expiry,
      trade.action,
      trade.quantity,
      new Date(trade.entryTimestamp).toLocaleString(),
      trade.exitTimestamp ? new Date(trade.exitTimestamp).toLocaleString() : 'N/A',
      trade.entryPrice,
      trade.exitPrice ?? 'N/A',
      trade.entryDelta?.toFixed(3) ?? 'N/A',
      trade.exitDelta?.toFixed(3) ?? 'N/A',
      trade.grossPnl.toFixed(2),
      trade.netPnl.toFixed(2),
      trade.totalCosts.toFixed(2),
      trade.netPnl >= 0 ? 'Win' : 'Loss'
    ]);

    let csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n" 
      + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "trade_journal.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
  
  if (isLoading) {
    return (
        <div className="flex items-center justify-center min-h-screen bg-background">
            <Loader className="w-12 h-12 animate-spin text-primary" />
        </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-4">
        <Card className="w-full max-w-md shadow-2xl rounded-2xl">
          <CardHeader>
            <div className="flex items-center justify-center gap-3 mb-4">
              <Bot className="w-10 h-10 text-primary" />
              <CardTitle className="text-3xl font-bold font-headline">Welcome to Webot</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
             <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>
              <TabsContent value="signin">
                <div className="space-y-4 pt-4">
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input 
                      type="email" 
                      placeholder="Email" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isAuthPending}
                      className="pl-10"
                    />
                  </div>
                  <div className="relative">
                    <KeySquare className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input 
                      type={showPassword ? "text" : "password"} 
                      placeholder="Password" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isAuthPending}
                      className="pl-10 pr-10"
                    />
                    <Button variant="ghost" size="icon" type="button" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <Button onClick={handleSignIn} disabled={isAuthPending || !email || !password} className="w-full">
                    {isAuthPending ? <Loader className="animate-spin" /> : <><LogIn className="mr-2" /><span>Sign In</span></>}
                  </Button>
                </div>
              </TabsContent>
              <TabsContent value="signup">
                 <div className="space-y-4 pt-4">
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input 
                      type="email" 
                      placeholder="Email" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isAuthPending}
                      className="pl-10"
                    />
                  </div>
                  <div className="relative">
                    <KeySquare className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input 
                       type={showPassword ? "text" : "password"}
                      placeholder="Password (min. 6 characters)" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isAuthPending}
                      className="pl-10 pr-10"
                    />
                     <Button variant="ghost" size="icon" type="button" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <Button onClick={handleSignUp} disabled={isAuthPending || !email || !password} className="w-full">
                    {isAuthPending ? <Loader className="animate-spin" /> : <><UserPlus className="mr-2" /><span>Sign Up</span></>}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-2xl h-[90vh] flex flex-col shadow-2xl rounded-2xl">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bot className="w-8 h-8 text-primary" />
              <div>
                <CardTitle className="text-2xl font-bold font-headline">Webot</CardTitle>
                <CardDescription>Professional NIFTY Options Analysis</CardDescription>
              </div>
            </div>
             <Button onClick={handleLogout} variant="outline" size="sm">
                <LogOut className="w-4 h-4 mr-2" /> Logout
            </Button>
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
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" disabled={isPending}><BookOpen/> Journal</Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl">
                  <DialogHeader>
                    <DialogTitle>Trade Journal</DialogTitle>
                    <DialogDescription>
                      A log of all your closed trades.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="max-h-[60vh] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Instrument</TableHead>
                          <TableHead>Entry Date</TableHead>
                           <TableHead>Entry/Exit Price</TableHead>
                           <TableHead>Entry/Exit Delta</TableHead>
                          <TableHead>Net P&L</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {portfolio.tradeHistory?.length > 0 ? portfolio.tradeHistory.map((trade) => (
                          <TableRow key={trade.id}>
                            <TableCell>{trade.strike} {trade.type}</TableCell>
                            <TableCell>{new Date(trade.entryTimestamp).toLocaleDateString()}</TableCell>
                            <TableCell>{trade.entryPrice.toFixed(2)} / {trade.exitPrice?.toFixed(2) ?? 'N/A'}</TableCell>
                            <TableCell>{trade.entryDelta?.toFixed(3) ?? 'N/A'} / {trade.exitDelta?.toFixed(3) ?? 'N/A'}</TableCell>
                            <TableCell className={trade.netPnl >= 0 ? 'text-green-600' : 'text-red-600'}>{trade.netPnl.toFixed(2)}</TableCell>
                            <TableCell className={trade.netPnl >= 0 ? 'text-green-600' : 'text-red-600'}>{trade.netPnl >= 0 ? 'Win' : 'Loss'}</TableCell>
                          </TableRow>
                        )) : (
                           <TableRow>
                            <TableCell colSpan={6} className="text-center">No closed trades yet.</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                   <DialogFooter>
                     <Button 
                        onClick={() => exportToCSV(portfolio.tradeHistory)}
                        disabled={!portfolio.tradeHistory || portfolio.tradeHistory.length === 0}
                      >
                        Export to CSV
                      </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Button variant="outline" size="sm" onClick={() => setInput('/close ')} disabled={isPending}><XCircle /> Close</Button>
               <Button variant="outline" size="sm" onClick={resetPortfolio} disabled={isPending}><RefreshCw /> Reset</Button>
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
