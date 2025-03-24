import TelegramBot from 'node-telegram-bot-api';
import { logger } from '../utils/logger';

/**
 * Handles the /start command
 * @param bot - The Telegram bot instance
 * @param msg - The message object from Telegram
 * @param match - The RegExp match result
 */
export function handleStartCommand(bot: TelegramBot, msg: TelegramBot.Message, match: RegExpExecArray | null): void {
  const chatId = msg.chat.id;
  
  try {
    const welcomeMessage = `
Welcome to Copperx Payout Bot! 🚀

This bot allows you to manage your Copperx account, including:
- Depositing and withdrawing USDC
- Checking balances
- Transferring funds
- Managing your wallet

Use /help to see available commands.
`;
    
    // Send welcome message
    bot.sendMessage(chatId, welcomeMessage);
    logger.info(`Start command handled for user ${msg.from?.id}`);
  } catch (error) {
    logger.error(`Error handling start command for user ${msg.from?.id}:`, error);
    bot.sendMessage(chatId, 'Sorry, there was an error processing your request. Please try again later.');
  }
}

