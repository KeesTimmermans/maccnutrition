import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface CoachConversation {
  id: string;
  user_id: string;
  week_start: string;
  messages: ChatMessage[];
  created_at: string;
  updated_at: string;
}

/**
 * Get the Monday of the current week (week starts on Monday)
 */
export function getCurrentWeekStart(): string {
  const now = new Date();
  const day = now.getDay();
  // Adjust: Sunday (0) becomes 6, Monday (1) becomes 0, etc.
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().split('T')[0];
}

/**
 * Load the current week's conversation
 */
export async function loadWeeklyConversation(): Promise<ChatMessage[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const weekStart = getCurrentWeekStart();

  const { data, error } = await supabase
    .from('coach_conversations')
    .select('*')
    .eq('user_id', user.id)
    .eq('week_start', weekStart)
    .maybeSingle();

  if (error) {
    console.error('Error loading conversation:', error);
    return [];
  }

  if (!data) return [];

  // Parse messages from JSONB - safely cast through unknown
  const rawMessages = data.messages as unknown;
  const messages = rawMessages as ChatMessage[];
  return Array.isArray(messages) ? messages : [];
}

/**
 * Save/update the current week's conversation
 */
export async function saveWeeklyConversation(messages: ChatMessage[]): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const weekStart = getCurrentWeekStart();

  // Check if conversation exists
  const { data: existing } = await supabase
    .from('coach_conversations')
    .select('id')
    .eq('user_id', user.id)
    .eq('week_start', weekStart)
    .maybeSingle();

  if (existing) {
    // Update existing
    const { error } = await supabase
      .from('coach_conversations')
      .update({ messages: messages as unknown as Json })
      .eq('id', existing.id);

    if (error) {
      console.error('Error updating conversation:', error);
      throw error;
    }
  } else {
    // Insert new - use raw insert with explicit typing
    const insertData = {
      user_id: user.id,
      week_start: weekStart,
      messages: messages as unknown as Json,
    };
    
    const { error } = await supabase
      .from('coach_conversations')
      .insert(insertData);

    if (error) {
      console.error('Error inserting conversation:', error);
      throw error;
    }
  }
}

/**
 * Clear conversation for the current week (manual reset)
 */
export async function clearWeeklyConversation(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const weekStart = getCurrentWeekStart();

  const { error } = await supabase
    .from('coach_conversations')
    .delete()
    .eq('user_id', user.id)
    .eq('week_start', weekStart);

  if (error) {
    console.error('Error clearing conversation:', error);
    throw error;
  }
}

/**
 * Get conversation summary for context (last N messages)
 */
export function getConversationSummary(messages: ChatMessage[], maxMessages = 10): string {
  if (messages.length === 0) return "";
  
  const recentMessages = messages.slice(-maxMessages);
  return recentMessages
    .map(m => `${m.role === 'user' ? 'User' : 'Coach'}: ${m.content.substring(0, 200)}${m.content.length > 200 ? '...' : ''}`)
    .join('\n');
}
