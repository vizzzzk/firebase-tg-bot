
'use server';

import { z } from 'zod';

// ===== CONFIGURATION =====
const config = {
    UPSTOX_API_KEY: process.env.UPSTOX_API_KEY || "226170d8-02ff-47d2-bb74-3611749f4d8d",
    UPSTOX_API_SECRET: process.env.UPSTOX_API_SECRET || "3yn8j0huzj",
    UPSTOX_REDIRECT_URI: "https://localhost.com",
    NIFTY_LOT_SIZE: 75,
    BROKERAGE_PER_LOT: 20, // Flat fee per lot per side (buy/sell)
    STT_CTT_CHARGE: 0.000625, // 0.0625% on sell side (premium)
    TRANSACTION_CHARGE: 0.00053, // 0.053% on premium
    GST_CHARGE: 0.18, // 18% on (Brokerage + Transaction Charge)
    SEBI_CHARGE: 10 / 10000000, // Rs 10 per crore
};

// ===== PORTFOLIO MANAGEMENT =====

const PositionSchema = z.object({
    id: z.number(),
    type: z.enum(['CE', 'PE']),
    strike: z.number(),
    action: z.enum(['BUY', 'SELL']),
    quantity: z.number(), // in lots
    entryPrice: z.number(),
    expiry: z.string(),
    entryTimestamp: z.string(),
    instrumentKey: z.string(),
    marginBlocked: z.number(),
    stopLoss: z.number(),
    entryDelta: z.number().optional(),
});
export type Position = z.infer<typeof PositionSchema>;

const TradeHistoryItemSchema = PositionSchema.extend({
    exitPrice: z.number(),
    exitTimestamp: z.string(),
    netPnl: z.number(),
    grossPnl: z.number(),
    totalCosts: z.number(),
    exitDelta: z.number().optional(),
});
export type TradeHistoryItem = z.infer<typeof TradeHistoryItemSchema>;

const PortfolioSchema = z.object({
  positions: z.array(PositionSchema),
  initialFunds: z.number(),
  realizedPnL: z.number(),
  blockedMargin: z.number(),
  lastActiveExpiry: z.string().optional(),
  winningTrades: z.number(),
  totalTrades: z.number(),
  tradeHistory: z.array(TradeHistoryItemSchema),
});
export type Portfolio = z.infer<typeof PortfolioSchema>;


// ===== API & TOKEN MANAGEMENT =====
async function exchangeCodeForToken(authCode: string): Promise<string> {
    const url = "https://api-v2.upstox.com/login/authorization/token";
    const headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
    };
    const body = new URLSearchParams({
        'code': authCode,
        'client_id': config.UPSTOX_API_KEY,
        'client_secret': config.UPSTOX_API_SECRET,
        'redirect_uri': config.UPSTOX_REDIRECT_URI,
        'grant_type': 'authorization_code'
    });

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: body.toString(),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`Token exchange failed with status ${response.status}: ${errorBody}`);
            throw new Error(`Upstox token exchange failed. The code might be expired or invalid. Please try the 'auth' command again.`);
        }

        const data = await response.json();
        const accessToken = data.access_token;
        if (!accessToken) {
             throw new Error(`Upstox token exchange failed. No access token returned.`);
        }
        return accessToken;
    } catch (error: any) {
        console.error('Error exchanging code for token:', error);
        throw error;
    }
}

// ===== DATA STRUCTURES & SCHEMAS =====
const ScoreBreakdownSchema = z.object({
    deltaScore: z.number(),
    ivScore: z.number(),
    liquidityScore: z.number(),
    alignmentBonus: z.number(),
});

const OptionDataSchema = z.object({
    strike: z.number(),
    delta: z.number(),
    iv: z.number(),
    ltp: z.number(),
    pop: z.number(),
    liquidity: z.object({
        grade: z.string(),
        score: z.number(),
    }),
    instrumentKey: z.string(),
});
export type OptionData = z.infer<typeof OptionDataSchema>;

const MarketAnalysisSchema = z.object({
    sentiment: z.string(),
    recommendation: z.string(),
    confidence: z.string(),
    interpretation: z.string(),
    tradingBias: z.string(),
    pcr_oi: z.number(),
    pcr_volume: z.number(),
});
export type MarketAnalysis = z.infer<typeof MarketAnalysisSchema>;

const OpportunitySchema = OptionDataSchema.extend({
    type: z.enum(['CE', 'PE']),
    total_score: z.number(),
    score_breakdown: ScoreBreakdownSchema,
});
export type Opportunity = z.infer<typeof OpportunitySchema>;

const TradeRecommendationSchema = z.object({
    reason: z.string(),
    tradeCommand: z.string(),
});
export type TradeRecommendation = z.infer<typeof TradeRecommendationSchema>;

const BasePayloadSchema = z.object({
    accessToken: z.string().optional(),
    portfolio: PortfolioSchema.optional(),
});

