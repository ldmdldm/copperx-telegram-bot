import { createClient, RedisClientType } from 'redis';
import { AuthToken } from '../services/auth';
import { logger } from './logger';

// Redis client singleton
let redisClient: RedisClientType | null = null;

// Key prefix for user sessions
const SESSION_PREFIX = 'user_session:';

/**
 * Initialize Redis connection
 */
export async function initRedisConnection(): Promise<void> {
  try {
    if (!redisClient) {
      const url = process.env.REDIS_URL || 'redis://localhost:6379';
      
      redisClient = createClient({
        url,
      });

      redisClient.on('error', (err) => {
        logger.error(`Redis connection error: ${err}`);
      });

      redisClient.on('connect', () => {
        logger.info('Connected to Redis');
      });

      await redisClient.connect();
    }
  } catch (error) {
    logger.error(`Failed to initialize Redis connection: ${error}`);
    throw new Error(`Redis connection failed: ${error}`);
  }
}

/**
 * Get Redis client (initialize if not already connected)
 */
export async function getRedisClient(): Promise<RedisClientType> {
  if (!redisClient || !redisClient.isOpen) {
    await initRedisConnection();
  }
  
  if (!redisClient) {
    throw new Error('Redis client is not initialized');
  }
  
  return redisClient;
}

/**
 * Close Redis connection
 */
export async function closeRedisConnection(): Promise<void> {
  try {
    if (redisClient && redisClient.isOpen) {
      await redisClient.quit();
      redisClient = null;
      logger.info('Redis connection closed');
    }
  } catch (error) {
    logger.error(`Error closing Redis connection: ${error}`);
  }
}

/**
 * Store user session in Redis
 * @param userId - User ID (Telegram ID)
 * @param token - Authentication token object
 * @param expiryInSeconds - Optional TTL in seconds (default: 24 hours)
 */
export async function storeUserSession(
  userId: number, 
  token: AuthToken, 
  expiryInSeconds: number = 60 * 60 * 24
): Promise<void> {
  try {
    const client = await getRedisClient();
    const key = `${SESSION_PREFIX}${userId}`;
    
    await client.set(key, JSON.stringify(token), {
      EX: expiryInSeconds,
    });
    
    logger.debug(`Stored session for user ${userId} with expiry ${expiryInSeconds}s`);
  } catch (error) {
    logger.error(`Failed to store user session for ${userId}: ${error}`);
    throw new Error(`Session storage failed: ${error}`);
  }
}

/**
 * Retrieve user session from Redis
 * @param userId - User ID (Telegram ID)
 * @returns AuthToken or null if not found
 */
export async function getUserSession(userId: number): Promise<AuthToken | null> {
  try {
    const client = await getRedisClient();
    const key = `${SESSION_PREFIX}${userId}`;
    
    const data = await client.get(key);
    if (!data) {
      return null;
    }
    
    return JSON.parse(data) as AuthToken;
  } catch (error) {
    logger.error(`Failed to retrieve user session for ${userId}: ${error}`);
    return null;
  }
}

/**
 * Delete user session from Redis
 * @param userId - User ID (Telegram ID)
 */
export async function deleteUserSession(userId: number): Promise<void> {
  try {
    const client = await getRedisClient();
    const key = `${SESSION_PREFIX}${userId}`;
    
    await client.del(key);
    logger.debug(`Deleted session for user ${userId}`);
  } catch (error) {
    logger.error(`Failed to delete user session for ${userId}: ${error}`);
    throw new Error(`Session deletion failed: ${error}`);
  }
}

/**
 * Check if a user session exists
 * @param userId - User ID (Telegram ID)
 * @returns boolean indicating if session exists
 */
export async function hasUserSession(userId: number): Promise<boolean> {
  try {
    const client = await getRedisClient();
    const key = `${SESSION_PREFIX}${userId}`;
    
    return await client.exists(key) === 1;
  } catch (error) {
    logger.error(`Failed to check session existence for ${userId}: ${error}`);
    return false;
  }
}

/**
 * Update the expiry time of an existing session
 * @param userId - User ID (Telegram ID)
 * @param expiryInSeconds - New TTL in seconds
 * @returns boolean indicating success
 */
export async function updateSessionExpiry(
  userId: number,
  expiryInSeconds: number = 60 * 60 * 24
): Promise<boolean> {
  try {
    const client = await getRedisClient();
    const key = `${SESSION_PREFIX}${userId}`;
    
    const success = await client.expire(key, expiryInSeconds);
    return success;
  } catch (error) {
    logger.error(`Failed to update session expiry for ${userId}: ${error}`);
    return false;
  }
}

