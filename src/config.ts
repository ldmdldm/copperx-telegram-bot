/**
 * Application configuration
 */
export const config = {
  // API endpoints
  api: {
    baseUrl: process.env.API_BASE_URL || 'https://income-api.copperx.io/api',
    endpoints: {
      // Auth endpoints
      emailOtpRequest: '/auth/email-otp/request',
      emailOtpAuthenticate: '/auth/email-otp/authenticate',
      me: '/auth/me',
      
      // KYC endpoints
      kycs: '/kycs',
      
      // Wallet endpoints
      wallets: '/wallets',
      balances: '/wallets/balances',
      defaultWallet: '/wallets/default',
      
      // Transfer endpoints
      transfers: '/transfers',
      sendTransfer: '/transfers/send',
      walletWithdraw: '/transfers/wallet-withdraw',
      bankWithdraw: '/transfers/offramp',
      batchTransfer: '/transfers/send-batch',
      
      // Notification endpoints
      notificationsAuth: '/notifications/auth'
    }
  },
  
  // Pusher configuration
  pusher: {
    key: process.env.PUSHER_KEY || 'e089376087cac1a62785',
    cluster: process.env.PUSHER_CLUSTER || 'ap1'
  }
};

// Export API URL for use in services
export const COPPERX_API_URL = config.api.baseUrl;
export const API_BASE_URL = COPPERX_API_URL;
