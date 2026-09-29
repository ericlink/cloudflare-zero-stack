export type Bindings = {
  DB: D1Database;
  ASSETS: Fetcher;
  RESEND_API_KEY?: string;
  NOTIFY_EMAIL: string;
};

export type FeedbackRow = {
  id: string;
  name: string;
  message: string;
  image_key: string | null;
  created_at: string;
};

export type FeedbackJson = {
  id: string;
  name: string;
  message: string;
  imageUrl: string | null;
  createdAt: string;
};

export const MAX_MESSAGE_LENGTH = 1000;
