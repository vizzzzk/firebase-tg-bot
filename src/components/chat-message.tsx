
import { Bot, User, Lock, BarChart, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Separator } from './ui/separator';
import { AnalysisPayload, Expiry, ExpiryPayload, Opportunity, OptionData } from '@/lib/bot-logic';

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
                <div className="space-y-2 mt-2">
                    <p className="font-semibold text-sm">Please select an expiry date for analysis:</p>
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
    <Card className="bg-card/50 mt-4 text-card-foreground border-primary/20">
        <CardHeader className="pb-2">
            <div className='flex justify-between items-center'>
                <CardTitle className="text-lg font-bold flex items-center gap-2"><Lock size={16}/> Professional NIFTY Analysis</CardTitle>
                <span className="text-xs text-muted-foreground">({analysis.timestamp} IST)</span>
            </div>
            <CardDescription>
                Expiry: {analysis.expiry}, Spot: {analysis.spotPrice.toFixed(2)}, DTE: {analysis.dte}, Lot Size: {analysis.lotSize} units
            </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-xs">
            <Separator />
            <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2"><BarChart size={14}/> PCR Analysis Explained:</h4>
                <div className="text-muted-foreground space-y-1 bg-background/50 p-2 rounded-md">
                    <p><strong>PCR (OI):</strong> {analysis.marketAnalysis.pcr_oi} - Put/Call Ratio by Open Interest</p>
                    <p><strong>PCR (Volume):</strong> {analysis.marketAnalysis.pcr_volume} - Put/Call Ratio by Volume</p>
                    <p><strong>Sentiment:</strong> {analysis.marketAnalysis.sentiment} ({analysis.marketAnalysis.confidence})</p>
                    <p><strong>Interpretation:</strong> {analysis.marketAnalysis.interpretation}</p>
                    <p><strong>Trading Bias:</strong> {analysis.marketAnalysis.tradingBias}</p>
                </div>
            </div>
             <Separator />
            <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2"><FileText size={14}/> Top Opportunities (Δ=0.15-0.25) - Scoring Explained:</h4>
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
             <Separator />
             <div>
                <h4 className="font-semibold mb-2">📊 Qualified Strikes (Δ=0.15-0.25 Only):</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
                    <div>
                         <h5 className="font-medium mb-1">✅ Qualified CE Strikes ({analysis.qualifiedStrikes.ce.length}):</h5>
                         <div className="space-y-1 text-muted-foreground bg-background/50 p-2 rounded-md">
                             {analysis.qualifiedStrikes.ce.length > 0 ? analysis.qualifiedStrikes.ce.map(s => (
                                 <p key={s.strike}>{s.strike}: Δ={s.delta.toFixed(3)}, IV={s.iv.toFixed(1)}%, LTP={s.ltp.toFixed(2)}, Liq: {s.liquidity.grade}</p>
                             )) : <p>None</p>}
                         </div>
                    </div>
                     <div>
                         <h5 className="font-medium mb-1">✅ Qualified PE Strikes ({analysis.qualifiedStrikes.pe.length}):</h5>
                         <div className="space-y-1 text-muted-foreground bg-background/50 p-2 rounded-md">
                            {analysis.qualifiedStrikes.pe.length > 0 ? analysis.qualifiedStrikes.pe.map(s => (
                                 <p key={s.strike}>{s.strike}: Δ={s.delta.toFixed(3)}, IV={s.iv.toFixed(1)}%, LTP={s.ltp.toFixed(2)}, Liq: {s.liquidity.grade}</p>
                             )) : <p>None</p>}
                         </div>
                    </div>
                </div>
             </div>
        </CardContent>
    </Card>
);

const OpportunityCard = ({ opportunity }: { opportunity: Opportunity }) => (
    <Card className="bg-background">
        <CardHeader className="p-3 pb-2">
            <CardTitle className="text-sm">{opportunity.type} {opportunity.strike} SELL (Total Score: {opportunity.total_score})</CardTitle>
        </CardHeader>
        <CardContent className="text-xs space-y-1 p-3 pt-0">
             <p><strong>LTP:</strong> {opportunity.ltp.toFixed(2)} | <strong>PoP:</strong> {opportunity.pop.toFixed(1)}%</p>
             <p><strong>Delta:</strong> {opportunity.delta.toFixed(3)} (Score: {opportunity.score_breakdown.deltaScore}/10)</p>
             <p><strong>IV:</strong> {opportunity.iv.toFixed(1)}% (Score: {opportunity.score_breakdown.ivScore}/10)</p>
             <p><strong>Liquidity:</strong> {opportunity.liquidity.grade} (Score: {opportunity.score_breakdown.liquidityScore}/20)</p>
             <p><strong>Alignment Bonus:</strong> {opportunity.score_breakdown.alignmentBonus}</p>
             <p className="font-mono text-primary/80 mt-1">/paper {opportunity.type} {opportunity.strike} SELL 1 {opportunity.ltp.toFixed(2)}</p>
             <p className="italic text-muted-foreground/80">Score: {opportunity.score_breakdown.deltaScore} + {opportunity.score_breakdown.ivScore} + {opportunity.score_breakdown.liquidityScore} + {opportunity.score_breakdown.alignmentBonus} = {opportunity.total_score}</p>
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
          'max-w-[95%] sm:max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-md animate-in fade-in zoom-in-95',
          isUser
            ? 'bg-primary text-primary-foreground rounded-br-none'
            : 'bg-muted text-muted-foreground rounded-bl-none'
        )}
      >
        <div>{content}</div>
        {payload && <div className="mt-2">{renderPayload(payload, onExpirySelect)}</div>}
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
