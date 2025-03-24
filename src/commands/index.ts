import TelegramBot from 'node-telegram-bot-api';
import { logger } from '../utils/logger';
import { handleStartCommand } from './start';
import { handleHelpCommand } from './help';
import { registerAuthCommands } from './auth';
import { registerWalletCommands } from './wallet';
import { registerTransferCommands } from './transfer';

/**
 * Sets up all command handlers for the bot
 * @param bot - The Telegram bot instance
 */
export async function setupCommandHandlers(bot: TelegramBot): Promise<void> {
  try {
    // Basic commands
    bot.onText(/\/start/, (msg, match) => handleStartCommand(bot, msg, match || null));
    bot.onText(/\/help/, (msg, match) => handleHelpCommand(bot, msg, match || null));
    
    // Register command groups
    await registerAuthCommands(bot);
    registerWalletCommands(bot);
    registerTransferCommands(bot);
    
    logger.info('Command handlers have been set up');
  } catch (error) {
    logger.error('Error setting up command handlers:', error);
    throw error;
  }
}
