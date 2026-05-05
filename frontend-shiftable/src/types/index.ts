export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  size?: number;
  extension?: string;
}

export interface WorkspaceNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: WorkspaceNode[];
}

export interface UploadResponse {
  success: boolean;
  session_id: string;
  file_tree: FileNode[];
  detected_languages: string[];
  primary_language: string;
  file_count: number;
  summary: {
    total_files: number;
    total_directories: number;
    total_size_bytes: number;
    language_breakdown: LanguageBreakdown[];
    extraction: { files_extracted: number; warnings: string[] };
  };
}

export interface LanguageBreakdown {
  language: string;
  count: number;
  percentage: number;
  code_percentage: number;
  is_code: boolean;
}

export interface AIIntelligence {
  converted_code?: string;
  reasoning?: string;
  confidence?: number;
  ir?: Record<string, unknown>;
}

export interface ConvertedFileInfo {
  path: string;
  status: 'success' | 'failed';
  error?: string;
  reason?: string;
  intelligence?: AIIntelligence;
  provider?: string;
  conversion_ms?: number;
  retry_attempted?: boolean;
}

export interface ProjectConversionResponse {
  total_files: number;
  success_count: number;
  failed_count: number;
  failed_files?: ConvertedFileInfo[];
  converted_files: ConvertedFileInfo[];
  total_conversion_ms?: number;
  diagnostics?: Record<string, number>;
}

export interface CopilotResponse {
  provider_used: string;
  answer: string;
  suggested_actions?: string[];
  terminal_fix_command?: string | null;
  delete_path?: string | null;
  environment_requirement?: string | null;
  recommended_runtime?: string | null;
  is_running?: boolean;
}
