

'use server';

import { z } from 'zod';

// ===== CONFIGURATION =====
const config = {
    UPSTOX_API_KEY: "226170d8-02ff-47d2-bb74-3611749f4d8d",
    UPSTOX_API_SECRET: "3yn8j0huzj",
    UPSTOX_REDIRECT_URI: "https://localhost.com",
    NIFTY_LOT_SIZE: 75,
};

// ===== PORTFOLIO MANAGEMENT =====

const PositionSchema = z.object({
    id: z.number(),
    type: z.enum(['CE', 'PE']),
    strike: z.number(),
    action: z.enum(['BUY', 'SELL']),
    quantity: z.number(),
    entryPrice: z.number(),
    expiry: z.string(),
    entryTimestamp: z.string(),
    instrumentKey: z.string(),
    marginBlocked: z.number(),
});
export type Position = z.infer<typeof PositionSchema>;

const PortfolioSchema = z.object({
  positions: z.array(PositionSchema),
  initialFunds: z.number(),
  realizedPnL: z.number(),
  blockedMargin: z.number(),
  lastActiveExpiry: z.string().optional(),
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

export type BotResponsePayload = AnalysisPayload | ExpiryPayload | ErrorPayload | PaperTradePayload | PortfolioPayloadSchema | ClosePositionPayloadSchema;

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
                    const isMonthly = expDate.getDay() === 4 && (lastDayOfMonth - expDate.getDate()) < 7;
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

    static async getLTP(accessToken: string | null | undefined, expiryDate: string, strike: number, optionType: 'CE' | 'PE'): Promise<number> {
        console.log(`Fetching LTP for ${optionType} ${strike} @ ${expiryDate}`);
        try {
            const optionChain = await this.getOptionChain(accessToken, expiryDate);
            if (!optionChain || !optionChain.data) {
                console.error("Failed to fetch or parse option chain.");
                return 0;
            }
    
            // Upstox API strike_price can be a float.
            const targetStrike = parseFloat(strike.toString());
    
            const strikeData = optionChain.data.find((d: any) => {
                // Ensure we handle potential type differences by parsing the item's strike_price to a float as well.
                const itemStrike = parseFloat(d.strike_price);
                return itemStrike === targetStrike;
            });
    
            if (!strikeData) {
                console.error(`Strike ${targetStrike} not found in option chain for ${expiryDate}`);
                const allStrikes = optionChain.data.map((d:any) => d.strike_price);
                console.log("Available strikes:", allStrikes.slice(0, 20)); // Log first 20 available strikes for debugging
                return 0;
            }
            
            const optionDetails = optionType === 'CE' ? strikeData.call_options : strikeData.put_options;
            if (!optionDetails || !optionDetails.market_data) {
                console.error(`No ${optionType} market data for strike ${targetStrike}`);
                return 0;
            }
            
            // The correct field for live price is `last_price` according to Upstox docs and observation.
            const ltp = optionDetails.market_data.last_price;
            
            if (typeof ltp !== 'number') {
                 console.error(`LTP is not a number for ${optionType} ${strike}:`, ltp, `(type: ${typeof ltp})`);
                 // Fallback to 'ltp' if 'last_price' is not a number, just in case of API inconsistencies.
                 const fallbackLtp = optionDetails.market_data.ltp;
                 if(typeof fallbackLtp === 'number'){
                     console.log(`Found LTP in fallback field 'ltp': ${fallbackLtp}`);
                     return fallbackLtp;
                 }
                 return 0;
            }
    
            console.log(`Found LTP in 'last_price': ${ltp}`);
            return ltp;
        } catch (error: any) {
            console.error(`Error in getLTP for ${optionType} ${strike} @ ${expiryDate}:`, error);
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

    static findOpportunities(optionChain: any[], spotPrice: number, dte: number, marketAnalysis: MarketAnalysis, expiry: string) {
        const allOptions: (Opportunity | (OptionData & {type: 'CE' | 'PE'}))[] = [];

        for (const item of optionChain) {
            if (item.expiry !== expiry) continue;
            const strike = item.strike_price;

            const ceData = item.call_options;
            if (ceData?.market_data?.ltp > 0) {
                 const delta = ceData.option_greeks?.delta ?? 0;
                 const liquidity = this.calculateLiquidityScore(ceData.market_data.volume ?? 0, ceData.market_data.oi ?? 0);
                 const iv = (ceData.option_greeks?.iv ?? 0) * 100; // Correctly convert to percentage
                 const pop = (1 - Math.abs(delta)) * 100;

                 const option: OptionData & {type: 'CE'} = { type: 'CE', strike, delta, iv, liquidity, ltp: ceData.market_data.ltp, pop, instrumentKey: ceData.instrument_key };
                 
                 if (Math.abs(delta) >= 0.15 && Math.abs(delta) <= 0.25) {
                    const deltaScore = parseFloat((10 * (1 - Math.min(Math.abs(Math.abs(delta) - 0.20) / 0.05, 1))).toFixed(1));
                    const ivScore = parseFloat(Math.min((iv / 3), 10).toFixed(1)); // Use corrected IV
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
                 const iv = (peData.option_greeks?.iv ?? 0) * 100; // Correctly convert to percentage
                 const pop = (1-Math.abs(delta)) * 100;
                 
                 const option: OptionData & {type: 'PE'} = { type: 'PE', strike, delta, iv, liquidity, ltp: peData.market_data.ltp, pop, instrumentKey: peData.instrument_key };

                 if (Math.abs(delta) >= 0.15 && Math.abs(delta) <= 0.25) {
                    const deltaScore = parseFloat((10 * (1 - Math.min(Math.abs(Math.abs(delta) - 0.20) / 0.05, 1))).toFixed(1));
                    const ivScore = parseFloat(Math.min((iv / 3), 10).toFixed(1)); // Use corrected IV
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
async function findInstrumentAndSpot(token: string | null | undefined, expiry: string, strike: number, type: 'CE' | 'PE'): Promise<{instrumentKey?: string, spotPrice?: number}> {
    const optionChain = await UpstoxAPI.getOptionChain(token, expiry);
    if (!optionChain || !optionChain.data || optionChain.data.length === 0) {
        return { instrumentKey: undefined, spotPrice: undefined };
    }
    const spotPrice = optionChain.data[0]?.underlying_spot_price;
    const strikeData = optionChain.data.find((d: any) => d.strike_price === strike);
    let instrumentKey;
    if (type === 'CE') {
        instrumentKey = strikeData?.call_options?.instrument_key;
    } else {
        instrumentKey = strikeData?.put_options?.instrument_key;
    }
    return { instrumentKey, spotPrice };
}

function calculateMargin(spotPrice: number, premium: number): number {
    // This is an approximation. Real margin calculation is more complex.
    const margin = (spotPrice * config.NIFTY_LOT_SIZE * 0.10) + premium;
    return parseFloat(margin.toFixed(2));
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
    
    // Command whitelist
    const allowedCommands = ['start', 'auth', 'help', '/portfolio', '/close'];
    const isExplicitCommand = allowedCommands.includes(mainCommand) || mainCommand.startsWith('exp:') || mainCommand.startsWith('/paper') || mainCommand.startsWith('/close');
    const isAuthCode = /^[a-zA-Z0-9]{6,50}$/.test(command) && !isExplicitCommand;


    if (isAuthCode) {
        try {
            const newAccessToken = await exchangeCodeForToken(command);
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
            return { type: 'error', message: helpText.replace(/`([^`]+)`/g, '**$1**'), portfolio };
            
        case '/paper':
            if (parts.length === 6) {
                const [_, type, strikeStr, action, qtyStr, priceStr] = parts;
                const strike = parseFloat(strikeStr);
                const quantity = parseInt(qtyStr);
                const price = parseFloat(priceStr);

                if (!portfolio.lastActiveExpiry) {
                   return { type: 'error', message: `Please run an analysis for an expiry date first before placing a trade.`, portfolio };
                }
                
                const { instrumentKey, spotPrice } = await findInstrumentAndSpot(token, portfolio.lastActiveExpiry, strike, type.toUpperCase() as 'CE' | 'PE');

                if (!instrumentKey || !spotPrice) {
                    return { type: 'error', message: `Could not find instrument key or spot price for ${type.toUpperCase()} ${strike}. Cannot place trade.`, portfolio };
                }
                
                const premium = price * quantity * config.NIFTY_LOT_SIZE;
                const marginRequired = calculateMargin(spotPrice, premium);
                const availableFunds = portfolio.initialFunds + portfolio.realizedPnL - portfolio.blockedMargin;
                
                if (marginRequired > availableFunds) {
                     return { type: 'error', message: `Insufficient funds. Margin required: Rs. ${marginRequired.toLocaleString()}. Available funds: Rs. ${availableFunds.toLocaleString()}.`, portfolio };
                }

                const newPosition: Position = {
                    id: portfolio.positions.length > 0 ? Math.max(...portfolio.positions.map(p => p.id)) + 1 : 1,
                    type: type.toUpperCase() as 'CE' | 'PE',
                    strike: strike,
                    action: action.toUpperCase() as 'BUY' | 'SELL',
                    quantity: quantity,
                    entryPrice: price,
                    expiry: portfolio.lastActiveExpiry,
                    entryTimestamp: new Date().toISOString(),
                    instrumentKey,
                    marginBlocked: marginRequired,
                };

                const updatedPortfolio = { 
                    ...portfolio, 
                    positions: [...portfolio.positions, newPosition],
                    blockedMargin: portfolio.blockedMargin + marginRequired,
                };

                const message = `**🔒 Professional Paper Trade Executed**

- **Trade ID:** ${newPosition.id}
- **Position:** ${newPosition.action} ${newPosition.quantity} lot(s) (${newPosition.quantity * config.NIFTY_LOT_SIZE} units)
- **Option:** ${newPosition.type} ${newPosition.strike.toFixed(1)}
- **Entry Price:** Rs. ${newPosition.entryPrice.toFixed(2)}
- **Expiry:** ${newPosition.expiry}
- **Premium:** Rs. ${premium.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
- **Est. Margin Blocked:** Rs. ${marginRequired.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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

            let portfolioMessage = `**🔒 Professional Paper Portfolio**\n\n`;
            portfolioMessage += `- **Total Funds:** Rs. ${totalFunds.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
            portfolioMessage += `- **Blocked Margin:** Rs. ${portfolio.blockedMargin.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
            portfolioMessage += `- **Available Funds:** Rs. ${availableFundsPortfolio.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
            portfolioMessage += `- **Realized P&L:** Rs. ${portfolio.realizedPnL.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\n`;
            
            if (portfolio.positions.length === 0) {
                 portfolioMessage += `- **Open Positions:** 0`;
            } else {
                 portfolio.positions.forEach(pos => {
                    portfolioMessage += `**Position #${pos.id}** (${pos.action} ${pos.quantity} lot)\n`;
                    portfolioMessage += `- **Option:** ${pos.type} ${pos.strike.toFixed(1)}\n`;
                    portfolioMessage += `- **Entry:** Rs. ${pos.entryPrice.toFixed(2)} | **Expiry:** ${pos.expiry}\n`;
                    portfolioMessage += `- **Margin:** Rs. ${pos.marginBlocked.toLocaleString('en-IN')}\n`;
                    portfolioMessage += `*To close, type: /close ${pos.id}*\n\n`;
                });
            }

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
                const exitPrice = await UpstoxAPI.getLTP(token, positionToClose.expiry, positionToClose.strike, positionToClose.type);

                if(exitPrice === 0) {
                    return { type: 'error', message: `Could not fetch live price for ${positionToClose.type} ${positionToClose.strike}. Cannot close position.`, portfolio };
                }

                const pnl = (positionToClose.entryPrice - exitPrice) * positionToClose.quantity * config.NIFTY_LOT_SIZE * (positionToClose.action === 'SELL' ? 1 : -1);

                const updatedPositions = portfolio.positions.filter(p => p.id !== positionIdToClose);
                const updatedPortfolio = { 
                    ...portfolio, 
                    positions: updatedPositions, 
                    realizedPnL: portfolio.realizedPnL + pnl,
                    blockedMargin: portfolio.blockedMargin - positionToClose.marginBlocked,
                };

                const closeMessage = `**🔒 Position Closed Successfully**
- **Trade ID:** ${positionToClose.id}
- **Position:** ${positionToClose.action} ${positionToClose.quantity} lot(s)
- **Option:** ${positionToClose.type} ${positionToClose.strike.toFixed(1)}
- **Entry:** Rs. ${positionToClose.entryPrice.toFixed(2)}
- **Exit:** Rs. ${exitPrice.toFixed(2)} (Current LTP)
- **P&L:** Rs. ${pnl.toFixed(2)} ${pnl >= 0 ? '✅ Profit' : '⚠️ Loss'}

- **Total Funds:** Rs. ${(updatedPortfolio.initialFunds + updatedPortfolio.realizedPnL).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
- **Realized P&L:** Rs. ${updatedPortfolio.realizedPnL.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                
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
            const expDate = new Date(expiry);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const dte = Math.round((expDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
            
            const marketAnalysis = MarketAnalyzer.analyzePcr(optionChain, expiry);
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
