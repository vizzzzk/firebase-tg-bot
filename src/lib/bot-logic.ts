
'use server';

import { z } from 'zod';
import * as fs from 'fs/promises';
import path from 'path';

// ===== CONFIGURATION =====
const config = {
    UPSTOX_API_KEY: "226170d8-02ff-47d2-bb74-3611749f4d8d",
    UPSTOX_API_SECRET: "3yn8j0huzj",
    UPSTOX_REDIRECT_URI: "https://localhost.com",
};

const TOKEN_FILE_PATH = path.join(process.cwd(), 'upstox_access_token.json');

// This variable will hold the token in memory for the current session.
let currentAccessToken: string | null = null;


// ===== API & TOKEN MANAGEMENT =====

async function saveAccessToken(token: string) {
    try {
        await fs.writeFile(TOKEN_FILE_PATH, JSON.stringify({ accessToken: token, timestamp: new Date().toISOString() }));
        // CRITICAL FIX: Immediately update the in-memory token for the current lifecycle.
        currentAccessToken = token;
    } catch (error) {
        console.error('Error saving access token:', error);
        // In a serverless environment, we might not be able to write files.
        // We can proceed without saving, but the token will be lost on restart.
    }
}

async function getAccessToken(): Promise<string | null> {
    // 1. Prefer the in-memory token for this session
    if (currentAccessToken) {
        return currentAccessToken;
    }
    // 2. If not available, try to read from the file (for persistence between restarts)
    try {
        const data = await fs.readFile(TOKEN_FILE_PATH, 'utf-8');
        const { accessToken } = JSON.parse(data);
        if (accessToken) {
            currentAccessToken = accessToken; // Load it into memory
            return accessToken;
        }
        return null;
    } catch (error) {
        // File might not exist, which is fine on first run.
        return null;
    }
}

async function exchangeCodeForToken(authCode: string): Promise<string | null> {
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
        if (accessToken) {
            // Set the token for the current session AND save it for later
            await saveAccessToken(accessToken);
            return accessToken;
        }
        return null;
    } catch (error: any) {
        console.error('Error exchanging code for token:', error);
        throw error;
    }
}


// ===== DATA STRUCTURES & SCHEMAS =====
const OptionDataSchema = z.object({
    strike: z.number(),
    delta: z.number(),
    iv: z.number(),
    ltp: z.number(),
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
    pcr_oi: z.number(),
    pcr_volume: z.number(),
});
export type MarketAnalysis = z.infer<typeof MarketAnalysisSchema>;

const AnalysisPayloadSchema = z.object({
    type: z.literal('analysis'),
    spotPrice: z.number(),
    dte: z.number(),
    marketAnalysis: MarketAnalysisSchema,
    opportunities: z.array(OptionDataSchema.extend({ type: z.enum(['CE', 'PE']), total_score: z.number() })),
});
export type AnalysisPayload = z.infer<typeof AnalysisPayloadSchema>;

const ExpirySchema = z.object({
    value: z.string(),
    label: z.string(),
});
export type Expiry = z.infer<typeof ExpirySchema>;

const ExpiryPayloadSchema = z.object({
    type: z.literal('expiries'),
    expiries: z.array(ExpirySchema),
});
export type ExpiryPayload = z.infer<typeof ExpiryPayloadSchema>;

const ErrorPayloadSchema = z.object({
    type: z.literal('error'),
    message: z.string(),
    authUrl: z.string().optional(),
});
export type ErrorPayload = z.infer<typeof ErrorPayloadSchema>;


export type BotResponsePayload = AnalysisPayload | ExpiryPayload | ErrorPayload;


// ===== API HELPERS =====
class UpstoxAPI {
    private static async getHeaders() {
        const accessToken = await getAccessToken();
        if (!accessToken) {
             throw new Error("Upstox Access Token is not configured. Please use the 'auth' command.");
        }
        return {
            "Authorization": `Bearer ${accessToken}`,
            "Accept": "application/json"
        };
    }

