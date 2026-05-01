'use client';

import { useChat } from '@/context/ChatContext';
import { motion } from 'motion/react';
import { ArrowLeft, Shield, MessageSquare, Zap, Sparkles } from 'lucide-react';

export default function FeaturesView() {
  const { setView, themeColor } = useChat();

  return (
    <motion.div 
      initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="absolute inset-0 bg-white flex flex-col z-20"
    >
      <div 
        className="text-white px-2.5 h-14 flex items-center gap-4 shrink-0 relative z-30"
        style={{ backgroundColor: themeColor }}
      >
        <button onClick={() => setView('menu')} className="p-1.5 rounded-full hover:bg-white/10 transition-colors">
          <ArrowLeft size={24} />
        </button>
        <div className="flex-grow text-[18px] font-medium">Возможности HouseGram</div>
      </div>

      <div className="flex-grow overflow-y-auto p-4 space-y-6">
        <div className="text-center py-4">
          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Zap size={40} className="text-blue-500" />
          </div>
          <h2 className="text-xl font-medium text-black mb-2">Демонстрация функций</h2>
          <p className="text-gray-500 text-sm">Посмотрите, как работает HouseGram на реальных примерах</p>
        </div>

        <div className="bg-gradient-to-br from-violet-50 to-fuchsia-50 rounded-xl p-4 border border-violet-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-lg text-white">
              <Sparkles size={20} />
            </div>
            <h3 className="font-medium text-black">AI исправление сообщений</h3>
            <span className="ml-auto text-[11px] font-semibold text-violet-600 bg-white px-2 py-0.5 rounded-full border border-violet-200">
              1 день бесплатно
            </span>
          </div>
          <p className="text-sm text-gray-700 mb-4">
            Нажмите на иконку волшебной палочки рядом с полем ввода — и AI исправит грамматику, орфографию и сделает текст естественнее. Также можно тапнуть по своему отправленному сообщению, чтобы исправить уже опубликованный текст.
          </p>
          <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100">
            <div className="flex flex-col gap-2">
              <div className="bg-gray-100 text-gray-500 line-through rounded-2xl rounded-tr-sm px-3 py-2 text-sm self-end max-w-[80%]">
                привет как дилаа в выходные пойдём в кино?
              </div>
              <div className="self-end text-[11px] text-violet-500 flex items-center gap-1">
                <Sparkles size={12} /> AI исправил
              </div>
              <div className="bg-violet-50 text-violet-900 rounded-2xl rounded-tr-sm px-3 py-2 text-sm self-end max-w-[80%] border border-violet-100">
                Привет! Как дела? В выходные пойдём в кино?
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-green-100 rounded-lg text-green-600">
              <MessageSquare size={20} />
            </div>
            <h3 className="font-medium text-black">Умный чат-бот</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Наш бот умеет поддерживать беседу, отвечать на вопросы и имитировать реальное общение с задержками и статусом &quot;печатает...&quot;.
          </p>
          <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100">
            <div className="flex flex-col gap-2">
              <div className="bg-blue-50 text-blue-900 rounded-2xl rounded-tr-sm px-3 py-2 text-sm self-end max-w-[80%]">
                Привет! Как дела?
              </div>
              <div className="bg-gray-100 text-gray-800 rounded-2xl rounded-tl-sm px-3 py-2 text-sm self-start max-w-[80%]">
                Здравствуйте! Я бот HouseGram. У меня всё отлично, готов помочь вам протестировать функционал! 🚀
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-red-100 rounded-lg text-red-600">
              <Shield size={20} />
            </div>
            <h3 className="font-medium text-black">Защита от спама</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Вы можете легко заблокировать подозрительные контакты. После блокировки они не смогут отправлять вам сообщения.
          </p>
          <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100">
            <div className="flex flex-col gap-2">
              <div className="bg-gray-100 text-gray-800 rounded-2xl rounded-tl-sm px-3 py-2 text-sm self-start max-w-[80%]">
                Вы выиграли 1000000$! Перейдите по ссылке...
              </div>
              <div className="flex items-center justify-center py-2">
                <span className="text-xs text-red-500 bg-red-50 px-2 py-1 rounded-full border border-red-100">
                  Пользователь заблокирован
                </span>
              </div>
              <div className="bg-gray-50 text-gray-400 rounded-2xl rounded-tr-sm px-3 py-2 text-sm self-end max-w-[80%] border border-gray-200">
                Сообщение не отправлено
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
