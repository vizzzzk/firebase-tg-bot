
"use server";

import { getBotResponse, BotResponsePayload, Portfolio } from '@/lib/bot-logic';

export async function sendMessage(userInput: string, token: string | null | undefined, portfolio: Portfolio): Promise<BotResponsePayload> {
  if (!userInput || typeof userInput !== 'string' || userInput.length > 500) {
    return { type: 'error', message: 'Invalid input. Please provide a valid message.' };
  }
  
  try {
    const botResponse = await getBotResponse(userInput, token, portfolio);
    return botResponse;
  } catch (e: any) {
    console.error('Error getting bot response:', e);
    return { type: 'error', message: e.message || 'An internal error occurred. Please try again later.' };
  }
}
