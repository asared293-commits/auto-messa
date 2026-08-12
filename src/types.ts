export type TemplateCategory = 
  | 'Business' 
  | 'Marketing' 
  | 'Sales' 
  | 'Customer Support' 
  | 'Announcements' 
  | 'Events' 
  | 'Birthday' 
  | 'Invitations' 
  | 'Reminders' 
  | 'Education' 
  | 'News' 
  | 'Social Media' 
  | 'Personal' 
  | 'Motivational' 
  | 'Greetings' 
  | 'Promotions' 
  | 'Follow-ups' 
  | 'Tech' 
  | 'Other';

export interface Template {
  id: string;
  userId: string;
  name: string;
  description?: string;
  category: TemplateCategory;
  content: string;
  variables: string[];
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'document' | 'audio';
  buttons?: { text: string; url?: string }[];
  isFavorite?: boolean;
  isPreDesigned?: boolean;
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string;
  usageCount: number;
  sentCount?: number;
  scheduledCount?: number;
}

export type RepeatType = 'none' | 'daily' | 'weekly' | 'monthly' | 'custom';

export type ScheduledStatus = 'scheduled' | 'sending' | 'sent' | 'failed' | 'cancelled' | 'paused';

export interface ScheduledMessage {
  id: string;
  userId: string;
  recipientJid: string;
  recipientName: string;
  phoneNumber?: string;
  message: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'document' | 'audio';
  templateId?: string;
  templateName?: string;
  scheduledAt: string; // ISO string
  timezone: string;
  repeatType: RepeatType;
  repeatDays?: string[]; // e.g. ['Monday', 'Wednesday']
  startDate?: string;
  endDate?: string;
  status: ScheduledStatus;
  createdAt: string;
  sentAt?: string;
  errorMessage?: string;
}

export type CampaignStatus = 'active' | 'paused' | 'completed';

export interface Campaign {
  id: string;
  userId: string;
  name: string;
  description?: string;
  templateId?: string;
  templateName?: string;
  recipientJid: string;
  recipientName: string;
  phoneNumber?: string;
  scheduleTime: string;
  repeatType: RepeatType;
  repeatDays?: string[];
  status: CampaignStatus;
  createdAt: string;
  updatedAt: string;
}

export interface MessageLog {
  id: string;
  userId: string;
  message: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'document' | 'audio';
  recipientJid: string;
  recipientName: string;
  phoneNumber?: string;
  templateName?: string;
  sentAt: string;
  status: 'sent' | 'failed';
  errorMessage?: string;
  scheduleId?: string;
}

export interface WhatsAppChat {
  id: string;
  name: string;
  isGroup: boolean;
}