const AnalysisPayloadSchema = BasePayloadSchema.extend({
    type: z.literal('analysis'),
    spotPrice: z.number(),
    dte: z.number(),
    lotSize: z.number(),
    expiry: z.string(),
    timestamp: z.string(),
    marketAnalysis: MarketAnalysisSchema,
    opportunities: z.array(OpportunitySchema),
    qualifiedStrikes: z.object({
        ce: z.array(OptionDataSchema.extend({type: z.literal("CE")})),
        pe: z.array(OptionDataSchema.extend({type: z.literal("PE")})),
    }),
    tradeRecommendation: TradeRecommendationSchema.optional(),
    vix: z.number().optional(),
    maxPain: z.number().optional(),
});
export type AnalysisPayload = z.infer<typeof AnalysisPayloadSchema>;

const ExpirySchema = z.object({
    value: z.string(),
    label: z.string(),
});
export type Expiry = z.infer<typeof ExpirySchema>;

const ExpiryPayloadSchema = BasePayloadSchema.extend({
    type: z.literal('expiries'),
    expiries: z.array(ExpirySchema),
});
export type ExpiryPayload = z.infer<typeof ExpiryPayloadSchema>;

const ErrorPayloadSchema = BasePayloadSchema.extend({
    type: z.literal('error'),
    message: z.string(),
    authUrl: z.string().optional(),
});
export type ErrorPayload = z.infer<ErrorPayloadSchema>;

const PaperTradePayloadSchema = BasePayloadSchema.extend({
    type: z.literal('paper-trade'),
    message: z.string(),
});
export type PaperTradePayload = z.infer<typeof PaperTradePayloadSchema>;

const PortfolioPayloadSchema = BasePayloadSchema.extend({
    type: z.literal('portfolio'),
    message: z.string(),
});

const ClosePositionPayloadSchema = BasePayloadSchema.extend({
    type: z.literal('close-position'),
    message: z.string(),
});

const ResetPayloadSchema = BasePayloadSchema.extend({
    type: z.literal('reset'),
    message: z.string(),
});


export type BotResponsePayload = AnalysisPayload | ExpiryPayload | ErrorPayload | PaperTradePayload | PortfolioPayloadSchema | ClosePositionPayloadSchema | ResetPayloadSchema;

// ===== API HELPERS =====
class UpstoxAPI {
    private static getHeaders(accessToken: string | null | undefined) {
        if (!accessToken) {
             throw new Error("Upstox Access Token is not configured. Please use the 'auth' command.");
        }
        return {
            "Authorization": `Bearer ${accessToken}`,
            "Accept": "application/json"
        };
    }

