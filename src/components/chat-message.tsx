
import { Bot, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { AnalysisPayload, Expiry, ExpiryPayload, OptionData } from '@/lib/bot-logic';

export interface Message {
  id: string;
  role: 'user' | 'bot';
  content: React.ReactNode;
  payload?: any;
}

const renderPayload = (payload: any, onExpirySelect: (expiry: string) => void) => {
    if (!payload) return null;

    switch (payload.type) {
        case 'expiries':
            const expiryPayload = payload as ExpiryPayload;
            return (
                <div className="space-y-2">
                    <p className="font-semibold">Please select an expiry date for analysis:</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {expiryPayload.expiries.map((exp: Expiry) => (
                            <Button key={exp.value} variant="outline" onClick={() => onExpirySelect(exp.value)}>
                                {exp.label}
                            </Button>
                        ))}
                    </div>
                </div>
            );
        case 'analysis':
            const analysisPayload = payload as AnalysisPayload;
            return <AnalysisCard analysis={analysisPayload} />;
        default:
            return null;
    }
}

const AnalysisCard = ({ analysis }: { analysis: AnalysisPayload }) => (
    <Card className="bg-background/80">
        <CardHeader>
            <CardTitle>NIFTY Analysis</CardTitle>
            <CardDescription>
                Spot: {analysis.spotPrice.toFixed(2)} | DTE: {analysis.dte}
            </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <div>
                <h4 className="font-semibold mb-2">PCR Analysis</h4>
                <div className="text-sm space-y-1">
                    <p><strong>Sentiment:</strong> {analysis.marketAnalysis.sentiment} ({analysis.marketAnalysis.confidence})</p>
                    <p><strong>Recommendation:</strong> {analysis.marketAnalysis.recommendation}</p>
                    <p><strong>PCR (OI):</strong> {analysis.marketAnalysis.pcr_oi}</p>
                    <p><strong>PCR (Volume):</strong> {analysis.marketAnalysis.pcr_volume}</p>
                </div>
            </div>
            <div>
                <h4 className="font-semibold mb-2">Top Opportunities</h4>
                {analysis.opportunities.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {analysis.opportunities.map((opp) => (
                        <OpportunityCard key={`${opp.type}-${opp.strike}`} opportunity={opp} />
                    ))}
                </div>
                 ) : (
                   <p className="text-sm text-muted-foreground">No qualified opportunities found for the selected criteria.</p>
                )}
            </div>
        </CardContent>
    </Card>
);

const OpportunityCard = ({ opportunity }: { opportunity: OptionData & { type: string, total_score: number } }) => (
    <Card className="bg-card">
        <CardHeader className="p-4">
            <CardTitle className="text-base">{opportunity.type} {opportunity.strike}</CardTitle>
            <CardDescription>Total Score: {opportunity.total_score}</CardDescription>
        </CardHeader>
        <CardContent className="text-xs space-y-1 p-4 pt-0">
             <p><strong>LTP:</strong> {opportunity.ltp.toFixed(2)}</p>
            <p><strong>Delta:</strong> {opportunity.delta.toFixed(3)}</p>
            <p><strong>IV:</strong> {opportunity.iv.toFixed(1)}%</p>
            <p><strong>Liquidity:</strong> {opportunity.liquidity.grade} ({opportunity.liquidity.score})</p>
        </CardContent>
    </Card>
)

export default function ChatMessage({ role, content, payload, onExpirySelect }: Message & { onExpirySelect: (expiry: string) => void }) {
  const isUser = role === 'user';

  return (
    <div className={cn('flex items-start gap-3 w-full', isUser && 'justify-end')}>
      {!isUser && (
        <Avatar className="w-8 h-8 border">
          <AvatarFallback className="bg-primary text-primary-foreground">
            <Bot className="w-5 h-5" />
          </AvatarFallback>
        </Avatar>
      )}
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-md animate-in fade-in zoom-in-95',
          isUser
            ? 'bg-primary text-primary-foreground rounded-br-none'
            : 'bg-muted text-muted-foreground rounded-bl-none'
        )}
      >
        {content}
        {payload && renderPayload(payload, onExpirySelect)}
      </div>
      {isUser && (
        <Avatar className="w-8 h-8 border">
          <AvatarFallback className="bg-accent text-accent-foreground">
            <User className="w-5 h-5" />
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
