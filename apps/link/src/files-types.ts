export type {
  AccountDrop,
  DropSessionResponse as SessionResponse,
  PublicDrop,
  UploadStartResponse as UploadStart,
} from "@kleavox/link-protocol";

export interface UploadResult {
  publicToken: string;
  shareUrl: string;
  manageToken: string;
  expiresAt: string;
  savedBytes: number;
  encrypted: boolean;
}
