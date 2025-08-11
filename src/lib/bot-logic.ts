
'use server';

import { z } from 'zod';

// ===== CONFIGURATION =====
const config = {
    UPSTOX_API_KEY: "226170d8-02ff-47d2-bb74-3611749f4d8d",
    UPSTOX_API_SECRET: "3yn8j0huzj",
    UPSTOX_REDIRECT_URI: "https://localhost.com",
    NIFTY_LOT_SIZE: 50,
};


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

export type BotResponsePayload = AnalysisPayload | ExpiryPayload | ErrorPayload | PaperTradePayload;


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
        const url = "https://api.upstox.com/v2/option/contract?instrument_key=NSE_INDEX|Nifty%2050";
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
                    const lastDayOfMonth = new Date(expDate.getFullYear(), expDate.getMonth() + 1, 0).getDate();
                    const isMonthly = (lastDayOfMonth - expDate.getDate()) < 7;
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
        const url = `https://api.upstox.com/v2/option/chain?instrument_key=NSE_INDEX|Nifty%2050&expiry_date=${expiryDate}`;
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

// ===== ANALYSIS LOGIC =====
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

    static findOpportunities(optionChain: any[], spotPrice: number, dte: number, marketAnalysis: MarketAnalysis) {
        const allOptions: (Opportunity | (OptionData & {type: 'CE' | 'PE'}))[] = [];

        for (const item of optionChain) {
            const strike = item.strike_price;

            const ceData = item.call_options;
            if (ceData?.market_data?.ltp > 0) {
                 const delta = ceData.option_greeks?.delta ?? 0;
                 const liquidity = this.calculateLiquidityScore(ceData.market_data.volume ?? 0, ceData.market_data.oi ?? 0);
                 const iv = (ceData.option_greeks?.iv ?? 0) * 100;
                 const pop = (1 - Math.abs(delta)) * 100;

                 const option: OptionData & {type: 'CE'} = { type: 'CE', strike, delta, iv, liquidity, ltp: ceData.market_data.ltp, pop };
                 
                 if (Math.abs(delta) >= 0.15 && Math.abs(delta) <= 0.25) {
                    const deltaScore = parseFloat((10 * (1 - Math.min(Math.abs(Math.abs(delta) - 0.20) / 0.05, 1))).toFixed(1));
                    const ivScore = parseFloat(Math.min(iv / 3, 10).toFixed(1));
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
                 const iv = (peData.option_greeks?.iv ?? 0) * 100;
                 const pop = (1-Math.abs(delta)) * 100;
                 
                 const option: OptionData & {type: 'PE'} = { type: 'PE', strike, delta, iv, liquidity, ltp: peData.market_data.ltp, pop };

                 if (Math.abs(delta) >= 0.15 && Math.abs(delta) <= 0.25) {
                    const deltaScore = parseFloat((10 * (1 - Math.min(Math.abs(Math.abs(delta) - 0.20) / 0.05, 1))).toFixed(1));
                    const ivScore = parseFloat(Math.min(iv / 3, 10).toFixed(1));
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


/**
 * Main logic function to get bot response.
 * @param message The user's input message.
 * @returns A promise that resolves to the bot's response payload.
 */
export async function getBotResponse(message: string, token: string | null | undefined): Promise<BotResponsePayload> {
    const lowerCaseMessage = message.toLowerCase().trim();
    const command = message.trim();

    // Command processing
    if (lowerCaseMessage.startsWith('start')) {
        try {
            const expiries = await UpstoxAPI.getExpiries(token);
            return { type: 'expiries', expiries, accessToken: token ?? undefined };
        } catch (e: any) {
            if (e.message.includes("Access Token is not configured") || e.message.includes("invalid or has expired")){
                const authUrl = `https://api-v2.upstox.com/login/authorization/dialog?response_type=code&client_id=${config.UPSTOX_API_KEY}&redirect_uri=${config.UPSTOX_REDIRECT_URI}`;
                return { type: 'error', message: e.message, authUrl };
            }
            return { type: 'error', message: `Failed to fetch expiries: ${e.message}` };
        }
    }

    if (lowerCaseMessage.startsWith('auth')) {
        const authUrl = `https://api-v2.upstox.com/login/authorization/dialog?response_type=code&client_id=${config.UPSTOX_API_KEY}&redirect_uri=${config.UPSTOX_REDIRECT_URI}`;
        return { 
            type: 'error', 
            message: `To get a new access token, you need to authorize this application with Upstox. Click the link below.`, 
            authUrl 
        };
    }
    
    if (lowerCaseMessage.startsWith('help')) {
        const helpText = `**NIFTY Options Analysis Bot**

**Core Commands:**
- \`start\`: Begins the analysis by showing available expiry dates.
- \`auth\`: Provides instructions on how to get a new access token for the Upstox API.
- \`help\`: Shows this help message.
- \`/paper [CE/PE] [STRIKE] [BUY/SELL] [QTY] [PRICE]\`: Executes a simulated trade.
- \`/portfolio\`: Shows your current simulated portfolio.
- \`/close [POSITION_#]\`: Closes an open position from your portfolio.

**How to use:**
1. Use the **Auth** button or type \`auth\` to get a link to log into Upstox.
2. After logging in, you'll be redirected. Copy the \`code\` from the new URL's address bar.
3. Paste the code directly into the chat here.
4. The bot will automatically get an access token and show you the available expiries.
5. Click on an expiry date to get a detailed market analysis and trading opportunities.
6. Use the paper trade commands from the analysis to simulate trades.
`;
        return { type: 'error', message: helpText.replace(/`([^`]+)`/g, '**$1**') };
    }

    if (lowerCaseMessage.startsWith('exp:')) {
        const expiry = lowerCaseMessage.split(':')[1];
        try {
            const optionChain = await UpstoxAPI.getOptionChain(token, expiry);
            if (!optionChain || !optionChain.data || optionChain.data.length === 0) {
                return { type: 'error', message: `No option chain data found for ${expiry}.`, accessToken: token ?? undefined };
            }

            const spotPrice = optionChain.data[0]?.underlying_spot_price ?? 0;
            const expDate = new Date(expiry);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const dte = Math.round((expDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
            
            const marketAnalysis = MarketAnalyzer.analyzePcr(optionChain, expiry);
            const { topOpportunities, qualifiedStrikes, tradeRecommendation } = MarketAnalyzer.findOpportunities(optionChain.data, spotPrice, dte, marketAnalysis);
            
            const timestamp = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false });

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
                accessToken: token ?? undefined
            };

        } catch (e: any) {
             if (e.message.includes("Access Token is not configured") || e.message.includes("invalid or has expired")){
                 const authUrl = `https://api-v2.upstox.com/login/authorization/dialog?response_type=code&client_id=${config.UPSTOX_API_KEY}&redirect_uri=${config.UPSTOX_REDIRECT_URI}`;
                return { type: 'error', message: e.message, authUrl };
            }
            return { type: 'error', message: `Failed to analyze expiry ${expiry}: ${e.message}` };
        }
    }
    
    if (command.startsWith('/paper')) {
        const parts = command.split(' ');
        if (parts.length === 6) {
            const [_, type, strike, action, qty, price] = parts;
            return {
                type: 'paper-trade',
                message: `✅ Paper trade executed: ${action.toUpperCase()} ${qty} lot(s) of ${strike} ${type.toUpperCase()} at ${price}.`,
                accessToken: token ?? undefined,
            };
        }
    }

    if (command.startsWith('/portfolio')) {
        return {
            type: 'paper-trade',
            message: `💼 Your Portfolio:\n• Value: Rs. 0.00\n• P&L: Rs. 0.00\n• Positions: 0 open`,
            accessToken: token ?? undefined,
        };
    }

    if (command.startsWith('/close')) {
        return {
            type: 'paper-trade',
            message: `✅ No open positions to close.`,
            accessToken: token ?? undefined,
        };
    }


    // Check if the message is a potential auth code.
    const isAuthCode = /^[a-z0-9]+$/i.test(command) && command.length > 20 && command.length < 50;

    if (isAuthCode) {
        try {
            const newAccessToken = await exchangeCodeForToken(command);
            const expiries = await UpstoxAPI.getExpiries(newAccessToken);
            return { type: 'expiries', expiries, accessToken: newAccessToken };
        } catch (e: any) {
             return { type: 'error', message: `❌ Authorization error: ${e.message}` };
        }
    }

    return { type: 'error', message: `I didn't understand that. Try 'start' or 'help'.` };
}
