export type HeyGenAvatarCatalogItem = {
  avatar_id: string;
  avatar_name: string;
  gender: string;
  preview_image_url: string;
  preview_video_url: string;
  premium: boolean;
  type: string | null;
  tags: unknown;
  default_voice_id: string | null;
  /** LiveAvatar / LiveKit session API UUID when HeyGen returns it on the avatar payload */
  live_avatar_avatar_uuid?: string | null;
};
