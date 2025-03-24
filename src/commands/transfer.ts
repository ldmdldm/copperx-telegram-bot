import TelegramBot from 'node-telegram-bot-api';
import { logger } from '../utils/logger';
import { getUserToken, isAuthenticated } from '../services/auth';
import { sendFunds, withdrawToWallet, withdrawToBank, getTransactionHistory } from '../services/transfer';
import { getDefaultWallet } from '../services/wallet';
import { formatTransferAmount, formatDate } from '../utils/formatter';

// Regular expression for amount validation (positive number with optional decimal places)
const AMOUNT_REGEX = /^\d+(\.\d{1,6})?$/;

/**
 * Handle /send command to transfer funds to an email
 * @param bot Telegram bot instance
 * @param msg Message object from Telegram
 */
export async function sendCommand(bot: TelegramBot, msg: TelegramBot.Message): Promise<void> {
  const chatId = msg.chat.id;
  
  try {
    // Check if user is authenticated
    if (!await isAuthenticated(chatId)) {
      bot.sendMessage(chatId, "⚠️ You need to login first! Use /login to authenticate.");
      return;
    }

    // Start the conversation for collecting transfer details
    await startSendConversation(bot, chatId);
  } catch (error) {
    logger.error('Error in send command:', error);
    bot.sendMessage(chatId, "❌ Something went wrong while processing your request. Please try again later.");
  }
}

/**
 * Handle /withdraw command for withdrawing funds
 * @param bot Telegram bot instance
 * @param msg Message object from Telegram
 */
export async function withdrawCommand(bot: TelegramBot, msg: TelegramBot.Message): Promise<void> {
  const chatId = msg.chat.id;
  
  try {
    // Check if user is authenticated
    if (!await isAuthenticated(chatId)) {
      bot.sendMessage(chatId, "⚠️ You need to login first! Use /login to authenticate.");
      return;
    }

    // Provide withdrawal options
    const options: TelegramBot.SendMessageOptions = {
      reply_markup: {
        inline_keyboard: [
          [{ text: '💳 To Bank Account', callback_data: 'withdraw_bank' }],
          [{ text: '🔑 To External Wallet', callback_data: 'withdraw_wallet' }]
        ]
      },
    };

    bot.sendMessage(chatId, "💸 *Withdraw Funds*\n\nPlease select your withdrawal method:", {
      parse_mode: 'Markdown',
      ...options
    });
  } catch (error) {
    logger.error('Error in withdraw command:', error);
    bot.sendMessage(chatId, "❌ Something went wrong while processing your request. Please try again later.");
  }
}

/**
 * Handle /history command to display transaction history
 * @param bot Telegram bot instance
 * @param msg Message object from Telegram
 */
export async function historyCommand(bot: TelegramBot, msg: TelegramBot.Message): Promise<void> {
  const chatId = msg.chat.id;
  
  try {
    // Check if user is authenticated
    if (!await isAuthenticated(chatId)) {
      bot.sendMessage(chatId, "⚠️ You need to login first! Use /login to authenticate.");
      return;
    }

    const token = await getUserToken(chatId);
    if (!token) {
      bot.sendMessage(chatId, "⚠️ Authentication error. Please login again with /login");
      return;
    }

    bot.sendMessage(chatId, "🔍 Fetching your recent transactions...");
    
    const response = await getTransactionHistory(token);
    
    if (!response.success || !response.data) {
      bot.sendMessage(chatId, `❌ Failed to fetch transaction history: ${response.error || 'Unknown error'}`);
      return;
    }

    const transactions = response.data.transfers;
    
    if (!transactions || transactions.length === 0) {
      bot.sendMessage(chatId, "📝 You don't have any transactions yet.");
      return;
    }

    // Format and display the transactions
    let message = "📜 *Recent Transactions*\n\n";
    
    transactions.slice(0, 10).forEach((tx: any, index: number) => {
      const date = formatDate(tx.createdAt);
      const amount = formatTransferAmount(tx.amount);
      const type = tx.type || 'Transaction';
      const status = tx.status || 'Completed';
      
      message += `*${index + 1}. ${type}*\n`;
      message += `💰 Amount: ${amount} USDC\n`;
      message += `📅 Date: ${date}\n`;
      message += `🔄 Status: ${status}\n`;
      
      if (tx.recipient) {
        message += `👤 Recipient: ${tx.recipient}\n`;
      }
      
      if (tx.sender) {
        message += `👤 Sender: ${tx.sender}\n`;
      }
      
      message += '\n';
    });

    message += "Use /history to refresh this list.";

    bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  } catch (error) {
    logger.error('Error in history command:', error);
    bot.sendMessage(chatId, "❌ Something went wrong while fetching your transaction history. Please try again later.");
  }
}

