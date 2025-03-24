# 🤖 CopperX Telegram Bot

<div align="center">
  <img src="https://via.placeholder.com/200x200.png?text=CopperX+Bot" alt="CopperX Telegram Bot Logo" width="200" height="200">
  
  <h3>Your Crypto Companion in Telegram</h3>
  
  <p>
    <a href="https://t.me/copperxp_bot"><img src="https://img.shields.io/badge/Telegram-@copperxp__bot-blue?logo=telegram" alt="Telegram Bot"></a>
    <a href="https://github.com/ldmdldm/copperx-telegram-bot/releases"><img src="https://img.shields.io/github/v/release/ldmdldm/copperx-telegram-bot?include_prereleases" alt="Version"></a>
    <a href="https://github.com/ldmdldm/copperx-telegram-bot/blob/master/LICENSE"><img src="https://img.shields.io/github/license/ldmdldm/copperx-telegram-bot" alt="License"></a>
  </p>
</div>

## ✨ Overview

The CopperX Telegram Bot extends the CopperX ecosystem to Telegram, giving users access to their cryptocurrency wallets and financial services directly from their favorite messaging platform. If you want to check balances, make transfers or manage your account, the CopperX bot provides a convenient interface for all your crypto needs.

## 🚀 Features

### 💳 Wallet Management
- **View Balances** - Check your cryptocurrency balances instantly
- **Transaction History** - Review your recent transactions
- **Wallet Details** - Get detailed information about your wallet

### 💸 Money Transfers
- **Send Crypto** - Transfer funds to other CopperX users or external wallets
- **QR Code Payments** - Generate and scan QR codes for quick transfers
- **Transaction Confirmation** - Verify transaction details before sending

### 🔒 Secure Authentication
- **Safe Login** - Securely authenticate with your CopperX account
- **Session Management** - Control active sessions and stay secure
- **Authorization** - Approve transactions with secure verification

### 📊 Real-Time Updates
- **Price Alerts** - Get notified about significant price movements
- **Transaction Notifications** - Receive instant alerts for wallet activity
- **Custom Alerts** - Set your own criteria for notifications

## 🌐 The CopperX Ecosystem Integration

This Telegram bot is a key component of the CopperX ecosystem, extending its functionality to where users spend much of their digital time. Benefits include:

- **Accessibility** - Access your crypto wallet without switching apps
- **Experience** - Perform transactions with simple text commands
- **Reach** - Engage with crypto services through a familiar platform
- **Community** - Share and interact with the CopperX community
- **Notifications** - Stay updated with real-time information

## 🧩 Commands

| Command | Description |
|---------|-------------|
| `/start` | Begin interaction with the bot |
| `/login` | Authenticate with your CopperX account |
| `/wallet` | View your wallet details and balances |
| `/transfer` | Initiate a cryptocurrency transfer |
| `/history` | View your transaction history |
| `/help` | Display available commands and assistance |
| `/logout` | Log out of your account |

## 🛠️ Setup and Installation

### Prerequisites
- Node.js (v16 or later)
- npm or yarn
- Telegram account
- CopperX account

### Local Development
1. Clone the repository:
   ```bash
   git clone https://github.com/ldmdldm/copperx-telegram-bot.git
   cd copperx-telegram-bot
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory with the following variables:
   ```
   TELEGRAM_BOT_TOKEN=your_telegram_bot_token
   COPPERX_API_URL=https://income-api.copperx.io/api
   REDIS_URL=redis://localhost:6379
   PUSHER_KEY=your_pusher_key
   PUSHER_CLUSTER=ap1
   SESSION_SECRET=your_session_secret
   TOKEN_EXPIRY=86400
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

### Deployment
The bot is deployed on Heroku with the following configuration:

1. Add the Heroku Redis add-on:
   ```bash
   heroku addons:create heroku-redis -a copperx-telegram-bot
   ```

2. Set the required environment variables:
   ```bash
   heroku config:set TELEGRAM_BOT_TOKEN=your_telegram_bot_token -a copperx-telegram-bot
   heroku config:set NODE_ENV=production -a copperx-telegram-bot
   # Set other environment variables as needed
   ```

3. Deploy to Heroku:
   ```bash
   git push heroku master
   ```

4. Scale the worker dyno:
   ```bash
   heroku ps:scale worker=1 web=0 -a copperx-telegram-bot
   ```

## 🔄 How It Works

1. **Authentication**: Users authenticate via secure OAuth flow
2. **Interaction**: Command-based interface for all operations
3. **Processing**: Requests are processed through the CopperX API
4. **Notification**: Real-time updates via Pusher integration
5. **Security**: All data is encrypted and sessions are securely managed

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 🙏 Acknowledgements

- [node-telegram-bot-api](https://github.com/yagop/node-telegram-bot-api) - Telegram Bot API for Node.js
- The CopperX team for their support and API
- All contributors who have helped shape this project

---

<div align="center">
  <p>We enjoyed building this one for CopperX team!</p>
  <p>
    <a href="https://copperx.io">Website</a> •
    <a href="https://t.me/copperxcommunity">Telegram Community</a> •
    <a href="https://twitter.com/copperx_io">Twitter</a>
  </p>
</div>

