'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { Contact, ViewState, Message, UserProfile } from '@/types';
import { initialContacts, generateBotResponse } from '@/lib/mockData';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, updateDoc, serverTimestamp, addDoc, collection, query, orderBy, where } from 'firebase/firestore';
import { GoogleGenAI } from '@google/genai';

const AI_TRIAL_DURATION_MS = 24 * 60 * 60 * 1000;
const AI_TRIAL_STORAGE_KEY = 'housegram_ai_trial_start';

let aiInstance: GoogleGenAI | null = null;
const getAi = () => {
  if (!aiInstance && process.env.NEXT_PUBLIC_GEMINI_API_KEY) {
    aiInstance = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY });
  }
  return aiInstance;
};

interface ChatContextType {
  view: ViewState;
  setView: (view: ViewState) => void;
  activeChatId: string | null;
  setActiveChatId: (id: string | null) => void;
  contacts: Record<string, Contact>;
  isSideMenuOpen: boolean;
  setSideMenuOpen: (open: boolean) => void;
  sendMessage: (text: string, options?: { audioUrl?: string; fileUrl?: string; fileName?: string }) => void;
  markAsRead: (contactId: string) => void;
  themeColor: string;
  setThemeColor: (color: string) => void;
  wallpaper: string;
  setWallpaper: (url: string) => void;
  isGlassEnabled: boolean;
  setIsGlassEnabled: (enabled: boolean) => void;
  clearHistory: (contactId: string) => void;
  deleteChat: (contactId: string) => void;
  userProfile: UserProfile;
  setUserProfile: (profile: UserProfile) => void;
  blockContact: (contactId: string) => void;
  notificationsEnabled: boolean;
  setNotificationsEnabled: (enabled: boolean) => void;
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  passcode: string | null;
  isLocked: boolean;
  setIsLocked: (locked: boolean) => void;
  updatePasscode: (code: string | null) => void;
  user: User | null;
  isAdmin: boolean;
  isMaintenance: boolean;
  logout: () => void;
  addContact: (contact: Contact) => void;
  improveWithAI: (text: string) => Promise<string>;
  updateMessageText: (contactId: string, messageId: string, newText: string) => Promise<void>;
  aiTrialStart: number | null;
  startAiTrial: () => number;
  isAiTrialActive: () => boolean;
  aiTrialMsLeft: () => number;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider = ({ children }: { children: React.ReactNode }) => {
  const [view, setView] = useState<ViewState>('menu');
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const activeChatIdRef = useRef<string | null>(null);
  const [contacts, setContacts] = useState<Record<string, Contact>>(initialContacts);
  const [isSideMenuOpen, setSideMenuOpen] = useState(false);
  const [themeColor, setThemeColor] = useState('#517da2');
  const [wallpaper, setWallpaper] = useState('');
  const [isGlassEnabled, setIsGlassEnabled] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile>({
    name: 'Ваше Имя',
    username: '@usernamegoeshere',
    bio: 'Add a few words about yourself',
    phone: '+7 9XX XXX XX XX',
  });
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [passcode, setPasscode] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [aiTrialStart, setAiTrialStart] = useState<number | null>(null);

  const settingsRef = useRef({ soundEnabled, notificationsEnabled });

  useEffect(() => {
    settingsRef.current = { soundEnabled, notificationsEnabled };
  }, [soundEnabled, notificationsEnabled]);

  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId]);

  useEffect(() => {
    const savedPasscode = localStorage.getItem('housegram_passcode');
    if (savedPasscode) {
      Promise.resolve().then(() => {
        setPasscode(savedPasscode);
        setIsLocked(true);
      });
    }
    const savedNotif = localStorage.getItem('housegram_notif');
    const savedSound = localStorage.getItem('housegram_sound');
    const savedAiTrial = localStorage.getItem(AI_TRIAL_STORAGE_KEY);
    
    Promise.resolve().then(() => {
      if (savedNotif !== null) setNotificationsEnabled(savedNotif === 'true');
      if (savedSound !== null) setSoundEnabled(savedSound === 'true');
      if (savedAiTrial) {
        const ts = Number(savedAiTrial);
        if (!Number.isNaN(ts)) setAiTrialStart(ts);
      }
    });

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setIsAdmin(currentUser.email === 'veraloktushina1958@gmail.com' || data.role === 'admin');
          setUserProfile({
            name: data.name || 'Ваше Имя',
            username: data.username || '',
            bio: data.bio || '',
            phone: data.phone || '+7 9XX XXX XX XX',
            avatarUrl: data.avatarUrl || '',
            status: 'online',
            lastSeen: data.lastSeen,
            isOfficial: currentUser.email === 'veraloktushina1958@gmail.com' || data.role === 'admin'
          });
          
          // Set online status
          try {
            await updateDoc(doc(db, 'users', currentUser.uid), {
              status: 'online',
              lastSeen: serverTimestamp()
            });
          } catch (e) {
            console.error('Failed to update presence', e);
          }
        } else {
          // Create user document if it doesn't exist
          const rawUsername = currentUser.displayName || currentUser.email?.split('@')[0] || 'User';
          const finalUsername = rawUsername.startsWith('@') ? rawUsername : '@' + rawUsername.replace(/@/g, '');
          
          try {
            await setDoc(doc(db, 'users', currentUser.uid), {
              uid: currentUser.uid,
              email: currentUser.email,
              name: (currentUser.displayName || currentUser.email?.split('@')[0] || 'User').substring(0, 45),
              username: finalUsername.substring(0, 15),
              bio: '',
              role: currentUser.email === 'veraloktushina1958@gmail.com' ? 'admin' : 'user',
              isBanned: false,
              createdAt: serverTimestamp(),
              status: 'online',
              lastSeen: serverTimestamp()
            });
            setIsAdmin(currentUser.email === 'veraloktushina1958@gmail.com');
            setUserProfile({
              name: (currentUser.displayName || currentUser.email?.split('@')[0] || 'User').substring(0, 45),
              username: finalUsername.substring(0, 15),
              bio: '',
              phone: '+7 9XX XXX XX XX',
              avatarUrl: '',
              status: 'online',
              lastSeen: new Date(),
              isOfficial: currentUser.email === 'veraloktushina1958@gmail.com'
            });
          } catch (e) {
            console.error('Failed to create user document', e);
          }
        }
        setView('menu');
      } else {
        setIsAdmin(false);
        setView('auth');
      }
      setAuthReady(true);
    });

    const handleVisibilityChange = async () => {
      if (auth.currentUser) {
        try {
          if (document.visibilityState === 'visible') {
            await updateDoc(doc(db, 'users', auth.currentUser.uid), {
              status: 'online',
              lastSeen: serverTimestamp()
            });
          } else {
            await updateDoc(doc(db, 'users', auth.currentUser.uid), {
              status: 'offline',
              lastSeen: serverTimestamp()
            });
          }
        } catch (e) {
          console.error('Failed to update presence', e);
        }
      }
    };

    const handleBeforeUnload = () => {
      if (auth.currentUser) {
        // Use keepalive fetch or just try to update
        const data = JSON.stringify({
          fields: {
            status: { stringValue: 'offline' },
            lastSeen: { timestampValue: new Date().toISOString() }
          }
        });
        // We can't easily use updateDoc in beforeunload reliably, but we can try
        updateDoc(doc(db, 'users', auth.currentUser.uid), {
          status: 'offline',
          lastSeen: serverTimestamp()
        }).catch(() => {});
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    const unsubscribeSettings = onSnapshot(doc(db, 'settings', 'global'), (doc) => {
      if (doc.exists()) {
        setIsMaintenance(doc.data().maintenanceMode || false);
      }
    });

    return () => {
      unsubscribeAuth();
      unsubscribeSettings();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const logout = useCallback(async () => {
    if (auth.currentUser) {
      try {
        await updateDoc(doc(db, 'users', auth.currentUser.uid), {
          status: 'offline',
          lastSeen: serverTimestamp()
        });
      } catch (e) {
        console.error('Failed to update presence on logout', e);
      }
    }
    await signOut(auth);
    setContacts(initialContacts);
    setView('auth');
  }, []);

  const updatePasscode = useCallback((code: string | null) => {
    setPasscode(code);
    if (code) {
      localStorage.setItem('housegram_passcode', code);
    } else {
      localStorage.removeItem('housegram_passcode');
      setIsLocked(false);
    }
  }, []);

  const playSound = useCallback((type: 'send' | 'receive') => {
    if (!settingsRef.current.soundEnabled) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'send') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.1);
      } else {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.setValueAtTime(1760, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch (e) {
      console.error('Audio play error', e);
    }
  }, []);

  const markAsRead = useCallback((contactId: string) => {
    setContacts(prev => ({
      ...prev,
      [contactId]: { ...prev[contactId], unread: 0 }
    }));
  }, []);

  const clearHistory = useCallback((contactId: string) => {
    setContacts(prev => ({
      ...prev,
      [contactId]: { ...prev[contactId], messages: [] }
    }));
  }, []);

  const deleteChat = useCallback((contactId: string) => {
    setContacts(prev => {
      const newContacts = { ...prev };
      delete newContacts[contactId];
      return newContacts;
    });
    setActiveChatId(null);
    setView('menu');
  }, []);

  const blockContact = useCallback((contactId: string) => {
    setContacts(prev => ({
      ...prev,
      [contactId]: { ...prev[contactId], isBlocked: true }
    }));
  }, []);

  const sendMessage = useCallback(async (text: string, options?: { audioUrl?: string; fileUrl?: string; fileName?: string }) => {
    if (!activeChatId || !auth.currentUser) return;

    const now = serverTimestamp();
    const timeString = `${new Date().getHours().toString().padStart(2, '0')}:${new Date().getMinutes().toString().padStart(2, '0')}`;
    
    const chatId = [auth.currentUser.uid, activeChatId].sort().join('_');

    const newMessage: Omit<Message, 'id'> = {
      type: 'sent',
      text,
      time: timeString,
      status: 'sent',
      senderId: auth.currentUser.uid,
      chatId: chatId,
      createdAt: now,
      ...options,
    };

    try {
      console.log('Sending message to chatId:', chatId, 'newMessage:', newMessage);
      // Ensure chat document exists
      const sortedParticipants = [auth.currentUser.uid, activeChatId].sort();
      await setDoc(doc(db, 'chats', chatId), {
        updatedAt: now,
        participants: sortedParticipants
      }, { merge: true });

      // Add message to Firestore
      await addDoc(collection(db, 'chats', chatId, 'messages'), newMessage);
      
      // Update last message in chat document
      await updateDoc(doc(db, 'chats', chatId), {
        lastMessage: text,
        lastMessageSenderId: auth.currentUser.uid,
        updatedAt: now
      });

      playSound('send');

      // Handle Gemini AI response if chatting with test_bot
      const ai = getAi();
      if (activeChatId === 'test_bot' && ai) {
        try {
          const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: text,
            config: {
              systemInstruction: 'You are HouseGram AI, a helpful and friendly AI assistant integrated into the HouseGram Web messenger. You speak Russian by default unless asked otherwise. Keep your responses concise and conversational.',
            }
          });
          
          if (response.text) {
            const aiNow = serverTimestamp();
            const aiTimeString = `${new Date().getHours().toString().padStart(2, '0')}:${new Date().getMinutes().toString().padStart(2, '0')}`;
            
            const aiMessage: Omit<Message, 'id'> = {
              type: 'received',
              text: response.text,
              time: aiTimeString,
              status: 'sent',
              senderId: 'test_bot',
              chatId: chatId,
              createdAt: aiNow,
            };

            await addDoc(collection(db, 'chats', chatId, 'messages'), aiMessage);
            
            await updateDoc(doc(db, 'chats', chatId), {
              lastMessage: response.text,
              lastMessageSenderId: 'test_bot',
              updatedAt: aiNow
            });
            
            playSound('receive');
          }
        } catch (aiError) {
          console.error('Gemini AI Error:', aiError);
        }
      }
    } catch (e) {
      console.error('Failed to send message', e);
      alert(`Ошибка при отправке сообщения: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [activeChatId, playSound]);

  const addContact = useCallback((contact: Contact) => {
    setContacts(prev => {
      if (prev[contact.id]) return prev;
      return { ...prev, [contact.id]: contact };
    });
  }, []);

  useEffect(() => {
    if (!user) return;

    const chatsRef = collection(db, 'chats');
    const q = query(chatsRef, where('participants', 'array-contains', user.uid));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const newContacts: Record<string, Contact> = {};
      
      for (const docSnapshot of snapshot.docs) {
        const data = docSnapshot.data();
        const otherUserId = data.participants.find((id: string) => id !== user.uid);
        if (!otherUserId) continue;

        const userDoc = await getDoc(doc(db, 'users', otherUserId));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          
          let timeString = '';
          if (data.updatedAt) {
            try {
              const date = data.updatedAt.toDate();
              timeString = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
            } catch (e) {}
          }

          const dummyMessages: Message[] = [];
          if (data.lastMessage) {
            dummyMessages.push({
              id: 'dummy',
              type: data.lastMessageSenderId === user.uid ? 'sent' : 'received',
              text: data.lastMessage,
              time: timeString,
            });
          }

          newContacts[otherUserId] = {
            id: otherUserId,
            name: userData.name || 'User',
            initial: (userData.name || 'U').charAt(0).toUpperCase(),
            avatarColor: '#517da2',
            avatarUrl: userData.avatarUrl || '',
            statusOnline: 'в сети',
            statusOffline: 'был(а) недавно',
            phone: userData.phone || '',
            bio: userData.bio || '',
            username: userData.username || '',
            messages: dummyMessages,
            isTyping: false,
            unread: 0,
            isChannel: false,
            isOfficial: userData.role === 'admin' || userData.email === 'veraloktushina1958@gmail.com'
          };
        }
      }

      setContacts(prev => {
        const updated = { ...prev };
        for (const [id, contact] of Object.entries(newContacts)) {
          if (!updated[id]) {
            updated[id] = contact;
          } else {
            // Update contact info
            updated[id] = {
              ...updated[id],
              name: contact.name,
              avatarUrl: contact.avatarUrl,
              statusOnline: contact.statusOnline,
              statusOffline: contact.statusOffline,
              isOfficial: contact.isOfficial,
            };
            
            // If we have a new last message from the chats collection, and the chat is not currently active
            // (meaning the messages subcollection listener is not running for it), we should update the preview.
            if (contact.messages.length > 0 && id !== activeChatIdRef.current) {
              const newLastMsg = contact.messages[0];
              const currentMessages = updated[id].messages;
              
              if (currentMessages.length === 0 || currentMessages[currentMessages.length - 1].text !== newLastMsg.text || currentMessages[currentMessages.length - 1].time !== newLastMsg.time) {
                // Replace or append the dummy message to update the chat list preview
                updated[id].messages = [...currentMessages.filter(m => m.id !== 'dummy'), newLastMsg];
              }
            } else if (updated[id].messages.length === 0) {
              updated[id].messages = contact.messages;
            }
          }
        }
        return updated;
      });
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!activeChatId || !user) return;

    const chatId = [user.uid, activeChatId].sort().join('_');
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
      const messages: Message[] = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          type: data.senderId === user.uid ? 'sent' : 'received',
          status: doc.metadata.hasPendingWrites ? 'sending' : (data.status === 'sending' ? 'sent' : data.status),
        } as Message;
      });

      setContacts(prev => {
        const contact = prev[activeChatId];
        if (!contact) return prev;
        
        return {
          ...prev,
          [activeChatId]: {
            ...contact,
            messages: messages,
          }
        };
      });
    });

    return () => unsubscribe();
  }, [activeChatId, user]);

  const startAiTrial = useCallback(() => {
    const now = Date.now();
    setAiTrialStart(now);
    localStorage.setItem(AI_TRIAL_STORAGE_KEY, String(now));
    return now;
  }, []);

  const aiTrialMsLeft = useCallback(() => {
    if (!aiTrialStart) return AI_TRIAL_DURATION_MS;
    return Math.max(0, AI_TRIAL_DURATION_MS - (Date.now() - aiTrialStart));
  }, [aiTrialStart]);

  const isAiTrialActive = useCallback(() => {
    if (!aiTrialStart) return true;
    return Date.now() - aiTrialStart < AI_TRIAL_DURATION_MS;
  }, [aiTrialStart]);

  const improveWithAI = useCallback(async (text: string): Promise<string> => {
    const trimmed = text.trim();
    if (!trimmed) return text;
    const ai = getAi();
    if (!ai) {
      throw new Error('AI недоступен: не настроен NEXT_PUBLIC_GEMINI_API_KEY.');
    }
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: trimmed,
      config: {
        systemInstruction:
          'Ты — редактор-корректор в мессенджере HouseGram. Получаешь черновик сообщения и возвращаешь улучшенную версию: исправляешь грамматику, орфографию и пунктуацию, делаешь формулировку более ясной и естественной, сохраняешь исходный язык, тон и эмодзи. Никогда не добавляй пояснений, кавычек или префиксов вроде «Исправлено:» — отвечай только готовым текстом сообщения.',
        temperature: 0.4,
      },
    });
    const improved = (response.text || '').trim();
    if (!improved) throw new Error('AI вернул пустой ответ');
    return improved.replace(/^["«]+|["»]+$/g, '');
  }, []);

  const updateMessageText = useCallback(async (contactId: string, messageId: string, newText: string) => {
    if (!auth.currentUser) return;
    const chatId = [auth.currentUser.uid, contactId].sort().join('_');
    await updateDoc(doc(db, 'chats', chatId, 'messages', messageId), {
      text: newText,
      editedAt: serverTimestamp(),
    });
    const chatDocRef = doc(db, 'chats', chatId);
    const chatSnap = await getDoc(chatDocRef);
    if (chatSnap.exists() && chatSnap.data().lastMessageSenderId === auth.currentUser.uid) {
      await updateDoc(chatDocRef, { lastMessage: newText });
    }
  }, []);

  const updateUserProfile = useCallback(async (profile: UserProfile) => {
    setUserProfile(profile);
    if (auth.currentUser) {
      try {
        await setDoc(doc(db, 'users', auth.currentUser.uid), {
          name: profile.name || 'User',
          username: profile.username || '',
          bio: profile.bio || '',
          phone: profile.phone || '',
          avatarUrl: profile.avatarUrl || ''
        }, { merge: true });
      } catch (e: any) {
        console.error('Failed to update profile in Firestore', e);
        alert('Ошибка при сохранении профиля: ' + e.message);
      }
    }
  }, []);

  return (
    <ChatContext.Provider value={{
      view, setView,
      activeChatId, setActiveChatId,
      contacts,
      isSideMenuOpen, setSideMenuOpen,
      sendMessage, markAsRead,
      themeColor, setThemeColor,
      wallpaper, setWallpaper,
      isGlassEnabled, setIsGlassEnabled,
      clearHistory, deleteChat,
      userProfile, setUserProfile: updateUserProfile,
      blockContact, addContact,
      notificationsEnabled, setNotificationsEnabled: (val: boolean) => { setNotificationsEnabled(val); localStorage.setItem('housegram_notif', String(val)); },
      soundEnabled, setSoundEnabled: (val: boolean) => { setSoundEnabled(val); localStorage.setItem('housegram_sound', String(val)); },
      passcode, isLocked, setIsLocked, updatePasscode,
      user, isAdmin, isMaintenance, logout,
      improveWithAI, updateMessageText,
      aiTrialStart, startAiTrial, isAiTrialActive, aiTrialMsLeft
    }}>
      {!authReady ? (
        <div className="absolute inset-0 flex items-center justify-center bg-white z-50">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : isMaintenance && !isAdmin ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white z-50 p-6 text-center">
          <div className="text-6xl mb-4">🛠️</div>
          <h2 className="text-2xl font-bold mb-2">Технические работы</h2>
          <p className="text-gray-600">Мы обновляем приложение. Пожалуйста, зайдите позже.</p>
        </div>
      ) : children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) throw new Error('useChat must be used within ChatProvider');
  return context;
};