/**
 * Start conversation flow for sending funds
 * @param bot Telegram bot instance
 * @param chatId Chat ID
 */
async function startSendConversation(bot: TelegramBot, chatId: number): Promise<void> {
  // Store user states
  const userStates: Record<number, any> = {};
  
  bot.sendMessage(chatId, "📤 *Send Funds*\n\nPlease enter the recipient's email address:", {
    parse_mode: 'Markdown'
  });

  // Set up listener for recipient email
  const emailListener = async (msg: TelegramBot.Message) => {
    if (msg.chat.id !== chatId) return;
    
    const email = msg.text?.trim();
    if (!email || !email.includes('@')) {
      bot.sendMessage(chatId, "⚠️ Please enter a valid email address.");
      return;
    }

    // Store recipient email and prompt for amount
    userStates[chatId] = { recipient: email };
    bot.removeListener('message', emailListener);
    
    bot.sendMessage(chatId, `Please enter the amount in USDC to send to ${email}:`);
    bot.on('message', amountListener);
  };

  // Set up listener for amount
  const amountListener = async (msg: TelegramBot.Message) => {
    if (msg.chat.id !== chatId) return;
    
    const amountText = msg.text?.trim();
    if (!amountText || !AMOUNT_REGEX.test(amountText)) {
      bot.sendMessage(chatId, "⚠️ Please enter a valid amount (e.g., 10 or 10.5)");
      return;
    }

    const amount = parseFloat(amountText);
    if (amount <= 0) {
      bot.sendMessage(chatId, "⚠️ Amount must be greater than 0.");
      return;
    }

    // Update state with amount and prompt for description
    userStates[chatId].amount = amount;
    bot.removeListener('message', amountListener);
    
    bot.sendMessage(chatId, "Please enter a description for this transfer (optional, type 'skip' to leave blank):");
    bot.on('message', descriptionListener);
  };

  // Set up listener for description
  const descriptionListener = async (msg: TelegramBot.Message) => {
    if (msg.chat.id !== chatId) return;
    
    let description = msg.text?.trim();
    if (description?.toLowerCase() === 'skip') {
      description = '';
    }

    // Update state with description and show confirmation
    userStates[chatId].description = description;
    bot.removeListener('message', descriptionListener);
    
    // Show confirmation message with transfer details
    const confirmMessage = `📤 *Transfer Confirmation*\n\n` +
      `To: ${userStates[chatId].recipient}\n` +
      `Amount: ${userStates[chatId].amount} USDC\n` +
      (description ? `Description: ${description}\n\n` : '\n') +
      `Please confirm this transfer:`;
    
    const options: TelegramBot.SendMessageOptions = {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Confirm', callback_data: 'confirm_send' },
            { text: '❌ Cancel', callback_data: 'cancel_send' }
          ]
        ]
      }
    };
    
    bot.sendMessage(chatId, confirmMessage, options);
  };

  // Set up callback handler for confirmation
  bot.on('callback_query', async (callbackQuery) => {
    if (!callbackQuery.message || callbackQuery.message.chat.id !== chatId) return;
    
    const action = callbackQuery.data;
    
    if (action === 'confirm_send') {
      bot.answerCallbackQuery(callbackQuery.id);
      
      try {
        const userData = userStates[chatId];
        if (!userData) {
          bot.sendMessage(chatId, "❌ Transfer data not found. Please start again with /send");
          return;
        }
        
        const token = await getUserToken(chatId);
        if (!token) {
          bot.sendMessage(chatId, "⚠️ Authentication error. Please login again with /login");
          return;
        }

        // Get the default wallet
        let defaultWallet;
        try {
          defaultWallet = await getDefaultWallet(chatId);
          if (!defaultWallet) {
            bot.sendMessage(chatId, `❌ Couldn't retrieve your default wallet: Unknown error`);
            return;
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          bot.sendMessage(chatId, `❌ Couldn't retrieve your default wallet: ${errorMessage}`);
          return;
        }

        bot.sendMessage(chatId, "🔄 Processing your transfer...");

        // Execute the transfer
        const result = await sendFunds(
          token, 
          userData.recipient, 
          userData.amount.toString(), 
          userData.description || ''
        );

        if (result.success && result.data) {
          bot.sendMessage(chatId, 
            `✅ *Transfer Successful!*\n\n` +
            `Amount: ${userData.amount} USDC\n` +
            `Recipient: ${userData.recipient}\n\n` +
            `Transaction ID: \`${result.data.id}\``, 
            { parse_mode: 'Markdown' }
          );
          // Clean up stored state
          delete userStates[chatId];
        } else {
          bot.sendMessage(chatId, `❌ Transfer failed: ${result.data?.message || 'Unknown error'}`);
        }
      } catch (error) {
        logger.error('Error in send confirmation:', error);
        bot.sendMessage(chatId, "❌ Something went wrong while processing your transfer. Please try again later.");
      }
    } else if (action === 'cancel_send') {
      bot.answerCallbackQuery(callbackQuery.id, { text: 'Transfer canceled' });
      bot.sendMessage(chatId, "❌ Transfer has been canceled.");
      // Clean up stored state
      delete userStates[chatId];
    } else if (action === 'withdraw_wallet') {
      bot.answerCallbackQuery(callbackQuery.id);
      startWalletWithdrawConversation(bot, chatId);
    } else if (action === 'withdraw_bank') {
      bot.answerCallbackQuery(callbackQuery.id);
      startBankWithdrawConversation(bot, chatId);
    }
  });

  // Set up initial listener
  bot.on('message', emailListener);
}

