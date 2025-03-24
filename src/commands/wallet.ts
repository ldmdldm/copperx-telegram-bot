import TelegramBot from 'node-telegram-bot-api';
import { 
  getWallets, 
  getWalletBalances, 
  setDefaultWallet, 
  formatWalletBalance,
  Wallet,
  WalletBalance
} from '../services/wallet';
import { isAuthenticated } from '../services/auth';

// Command handlers
export const balanceCommand = async (bot: TelegramBot, msg: TelegramBot.Message): Promise<void> => {
  const chatId = msg.chat.id;
  
  if (!isAuthenticated(chatId)) {
    await bot.sendMessage(
      chatId, 
      'You need to be logged in to view your wallet balances. Use /login to authenticate.',
      { parse_mode: 'Markdown' }
    );
    return;
  }
  
  try {
    await bot.sendMessage(chatId, 'Fetching your wallet balances, please wait...');
    
    // Get wallet balances
    const balances = await getWalletBalances(chatId);
    
    if (!balances || balances.length === 0) {
      await bot.sendMessage(
        chatId,
        'You don\'t have any wallets yet. Please contact support for assistance.',
        { parse_mode: 'Markdown' }
      );
      return;
    }
    
    // Format balances for display
    const balanceMessages = balances.map(formatWalletBalance);
    
    const message = `
*Your Wallet Balances*

${balanceMessages.join('\n')}

Use /wallets to see all your wallets.
Use /setdefaultwallet to change your default wallet.
`;
    
    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    
  } catch (error) {
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Unknown error occurred';
    await bot.sendMessage(chatId, `Error fetching wallet balances: ${errorMessage}`);
  }
};

export const walletsCommand = async (bot: TelegramBot, msg: TelegramBot.Message): Promise<void> => {
  const chatId = msg.chat.id;
  
  if (!isAuthenticated(chatId)) {
    await bot.sendMessage(
      chatId, 
      'You need to be logged in to view your wallets. Use /login to authenticate.',
      { parse_mode: 'Markdown' }
    );
    return;
  }
  
  try {
    await bot.sendMessage(chatId, 'Fetching your wallets, please wait...');
    
    // Get wallets
    const wallets = await getWallets(chatId);
    
    if (!wallets || wallets.length === 0) {
      await bot.sendMessage(
        chatId,
        'You don\'t have any wallets yet. Please contact support for assistance.',
        { parse_mode: 'Markdown' }
      );
      return;
    }
    
    // Format wallets for display
    const walletMessages = wallets.map((wallet: Wallet) => 
      `${wallet.name} (${wallet.network}):\n` +
      `Address: \`${wallet.address}\`\n` +
      `${wallet.isDefault ? '✅ Default Wallet' : ''}`
    );
    
    const message = `
*Your Wallets*

${walletMessages.join('\n\n')}

Use /balance to check your balances.
Use /setdefaultwallet to change your default wallet.
`;
    
    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    
  } catch (error) {
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Unknown error occurred';
    await bot.sendMessage(chatId, `Error fetching wallets: ${errorMessage}`);
  }
};

// State management for default wallet selection
interface DefaultWalletState {
  awaitingSelection: boolean;
  wallets?: Wallet[];
}

const defaultWalletStates = new Map<number, DefaultWalletState>();

export const setDefaultWalletCommand = async (bot: TelegramBot, msg: TelegramBot.Message): Promise<void> => {
  const chatId = msg.chat.id;
  
  if (!isAuthenticated(chatId)) {
    await bot.sendMessage(
      chatId, 
      'You need to be logged in to set a default wallet. Use /login to authenticate.',
      { parse_mode: 'Markdown' }
    );
    return;
  }
  
  try {
    await bot.sendMessage(chatId, 'Fetching your wallets, please wait...');
    
    // Get wallets
    const wallets = await getWallets(chatId);
    
    if (!wallets || wallets.length === 0) {
      await bot.sendMessage(
        chatId,
        'You don\'t have any wallets to set as default. Please contact support for assistance.',
        { parse_mode: 'Markdown' }
      );
      return;
    }
    
    // Initialize selection state
    defaultWalletStates.set(chatId, { awaitingSelection: true, wallets });
    
    // Create keyboard for wallet selection
    const keyboard = wallets.map((wallet, index) => [{
      text: `${wallet.name} (${wallet.network})${wallet.isDefault ? ' ✅' : ''}`,
      callback_data: `default_wallet:${wallet.id}`
    }]);
    
    await bot.sendMessage(
      chatId,
      'Please select the wallet you want to set as default:',
      {
        reply_markup: {
          inline_keyboard: keyboard
        }
      }
    );
    
    // Set up callback query handler for the selection
    bot.on('callback_query', async (callbackQuery) => {
      if (!callbackQuery.data?.startsWith('default_wallet:')) return;
      
      // Ensure this is for the right chat
      if (callbackQuery.message?.chat.id !== chatId) return;
      
      const state = defaultWalletStates.get(chatId);
      if (!state || !state.awaitingSelection) return;
      
      // Extract wallet ID from callback data
      const walletId = callbackQuery.data.split(':')[1];
      
      try {
        await bot.answerCallbackQuery(callbackQuery.id, { text: 'Processing your selection...' });
        
        // Set default wallet
        const updatedWallet = await setDefaultWallet(chatId, walletId);
        
        // Clear selection state
        defaultWalletStates.delete(chatId);
        
        await bot.sendMessage(
          chatId,
          `✅ Your default wallet has been updated to: ${updatedWallet.name} (${updatedWallet.network})`,
          { parse_mode: 'Markdown' }
        );
        
        // Remove the inline keyboard
        await bot.editMessageReplyMarkup(
          { inline_keyboard: [] },
          {
            chat_id: chatId,
            message_id: callbackQuery.message?.message_id
          }
        );
        
      } catch (error) {
        const errorMessage = error instanceof Error 
          ? error.message 
          : 'Unknown error occurred';
        await bot.sendMessage(chatId, `Error setting default wallet: ${errorMessage}`);
      }
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Unknown error occurred';
    await bot.sendMessage(chatId, `Error fetching wallets: ${errorMessage}`);
  }
};

/**
 * Registers all wallet-related commands for the bot
 * @param bot - The Telegram bot instance
 */
export function registerWalletCommands(bot: TelegramBot): void {
  try {
    // Register wallet commands
    bot.onText(/\/balance/, (msg) => balanceCommand(bot, msg));
    bot.onText(/\/wallets/, (msg) => walletsCommand(bot, msg));
    bot.onText(/\/setdefaultwallet/, (msg) => setDefaultWalletCommand(bot, msg));
    
    // Log successful registration
    console.log('Wallet commands registered successfully');
  } catch (error) {
    if (error instanceof Error) {
      console.error('Error registering wallet commands:', error.message);
    } else {
      console.error('Error registering wallet commands:', error);
    }
    throw error;
  }
}
