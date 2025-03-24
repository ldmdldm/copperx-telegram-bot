import TelegramBot from 'node-telegram-bot-api';
import { logger } from '../utils/logger';

/**
 * Sets up middleware for the bot
 * @param bot - The Telegram bot instance
 */
export function setupMiddleware(bot: TelegramBot): void {
  try {
    // Log all incoming messages
    bot.on('message', (msg) => {
      const username = msg.from?.username || msg.from?.first_name || 'Unknown';
      logger.info(`Received message from ${username} (${msg.from?.id}): ${msg.text}`);
    });
    
    // TODO: Add authentication middleware
    // TODO: Add rate limiting middleware
    
    logger.info('Middleware has been set up');
  } catch (error) {
    logger.error('Error setting up middleware:', error);
    throw error;
  }
}

