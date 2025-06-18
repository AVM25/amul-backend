import axios from 'axios';
import { IProduct } from '@/types';
import TelegramBot from 'node-telegram-bot-api';
import { Product } from '@/models/Product';
import { Subscription } from '@/models/Subscription';
import dotenv from 'dotenv';

dotenv.config();

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN || '', { polling: true });

// Mapping Telegram usernames to chat IDs
const telegramUserMap = new Map<string, number>();

// Map new messages to usernames
bot.on('message', (msg) => {
  const username = msg.from?.username;
  const chatId = msg.chat.id;

  if (username) {
    telegramUserMap.set(username, chatId);
    console.log(`🔗 Mapped @${username} to chat ID ${chatId}`);
  }
});

// Your existing bot command handlers continue unchanged below...

// Export bot and user map
export { bot, telegramUserMap };

// If you use the TelegramService class elsewhere, be sure to update it to use telegramUserMap instead of maintaining its own map.