    static async getExpiries(): Promise<Expiry[]> {
        const headers = await this.getHeaders();
        const url = "https://api.upstox.com/v2/option/contract?instrument_key=NSE_INDEX|Nifty%2050";
        try {
            const response = await fetch(url, { headers });
            if (!response.ok) {
                 if (response.status === 401) {
                     // The token is invalid, clear it from memory so we are forced to get a new one.
                     currentAccessToken = null;
                     throw new Error("Your Upstox Access Token is invalid or has expired. Please use the 'auth' command to get a new one.");
                 }
                throw new Error(`Upstox API error: ${response.statusText}`);
            }
            const data = await response.json();
            const expiryDates: string[] = Array.from(new Set(data.data.map((item: any) => item.expiry))).slice(0, 7) as string[];

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            return expiryDates.sort().map(expiry => {
                const expDate = new Date(expiry);
                const dte = Math.round((expDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
                const lastDayOfMonth = new Date(expDate.getFullYear(), expDate.getMonth() + 1, 0).getDate();
                const isMonthly = (lastDayOfMonth - expDate.getDate()) < 7;
                const label = isMonthly ? "(M)" : "(W)";

                return {
                    value: expiry,
                    label: `${expiry} ${label} DTE: ${dte}`
                };
            });
        } catch (error: any) {
            console.error("Error fetching expiries:", error);
            throw error;
        }
    }

    static async getOptionChain(expiryDate: string): Promise<any> {
        const headers = await this.getHeaders();
        const url = `https://api.upstox.com/v2/option/chain?instrument_key=NSE_INDEX|Nifty%2050&expiry_date=${expiryDate}`;
        try {
            const response = await fetch(url, { headers });
            if (!response.ok) {
                if (response.status === 401) {
                     // The token is invalid, clear it from memory so we are forced to get a new one.
                     currentAccessToken = null;
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
        return { score: Math.round(totalScore, 1), grade };
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

        const pcr_oi = totalCallOi > 0 ? totalPutOi / totalCallOi : 0;
        const pcr_volume = totalCallVolume > 0 ? totalPutVolume / totalCallVolume : 0;
        const weightedPcr = pcr_oi * 0.7 + pcr_volume * 0.3;

        let sentiment = "Neutral", recommendation = "Mixed", confidence = "Low";
        if (weightedPcr > 1.5) {
            sentiment = "Bearish"; recommendation = "PE";
            confidence = weightedPcr > 2.0 ? "High" : "Medium";
        } else if (weightedPcr < 0.7) {
            sentiment = "Bullish"; recommendation = "CE";
            confidence = weightedPcr < 0.5 ? "High" : "Medium";
        }

        return { sentiment, recommendation, confidence, pcr_oi: parseFloat(pcr_oi.toFixed(3)), pcr_volume: parseFloat(pcr_volume.toFixed(3)) };
    }

    static findOpportunities(optionChain: any[], spotPrice: number, dte: number, marketAnalysis: MarketAnalysis) {
        const opportunities: (OptionData & { type: 'CE' | 'PE', total_score: number })[] = [];

        for (const item of optionChain) {
            const strike = item.strike_price;

            const ceData = item.call_options;
            if (ceData?.market_data?.ltp > 0) {
                 const delta = ceData.option_greeks?.delta ?? 0;
                 if (Math.abs(delta) >= 0.15 && Math.abs(delta) <= 0.25) {
                    const liquidity = this.calculateLiquidityScore(ceData.market_data.volume ?? 0, ceData.market_data.oi ?? 0);
                    const iv = (ceData.option_greeks?.iv ?? 0.2) * 100;
                    const deltaScore = 10 * (1 - Math.min(Math.abs(Math.abs(delta) - 0.20) / 0.05, 1));
                    const ivScore = Math.min(iv / 3, 10);
                    const alignmentBonus = 'CE' === marketAnalysis.recommendation ? 15 : 0;
                    const total_score = deltaScore + ivScore + liquidity.score + alignmentBonus;

                    opportunities.push({
                        type: 'CE', strike, delta, iv, liquidity, ltp: ceData.market_data.ltp,
                        total_score: parseFloat(total_score.toFixed(1))
                    });
                 }
            }

            const peData = item.put_options;
            if (peData?.market_data?.ltp > 0) {
                 const delta = peData.option_greeks?.delta ?? 0;
                 if (Math.abs(delta) >= 0.15 && Math.abs(delta) <= 0.25) {
                    const liquidity = this.calculateLiquidityScore(peData.market_data.volume ?? 0, peData.market_data.oi ?? 0);
                    const iv = (peData.option_greeks?.iv ?? 0.2) * 100;
                    const deltaScore = 10 * (1 - Math.min(Math.abs(Math.abs(delta) - 0.20) / 0.05, 1));
                    const ivScore = Math.min(iv / 3, 10);
                    const alignmentBonus = 'PE' === marketAnalysis.recommendation ? 15 : 0;
                    const total_score = deltaScore + ivScore + liquidity.score + alignmentBonus;
                    
                    opportunities.push({
                        type: 'PE', strike, delta, iv, liquidity, ltp: peData.market_data.ltp,
                        total_score: parseFloat(total_score.toFixed(1))
                    });
                 }
            }
        }
        
        opportunities.sort((a, b) => b.total_score - a.total_score);
        
        const top_ce = opportunities.find(o => o.type === 'CE');
        const top_pe = opportunities.find(o => o.type === 'PE');

        return [top_ce, top_pe].filter(Boolean) as (OptionData & { type: 'CE' | 'PE', total_score: number })[];
    }
}


/**
 * Main logic function to get bot response.
 * @param message The user's input message.
 * @returns A promise that resolves to the bot's response payload.
 */
export async function getBotResponse(message: string): Promise<BotResponsePayload> {
    const lowerCaseMessage = message.toLowerCase().trim();

    // Handle Auth Code submission
    // A simple check to see if the message could be an auth code.
    if (lowerCaseMessage.length > 4 && lowerCaseMessage.length < 50 && !lowerCaseMessage.includes(' ')) {
        try {
            const accessToken = await exchangeCodeForToken(message);
            if (accessToken) {
                return { type: 'error', message: "✅ Authorization successful! You can now use the 'start' command." };
            } else {
                return { type: 'error', message: "❌ Authorization failed. The code might be invalid or expired. Please try '/auth' again." };
            }
        } catch (e: any) {
             return { type: 'error', message: `❌ Authorization error: ${e.message}` };
        }
    }


    if (lowerCaseMessage.startsWith('start') || lowerCaseMessage.startsWith('hello') || lowerCaseMessage.startsWith('hi') || lowerCaseMessage.startsWith('/start')) {
        try {
            const expiries = await UpstoxAPI.getExpiries();
            return { type: 'expiries', expiries };
        } catch (e: any) {
            if (e.message.includes("Access Token is not configured") || e.message.includes("invalid or has expired")){
                const authUrl = `https://api-v2.upstox.com/login/authorization/dialog?response_type=code&client_id=${config.UPSTOX_API_KEY}&redirect_uri=${config.UPSTOX_REDIRECT_URI}`;
                return { type: 'error', message: e.message, authUrl };
            }
            return { type: 'error', message: `Failed to fetch expiries: ${e.message}` };
        }
    }

    if (lowerCaseMessage.startsWith('exp:')) {
        const expiry = lowerCaseMessage.split(':')[1];
        try {
            const optionChain = await UpstoxAPI.getOptionChain(expiry);
            if (!optionChain || !optionChain.data || optionChain.data.length === 0) {
                return { type: 'error', message: `No option chain data found for ${expiry}.` };
            }

            const spotPrice = optionChain.data[0]?.underlying_spot_price ?? 0;
            const expDate = new Date(expiry);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const dte = Math.round((expDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
            
            const marketAnalysis = MarketAnalyzer.analyzePcr(optionChain, expiry);
            const opportunities = MarketAnalyzer.findOpportunities(optionChain.data, spotPrice, dte, marketAnalysis);

            return {
                type: 'analysis',
                spotPrice,
                dte,
                marketAnalysis,
                opportunities,
            };

        } catch (e: any) {
            if (e.message.includes("Access Token is not configured") || e.message.includes("invalid or has expired")){
                 const authUrl = `https://api-v2.upstox.com/login/authorization/dialog?response_type=code&client_id=${config.UPSTOX_API_KEY}&redirect_uri=${config.UPSTOX_REDIRECT_URI}`;
                return { type: 'error', message: e.message, authUrl };
            }
            return { type: 'error', message: `Failed to analyze expiry ${expiry}: ${e.message}` };
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
    
     if (lowerCaseMessage.includes('help')) {
        const helpText = `**NIFTY Options Analysis Bot**

**Core Commands:**
- \`start\`: Begins the analysis by showing available expiry dates.
- \`auth\`: Provides instructions on how to get a new access token for the Upstox API.
- \`help\`: Shows this help message.

**How to use:**
1. Use the **Auth** button or type \`auth\` to get a link to log into Upstox.
2. After logging in, you'll be redirected. Copy the \`code\` from the URL in the address bar.
3. Paste the code directly into the chat here.
4. The bot will automatically get an access token.
5. Use the **Start** button or type \`start\` to begin your analysis.
6. Click on an expiry date to get a detailed market analysis and trading opportunities.
`;
        // A simple markdown conversion for bolding
        return { type: 'error', message: helpText.replace(/`([^`]+)`/g, '**$1**') };
    }

    return { type: 'error', message: `I didn't understand that. Try 'start' or 'help'.` };
}
