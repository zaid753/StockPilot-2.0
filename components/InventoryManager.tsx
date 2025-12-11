
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { LiveServerMessage, Blob as GenaiBlob, FunctionCall, Modality } from '@google/genai';
import { INITIATE_ADD_ITEM_TOOL, PROVIDE_ITEM_QUANTITY_TOOL, PROVIDE_ITEM_PRICE_TOOL, REMOVE_ITEM_TOOL, QUERY_INVENTORY_TOOL, PROVIDE_ITEM_EXPIRY_DATE_TOOL, BULK_ACTION_TOOL, UPDATE_ITEM_TOOL, PLAN_LIMITS } from '../constants';
import { useAuth } from '../hooks/useAuth';
import { useInventory } from '../hooks/useInventory';
import InventoryTable from './InventoryTable';
import MicButton from './MicButton';
import CameraCapture from './CameraCapture';
import EditItemModal from './EditItemModal';
import AddItemModal from './AddItemModal';
import BusinessPilot from './BusinessPilot';
import SubscriptionModal from './SubscriptionModal';
import AnalyticsDashboard from './AnalyticsDashboard';
import InvoiceModal from './InvoiceModal';
import CreateInvoiceModal from './CreateInvoiceModal'; 
import { encode, decode, decodeAudioData } from '../utils/audioUtils';
import { getAi, setDynamicApiKey } from '../services/geminiService';
import { getSiteConfig } from '../services/siteConfigService';
import { addOrUpdateItem, removeItem, updateInventoryItem, deleteItemsBatch, saveShelfAnalysis, getShelfAnalyses, findItemByName, logSale } from '../services/inventoryService';
import { uploadImageToImgbb } from '../services/imageService';
import { getChatsStream } from '../services/chatService';
import { getNotificationsStream } from '../services/notificationService';
import { incrementUserUsage } from '../services/firebase';
import { LogoutIcon, SearchIcon, ChatIcon, BellIcon, CameraIcon, XMarkIcon, DocumentTextIcon, PresentationChartLineIcon, PlusIcon, ChartBarIcon, ReceiptIcon, DocumentPlusIcon } from './icons';
import { InventoryItem, Chat, Notification, ShelfAnalysis } from '../types';
import { ChatParams } from '../App';
import ChatListModal from './ChatListModal';
import Toast from './Toast';
import { Timestamp } from 'firebase/firestore';
import AudioVisualizer from './AudioVisualizer';

interface InventoryManagerProps {
    onNavigateToChat: (params: ChatParams) => void;
    onOpenNotifications: () => void;
    onViewAnalysis: (analysisId: string) => void;
}

interface DetectedItem {
    name: string;
    quantity: number;
    price: number;
    expiryDate: string;
}