/**
 * Start conversation flow for withdrawing to an external wallet
 * @param bot Telegram bot instance
 * @param chatId Chat ID
 */
async function startWalletWithdrawConversation(bot: TelegramBot, chatId: number): Promise<void> {
  // Store user states
  const userStates: Record<number, any> = {};
  
  bot.sendMessage(chatId, "🔑 *Withdraw to External Wallet*\n\nPlease enter the destination wallet address:", {
    parse_mode: 'Markdown'
  });

  // Set up listener for wallet address
  const addressListener = async (msg: TelegramBot.Message) => {
    if (msg.chat.id !== chatId) return;
    
    const address = msg.text?.trim();
    if (!address || address.length < 32) {
      bot.sendMessage(chatId, "⚠️ Please enter a valid wallet address.");
      return;
    }

    // Store wallet address and prompt for amount
    userStates[chatId] = { address };
    bot.removeListener('message', addressListener);
    
    bot.sendMessage(chatId, "Please enter the amount in USDC to withdraw:");
    bot.on('message', amountListener);
  };

  // Set up listener for amount
  const amountListener = async (msg: TelegramBot.Message) => {
    if (msg.chat.id !== chatId) return;
    
    const amountText = msg.text?.trim();
    if (!amountText || !AMOUNT_REGEX.test(amountText)) {
      bot.sendMessage(chatId, "⚠️ Please enter a valid amount (e.g., 10 or 10.5)");
      return;
    }

    const amount = parseFloat(amountText);
    if (amount <= 0) {
      bot.sendMessage(chatId, "⚠️ Amount must be greater than 0.");
      return;
    }

    // Update state with amount and prompt for network
    userStates[chatId].amount = amount;
    bot.removeListener('message', amountListener);
    
    const options: TelegramBot.SendMessageOptions = {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Solana', callback_data: 'network_solana' }],
          [{ text: 'Ethereum', callback_data: 'network_ethereum' }]
        ]
      }
    };
    
    bot.sendMessage(chatId, "Please select the network for the withdrawal:", options);
    
    // Handle network selection via callback
    bot.on('callback_query', async (callbackQuery) => {
      if (!callbackQuery.message || callbackQuery.message.chat.id !== chatId) return;
      
      const data = callbackQuery.data;
      if (data?.startsWith('network_')) {
        bot.answerCallbackQuery(callbackQuery.id);
        
        const network = data.replace('network_', '');
        userStates[chatId].network = network;
        
        // Show confirmation message
        const confirmMessage = `🔑 *Withdrawal Confirmation*\n\n` +
          `To: ${userStates[chatId].address}\n` +
          `Amount: ${userStates[chatId].amount} USDC\n` +
          `Network: ${network}\n\n` +
          `Please confirm this withdrawal:`;
        
        const confirmOptions: TelegramBot.SendMessageOptions = {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '✅ Confirm', callback_data: 'confirm_wallet_withdraw' },
                { text: '❌ Cancel', callback_data: 'cancel_withdraw' }
              ]
            ]
          }
        };
        
        bot.sendMessage(chatId, confirmMessage, confirmOptions);
      } else if (data === 'confirm_wallet_withdraw') {
        bot.answerCallbackQuery(callbackQuery.id);
        
        try {
          const userData = userStates[chatId];
          if (!userData) {
            bot.sendMessage(chatId, "❌ Withdrawal data not found. Please start again with /withdraw");
            return;
          }
          
          const token = await getUserToken(chatId);
          if (!token) {
            bot.sendMessage(chatId, "⚠️ Authentication error. Please login again with /login");
            return;
          }
          
          bot.sendMessage(chatId, "🔄 Processing your withdrawal...");
          
          // Execute the withdrawal
          const result = await withdrawToWallet(
            token,
            userData.address,
            userData.amount.toString(),
            userData.network
          );
          
          if (result.success && result.data) {
            bot.sendMessage(chatId, 
              `✅ *Withdrawal Initiated!*\n\n` +
              `Amount: ${userData.amount} USDC\n` +
              `To: ${userData.address}\n` +
              `Network: ${userData.network}\n\n` +
              `Transaction ID: \`${result.data.id}\``,
              { parse_mode: 'Markdown' }
            );
            // Clean up stored state
            delete userStates[chatId];
          } else {
            bot.sendMessage(chatId, `❌ Withdrawal failed: ${result.data?.message || 'Unknown error'}`);
          }
        } catch (error) {
          logger.error('Error in wallet withdrawal:', error);
          bot.sendMessage(chatId, "❌ Something went wrong while processing your withdrawal. Please try again later.");
        }
      } else if (data === 'cancel_withdraw') {
        bot.answerCallbackQuery(callbackQuery.id, { text: 'Withdrawal canceled' });
        bot.sendMessage(chatId, "❌ Withdrawal has been canceled.");
        // Clean up stored state
        delete userStates[chatId];
      }
    });
  };
  
  // Set up initial listener
  bot.on('message', addressListener);
}

