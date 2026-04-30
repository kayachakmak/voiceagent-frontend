export interface AgentSummary {
  agent_id: string;
  name: string;
}

export interface AgentListResponse {
  agents: AgentSummary[];
  next_cursor: string | null;
}

export interface AgentDetail {
  agent_id: string;
  name: string;
  phone_numbers: Record<string, unknown>[];
  conversation_config: {
    agent?: {
      prompt?: { prompt?: string };
    };
    tts?: {
      voice_id?: string;
    };
  } | null;
}

export interface PhoneNumber {
  phone_number_id: string;
  phone_number: string | null;
  label: string | null;
  provider: string | null;
}

export interface BatchCallRecipient {
  phone_number: string;
  dynamic_variables?: Record<string, string>;
}

export interface SubmitBatchCallRequest {
  call_name: string;
  agent_id: string;
  recipients: BatchCallRecipient[];
  scheduled_time_unix?: number;
  agent_phone_number_id?: string;
  timezone?: string;
}

export type BatchJobStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "failed"
  | "cancelled";

export interface BatchJob {
  id: string;
  name: string | null;
  agent_id: string;
  status: BatchJobStatus;
  total_calls_scheduled: number;
  total_calls_dispatched: number;
  total_calls_finished: number;
  retry_count: number;
  created_at_unix: number | null;
  scheduled_time_unix: number | null;
  last_updated_at_unix: number | null;
  agent_name: string | null;
  phone_number_id: string | null;
}

export interface BatchJobListResponse {
  batch_calls: BatchJob[];
  next_doc: string | null;
  has_more: boolean;
}

export interface BatchRecipientStatus {
  phone_number: string;
  status: string;
  conversation_id: string | null;
  call_duration_secs: number | null;
}

export interface BatchDetail extends BatchJob {
  recipients: BatchRecipientStatus[];
}

export interface ConversationSummary {
  conversation_id: string;
  agent_id: string;
  status: string;
  start_time_unix: number | null;
  end_time_unix: number | null;
  call_duration_secs: number | null;
  call_successful: string | null;
}

export interface ConversationListResponse {
  conversations: ConversationSummary[];
  next_cursor: string | null;
  has_more: boolean;
}

export interface TranscriptMessage {
  role: "agent" | "user";
  message: string;
  time_in_call_secs: number | null;
  duration_secs: number | null;
}

export interface EvaluationCriterionResult {
  criteria_id: string | null;
  name: string | null;
  result: string | null;
  rationale: string | null;
}

export interface DataCollectionResult {
  data_collection_id: string | null;
  name: string | null;
  value: string | null;
  rationale: string | null;
}

export interface ConversationAnalysis {
  call_successful: string | null;
  transcript_summary: string | null;
  evaluation_criteria_results: EvaluationCriterionResult[] | null;
  data_collection_results: DataCollectionResult[] | null;
}

export interface ConversationDetail {
  conversation_id: string;
  agent_id: string;
  status: string;
  start_time_unix: number | null;
  end_time_unix: number | null;
  call_duration_secs: number | null;
  has_audio: boolean;
  transcript: TranscriptMessage[];
  metadata: Record<string, unknown> | null;
  analysis: ConversationAnalysis | null;
}
