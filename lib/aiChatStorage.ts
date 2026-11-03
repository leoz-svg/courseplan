// Type definitions - consistent with AIRecommendationsPanel
export type RecItem = {
    course_id: string;
    title: string;
    match: number;
    why: string;
    faculty?: string;
    cp?: number;
    year?: string;
    skills?: string[];
    opportunities?: string[];
    description?: string;
};

export type ChatMsg = {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    ts: string;
    variant?: 'thinking' | 'summary';
};

export interface AIChatState {
    messages: ChatMsg[];
    items: RecItem[];
    hasSearched: boolean;
    lastSearchText: string;
    timestamp: number;
}

const AI_CHAT_STORAGE_KEY = 'ai-chat-state';

/**
 * Save AI chat state to localStorage
 */
export function saveAIChatState(state: Partial<AIChatState>): void {
    if (typeof window === 'undefined') return;

    try {
        const existing = getAIChatState();
        const newState: AIChatState = {
            ...existing,
            ...state,
            timestamp: Date.now()
        };
        localStorage.setItem(AI_CHAT_STORAGE_KEY, JSON.stringify(newState));
    } catch (error) {
        console.warn('Failed to save AI chat state:', error);
    }
}

/**
 * Get AI chat state from localStorage
 */
export function getAIChatState(): AIChatState {
    if (typeof window === 'undefined') {
        return {
            messages: [],
            items: [],
            hasSearched: false,
            lastSearchText: '',
            timestamp: 0
        };
    }

    try {
        const stored = localStorage.getItem(AI_CHAT_STORAGE_KEY);
        if (!stored) {
            return {
                messages: [],
                items: [],
                hasSearched: false,
                lastSearchText: '',
                timestamp: 0
            };
        }

        const parsed = JSON.parse(stored);
        return {
            messages: parsed.messages || [],
            items: parsed.items || [],
            hasSearched: parsed.hasSearched || false,
            lastSearchText: parsed.lastSearchText || '',
            timestamp: parsed.timestamp || 0
        };
    } catch (error) {
        console.warn('Failed to load AI chat state:', error);
        return {
            messages: [],
            items: [],
            hasSearched: false,
            lastSearchText: '',
            timestamp: 0
        };
    }
}

/**
 * Clear AI chat state
 */
export function clearAIChatState(): void {
    if (typeof window === 'undefined') return;

    try {
        localStorage.removeItem(AI_CHAT_STORAGE_KEY);
    } catch (error) {
        console.warn('Failed to clear AI chat state:', error);
    }
}

/**
 * Check if AI chat state is expired (older than 24 hours)
 */
export function isAIChatStateExpired(): boolean {
    const state = getAIChatState();
    if (!state.timestamp) return true;

    const now = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000;
    return (now - state.timestamp) > twentyFourHours;
}

/**
 * Add new message to chat state
 */
export function addMessageToAIChat(message: ChatMsg): void {
    const state = getAIChatState();
    const newMessages = [...state.messages, message];
    saveAIChatState({ messages: newMessages });
}

/**
 * Update recommended courses to chat state
 */
export function updateRecommendationsToAIChat(items: RecItem[], searchText: string): void {
    saveAIChatState({
        items,
        hasSearched: true,
        lastSearchText: searchText
    });
}