const InventoryManager: React.FC<InventoryManagerProps> = ({ onNavigateToChat, onOpenNotifications, onViewAnalysis }) => {
    const { user, userProfile, logOut, updateUserProfileState } = useAuth();
    const { inventory, loading: inventoryLoading } = useInventory();
    
    const [isListening, setIsListening] = useState(false);
    const [isGreeting, setIsGreeting] = useState(false);
    const [statusText, setStatusText] = useState("Tap the mic to manage your stock, or use the camera.");
    const [searchTerm, setSearchTerm] = useState('');
    const [isChatModalOpen, setIsChatModalOpen] = useState(false);
    const [totalUnreadChatCount, setTotalUnreadChatCount] = useState(0);
    const [totalUnreadNotificationCount, setTotalUnreadNotificationCount] = useState(0);
    
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [cameraMode, setCameraMode] = useState<'item' | 'invoice' | 'shelf-analysis'>('item');
    
    const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    
    const [reviewItems, setReviewItems] = useState<DetectedItem[]>([]);
    const [isReviewingInvoice, setIsReviewingInvoice] = useState(false); 
    const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
    const [showAddItemModal, setShowAddItemModal] = useState(false);

    // New Features State
    const [showAnalytics, setShowAnalytics] = useState(false);
    const [showInvoice, setShowInvoice] = useState(false);
    const [showCreateInvoice, setShowCreateInvoice] = useState(false); 
    const [salesBucket, setSalesBucket] = useState<{item: InventoryItem, soldQty: number}[]>([]);

    // History State
    const [showAnalysisHistory, setShowAnalysisHistory] = useState(false);
    const [analysisHistory, setAnalysisHistory] = useState<ShelfAnalysis[]>([]);
    
    const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
    const [bulkPromoContent, setBulkPromoContent] = useState<string | null>(null);
    const [isGeneratingBulkPromo, setIsGeneratingBulkPromo] = useState(false);

    const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);

    // State to hold the active stream for visualization
    const [activeStream, setActiveStream] = useState<MediaStream | null>(null);

    const selectedItemIdsRef = useRef<Set<string>>(new Set());
    const inventoryRef = useRef<InventoryItem[]>([]);

    useEffect(() => {
        selectedItemIdsRef.current = selectedItemIds;
    }, [selectedItemIds]);

    useEffect(() => {
        inventoryRef.current = inventory;
    }, [inventory]);

    // Load dynamic API key on mount to ensure hot-swap persistence
    useEffect(() => {
        const loadApiKey = async () => {
            try {
                const config = await getSiteConfig();
                if (config.apiConfig?.geminiApiKey) {
                    setDynamicApiKey(config.apiConfig.geminiApiKey);
                }
            } catch (e) {
                console.error("Failed to load dynamic API config", e);
            }
        };
        loadApiKey();
    }, []);

    const [transcript, setTranscript] = useState<{ speaker: 'user' | 'assistant', text: string }[]>([]);
    const transcriptContainerRef = useRef<HTMLDivElement>(null);

    const awaitingPriceInfoRef = useRef<any | null>(null);
    const awaitingQuantityInfoRef = useRef<any | null>(null);
    const awaitingExpiryInfoRef = useRef<any | null>(null);

    const sessionRef = useRef<Promise<any> | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const isSessionActiveRef = useRef(false);
    const audioPlaybackTimeRef = useRef(0);
    const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    const greetingAudioSourceRef = useRef<AudioBufferSourceNode | null>(null);
    
    useEffect(() => {
        if (!user) return;
        const unsubChats = getChatsStream(user.uid, (chats: Chat[]) => {
            const unreadSum = chats.reduce((sum, chat) => sum + (chat.unreadCount[user.uid] || 0), 0);
            setTotalUnreadChatCount(unreadSum);
        });
        const unsubNotifications = getNotificationsStream(user.uid, (notifications: Notification[]) => {
            const unreadSum = notifications.filter(n => !n.read).length;
            setTotalUnreadNotificationCount(unreadSum);
        });
        return () => {
            unsubChats();
            unsubNotifications();
        };
    }, [user]);

    useEffect(() => {
        const container = transcriptContainerRef.current;
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    }, [transcript]);

    useEffect(() => {
        if (showAnalysisHistory && user) {
            getShelfAnalyses(user.uid).then(setAnalysisHistory);
        }
    }, [showAnalysisHistory, user]);

    const checkUsageLimit = (feature: 'aiScans' | 'promosGenerated' | 'inventoryCount', currentCount: number): boolean => {
        if (!userProfile) return false;
        if (userProfile.plan === 'pro') return true; 
        const limit = PLAN_LIMITS.free[feature === 'inventoryCount' ? 'maxInventoryItems' : feature === 'aiScans' ? 'maxAiScans' : 'maxPromos'];
        if (currentCount >= limit) {
            setShowSubscriptionModal(true);
            return false;
        }
        return true;
    };

    const handleIncrementUsage = async (feature: 'aiScans' | 'promosGenerated') => {
        if (!user || !userProfile) return;
        const newCount = (userProfile.usage?.[feature] || 0) + 1;
        updateUserProfileState({ usage: { ...userProfile.usage, [feature]: newCount } });
        await incrementUserUsage(user.uid, feature);
    };

    const handlePushUp = async (item: InventoryItem) => {
        if (!user) return;
        await addOrUpdateItem(user.uid, item.name, 1, item.price, undefined, item.costPrice);
        setToastMessage(`Added 1 unit to ${item.name}`);
    };

    const handlePushDown = async (item: InventoryItem) => {
        if (!user) return;
        const result = await removeItem(user.uid, item.name, 1);
        if (result.success) {
            setSalesBucket(prev => {
                const existing = prev.find(i => i.item.id === item.id);
                if (existing) {
                    return prev.map(i => i.item.id === item.id ? { ...i, soldQty: i.soldQty + 1 } : i);
                }
                return [...prev, { item, soldQty: 1 }];
            });
            setToastMessage(`Sold 1 unit of ${item.name}`);
        } else {
            setToastMessage(result.message);
        }
    };

    const handleToolCall = useCallback(async (fc: FunctionCall, session: any): Promise<void> => {
        if (!user || !userProfile || !fc.args) return;
        let result: any = { success: false, message: "Sorry, I couldn't do that." };
        const userCategories = userProfile.categories || [];
        
        const args = fc.args as any;

        switch (fc.name) {
            case 'initiateAddItem': {
                const { itemName, quantity } = args;
                if (quantity) {
                    awaitingPriceInfoRef.current = { itemName, quantity };
                    result = { success: true, message: `Okay, adding ${quantity} ${itemName}. What is the Buying Cost Price (CP) and Selling Price (SP)?` };
                } else {
                    awaitingQuantityInfoRef.current = { itemName };
                    result = { success: true, message: `Okay, you want to add ${itemName}. How many?` };
                }
                break;
            }
            case 'provideItemQuantity': {
                if (awaitingQuantityInfoRef.current) {
                    const { itemName } = awaitingQuantityInfoRef.current;
                    const { quantity } = args;
                    awaitingPriceInfoRef.current = { itemName, quantity };
                    awaitingQuantityInfoRef.current = null;
                    result = { success: true, message: `Got it, ${quantity}. What is the Buying Cost Price (CP) and Selling Price (SP)?` };
                } else {
                    result = { success: false, message: "I'm sorry, I don't know which item you're providing the quantity for." };
                }
                break;
            }
            case 'provideItemPrice': {
                if (awaitingPriceInfoRef.current) {
                    const { itemName, quantity } = awaitingPriceInfoRef.current;
                    const { price, costPrice } = args;
                    
                    if (price === undefined) {
                         result = { success: false, message: "I need at least the Selling Price." };
                         break;
                    }

                    awaitingPriceInfoRef.current = null;
                    const needsExpiry = userCategories.some(cat => ['medical', 'grocery', 'sweets'].includes(cat));
                    
                    if (!checkUsageLimit('inventoryCount', inventoryRef.current.length)) {
                         result = { success: false, message: "Inventory limit reached. Upgrade to add more items." };
                    } else {
                        if (needsExpiry) {
                            awaitingExpiryInfoRef.current = { itemName, quantity, price, costPrice: costPrice || 0 };
                            result = { success: true, message: `Prices set. What is the expiry date? (DD-MM-YYYY)` };
                        } else {
                            await addOrUpdateItem(user.uid, itemName, quantity, price, undefined, costPrice);
                            result = { success: true, message: `Great, added ${quantity} ${itemName}. Cost: ${costPrice || 0}, Sell: ${price}` };
                        }
                    }
                } else {
                    result = { success: false, message: "I don't know which item you're providing the price for." };
                }
                break;
            }
            case 'provideItemExpiryDate': {
                 if (awaitingExpiryInfoRef.current) {
                    const { itemName, quantity, price, costPrice } = awaitingExpiryInfoRef.current;
                    const { expiryDate } = args;
                    if (!/^\d{2}-\d{2}-\d{4}$/.test(expiryDate)) {
                        result = { success: false, message: "Please provide the date in Day-Month-Year format." };
                    } else {
                        if (!checkUsageLimit('inventoryCount', inventoryRef.current.length)) {
                            result = { success: false, message: "Inventory limit reached." };
                        } else {
                            await addOrUpdateItem(user.uid, itemName, quantity, price, expiryDate, costPrice);
                            result = { success: true, message: `Added ${itemName} with expiry ${expiryDate}.` };
                            awaitingExpiryInfoRef.current = null;
                        }
                    }
                } else {
                    result = { success: false, message: "I don't know which item needs an expiry." };
                }
                break;
            }
            case 'updateItem': {
                const { itemName, newPrice, newQuantity, newCostPrice } = args;
                const foundItem = await findItemByName(user.uid, itemName);
                if (!foundItem) {
                     result = { success: false, message: `I couldn't find ${itemName} in your inventory to update.` };
                } else {
                     const updates: Partial<InventoryItem> = {};
                     if (newPrice !== undefined) updates.price = newPrice;
                     if (newCostPrice !== undefined) updates.costPrice = newCostPrice;
                     if (newQuantity !== undefined) updates.quantity = newQuantity;
                     
                     if (Object.keys(updates).length > 0) {
                        await updateInventoryItem(user.uid, foundItem.id, updates);
                        result = { success: true, message: `Updated ${itemName}.` };
                     } else {
                        result = { success: false, message: `What would you like to update for ${itemName}?` };
                     }
                }
                break;
            }
            case 'removeItem': {
                const removeResult = await removeItem(user.uid, args.itemName, args.quantity);
                result = { success: removeResult.success, message: removeResult.message };
                break;
            }
            case 'queryInventory': {
                const items = inventoryRef.current;
                const totalValue = items.reduce((acc, item) => acc + (item.quantity * item.price), 0);
                const totalCount = items.reduce((acc, item) => acc + item.quantity, 0);

                const inventoryList = items.map(i => 
                    `Item: ${i.name}, Qty: ${i.quantity}, CP: ${i.costPrice || 0}, SP: ${i.price}`
                ).join('; ');

                const message = inventoryList 
                    ? `Inventory Summary:
                       - Total Value (SP): ₹${totalValue}
                       - Total Items: ${totalCount}
                       
                       List: [${inventoryList}].` 
                    : "The inventory is currently empty.";
                
                result = { success: true, message };
                break;
            }
            case 'performBulkAction': {
                const { actionType } = args;
                const currentSelection = selectedItemIdsRef.current;
                
                if (actionType === 'deselect') {
                    setSelectedItemIds(new Set());
                    result = { success: true, message: "Selection cleared." };
                } else if (currentSelection.size === 0) {
                    result = { success: false, message: "No items selected." };
                } else {
                    if (actionType === 'delete') {
                         try {
                            await deleteItemsBatch(user.uid, Array.from(currentSelection));
                            setSelectedItemIds(new Set());
                            result = { success: true, message: `Deleted ${currentSelection.size} items.` };
                        } catch (e) {
                            result = { success: false, message: "Failed to delete items." };
                        }
                    } else if (actionType === 'promote') {
                         const currentPromos = userProfile.usage?.promosGenerated || 0;
                         if (!checkUsageLimit('promosGenerated', currentPromos)) {
                             result = { success: false, message: "Promo limit reached. Upgrade for more." };
                         } else {
                             setIsGeneratingBulkPromo(true);
                             const selectedItems = inventoryRef.current.filter(i => currentSelection.has(i.id));
                             const itemNames = selectedItems.map(i => i.name).join(", ");
                             
                             const ai = getAi();
                             const prompt = `Create a WhatsApp promo for bundle: ${itemNames}. Discount? Emojis. Short.`;

                             ai.models.generateContent({
                                model: 'gemini-2.5-flash',
                                contents: prompt
                            }).then(res => {
                                setBulkPromoContent(res.text || null);
                                setIsGeneratingBulkPromo(false);
                                handleIncrementUsage('promosGenerated');
                            });
                            
                            result = { success: true, message: `Generating promo for ${currentSelection.size} items.` };
                         }
                    }
                }
                break;
            }
        }

        session.sendToolResponse({
            functionResponses: [{
                id: fc.id,
                name: fc.name,
                response: { result: result.message },
            }]
        });
    }, [user, userProfile]);

    const stopSession = useCallback(() => {
        if (!isSessionActiveRef.current) return;
        isSessionActiveRef.current = false;
    
        if (greetingAudioSourceRef.current) {
            try { greetingAudioSourceRef.current.stop(); } catch(e) {}
            greetingAudioSourceRef.current = null;
        }

        setIsListening(false);
        setIsGreeting(false);
        setActiveStream(null); 
        setStatusText(prev => prev.startsWith("Microphone") ? prev : "Tap the mic to manage your stock, or use the camera.");
        
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }

        scriptProcessorRef.current?.disconnect();
        scriptProcessorRef.current = null;
        
        inputAudioContextRef.current?.close().catch(console.error);
        inputAudioContextRef.current = null;

        outputAudioContextRef.current?.close().catch(console.error);
        outputAudioContextRef.current = null;
        
        audioSourcesRef.current.forEach(source => {
            try { source.stop(); } catch (e) { }
        });
        audioSourcesRef.current.clear();

        sessionRef.current?.then((session: any) => session.close()).catch(console.error);
        sessionRef.current = null;
        
        awaitingPriceInfoRef.current = null;
        awaitingQuantityInfoRef.current = null;
        awaitingExpiryInfoRef.current = null;
    }, []);

    const connectToGemini = async () => {
        if (!user || !userProfile?.categories || !isSessionActiveRef.current) return;
        
        if (!inputAudioContextRef.current || !outputAudioContextRef.current || !mediaStreamRef.current) {
             console.error("Audio resources missing in connectToGemini");
             stopSession();
             return;
        }

        setIsListening(true);
        setStatusText("Listening... Say something.");

        const ai = getAi();
        const userCats = userProfile.categories.join(', ');
        
        const systemInstruction = `You are a bilingual inventory assistant for a shopkeeper in India. 
        1. **Language & Accent:** You understand Hindi, English, and Hinglish accents proficiently. Speak naturally.
        2. **Category Enforcement:** Store Categories: [${userCats}]. Refuse items not fitting these categories.
        3. **Two-Price System:** ALWAYS ask for BOTH "Cost Price" (CP - buying price) and "Selling Price" (SP) when adding items. If the user only gives one, ask for the other.
        4. **Translation:** Translate item names to English internally.
        5. **API Key Update:** If the user mentions updating or changing the "API Key" or "AI Key", say: "For security, please update the API key directly in the Admin Panel settings tab."
        6. **Tools:** Use provided tools for database actions.`;

        try {
            sessionRef.current = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: {
                    systemInstruction,
                    responseModalities: [Modality.AUDIO],
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                    tools: [{ functionDeclarations: [INITIATE_ADD_ITEM_TOOL, PROVIDE_ITEM_QUANTITY_TOOL, PROVIDE_ITEM_PRICE_TOOL, REMOVE_ITEM_TOOL, QUERY_INVENTORY_TOOL, PROVIDE_ITEM_EXPIRY_DATE_TOOL, BULK_ACTION_TOOL, UPDATE_ITEM_TOOL] }]
                },
                callbacks: {
                    onopen: () => {
                        if (!inputAudioContextRef.current || !mediaStreamRef.current) return;
                        const source = inputAudioContextRef.current.createMediaStreamSource(mediaStreamRef.current);
                        scriptProcessorRef.current = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
                        scriptProcessorRef.current.onaudioprocess = (e) => {
                            if (!isSessionActiveRef.current) return;
                            const inputData = e.inputBuffer.getChannelData(0);
                            const pcmBlob: GenaiBlob = { data: encode(new Uint8Array(new Int16Array(inputData.map(f => f * 32768)).buffer)), mimeType: 'audio/pcm;rate=16000' };
                            sessionRef.current?.then((s: any) => s.sendRealtimeInput({ media: pcmBlob }));
                        };
                        source.connect(scriptProcessorRef.current);
                        scriptProcessorRef.current.connect(inputAudioContextRef.current.destination);
                    },
                    onmessage: async (msg: LiveServerMessage) => {
                        if (!isSessionActiveRef.current) return;

                        if (msg.serverContent?.interrupted) {
                            audioSourcesRef.current.forEach(source => {
                                try { source.stop(); } catch (e) {}
                            });
                            audioSourcesRef.current.clear();
                            if (outputAudioContextRef.current) {
                                audioPlaybackTimeRef.current = outputAudioContextRef.current.currentTime;
                            }
                        }

                        const inlineData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData;
                        if (inlineData?.data) {
                            const base64 = inlineData.data;
                            if (outputAudioContextRef.current) {
                                if (outputAudioContextRef.current.state === 'suspended') {
                                    await outputAudioContextRef.current.resume();
                                }
                                audioPlaybackTimeRef.current = Math.max(audioPlaybackTimeRef.current, outputAudioContextRef.current.currentTime);
                                const buffer = await decodeAudioData(decode(base64), outputAudioContextRef.current, 24000, 1);
                                const sourceNode = outputAudioContextRef.current.createBufferSource();
                                sourceNode.buffer = buffer;
                                sourceNode.connect(outputAudioContextRef.current.destination);
                                sourceNode.onended = () => audioSourcesRef.current.delete(sourceNode);
                                sourceNode.start(audioPlaybackTimeRef.current);
                                audioPlaybackTimeRef.current += buffer.duration;
                                audioSourcesRef.current.add(sourceNode);
                            }
                        }

                        if (msg.serverContent?.outputTranscription?.text) {
                            const text = msg.serverContent.outputTranscription.text;
                            setTranscript(prev => {
                                const last = prev[prev.length - 1];
                                if (last && last.speaker === 'assistant') {
                                    return [...prev.slice(0, -1), { ...last, text: last.text + text }];
                                }
                                return [...prev, { speaker: 'assistant', text }];
                            });
                        }

                        if (msg.serverContent?.inputTranscription?.text) {
                            const text = msg.serverContent.inputTranscription.text;
                            setTranscript(prev => {
                                const last = prev[prev.length - 1];
                                if (last && last.speaker === 'user') {
                                    return [...prev.slice(0, -1), { ...last, text: last.text + text }];
                                }
                                return [...prev, { speaker: 'user', text }];
                            });
                        }

                        if (msg.toolCall?.functionCalls) {
                            const s = await sessionRef.current;
                            if (s) msg.toolCall.functionCalls.forEach(fc => handleToolCall(fc, s));
                        }
                    },
                    onerror: (e: ErrorEvent) => { 
                        console.error("Session Error", e);
                        // Specific error handling for API Key Issues
                        if (JSON.stringify(e).includes('400') || JSON.stringify(e).includes('403')) {
                            setToastMessage("⚠️ API key invalid or expired — please update from Admin Panel.");
                            setStatusText("API Key Error. Check Admin Panel.");
                        } else {
                            setStatusText("Connection Error. Tap to retry.");
                        }
                        stopSession(); 
                    },
                    onclose: () => {
                         if (isSessionActiveRef.current) stopSession();
                    },
                },
            });
        } catch (e: any) {
            console.error("Connection Failed", e);
             if (e.message?.includes('400') || e.message?.includes('403')) {
                setToastMessage("⚠️ API key invalid or expired — please update from Admin Panel.");
            }
            setStatusText("Failed to connect.");
            stopSession();
        }
    };

    const startAndGreetSession = async () => {
        if (!user) return;
        
        if (isSessionActiveRef.current) {
            stopSession();
            return;
        }

        isSessionActiveRef.current = true;
        setIsGreeting(true);
        setTranscript([]); 
        setStatusText("Initializing...");

        try {
            mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
            setActiveStream(mediaStreamRef.current);

            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            
            await outputAudioContextRef.current.resume();
            await inputAudioContextRef.current.resume();

        } catch (error: any) {
             console.error("Audio Initialization Error:", error);
             if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                 setStatusText("Microphone permission denied.");
                 setToastMessage("Please allow microphone access.");
            } else {
                 setStatusText("Audio unavailable. Check settings.");
            }
            stopSession();
            return;
        }

        setStatusText("Assistant is speaking...");
        setTranscript([{ speaker: 'assistant', text: "Hello, how can I help you?" }]);

        try {
            const ai = getAi();
            const res = await ai.models.generateContent({
                model: "gemini-2.5-flash-preview-tts", 
                contents: [{ parts: [{ text: "Hello, how can I help you?" }] }],
                config: { 
                    responseModalities: [Modality.AUDIO],
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } } 
                },
            });
            
            // Robustly find the audio part (inlineData)
            let base64: string | undefined;
            if (res.candidates?.[0]?.content?.parts) {
                for (const part of res.candidates[0].content.parts) {
                    if (part.inlineData?.data) {
                        base64 = part.inlineData.data;
                        break;
                    }
                }
            }
            
            if (!base64 || !outputAudioContextRef.current) throw new Error("TTS failed or no audio data returned.");
            
            const buffer = await decodeAudioData(decode(base64), outputAudioContextRef.current, 24000, 1);
            const source = outputAudioContextRef.current.createBufferSource();
            greetingAudioSourceRef.current = source;
            source.buffer = buffer;
            source.connect(outputAudioContextRef.current.destination);
            
            source.onended = () => { 
                if (isSessionActiveRef.current) {
                    setIsGreeting(false);
                    connectToGemini();
                }
            };
            source.start();
        } catch (error: any) {
            console.error("Greeting failed", error);
            if (error.message?.includes('400') || error.message?.includes('403')) {
                 setToastMessage("⚠️ API key invalid or expired — please update from Admin Panel.");
                 stopSession();
                 return;
            }
            // Fallback for non-auth errors
            setIsGreeting(false);
            if (isSessionActiveRef.current) connectToGemini();
        }
    };

    const handleMicClick = () => { if (isListening || isGreeting) stopSession(); else startAndGreetSession(); };
    const handleCaptureOpen = (mode: any) => { setCameraMode(mode); setIsCameraOpen(true); };

    // New Implementation of Missing Functions

    const filteredInventory = useMemo(() => {
        if (!searchTerm) return inventory;
        return inventory.filter(item => 
            item.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [inventory, searchTerm]);

    const totalItems = useMemo(() => inventory.reduce((acc, item) => acc + item.quantity, 0), [inventory]);
    
    const totalValue = useMemo(() => inventory.reduce((acc, item) => acc + (item.quantity * item.price), 0), [inventory]);

    const handleBulkDelete = async () => {
        if (!user || selectedItemIds.size === 0) return;
        if (confirm(`Are you sure you want to delete ${selectedItemIds.size} items?`)) {
            await deleteItemsBatch(user.uid, Array.from(selectedItemIds));
            setSelectedItemIds(new Set());
            setToastMessage("Items deleted successfully.");
        }
    };

    const handleBulkPromo = async () => {
        if (!userProfile) return;
        if (!checkUsageLimit('promosGenerated', (userProfile.usage?.promosGenerated || 0))) return;

        setIsGeneratingBulkPromo(true);
        const selectedItems = inventory.filter(i => selectedItemIds.has(i.id));
        const itemNames = selectedItems.map(i => i.name).join(", ");

        const ai = getAi();
        const prompt = `Create a WhatsApp promo for bundle: ${itemNames}. Discount? Emojis. Short.`;

        try {
            const res = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt
            });
            setBulkPromoContent(res.text || null);
            await handleIncrementUsage('promosGenerated');
        } catch (e) {
            console.error(e);
            setToastMessage("Failed to generate promo.");
        } finally {
            setIsGeneratingBulkPromo(false);
        }
    };

    const handleManualAddItem = async (item: { name: string; quantity: number; price: number; costPrice: number; expiryDate?: string }) => {
        if (!user) return;
        if (!checkUsageLimit('inventoryCount', inventory.length)) return;

        try {
            await addOrUpdateItem(user.uid, item.name, item.quantity, item.price, item.expiryDate, item.costPrice);
            setToastMessage(`Added ${item.name}`);
            setShowAddItemModal(false);
        } catch (error) {
            console.error("Failed to add item", error);
            setToastMessage("Failed to add item.");
        }
    };

    const handleUpdateItem = async (updatedItem: InventoryItem) => {
        if (!user) return;
        try {
            await updateInventoryItem(user.uid, updatedItem.id, {
                name: updatedItem.name,
                quantity: updatedItem.quantity,
                price: updatedItem.price,
                costPrice: updatedItem.costPrice,
                expiryDate: updatedItem.expiryDate,
            });
            setToastMessage(`Updated ${updatedItem.name}`);
            setEditingItem(null);
        } catch (error) {
            console.error("Update failed", error);
            setToastMessage("Failed to update item.");
        }
    };

    const removeReviewItem = (index: number) => {
        setReviewItems(prev => prev.filter((_, i) => i !== index));
    };

    const updateReviewItem = (index: number, field: keyof DetectedItem, value: any) => {
        setReviewItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
    };

    const handleConfirmReview = async () => {
        if (!user) return;
        if (reviewItems.length === 0) return;
        
        if (!checkUsageLimit('inventoryCount', inventory.length + reviewItems.length)) return;

        setIsAnalyzingImage(true);
        try {
            for (const item of reviewItems) {
                await addOrUpdateItem(user.uid, item.name, item.quantity, item.price, item.expiryDate);
            }
            setToastMessage(`Added ${reviewItems.length} items.`);
            setReviewItems([]);
        } catch (error) {
            console.error("Failed to confirm items", error);
            setToastMessage("Failed to add items.");
        } finally {
            setIsAnalyzingImage(false);
        }
    };

    const handleImageCapture = async (data: string | string[]) => {
        if (!user) return;
        setIsCameraOpen(false);
        setIsAnalyzingImage(true);

        const ai = getAi();

        if (cameraMode === 'shelf-analysis') {
            if (!checkUsageLimit('aiScans', (userProfile?.usage?.aiScans || 0))) {
                setIsAnalyzingImage(false);
                return;
            }

            const frames = Array.isArray(data) ? data : [data];
            
            try {
                const prompt = `You are a retail shelf auditor. Analyze these images of a store shelf.
                Identify:
                1. "Ghost Spots" (Empty spaces where products should be).
                2. "Misplaced Items" (Items that look like they don't belong).
                
                Provide a JSON response with:
                - score (0-10, 10 is perfect)
                - summary (1 sentence)
                - powerMove (1 actionable tip)
                - visualIssues: Array of objects { label, type: 'ghost_spot'|'misplaced'|'good', frameIndex: number (which image index 0-N), box2d: [ymin, xmin, ymax, xmax], suggestion }
                
                The box2d coordinates should be normalized 0-1000.
                `;

                const parts = frames.map(frame => ({
                    inlineData: { mimeType: 'image/jpeg', data: frame }
                }));

                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: {
                        parts: [
                            { text: prompt },
                            ...parts
                        ]
                    },
                    config: {
                        responseMimeType: 'application/json'
                    }
                });

                const resultText = response.text;
                let analysisData: any = {};
                try {
                    analysisData = JSON.parse(resultText || '{}');
                } catch (e) {
                    console.error("JSON parse error", e);
                }

                const analysisId = await saveShelfAnalysis({
                    userId: user.uid,
                    createdAt: Timestamp.now(),
                    score: analysisData.score || 5,
                    summary: analysisData.summary || "Analysis completed.",
                    powerMove: analysisData.powerMove || "Restock empty spots.",
                    visualIssues: analysisData.visualIssues || [],
                    capturedFrame: frames[0],
                    capturedFrames: frames,
                });

                await handleIncrementUsage('aiScans');
                onViewAnalysis(analysisId);

            } catch (error) {
                console.error("Shelf analysis failed", error);
                setToastMessage("Analysis failed.");
            } finally {
                setIsAnalyzingImage(false);
            }

        } else {
             if (!checkUsageLimit('aiScans', (userProfile?.usage?.aiScans || 0))) {
                setIsAnalyzingImage(false);
                return;
            }

            const base64Image = Array.isArray(data) ? data[0] : data;
            const isInvoice = cameraMode === 'invoice';
            const prompt = isInvoice 
                ? "Extract items from this invoice. Return JSON array: [{ name, quantity, price, expiryDate (DD-MM-YYYY or null) }]. Translate names to English."
                : "Identify the product in this image. Return JSON array with ONE item: [{ name, quantity (estimate 1), price (estimate in INR), expiryDate (null) }]. Translate name to English.";

            try {
                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: {
                        parts: [
                            { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
                            { text: prompt }
                        ]
                    },
                    config: { responseMimeType: 'application/json' }
                });

                const items = JSON.parse(response.text || '[]');
                setReviewItems(items);
                setIsReviewingInvoice(isInvoice);
                await handleIncrementUsage('aiScans');
            } catch (error) {
                console.error("Scan failed", error);
                setToastMessage("Scan failed. Try again.");
            } finally {
                setIsAnalyzingImage(false);
            }
        }
    };

    return (
        <main className="container mx-auto p-4 md:p-8 pb-24">
            <Toast message={toastMessage} onClose={() => setToastMessage('')} />
            <header className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
                    <p className="text-gray-500 dark:text-gray-400">Welcome, {userProfile?.name}</p>
                    <div className="mt-2 flex items-center gap-2">
                        {userProfile?.plan === 'pro' ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-indigo-600 to-purple-600 text-white">Vyapar Pro 🚀</span>
                        ) : (
                            <button onClick={() => setShowSubscriptionModal(true)} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200">Free Plan</button>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={() => setShowAnalysisHistory(true)} className="p-3 bg-gray-200 dark:bg-gray-700 rounded-full hover:bg-gray-300 dark:hover:bg-gray-600" title="Scan History"><PresentationChartLineIcon className="w-5 h-5 text-gray-500 dark:text-white" /></button>
                    <button onClick={() => setShowAnalytics(true)} className="p-3 bg-gray-200 dark:bg-gray-700 rounded-full hover:bg-gray-300 dark:hover:bg-gray-600" title="Analytics"><ChartBarIcon className="w-5 h-5 text-gray-500 dark:text-white" /></button>
                    
                    {/* New Invoice Button */}
                    <button onClick={() => setShowCreateInvoice(true)} className="p-3 bg-gray-200 dark:bg-gray-700 rounded-full hover:bg-gray-300 dark:hover:bg-gray-600" title="Create New Invoice">
                        <DocumentPlusIcon className="w-5 h-5 text-gray-500 dark:text-white" />
                    </button>

                    {/* Bucket Invoice Button */}
                    <button onClick={() => setShowInvoice(true)} className="relative p-3 bg-gray-200 dark:bg-gray-700 rounded-full hover:bg-gray-300 dark:hover:bg-gray-600" title="Quick Sales Bucket">
                        <ReceiptIcon className="w-5 h-5 text-gray-500 dark:text-white" />
                        {salesBucket.length > 0 && <span className="absolute top-0 right-0 h-4 w-4 bg-green-500 rounded-full border border-white"></span>}
                    </button>

                    <button onClick={onOpenNotifications} className="relative p-3 bg-gray-200 dark:bg-gray-700 rounded-full"><BellIcon className="w-5 h-5" />{totalUnreadNotificationCount > 0 && <span className="absolute top-0 right-0 h-5 w-5 bg-red-500 text-white text-xs flex items-center justify-center rounded-full">{totalUnreadNotificationCount}</span>}</button>
                    <button onClick={() => setIsChatModalOpen(true)} className="relative p-3 bg-gray-200 dark:bg-gray-700 rounded-full"><ChatIcon className="w-5 h-5" />{totalUnreadChatCount > 0 && <span className="absolute top-0 right-0 h-5 w-5 bg-red-500 text-white text-xs flex items-center justify-center rounded-full">{totalUnreadChatCount}</span>}</button>
                    <button onClick={logOut} className="p-3 bg-gray-200 dark:bg-gray-700 rounded-full"><LogoutIcon className="w-5 h-5" /></button>
                </div>
            </header>

            {/* Business Pilot Component */}
            <BusinessPilot inventory={inventory} onIncrementUsage={handleIncrementUsage} />
            
            <section className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-6 text-white shadow-lg relative overflow-hidden h-48 md:h-auto flex flex-col justify-between">
                     {(isListening || isGreeting) && (
                        <AudioVisualizer stream={activeStream} isActive={isListening || isGreeting} />
                     )}
                    <div className="relative z-10"><h2 className="text-lg font-semibold mb-1">Voice Assistant</h2><p className="text-indigo-100 text-sm h-12 overflow-hidden">{statusText}</p></div>
                    <div className="absolute bottom-4 right-4 z-20"><MicButton isListening={isListening || isGreeting} onClick={handleMicClick} /></div>
                    {(isListening || isGreeting) && !activeStream && <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center pointer-events-none"><span className="animate-ping absolute inline-flex h-32 w-32 rounded-full bg-white opacity-10"></span></div>}
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-md border border-gray-200 dark:border-gray-700 flex flex-col">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Transcript</h2>
                    <div ref={transcriptContainerRef} className="h-32 overflow-y-auto text-sm space-y-2 custom-scrollbar">
                        {transcript.length === 0 ? (
                            <p className="text-gray-400 text-xs italic text-center mt-10">Conversation history will appear here.</p>
                        ) : (
                            transcript.map((entry, i) => (
                                <div key={i} className={entry.speaker === 'user' ? 'text-right' : 'text-left'}>
                                    <span className={`inline-block px-3 py-1 rounded-lg ${entry.speaker === 'user' ? 'bg-indigo-100 dark:bg-indigo-900/30' : 'bg-gray-100 dark:bg-gray-700'}`}>{entry.text}</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-md border border-gray-200 dark:border-gray-700 flex flex-col justify-between md:col-span-2 lg:col-span-1">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Visual AI Tools</h2>
                    <div className="grid grid-cols-3 gap-2">
                        <button onClick={() => handleCaptureOpen('item')} className="flex flex-col items-center justify-center p-2 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors group"><div className="p-2 bg-indigo-100 dark:bg-indigo-900 rounded-full mb-1"><CameraIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /></div><span className="text-xs font-medium text-gray-700 dark:text-gray-300">Snap Item</span></button>
                        <button onClick={() => handleCaptureOpen('invoice')} className="flex flex-col items-center justify-center p-2 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors group relative">{userProfile?.plan !== 'pro' && <div className="absolute top-1 right-1 w-2 h-2 bg-yellow-400 rounded-full" />}<div className="p-2 bg-green-100 dark:bg-green-900 rounded-full mb-1"><DocumentTextIcon className="w-5 h-5 text-green-600 dark:text-green-400" /></div><span className="text-xs font-medium text-gray-700 dark:text-gray-300">Scan Bill</span></button>
                        <button onClick={() => handleCaptureOpen('shelf-analysis')} className="flex flex-col items-center justify-center p-2 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors group relative">{userProfile?.plan !== 'pro' && <div className="absolute top-1 right-1 w-2 h-2 bg-yellow-400 rounded-full" />}<div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-full mb-1"><PresentationChartLineIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" /></div><span className="text-xs font-medium text-gray-700 dark:text-gray-300">Shelf Doctor</span></button>
                    </div>
                </div>
            </section>

            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <div className="flex items-center bg-white dark:bg-gray-800 p-2 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 w-full md:max-w-md"><SearchIcon className="w-5 h-5 text-gray-400 ml-2" /><input type="text" placeholder="Search inventory..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-transparent border-none focus:ring-0 text-gray-900 dark:text-white ml-2" /></div>
                <button onClick={() => setShowAddItemModal(true)} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm w-full md:w-auto justify-center"><PlusIcon className="w-5 h-5" />Add Item Manually</button>
            </div>

            <InventoryTable 
                items={filteredInventory} 
                loading={inventoryLoading} 
                totalItems={totalItems} 
                totalValue={totalValue} 
                onStartChat={() => setIsChatModalOpen(true)} 
                onAddItemClick={() => startAndGreetSession()} 
                onEdit={setEditingItem} 
                selectedItems={selectedItemIds} 
                onSelectionChange={setSelectedItemIds} 
                onBulkDelete={handleBulkDelete} 
                onBulkPromo={handleBulkPromo}
                onPushUp={handlePushUp}
                onPushDown={handlePushDown}
            />

            {/* Modals */}
            {isChatModalOpen && userProfile && <ChatListModal currentUserProfile={userProfile} onClose={() => setIsChatModalOpen(false)} onNavigateToChat={onNavigateToChat} />}
            {isCameraOpen && <CameraCapture onCapture={handleImageCapture} onClose={() => setIsCameraOpen(false)} mode={cameraMode} />}
            {isAnalyzingImage && <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center"><div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-2xl flex flex-col items-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div><p className="text-lg font-semibold text-gray-900 dark:text-white">AI is analyzing...</p></div></div>}
            
            {showAnalytics && user && <AnalyticsDashboard userId={user.uid} currentInventory={inventory} onClose={() => setShowAnalytics(false)} />}
            {showInvoice && <InvoiceModal items={salesBucket.map(i => ({...i.item, soldQuantity: i.soldQty}))} onClose={() => setShowInvoice(false)} onClearBucket={() => setSalesBucket([])} />}
            {showCreateInvoice && user && <CreateInvoiceModal userId={user.uid} inventory={inventory} onClose={() => setShowCreateInvoice(false)} />}

            {showAnalysisHistory && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl h-[80vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700">
                        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Shelf Analysis History</h2>
                            <button onClick={() => setShowAnalysisHistory(false)} className="text-gray-500 hover:text-gray-700"><XMarkIcon className="w-6 h-6" /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {analysisHistory.length === 0 ? (
                                <p className="text-center text-gray-500 mt-10">No past analyses found.</p>
                            ) : (
                                analysisHistory.map(analysis => (
                                    <div key={analysis.id} onClick={() => { setShowAnalysisHistory(false); onViewAnalysis(analysis.id); }} className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-4">
                                        <img 
                                            src={analysis.capturedFrame.startsWith('http') ? analysis.capturedFrame : `data:image/jpeg;base64,${analysis.capturedFrame}`} 
                                            className="w-16 h-16 object-cover rounded-md" 
                                            alt="Thumbnail" 
                                        />
                                        <div className="flex-1">
                                            <div className="flex justify-between">
                                                <h3 className="font-bold text-gray-900 dark:text-white">Score: {analysis.score}/10</h3>
                                                <span className="text-xs text-gray-500">{analysis.createdAt.toDate().toLocaleDateString()}</span>
                                            </div>
                                            <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">{analysis.summary}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {reviewItems.length > 0 && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center"><div><h2 className="text-xl font-bold text-gray-900 dark:text-white">Review {isReviewingInvoice ? 'Invoice' : 'Detected'} Items</h2></div><button onClick={() => setReviewItems([])} className="text-gray-400 hover:text-gray-600"><XMarkIcon className="w-6 h-6" /></button></div>
                        <div className="flex-1 overflow-y-auto p-6"><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{reviewItems.map((item, idx) => (<div key={idx} className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg border relative group"><button onClick={() => removeReviewItem(idx)} className="absolute top-2 right-2 text-red-600 opacity-0 group-hover:opacity-100"><XMarkIcon className="w-4 h-4" /></button><div className="space-y-2"><input value={item.name} onChange={(e) => updateReviewItem(idx, 'name', e.target.value)} className="w-full bg-transparent border-b font-bold" /><div className="flex gap-2"><input type="number" value={item.quantity} onChange={(e) => updateReviewItem(idx, 'quantity', parseInt(e.target.value))} className="w-1/2 bg-transparent border-b" /><input type="number" value={item.price} onChange={(e) => updateReviewItem(idx, 'price', parseFloat(e.target.value))} className="w-1/2 bg-transparent border-b" /></div><input value={item.expiryDate} onChange={(e) => updateReviewItem(idx, 'expiryDate', e.target.value)} className="w-full bg-transparent border-b text-xs" placeholder="Expiry" /></div></div>))}</div></div>
                        <div className="p-6 border-t bg-gray-50 dark:bg-gray-800 flex justify-end gap-3"><button onClick={() => setReviewItems([])} className="px-4 py-2 rounded hover:bg-gray-200">Cancel</button><button onClick={handleConfirmReview} className="px-6 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">Confirm All</button></div>
                    </div>
                </div>
            )}
            {editingItem && <EditItemModal item={editingItem} onClose={() => setEditingItem(null)} onSave={handleUpdateItem} />}
            {showAddItemModal && <AddItemModal onClose={() => setShowAddItemModal(false)} onAdd={handleManualAddItem} />}
            {bulkPromoContent && <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center"><div className="bg-white dark:bg-gray-800 p-6 rounded-xl max-w-sm"><h3 className="font-bold text-xl mb-4">Promo Ready!</h3><p className="bg-gray-100 p-4 rounded italic mb-4 text-black">{bulkPromoContent}</p><button onClick={() => setBulkPromoContent(null)} className="w-full bg-indigo-600 text-white py-2 rounded">Close</button></div></div>}
            {isGeneratingBulkPromo && <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"><div className="bg-white p-6 rounded-xl"><p>Generating Promo...</p></div></div>}
            {showSubscriptionModal && <SubscriptionModal onClose={() => setShowSubscriptionModal(false)} />}
        </main>
    );
};

export default InventoryManager;
