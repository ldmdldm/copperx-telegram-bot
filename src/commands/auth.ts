import TelegramBot from 'node-telegram-bot-api';
import { 
  authenticateWithOTP, 
  clearUserSession, 
  getUserProfile, 
  isAuthenticated, 
  requestEmailOTP,
  getKYCStatus,
  storeUserSession 
} from '../services/auth';
import { initializePusher, cleanupPusher } from '../services/notification';
import { logger } from '../utils/logger';

// Email validation regex
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
// OTP validation regex - 6 digits, optionally separated by spaces
const OTP_REGEX = /^\s*\d{1,6}(?:\s+\d{1,6})*\s*$/;

/**
 * Handle /login command
 */
export const handleLogin = async (bot: TelegramBot) => {
  bot.onText(/\/login/, async (msg) => {
    const chatId = msg.chat.id;
    
    try {
      // Check if user is already authenticated
      if (await isAuthenticated(chatId)) {
        return bot.sendMessage(chatId, '🔒 You are already logged in. Use /profile to view your account details or /logout to sign out.');
      }
      
      // Ask for email
      await bot.sendMessage(chatId, '📧 Please enter your Copperx account email:');
      
      // Wait for email response
      const emailListener = bot.onText(/.*/, async (emailMsg) => {
        if (emailMsg.chat.id !== chatId) return;
        
        const email = emailMsg.text?.trim() || '';
        bot.removeTextListener(/.*/);
        
        // Validate email format
        if (!EMAIL_REGEX.test(email)) {
          await bot.sendMessage(chatId, '❌ Invalid email format. Please try /login again.');
          return;
        }
        
        try {
          // Request OTP
          await requestEmailOTP(email);
          await bot.sendMessage(chatId, `✅ OTP sent to ${email}. Please enter the 6-digit OTP code:`);
          
          // Wait for OTP response
          const otpListener = bot.onText(/.*/, async (otpMsg) => {
            if (otpMsg.chat.id !== chatId) return;
            
            const otp = otpMsg.text?.trim() || '';
            bot.removeTextListener(/.*/);
            
            // Validate OTP format
            if (!OTP_REGEX.test(otp)) {
              await bot.sendMessage(chatId, '❌ Invalid OTP format. Please try /login again.');
              return;
            }
            
            try {
              // Show loading message
              const loadingMsg = await bot.sendMessage(chatId, '🔄 Authenticating...');
              
              // Authenticate with OTP
              const authToken = await authenticateWithOTP(email, otp);
              
              // First store the session with the token
              await storeUserSession(chatId, authToken);
              
              // Now get user profile (which requires authentication)
              const profile = await getUserProfile(chatId);
              
              // Update session with organization ID if needed
              if (profile.organizationId) {
                await storeUserSession(chatId, {
                  ...authToken,
                  organizationId: profile.organizationId
                });
              }
              
              // Initialize Pusher for real-time notifications
              await initializePusher(chatId, bot);
              
              // Delete loading message
              await bot.deleteMessage(chatId, loadingMsg.message_id);
              
              await bot.sendMessage(
                chatId,
                `🎉 Welcome, ${profile.firstName}! You are now logged in.\n\n` +
                'You can use the following commands:\n' +
                '/profile - View your account details\n' +
                '/wallets - View your wallets\n' +
                '/balance - Check your balance\n' +
                '/send - Send funds\n' +
                '/withdraw - Withdraw funds\n' +
                '/history - View transaction history'
              );
            } catch (error) {
              logger.error('OTP authentication error:', error);
              
              // Advanced error message extraction and user-friendly formatting
              let errorMessage = 'Unknown error';
              let userFriendlyMessage = 'Authentication failed. Please check your OTP and try again.';
              
              // Extract the error message from different error types
              if (error instanceof Error) {
                errorMessage = error.message;
              } else if (typeof error === 'string') {
                errorMessage = error;
              } else if (error && typeof error === 'object') {
                // Handle API error responses which might be objects
                if ('message' in error && typeof error.message === 'string') {
                  errorMessage = error.message;
                } else if ('message' in error && error.message) {
                  // Handle non-string message by converting it to string
                  errorMessage = String(error.message);
                } else if ('error' in error && error.error) {
                  errorMessage = typeof error.error === 'string' ? error.error : JSON.stringify(error.error);
                } else {
                  // If we can't extract a specific message, stringify the object but not directly in the template
                  errorMessage = JSON.stringify(error);
                }
              }
              
              // Format error message to be more user-friendly
              errorMessage = errorMessage.trim();
              
              // Log the raw error message for debugging
              logger.debug(`Raw error message: ${errorMessage}`);
              
              // Handle specific validation error patterns
              if (errorMessage.includes('sid') && (errorMessage.includes('required') || errorMessage.includes('missing'))) {
                userFriendlyMessage = 'Session ID is missing. Please restart the login process.';
              } else if (errorMessage.includes('validation failed') || errorMessage.includes('Unprocessable Entity')) {
                userFriendlyMessage = 'Validation failed. Please ensure your OTP is correct.';
              } else if (errorMessage.includes('expired') || errorMessage.includes('timeout')) {
                userFriendlyMessage = 'Your OTP code has expired. Please request a new one.';
              } else if (errorMessage.includes('incorrect') || errorMessage.includes('invalid') || errorMessage.includes('wrong')) {
                userFriendlyMessage = 'The OTP you entered is incorrect. Please check and try again.';
              } else if (errorMessage.includes('too many attempts') || errorMessage.includes('rate limit')) {
                userFriendlyMessage = 'Too many failed attempts. Please wait a moment before trying again.';
              } else if (errorMessage.toLowerCase().includes('email') && (errorMessage.includes('not found') || errorMessage.includes('unknown'))) {
                userFriendlyMessage = 'This email is not registered. Please check your email or sign up first.';
              } else if (errorMessage.includes('unauthorized') || errorMessage.includes('Unauthorized')) {
                userFriendlyMessage = 'Authentication failed. Please ensure you are using the correct credentials.';
              } else if (errorMessage.includes('server error') || errorMessage.includes('500')) {
                userFriendlyMessage = 'Server error occurred. Please try again later.';
              } else if (errorMessage.includes('[object Object]')) {
                // For cases where error serialization didn't work properly
                userFriendlyMessage = 'Authentication failed due to a system error. Please try again.';
              } else {
                // For generic errors, we'll still use the original message but clean it up
                // Remove technical jargon and format it nicely
                userFriendlyMessage = errorMessage
                  .replace(/\[object Object\]/g, 'system error')
                  .replace(/Error:/i, '')
                  .replace(/\{|\}|\[|\]|"/g, '') // Remove JSON symbols
                  .replace(/sid|session_id|token|jwt/gi, 'login credentials') // Replace technical terms
                  .trim();
                
                // If message is too long or looks too technical, use a generic message
                if (userFriendlyMessage.length > 100 || /^[a-zA-Z0-9-_]{20,}$/.test(userFriendlyMessage)) {
                  userFriendlyMessage = 'Authentication failed. Please try again.';
                }
              }
              
              await bot.sendMessage(chatId, `❌ ${userFriendlyMessage} Please try /login again.`);
            }
          });
          
          // Set timeout for OTP response
          setTimeout(() => {
            bot.removeTextListener(/.*/);
            bot.sendMessage(chatId, '⏰ OTP verification timeout. Please try /login again.');
          }, 5 * 60 * 1000); // 5 minutes timeout
          
        } catch (error) {
          logger.error('Email OTP request error:', error);
          const errorMessage = error instanceof Error ? error.message : 'Invalid email';
          await bot.sendMessage(chatId, `❌ Failed to send OTP: ${errorMessage}. Please try /login again.`);
        }
      });
      
      // Set timeout for email response
      setTimeout(() => {
        bot.removeTextListener(/.*/);
        bot.sendMessage(chatId, '⏰ Email input timeout. Please try /login again.');
      }, 5 * 60 * 1000); // 5 minutes timeout
      
    } catch (error) {
      logger.error('Login error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await bot.sendMessage(chatId, `❌ An error occurred during login: ${errorMessage}. Please try again.`);
    }
  });
};

/**
 * Handle /logout command
 */
export const handleLogout = async (bot: TelegramBot) => {
  bot.onText(/\/logout/, async (msg) => {
    const chatId = msg.chat.id;
    
    try {
      if (!(await isAuthenticated(chatId))) {
        return bot.sendMessage(chatId, '❌ You are not logged in. Use /login to sign in.');
      }
      
      // Clean up Pusher before logging out
      await cleanupPusher(chatId);
      
      // Clear user session
      await clearUserSession(chatId);
      
      await bot.sendMessage(chatId, '👋 You have been logged out successfully. Use /login to sign in again.');
    } catch (error) {
      logger.error('Logout error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await bot.sendMessage(chatId, `❌ An error occurred during logout: ${errorMessage}. Please try again.`);
    }
  });
};

/**
 * Handle /profile command
 */
export const handleProfile = async (bot: TelegramBot) => {
  bot.onText(/\/profile/, async (msg) => {
    const chatId = msg.chat.id;
    
    try {
      if (!(await isAuthenticated(chatId))) {
        return bot.sendMessage(chatId, '❌ You are not logged in. Use /login to sign in.');
      }
      
      // Get user profile
      const profile = await getUserProfile(chatId);
      
      // Format KYC/KYB status
      const kycStatus = formatKYCStatus(profile.kycStatus);
      const kybStatus = formatKYCStatus(profile.kybStatus);
      const message = 
        `👤 *Account Profile*\n\n` +
        `*Name:* ${profile.firstName} ${profile.lastName}\n` +
        `*Email:* ${profile.email}\n` +
        `*Organization:* ${profile.organizationName || 'Personal'}\n` +
        `*KYC Status:* ${kycStatus}\n` +
        `*KYB Status:* ${kybStatus}\n\n` +
        (profile.kycStatus !== 'APPROVED' ? '⚠️ Complete KYC verification on Copperx to unlock all features.' : '');
      
      await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    } catch (error) {
      logger.error('Profile fetch error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await bot.sendMessage(chatId, `❌ Failed to fetch profile: ${errorMessage}. Please try again.`);
    }
  });
};

/**
 * Registers all authentication-related command handlers
 */
export const registerAuthCommands = async (bot: TelegramBot): Promise<void> => {
  await handleLogin(bot);
  await handleLogout(bot);
  await handleProfile(bot);
};

/**
 * Helper function to format KYC/KYB status for display
 */
function formatKYCStatus(status: string): string {
  switch (status?.toLowerCase()) {
    case 'approved':
      return '✅ Approved';
    case 'pending':
      return '⏳ Pending';
    case 'rejected':
      return '❌ Rejected';
    default:
      return '❓ Not Started';
  }
}

