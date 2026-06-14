interface Policy {
  kind: "guest" | "user";
  maxFileBytes: number;
  maxActiveBytes: number;
  retentionOptions: number[];
  maxDownloads: number;
  defaultDownloads: number;
}

export interface SessionResponse {
  authenticated: boolean;
  user?: {
    id: string;
    email: string;
    username: string | null;
    role: "ADMIN" | "USER";
  };
  policy: Policy;
}

export interface UploadStart {
  uploadId: string;
  manageToken: string;
  publicToken: string;
  shareUrl: string;
  partSizeBytes: number;
  partCount: number;
  expiresAt: string;
  maxDownloads: number;
}

export interface UploadResult {
  publicToken: string;
  shareUrl: string;
  manageToken: string;
  expiresAt: string;
  savedBytes: number;
}

export interface AccountDrop {
  id: string;
  public_token: string;
  original_name: string;
  content_type: string;
  size_bytes: number;
  source_size_bytes: number;
  storage_encoding: string | null;
  max_downloads: number | null;
  download_count: number;
  expires_at: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  protected: number;
}

export interface PublicDrop {
  name: string;
  contentType: string;
  sizeBytes: number;
  storedSizeBytes: number;
  storageEncoding: string | null;
  compressed: boolean;
  protected: boolean;
  maxDownloads: number | null;
  downloadCount: number;
  remainingDownloads: number | null;
  expiresAt: string;
  createdAt: string;
}
