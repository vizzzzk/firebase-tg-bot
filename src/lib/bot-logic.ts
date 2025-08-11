/**
 * Simulates a bot's response logic.
 * @param message The user's input message.
 * @returns A promise that resolves to the bot's string response.
 */
export async function getBotResponse(message: string): Promise<string> {
  // Simulate network/processing delay
  await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));

  const lowerCaseMessage = message.toLowerCase().trim();

  if (lowerCaseMessage.includes('hello') || lowerCaseMessage.includes('hi')) {
    return "Hello there! It's a pleasure to connect with you.";
  }

  if (lowerCaseMessage.includes('how are you')) {
    return "I'm just a set of algorithms, but I'm operating at peak efficiency! Thanks for asking.";
  }
  
  if (lowerCaseMessage.includes('help')) {
    return "I can respond to basic greetings like 'hello' and questions like 'how are you?'. I am a simple echo bot for anything else. Try asking me something!";
  }

  if (lowerCaseMessage.includes('what can you do')) {
    return "I'm a demonstration of how a Telegram bot can be adapted into a web interface. You can ask me for 'help' to see what I respond to.";
  }

  return `You said: "${message}". As a simple bot, I'm just echoing your message back to you.`;
}
