"use server";

import { getBotResponse } from '@/lib/bot-logic';

export async function sendMessage(userInput: string): Promise<{ response?: string; error?: string }> {
  if (!userInput || typeof userInput !== 'string' || userInput.length > 500) {
    return { error: 'Invalid input. Please provide a valid message.' };
  }
  
  try {
    const botResponse = await getBotResponse(userInput);
    return { response: botResponse };
  } catch (e) {
    console.error('Error getting bot response:', e);
    return { error: 'An internal error occurred. Please try again later.' };
  }
}
