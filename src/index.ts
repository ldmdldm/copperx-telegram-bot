import dotenv from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';
import { config } from './config';
import { setupCommandHandlers } from './commands';
import { setupMiddleware } from './middleware';
import { logger } from './utils/logger';
import { setupPusherForAllUsers } from './services/notification';
import { initRedisConnection, closeRedisConnection } from './utils/redis';

// Load environment variables
dotenv.config();

// Validate required environment variables
if (!process.env.TELEGRAM_BOT_TOKEN) {
  logger.error('TELEGRAM_BOT_TOKEN is required in .env file');
  process.exit(1);
}

/**
 * Initialize and start the Telegram bot
 */
async function startBot(): Promise<void> {
  try {
    // Create a bot instance
    const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN as string, {
      polling: true
    });

    logger.info('Bot is starting...');

    // Initialize Redis connection
    await initRedisConnection();
    logger.info('Redis connection established');

    // Setup middleware for the bot (authentication, logging, etc.)
    setupMiddleware(bot);

    // Register command handlers
    await setupCommandHandlers(bot);

    // Set up notification service
    setupPusherForAllUsers(bot);

    // Handle errors
    bot.on('polling_error', (error) => {
      logger.error('Polling error:', error);
    });

    // Log when bot is ready
    logger.info(`Bot has started. Username: ${(await bot.getMe()).username}`);

    // Handle process termination
    process.on('SIGINT', async () => {
      logger.info('Bot is shutting down...');
      bot.stopPolling();
      await closeRedisConnection();
      logger.info('Redis connection closed');
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('Bot is shutting down...');
      bot.stopPolling();
      await closeRedisConnection();
      logger.info('Redis connection closed');
      process.exit(0);
    });

    process.on('uncaughtException', async (error) => {
      logger.error('Uncaught exception:', error);
      bot.stopPolling();
      await closeRedisConnection();
      logger.error('Redis connection closed due to error');
      process.exit(1);
    });

  } catch (error) {
    logger.error('Failed to start bot:', error);
    await closeRedisConnection().catch(err => {
      logger.error('Error closing Redis connection:', err);
    });
    process.exit(1);
  }
}

// Start the bot
startBot().catch((error) => {
  logger.error('Fatal error starting bot:', error);
  process.exit(1);
});

