import TelegramBot from 'node-telegram-bot-api';
import { logger } from '../utils/logger';

/**
 * Handles the /help command
 * @param bot - The Telegram bot instance
 * @param msg - The message object from Telegram
 * @param match - The RegExp match result
 */
export function handleHelpCommand(bot: TelegramBot, msg: TelegramBot.Message, match: RegExpExecArray | null): void {
  const chatId = msg.chat.id;
  
  try {
    const helpMessage = `
Copperx Payout Bot Commands:

🔐 *Authentication*
/login - Log in with your Copperx credentials
/logout - Log out from your account
/profile - View your account profile

💰 *Wallet Management*
/balance - Check your wallet balances
/wallets - View your wallets
/setdefault - Set your default wallet

💸 *Transfers*
/send - Send funds to an email address
/withdraw - Withdraw funds to your bank or wallet
/history - View your transaction history

ℹ️ *Help & Support*
/help - Show this help message
/support - Get support information

For more help, visit: https://t.me/copperxcommunity/2183
`;
    
    // Send help message with markdown formatting
    bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
    logger.info(`Help command handled for user ${msg.from?.id}`);
  } catch (error) {
    logger.error(`Error handling help command for user ${msg.from?.id}:`, error);
    bot.sendMessage(chatId, 'Sorry, there was an error processing your request. Please try again later.');
  }
}

