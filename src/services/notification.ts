import axios from 'axios';
import Pusher from 'pusher-js';
import TelegramBot from 'node-telegram-bot-api';
import { COPPERX_API_URL, config } from '../config';
import { getUserSession } from './auth';
import { logger } from '../utils/logger';

// Store Pusher instances by chat ID
const pusherInstances = new Map<number, Pusher>();

/**
 * Initialize Pusher client for a specific user
 * @param chatId - The Telegram chat ID
 * @returns The initialized Pusher client
 */
export async function initializePusher(chatId: number, bot: TelegramBot): Promise<Pusher | null> {
  try {
    const session = await getUserSession(chatId);
    
    if (!session || !session.token || !session.organizationId) {
      logger.warn(`Cannot initialize Pusher for chat ${chatId}: User not authenticated or missing organizationId`);
      return null;
    }
    
    // Check if we already have a Pusher instance for this chat
    if (pusherInstances.has(chatId)) {
      logger.info(`Pusher already initialized for chat ${chatId}`);
      return pusherInstances.get(chatId) as Pusher;
    }
    
    logger.info(`Initializing Pusher for chat ${chatId} with org ${session.organizationId}`);
    
    // Initialize Pusher client with authentication
    const pusherClient = new Pusher(config.pusher.key, {
      cluster: config.pusher.cluster,
      authorizer: (channel) => ({
        authorize: async (socketId, callback) => {
          try {
            // Get a fresh session token every time to ensure we have the most up-to-date token
            const freshSession = await getUserSession(chatId);
            
            if (!freshSession || !freshSession.token) {
              callback(new Error('User not authenticated'), null);
              return;
            }
            
            const response = await axios.post(`${COPPERX_API_URL}${config.api.endpoints.notificationsAuth}`, {
              socket_id: socketId,
              channel_name: channel.name
            }, {
              headers: {
                Authorization: `Bearer ${freshSession.token}`
              }
            });

            if (response.data) {
              callback(null, response.data);
            } else {
              callback(new Error('Pusher authentication failed'), null);
            }
          } catch (error) {
            logger.error('Pusher authorization error:', error);
            callback(error as Error, null);
          }
        }
      })
    });
    
    // Get a fresh session to ensure we have the most up-to-date organizationId
    const freshSession = await getUserSession(chatId);
    
    if (!freshSession || !freshSession.organizationId) {
      logger.warn(`Cannot subscribe to Pusher channel for chat ${chatId}: Missing organizationId`);
      return null;
    }
    
    // Subscribe to organization's private channel
    const channelName = `private-org-${freshSession.organizationId}`;
    const channel = pusherClient.subscribe(channelName);
    
    // Handle subscription events
    channel.bind('pusher:subscription_succeeded', () => {
      logger.info(`Successfully subscribed to channel ${channelName} for chat ${chatId}`);
    });
    
    channel.bind('pusher:subscription_error', (error: Error) => {
      logger.error(`Subscription error for chat ${chatId}:`, error);
    });
    
    // Bind to the deposit event
    channel.bind('deposit', (data: { amount?: string; currency?: string; network?: string }) => {
      try {
        const amount = data.amount || 'Unknown amount';
        const currency = data.currency || 'USDC';
        const network = data.network || 'Solana';
        
        bot.sendMessage(chatId,
          `💰 *New Deposit Received*\n\n` +
          `*Amount:* ${amount} ${currency}\n` +
          `*Network:* ${network}\n` +
          `*Status:* Confirmed`,
          { parse_mode: 'Markdown' }
        );
        
        logger.info(`Deposit notification sent to chat ${chatId}: ${amount} ${currency}`);
      } catch (error) {
        logger.error(`Failed to process deposit event for chat ${chatId}:`, error);
      }
    });
    
    // Store the Pusher instance
    pusherInstances.set(chatId, pusherClient);
    
    return pusherClient;
  } catch (error) {
    logger.error(`Failed to initialize Pusher for chat ${chatId}:`, error);
    return null;
  }
}

/**
 * Clean up Pusher connection for a user
 * @param chatId - The Telegram chat ID
 */
export async function cleanupPusher(chatId: number): Promise<void> {
  try {
    const pusher = pusherInstances.get(chatId);
    
    if (pusher) {
      logger.info(`Cleaning up Pusher connection for chat ${chatId}`);
      
      // Get user session to find organization ID
      // Get user session to find organization ID
      const session = await getUserSession(chatId);
      
      if (session && session.organizationId) {
        // Unsubscribe from the channel
        const channelName = `private-org-${session.organizationId}`;
        pusher.unsubscribe(channelName);
      } else {
        logger.warn(`Cannot unsubscribe from Pusher channel for chat ${chatId}: Missing organizationId`);
      }
      // Disconnect the Pusher client
      pusher.disconnect();
      
      // Remove from our map
      pusherInstances.delete(chatId);
    }
  } catch (error) {
    logger.error(`Error cleaning up Pusher for chat ${chatId}:`, error);
  }
}

/**
 * Set up Pusher for all authenticated users
 * @param bot - The Telegram bot instance
 */
export function setupPusherForAllUsers(bot: TelegramBot): void {
  // This would typically read from a persistent store of authenticated users
  // For this implementation, we'll rely on the login command to set up Pusher
  logger.info('Pusher notification service initialized');
}