/**
 * Start conversation flow for withdrawing to a bank account
 * @param bot Telegram bot instance
 * @param chatId Chat ID
 */
async function startBankWithdrawConversation(bot: TelegramBot, chatId: number): Promise<void> {
  // Store user states
  const userStates: Record<number, any> = {};
  
  bot.sendMessage(chatId, "🏦 *Withdraw to Bank Account*\n\nPlease enter the amount in USDC to withdraw:", {
    parse_mode: 'Markdown'
  });

  // Set up listener for amount
  const amountListener = async (msg: TelegramBot.Message) => {
    if (msg.chat.id !== chatId) return;
    
    const amountText = msg.text?.trim();
    if (!amountText || !AMOUNT_REGEX.test(amountText)) {
      bot.sendMessage(chatId, "⚠️ Please enter a valid amount (e.g., 10 or 10.5)");
      return;
    }

    const amount = parseFloat(amountText);
    if (amount <= 0) {
      bot.sendMessage(chatId, "⚠️ Amount must be greater than 0.");
      return;
    }

    // Update state with amount
    userStates[chatId] = { amount };
    bot.removeListener('message', amountListener);
    
    // Show confirmation message
    const confirmMessage = `🏦 *Bank Withdrawal Confirmation*\n\n` +
      `Amount: ${amount} USDC\n\n` +
      `Note: The funds will be sent to your bank account on file.\n\n` +
      `Please confirm this withdrawal:`;
    
    const confirmOptions: TelegramBot.SendMessageOptions = {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Confirm', callback_data: 'confirm_bank_withdraw' },
            { text: '❌ Cancel', callback_data: 'cancel_withdraw' }
          ]
        ]
      }
    };
    
    bot.sendMessage(chatId, confirmMessage, confirmOptions);
    
    // Handle confirmation via callback
    bot.on('callback_query', async (callbackQuery) => {
      if (!callbackQuery.message || callbackQuery.message.chat.id !== chatId) return;
      
      const data = callbackQuery.data;
      if (data === 'confirm_bank_withdraw') {
        bot.answerCallbackQuery(callbackQuery.id);
        
        try {
          const userData = userStates[chatId];
          if (!userData) {
            bot.sendMessage(chatId, "❌ Withdrawal data not found. Please start again with /withdraw");
            return;
          }
          
          const token = await getUserToken(chatId);
          if (!token) {
            bot.sendMessage(chatId, "⚠️ Authentication error. Please login again with /login");
            return;
          }
          
          bot.sendMessage(chatId, "🔄 Processing your bank withdrawal...");
          
          // Execute the bank withdrawal
          // Execute the bank withdrawal
          const result = await withdrawToBank(
            token,
            userData.amount.toString(),
            "" // Default empty bankId parameter
          );
          if (result.success && result.data) {
            bot.sendMessage(chatId, 
              `✅ *Bank Withdrawal Initiated!*\n\n` +
              `Amount: ${userData.amount} USDC\n\n` +
              `Your funds will be transferred to your bank account on file. This process typically takes 1-3 business days.\n\n` +
              `Transaction ID: \`${result.data.id}\``,
              { parse_mode: 'Markdown' }
            );
            // Clean up stored state
            delete userStates[chatId];
          } else {
            bot.sendMessage(chatId, `❌ Bank withdrawal failed: ${result.data?.message || 'Unknown error'}`);
          }
        } catch (error) {
          logger.error('Error in bank withdrawal:', error);
          bot.sendMessage(chatId, "❌ Something went wrong while processing your bank withdrawal. Please try again later.");
        }
      } else if (data === 'cancel_withdraw') {
        bot.answerCallbackQuery(callbackQuery.id, { text: 'Withdrawal canceled' });
        bot.sendMessage(chatId, "❌ Withdrawal has been canceled.");
        // Clean up stored state
        delete userStates[chatId];
      }
    });
  };
  
  // Set up initial listener
  bot.on('message', amountListener);
}

/**
 * Registers all transfer-related commands for the bot
 * @param bot - The Telegram bot instance
 */
export function registerTransferCommands(bot: TelegramBot): void {
  try {
    // Register transfer commands
    bot.onText(/\/send/, (msg) => sendCommand(bot, msg));
    bot.onText(/\/withdraw/, (msg) => withdrawCommand(bot, msg));
    bot.onText(/\/history/, (msg) => historyCommand(bot, msg));
    
    // Log successful registration
    console.log('Transfer commands registered successfully');
  } catch (error) {
    console.error('Error registering transfer commands:', error);
    throw error;
  }
}