    static async getExpiries(accessToken: string | null | undefined): Promise<Expiry[]> {
        const headers = this.getHeaders(accessToken);
        const url = "https://api-v2.upstox.com/v2/option/contract?instrument_key=NSE_INDEX|Nifty%2050";
        try {
            const response = await fetch(url, { headers });
            if (!response.ok) {
                 if (response.status === 401) {
                     throw new Error("Your Upstox Access Token is invalid or has expired. Please use the 'auth' command to get a new one.");
                 }
                throw new Error(`Upstox API error: ${response.statusText}`);
            }
            const data = await response.json();
            const allExpiries: string[] = Array.from(new Set(data.data.map((item: any) => item.expiry)));

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            return allExpiries
                .map(expiry => ({ expiry, date: new Date(expiry) }))
                .filter(item => item.date >= today)
                .sort((a, b) => a.date.getTime() - b.date.getTime())
                .slice(0, 7)
                .map(item => {
                    const expDate = item.date;
                    const dte = Math.round((expDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
                    
                    const year = expDate.getFullYear();
                    const month = expDate.getMonth();
                    const lastDayOfMonth = new Date(year, month + 1, 0);
                    let lastThursday = new Date(lastDayOfMonth.getTime());
                    // Find the last day of the month which is a Thursday
                    lastThursday.setDate(lastDayOfMonth.getDate() - (lastDayOfMonth.getDay() + 3) % 7);

                    const isMonthly = expDate.getDate() === lastThursday.getDate();
                    const label = isMonthly ? "(M)" : "(W)";

                    return {
                        value: item.expiry,
                        label: `${item.expiry} ${label} DTE: ${dte}`
                    };
                });
        } catch (error: any) {
            console.error("Error fetching expiries:", error);
            throw error;
        }
    }

    static async getOptionChain(accessToken: string | null | undefined, expiryDate: string): Promise<any> {
        const headers = this.getHeaders(accessToken);
        const url = `https://api-v2.upstox.com/v2/option/chain?instrument_key=NSE_INDEX|Nifty%2050&expiry_date=${expiryDate}`;
        try {
            const response = await fetch(url, { headers });
            if (!response.ok) {
                if (response.status === 401) {
                     throw new Error("Your Upstox Access Token is invalid or has expired. Please use the 'auth' command to get a new one.");
                }
                throw new Error(`Upstox API error: ${response.statusText}`);
            }
            return await response.json();
        } catch (error: any) {
            console.error(`Error fetching option chain for ${expiryDate}:`, error);
            throw error;
        }
    }
}


// ===== ANALYSIS & UTILITY LOGIC =====

function isMarketOpen(): boolean {
    const now = new Date();
    const istTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    
    const day = istTime.getDay();
    const hour = istTime.getHours();
    const minutes = istTime.getMinutes();

    // Market is open Monday (1) to Friday (5)
    if (day < 1 || day > 5) {
        return false;
    }

    // Market timings: 9:15 AM to 3:30 PM
    if (hour < 9 || (hour === 9 && minutes < 15)) {
        return false;
    }
    if (hour > 15 || (hour === 15 && minutes > 30)) {
        return false;
    }

    return true;
}

function calculateCosts(premium: number, quantity: number, action: 'BUY' | 'SELL'): { total: number, breakdown: string } {
    const totalPremium = premium * quantity * config.NIFTY_LOT_SIZE;
    const brokerage = config.BROKERAGE_PER_LOT * quantity;
    const transactionCharge = totalPremium * config.TRANSACTION_CHARGE;
    const stt = action === 'SELL' ? totalPremium * config.STT_CTT_CHARGE : 0;
    const sebiCharge = totalPremium * config.SEBI_CHARGE;
    const gst = (brokerage + transactionCharge) * config.GST_CHARGE;
    
    const totalCosts = brokerage + transactionCharge + stt + gst + sebiCharge;

    const breakdown = `
- **Brokerage:** Rs. ${brokerage.toFixed(2)}
- **STT/CTT (on sell):** Rs. ${stt.toFixed(2)}
- **Transaction Charges:** Rs. ${transactionCharge.toFixed(2)}
- **GST:** Rs. ${gst.toFixed(2)}
- **SEBI Fees:** Rs. ${sebiCharge.toFixed(2)}`;

    return { total: parseFloat(totalCosts.toFixed(2)), breakdown };
}


class MarketAnalyzer {
    static calculateLiquidityScore(volume: number, oi: number) {
        const volumeScore = Math.min(volume / 1000, 10);
        const oiScore = Math.min(oi / 10000, 10);
        const totalScore = volumeScore + oiScore;
        let grade = "Poor";
        if (totalScore >= 15) grade = "Excellent";
        else if (totalScore >= 10) grade = "Good";
        else if (totalScore >= 5) grade = "Fair";
        return { score: parseFloat(totalScore.toFixed(1)), grade };
    }

    static calculateMaxPain(optionChain: any[]): number | null {
        if (!optionChain || optionChain.length === 0) return null;

        const strikes = Array.from(new Set(optionChain.map(o => o.strike_price)));
        let maxPainStrike = 0;
        let minLoss = Infinity;

        for (const strike of strikes) {
            let totalLoss = 0;
            for (const item of optionChain) {
                if (item.call_options?.market_data?.oi) {
                    totalLoss += (Math.max(0, strike - item.strike_price)) * item.call_options.market_data.oi;
                }
                if (item.put_options?.market_data?.oi) {
                    totalLoss += (Math.max(0, item.strike_price - strike)) * item.put_options.market_data.oi;
                }
            }
            if (totalLoss < minLoss) {
                minLoss = totalLoss;
                maxPainStrike = strike;
            }
        }
        return maxPainStrike;
    }

    static analyzePcr(optionData: any, expiryDate: string): MarketAnalysis {
        let totalCallOi = 0, totalPutOi = 0, totalCallVolume = 0, totalPutVolume = 0;

        for (const item of optionData.data) {
            if (item.expiry !== expiryDate) continue;
            totalCallOi += item.call_options?.market_data?.oi ?? 0;
            totalPutOi += item.put_options?.market_data?.oi ?? 0;
            totalCallVolume += item.call_options?.market_data?.volume ?? 0;
            totalPutVolume += item.put_options?.market_data?.volume ?? 0;
        }

        const pcr_oi = totalCallOi > 0 ? parseFloat((totalPutOi / totalCallOi).toFixed(3)) : 0;
        const pcr_volume = totalCallVolume > 0 ? parseFloat((totalPutVolume / totalCallVolume).toFixed(3)) : 0;
        const weightedPcr = pcr_oi * 0.7 + pcr_volume * 0.3;

        let sentiment = "Neutral", recommendation = "Mixed", confidence = "Low", interpretation = "Neutral market sentiment detected.", tradingBias = "Focus on non-directional strategies.";
        
        if (weightedPcr > 1.3) {
            sentiment = "Bearish"; recommendation = "Consider PEs"; confidence = weightedPcr > 1.7 ? "High" : "Medium";
            interpretation = "🐻 Bearish (More Put activity - expect downward pressure)";
            tradingBias = "Focus on Bear Call Spreads or buying Puts.";
        } else if (weightedPcr < 0.8) {
            sentiment = "Bullish"; recommendation = "Consider CEs"; confidence = weightedPcr < 0.6 ? "High" : "Medium";
            interpretation = "🐂 Bullish (More Call activity - expect upward pressure)";
            tradingBias = "Focus on Bull Put Spreads or buying CEs.";
        }

        return { sentiment, recommendation, confidence, pcr_oi, pcr_volume, interpretation, tradingBias };
    }
    
    static generateTradeRecommendation(ceOpp: Opportunity | undefined, peOpp: Opportunity | undefined): TradeRecommendation | undefined {
        if (!ceOpp && !peOpp) {
            return undefined;
        }

        let bestOpp: Opportunity;
        let reason: string;

        if (ceOpp && peOpp) {
            if (ceOpp.total_score > peOpp.total_score) {
                bestOpp = ceOpp;
                reason = `The CE trade has a higher total score (${ceOpp.total_score.toFixed(1)} vs ${peOpp.total_score.toFixed(1)}), suggesting it's the better opportunity based on current market data.`;
            } else {
                bestOpp = peOpp;
                reason = `The PE trade has a higher total score (${peOpp.total_score.toFixed(1)} vs ${ceOpp.total_score.toFixed(1)}), suggesting it's the better opportunity based on current market data.`;
            }
        } else if (ceOpp) {
            bestOpp = ceOpp;
            reason = "Only a qualified CE opportunity was found. This is the recommended trade by default.";
        } else if (peOpp) {
            bestOpp = peOpp;
            reason = "Only a qualified PE opportunity was found. This is the recommended trade by default.";
        } else {
            return undefined; // Should not happen given the initial check
        }

        const tradeCommand = `/paper ${bestOpp.type} ${bestOpp.strike} SELL 1 ${bestOpp.ltp.toFixed(2)}`;

        return { reason, tradeCommand };
    }

    static findOpportunities(optionChain: any[], spotPrice: number, dte: number, marketAnalysis: MarketAnalysis, expiry: string) {
        const allOptions: (Opportunity | (OptionData & {type: 'CE' | 'PE'}))[] = [];

        for (const item of optionChain) {
            if (item.expiry !== expiry) continue;
            const strike = item.strike_price;

            const ceData = item.call_options;
            if (ceData?.market_data?.ltp > 0) {
                 const delta = ceData.option_greeks?.delta ?? 0;
                 const liquidity = this.calculateLiquidityScore(ceData.market_data.volume ?? 0, ceData.market_data.oi ?? 0);
                 const iv = (ceData.option_greeks?.iv ?? 0);
                 const pop = (1 - Math.abs(delta)) * 100;

                 const option: OptionData & {type: 'CE'} = { type: 'CE', strike, delta, iv, liquidity, ltp: ceData.market_data.ltp, pop, instrumentKey: ceData.instrument_key };
                 
                 if (Math.abs(delta) >= 0.15 && Math.abs(delta) <= 0.25) {
                    const deltaScore = parseFloat((10 * (1 - Math.min(Math.abs(Math.abs(delta) - 0.20) / 0.05, 1))).toFixed(1));
                    const ivScore = parseFloat(Math.min((iv / 3), 10).toFixed(1));
                    const alignmentBonus = 'CE' === marketAnalysis.recommendation ? 15 : 0;
                    const total_score = parseFloat((deltaScore + ivScore + liquidity.score + alignmentBonus).toFixed(1));
                    
                    const score_breakdown = { deltaScore, ivScore, liquidityScore: liquidity.score, alignmentBonus };
                    allOptions.push({ ...option, total_score, score_breakdown });
                 } else {
                    allOptions.push(option);
                 }
            }

            const peData = item.put_options;
            if (peData?.market_data?.ltp > 0) {
                 const delta = peData.option_greeks?.delta ?? 0;
                 const liquidity = this.calculateLiquidityScore(peData.market_data.volume ?? 0, peData.market_data.oi ?? 0);
                 const iv = (peData.option_greeks?.iv ?? 0);
                 const pop = (1-Math.abs(delta)) * 100;
                 
                 const option: OptionData & {type: 'PE'} = { type: 'PE', strike, delta, iv, liquidity, ltp: peData.market_data.ltp, pop, instrumentKey: peData.instrument_key };

                 if (Math.abs(delta) >= 0.15 && Math.abs(delta) <= 0.25) {
                    const deltaScore = parseFloat((10 * (1 - Math.min(Math.abs(Math.abs(delta) - 0.20) / 0.05, 1))).toFixed(1));
                    const ivScore = parseFloat(Math.min((iv / 3), 10).toFixed(1));
                    const alignmentBonus = 'PE' === marketAnalysis.recommendation ? 15 : 0;
                    const total_score = parseFloat((deltaScore + ivScore + liquidity.score + alignmentBonus).toFixed(1));
                    const score_breakdown = { deltaScore, ivScore, liquidityScore: liquidity.score, alignmentBonus };
                    allOptions.push({ ...option, total_score, score_breakdown });
                 } else {
                    allOptions.push(option);
                 }
            }
        }
        
        const opportunities = allOptions.filter(o => 'total_score' in o) as Opportunity[];
        opportunities.sort((a, b) => b.total_score - a.total_score);

        const qualifiedStrikes = {
            ce: allOptions.filter(o => o.type === 'CE' && Math.abs(o.delta) >= 0.15 && Math.abs(o.delta) <= 0.25).sort((a,b) => a.strike - b.strike) as (OptionData & {type: 'CE'})[],
            pe: allOptions.filter(o => o.type === 'PE' && Math.abs(o.delta) >= 0.15 && Math.abs(o.delta) <= 0.25).sort((a,b) => a.strike - b.strike) as (OptionData & {type: 'PE'})[],
        }
        
        const top_ce = opportunities.find(o => o.type === 'CE');
        const top_pe = opportunities.find(o => o.type === 'PE');

        const topOpportunities = [top_ce, top_pe].filter(Boolean) as Opportunity[];
        
        const tradeRecommendation = this.generateTradeRecommendation(top_ce, top_pe);

        return { topOpportunities, qualifiedStrikes, tradeRecommendation };
    }
}


// A helper to find the corresponding instrument key from the analysis data
async function findInstrumentAndOptionData(token: string | null | undefined, expiry: string, strike: number, type: 'CE' | 'PE'): Promise<{instrumentKey?: string; spotPrice?: number; vix?: number, delta?: number}> {
    const optionChain = await UpstoxAPI.getOptionChain(token, expiry);
    if (!optionChain || !optionChain.data || optionChain.data.length === 0) {
        console.error(`Could not get option chain for expiry ${expiry}`);
        return {};
    }
    const spotPrice = optionChain.data[0]?.underlying_spot_price;
    const vix = optionChain.data[0]?.vix;
    
    // Find the specific strike in the chain
    const strikeData = optionChain.data.find((d: any) => d.strike_price === strike);

    if (!strikeData) {
        console.error(`Could not find strike ${strike} in option chain for expiry ${expiry}`);
        return { spotPrice, vix };
    }

    let instrumentKey, delta;
    if (type === 'CE' && strikeData.call_options) {
        instrumentKey = strikeData.call_options.instrument_key;
        delta = strikeData.call_options.option_greeks?.delta;
    } else if (type === 'PE' && strikeData.put_options) {
        instrumentKey = strikeData.put_options.instrument_key;
        delta = strikeData.put_options.option_greeks?.delta;
    } else {
        console.error(`Could not find specified option type ${type} for strike ${strike}`);
    }

    return { instrumentKey, spotPrice, vix, delta };
}

async function getLivePriceAndDelta(token: string | null | undefined, position: Position): Promise<{ ltp: number | null; delta: number | null }> {
    try {
        const optionChain = await UpstoxAPI.getOptionChain(token, position.expiry);
        if (!optionChain || !optionChain.data) return { ltp: null, delta: null };

        const strikeData = optionChain.data.find((d: any) => d.strike_price === position.strike);
        if (!strikeData) return { ltp: null, delta: null };

        if (position.type === 'CE' && strikeData.call_options) {
            return {
                ltp: strikeData.call_options.market_data?.ltp ?? null,
                delta: strikeData.call_options.option_greeks?.delta ?? null
            };
        } else if (position.type === 'PE' && strikeData.put_options) {
            return {
                ltp: strikeData.put_options.market_data?.ltp ?? null,
                delta: strikeData.put_options.option_greeks?.delta ?? null
            };
        }
        return { ltp: null, delta: null };
    } catch (error) {
        console.error(`Error fetching live price for ${position.instrumentKey}:`, error);
        return { ltp: null, delta: null };
    }
}


function calculateMargin(spotPrice: number, premium: number): number {
    // This is an approximation. Real margin calculation is more complex.
    const margin = (spotPrice * config.NIFTY_LOT_SIZE * 0.10) + premium;
    return parseFloat(margin.toFixed(2));
}

// Function to extract auth code from a URL
function extractAuthCode(input: string): string | null {
  try {
    // It's a full URL, parse it
    if (input.startsWith('http')) {
        const url = new URL(input);
        return url.searchParams.get("code");
    }
    // It's just the code
    if (/^[a-zA-Z0-9\-_=]{6,100}$/.test(input)) {
        return input;
    }
  } catch (error) {
    // Ignore parsing errors, it's not a valid URL
  }
  return null;
}

/**
 * Main logic function to get bot response.
 * @param message The user's input message.
 * @returns A promise that resolves to the bot's response payload.
 */
export async function getBotResponse(message: string, token: string | null | undefined, portfolio: Portfolio): Promise<BotResponsePayload> {
    const command = message.trim();
    const parts = command.split(' ');
    const mainCommand = parts[0].toLowerCase();
    
    // Check if the input is an auth code or a URL containing one.
    const authCode = extractAuthCode(command);

    if (authCode) {
        try {
            const newAccessToken = await exchangeCodeForToken(authCode);
            const expiries = await UpstoxAPI.getExpiries(newAccessToken);
            return { type: 'expiries', expiries, accessToken: newAccessToken, portfolio };
        } catch (e: any) {
             return { type: 'error', message: `❌ Authorization error: ${e.message}`, portfolio };
        }
    }
    
    // Then, process other commands.
    switch (mainCommand) {
        case 'start':
            try {
                const expiries = await UpstoxAPI.getExpiries(token);
                return { type: 'expiries', expiries, accessToken: token ?? undefined, portfolio };
            } catch (e: any) {
                if (e.message.includes("Access Token is not configured") || e.message.includes("invalid or has expired")){
                    const authUrl = `https://api-v2.upstox.com/login/authorization/dialog?response_type=code&client_id=${config.UPSTOX_API_KEY}&redirect_uri=${config.UPSTOX_REDIRECT_URI}`;
                    return { type: 'error', message: e.message, authUrl, portfolio };
                }
                return { type: 'error', message: `Failed to fetch expiries: ${e.message}`, portfolio };
            }

        case 'auth':
            const authUrl = `https://api-v2.upstox.com/login/authorization/dialog?response_type=code&client_id=${config.UPSTOX_API_KEY}&redirect_uri=${config.UPSTOX_REDIRECT_URI}`;
            return { 
                type: 'error', 
                message: `To get a new access token, you need to authorize this application with Upstox. Click the link below.`, 
                authUrl,
                portfolio
            };
        
        case 'help':
            const helpText = `**NIFTY Options Analysis Bot**

**Core Commands:**
- \`start\`: Begins the analysis by showing available expiry dates.
- \`auth\`: Provides instructions on how to get a new access token.
- \`help\`: Shows this help message.
- \`/paper [CE/PE] [STRIKE] [BUY/SELL] [QTY] [PRICE]\`: Executes a simulated trade.
- \`/portfolio\`: Shows your current simulated portfolio with MTM.
- \`/journal\`: Shows a history of all your closed trades.
- \`/close [POSITION_#]\`: Closes an open position from your portfolio.
- \`/reset\`: Resets your portfolio and access token.

**How to use:**
1. Use the **Auth** button or type \`auth\` to log into Upstox.
2. After logging in, copy the \`code\` from the new URL's address bar.
3. Paste the code into the chat. The bot will get an access token.
4. This session is remembered even if you refresh the page.
5. Click an expiry date for market analysis.
6. Use paper trade commands (e.g., \`/paper CE 22500 SELL 1 150.5\`) to trade.
`;
            return { type: 'error', message: helpText.replace(/`([^`]+)`/g, '**$1**'), portfolio };
            
        case '/reset':
            return { type: 'reset', message: 'Portfolio has been reset successfully.', portfolio: { positions: [], initialFunds: 400000, realizedPnL: 0, blockedMargin: 0, winningTrades: 0, totalTrades: 0, tradeHistory: [] }};

        case '/paper':
            if (!isMarketOpen()) {
                return { type: 'error', message: `The market is currently closed. Paper trading is only allowed between 9:15 AM and 3:30 PM IST, Monday to Friday. Please try again during market hours.`, portfolio };
            }

            if (parts.length === 6) {
                const [_, type, strikeStr, action, qtyStr, priceStr] = parts;
                const strike = parseInt(strikeStr, 10);
                const quantity = parseInt(qtyStr);
                const price = parseFloat(priceStr);

                if (isNaN(strike) || isNaN(quantity) || isNaN(price)) {
                     return { type: 'error', message: `Invalid number format in trade command.`, portfolio };
                }

                if (!portfolio.lastActiveExpiry) {
                   return { type: 'error', message: `Please run an analysis for an expiry date first before placing a trade.`, portfolio };
                }
                
                const { instrumentKey, spotPrice, delta } = await findInstrumentAndOptionData(token, portfolio.lastActiveExpiry, strike, type.toUpperCase() as 'CE' | 'PE');

                if (!instrumentKey || !spotPrice) {
                    return { type: 'error', message: `Could not find instrument key or spot price for ${type.toUpperCase()} ${strike}. Cannot place trade. Please ensure the strike exists for the selected expiry.`, portfolio };
                }
                
                const premium = price * quantity * config.NIFTY_LOT_SIZE;
                const marginRequired = calculateMargin(spotPrice, premium);
                const availableFunds = portfolio.initialFunds + portfolio.realizedPnL - portfolio.blockedMargin;
                
                if (marginRequired > availableFunds) {
                     return { type: 'error', message: `Insufficient funds. Margin required: Rs. ${marginRequired.toLocaleString()}. Available funds: Rs. ${availableFunds.toLocaleString()}.`, portfolio };
                }
                
                const stopLoss = action.toUpperCase() === 'SELL' ? parseFloat((price * 2).toFixed(2)) : parseFloat((price * 0.5).toFixed(2));
                const costs = calculateCosts(price, quantity, action.toUpperCase() as 'BUY'|'SELL');

                const newPosition: Position = {
                    id: portfolio.positions.length + portfolio.tradeHistory.length > 0 ? Math.max(0, ...portfolio.positions.map(p => p.id), ...portfolio.tradeHistory.map(t => t.id)) + 1 : 1,
                    type: type.toUpperCase() as 'CE' | 'PE',
                    strike: strike,
                    action: action.toUpperCase() as 'BUY' | 'SELL',
                    quantity: quantity,
                    entryPrice: price,
                    expiry: portfolio.lastActiveExpiry,
                    entryTimestamp: new Date().toISOString(),
                    instrumentKey,
                    marginBlocked: marginRequired,
                    stopLoss: stopLoss,
                    entryDelta: delta,
                };

                const updatedPortfolio = { 
                    ...portfolio, 
                    positions: [...portfolio.positions, newPosition],
                    blockedMargin: portfolio.blockedMargin + marginRequired,
                };

                const message = `**🔒 Professional Paper Trade Executed**

- **Trade ID:** ${newPosition.id}
- **Position:** ${newPosition.action} ${newPosition.quantity} lot(s) (${newPosition.quantity * config.NIFTY_LOT_SIZE} units)
- **Option:** ${newPosition.type} ${newPosition.strike} @ Rs. ${newPosition.entryPrice.toFixed(2)}
- **Stop-Loss:** Set at Rs. ${newPosition.stopLoss.toFixed(2)}
- **Est. Margin Blocked:** Rs. ${marginRequired.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
- **Est. Costs (Entry):** Rs. ${costs.total.toFixed(2)}
- **Available Funds:** Rs. ${(availableFunds - marginRequired).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;


                return {
                    type: 'paper-trade',
                    message,
                    accessToken: token ?? undefined,
                    portfolio: updatedPortfolio,
                };
            }
            return { type: 'error', message: "Invalid /paper command format. Expected: /paper [CE/PE] [STRIKE] [BUY/SELL] [QTY] [PRICE]", portfolio };

        case '/portfolio':
            const totalFunds = portfolio.initialFunds + portfolio.realizedPnL;
            const availableFundsPortfolio = totalFunds - portfolio.blockedMargin;
            const winLossRatio = portfolio.totalTrades > 0 ? ((portfolio.winningTrades / portfolio.totalTrades) * 100).toFixed(1) : "N/A";
            
            let unrealizedPnl = 0;

            let portfolioMessage = `**🔒 Professional Paper Portfolio**\n\n`;
            portfolioMessage += `- **Total Funds:** Rs. ${totalFunds.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
            portfolioMessage += `- **Realized P&L:** Rs. ${portfolio.realizedPnL.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
            portfolioMessage += `- **Win/Loss Ratio:** ${winLossRatio}% (${portfolio.winningTrades}/${portfolio.totalTrades} wins)\n`;
            
            if (portfolio.positions.length === 0) {
                 portfolioMessage += `- **Open Positions:** 0\n`;
                 portfolioMessage += `- **Unrealized P&L:** Rs. 0.00\n`;
                 portfolioMessage += `- **Blocked Margin:** Rs. 0.00\n`;
            } else {
                const ltpPromises = portfolio.positions.map(p => getLivePriceAndDelta(token, p));
                const liveData = await Promise.all(ltpPromises);

                portfolio.positions.forEach((pos, index) => {
                    const { ltp } = liveData[index];
                    const mtm = ltp !== null ? (pos.action === 'SELL' ? (pos.entryPrice - ltp) : (ltp - pos.entryPrice)) * pos.quantity * config.NIFTY_LOT_SIZE : 0;
                    unrealizedPnl += mtm;
                    portfolioMessage += `\n**Position #${pos.id}** (${pos.action} ${pos.quantity} lot)\n`;
                    portfolioMessage += `- **Option:** ${pos.type} ${pos.strike} | ${pos.expiry}\n`;
                    portfolioMessage += `- **Entry:** Rs. ${pos.entryPrice.toFixed(2)} | **LTP:** Rs. ${ltp !== null ? ltp.toFixed(2) : 'N/A'}\n`;
                    portfolioMessage += `- **MTM:** Rs. ${mtm.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${mtm >= 0 ? '✅' : '⚠️'}\n`;
                    portfolioMessage += `- **Margin Blocked:** Rs. ${pos.marginBlocked.toLocaleString('en-IN')}\n`;
                    portfolioMessage += `*To close, type: /close ${pos.id}*`;
                });
                portfolioMessage += `\n\n- **Total Unrealized P&L:** Rs. ${unrealizedPnl.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
                portfolioMessage += `- **Total Blocked Margin:** Rs. ${portfolio.blockedMargin.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
            }
             portfolioMessage += `- **Available Funds:** Rs. ${availableFundsPortfolio.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;

            return {
                type: 'portfolio',
                message: portfolioMessage,
                accessToken: token ?? undefined,
                portfolio,
            };

        case '/close':
            if (parts.length < 2) {
                return { type: 'error', message: "Please specify a position ID to close. Example: /close 1", portfolio };
            }
            const positionIdToClose = parseInt(parts[1]);
            if (isNaN(positionIdToClose)) {
                 return { type: 'error', message: "Please specify a valid position ID to close. Example: /close 1", portfolio };
            }
            
            const positionToClose = portfolio.positions.find(p => p.id === positionIdToClose);

            if (!positionToClose) {
                return { type: 'error', message: `Position #${positionIdToClose} not found in your portfolio.`, portfolio };
            }
            
            try {
                const { ltp: exitPrice, delta: exitDelta } = await getLivePriceAndDelta(token, positionToClose);

                if(exitPrice === null) {
                    return { type: 'error', message: `Could not fetch a live exit price for ${positionToClose.type} ${positionToClose.strike}. The market might be closed or the instrument illiquid. Cannot close position automatically.`, portfolio };
                }

                const entryCosts = calculateCosts(positionToClose.entryPrice, positionToClose.quantity, positionToClose.action);
                const exitAction = positionToClose.action === 'SELL' ? 'BUY' : 'SELL';
                const exitCosts = calculateCosts(exitPrice, positionToClose.quantity, exitAction);
                const totalCosts = entryCosts.total + exitCosts.total;

                const grossPnl = (positionToClose.action === 'SELL' ? (positionToClose.entryPrice - exitPrice) : (exitPrice - positionToClose.entryPrice)) * positionToClose.quantity * config.NIFTY_LOT_SIZE;
                const netPnl = grossPnl - totalCosts;

                const updatedPositions = portfolio.positions.filter(p => p.id !== positionIdToClose);

                const closedTrade: TradeHistoryItem = {
                    ...positionToClose,
                    exitPrice,
                    exitTimestamp: new Date().toISOString(),
                    grossPnl,
                    netPnl,
                    totalCosts,
                    exitDelta,
                };
                
                const updatedPortfolio = { 
                    ...portfolio, 
                    positions: updatedPositions, 
                    realizedPnL: portfolio.realizedPnL + netPnl,
                    blockedMargin: portfolio.blockedMargin - positionToClose.marginBlocked,
                    totalTrades: portfolio.totalTrades + 1,
                    winningTrades: portfolio.winningTrades + (netPnl > 0 ? 1 : 0),
                    tradeHistory: [...portfolio.tradeHistory, closedTrade],
                };

                const closeMessage = `**🔒 Position Closed Successfully**
- **Trade ID:** ${positionToClose.id} (${positionToClose.type} ${positionToClose.strike})
- **Entry:** Rs. ${positionToClose.entryPrice.toFixed(2)} | **Exit:** Rs. ${exitPrice.toFixed(2)}
- **Gross P&L:** Rs. ${grossPnl.toFixed(2)}
- **Total Costs (Entry+Exit):** Rs. ${totalCosts.toFixed(2)}
- **Net P&L:** Rs. **${netPnl.toFixed(2)}** ${netPnl >= 0 ? '✅ Profit' : '⚠️ Loss'}

- **Realized P&L (Total):** Rs. ${updatedPortfolio.realizedPnL.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                
                return {
                    type: 'close-position',
                    message: closeMessage,
                    accessToken: token ?? undefined,
                    portfolio: updatedPortfolio
                };
            } catch (e: any) {
                 return { type: 'error', message: `Error closing position: ${e.message}`, portfolio };
            }
    }
    
    if (mainCommand.startsWith('exp:')) {
        const expiry = mainCommand.split(':')[1];
        try {
            const optionChain = await UpstoxAPI.getOptionChain(token, expiry);
            if (!optionChain || !optionChain.data || optionChain.data.length === 0) {
                return { type: 'error', message: `No option chain data found for ${expiry}.`, accessToken: token ?? undefined, portfolio };
            }

            const spotPrice = optionChain.data[0]?.underlying_spot_price ?? 0;
            const vix = optionChain.data[0]?.vix;
            const expDate = new Date(expiry);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const dte = Math.round((expDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
            
            const marketAnalysis = MarketAnalyzer.analyzePcr(optionChain, expiry);
            const maxPain = MarketAnalyzer.calculateMaxPain(optionChain.data);
            const { topOpportunities, qualifiedStrikes, tradeRecommendation } = MarketAnalyzer.findOpportunities(optionChain.data, spotPrice, dte, marketAnalysis, expiry);
            
            const timestamp = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false });
            
            const updatedPortfolio = { ...portfolio, lastActiveExpiry: expiry };

            return {
                type: 'analysis',
                spotPrice,
                dte,
                lotSize: config.NIFTY_LOT_SIZE,
                expiry,
                timestamp,
                marketAnalysis,
                opportunities: topOpportunities,
                qualifiedStrikes,
                tradeRecommendation,
                vix,
                maxPain,
                accessToken: token ?? undefined,
                portfolio: updatedPortfolio,
            };

        } catch (e: any) {
             if (e.message.includes("Access Token is not configured") || e.message.includes("invalid or has expired")){
                 const authUrl = `https://api-v2.upstox.com/login/authorization/dialog?response_type=code&client_id=${config.UPSTOX_API_KEY}&redirect_uri=${config.UPSTOX_REDIRECT_URI}`;
                return { type: 'error', message: e.message, authUrl, portfolio };
            }
            return { type: 'error', message: `Failed to analyze expiry ${expiry}: ${e.message}`, portfolio };
        }
    }
    
    return { type: 'error', message: `I didn't understand that. Try 'start' or 'help'.`, portfolio };
}

    

    