export const platformProfileOptions = [
  "linux-cluster",
  "gpu-workstation",
  "single-gpu-node",
  "dgx-a100",
  "dgx-h100",
  "dgx-b200",
  "hgx-a100",
  "hgx-h100",
  "hgx-b200",
  "generic-nvlink-cluster",
] as const;

export const engagementStatusOptions = ["draft", "collecting", "processing", "ready_for_review", "complete", "archived"] as const;
export const acceptanceStatusOptions = ["not_evaluated", "ready", "ready_with_observations", "remediation_required", "failed"] as const;

export type PlatformProfile = typeof platformProfileOptions[number];
export type EngagementStatus = typeof engagementStatusOptions[number];
export type AcceptanceStatus = typeof acceptanceStatusOptions[number];

export interface Engagement {
  id: string;
  schema_version: string;
  name: string;
  customer_name: string;
  description: string;
  platform_profile: PlatformProfile;
  expected_node_count: number;
  received_node_count: number;
  ready_node_count: number;
  remediation_node_count: number;
  failed_node_count: number;
  status: EngagementStatus;
  acceptance_status: AcceptanceStatus;
  readiness_score: number | null;
  created_at: string;
  updated_at: string;
  collection_deadline: string | null;
  created_by: string;
  simulated: boolean;
  tags: string[];
}

export interface EngagementNode {
  id: string;
  engagement_id: string;
  display_name: string;
  source_hostname: string | null;
  node_fingerprint: string | null;
  platform_profile: PlatformProfile;
  gpu_model: string | null;
  gpu_count: number | null;
  driver_version: string | null;
  cuda_version: string | null;
  kernel_version: string | null;
  operating_system: string | null;
  ofed_version: string | null;
  fabric_type: string | null;
  collection_status: string;
  validation_status: string;
  readiness_score: number | null;
  last_collection_at: string | null;
  simulated: boolean;
  findings_count: number;
  critical_findings_count: number;
  high_findings_count: number;
  current_evidence_id?: string | null;
  upload_token_state?: string | null;
}

export interface UploadTokenSummary {
  id: string;
  engagement_id: string;
  node_id: string;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
  status: string;
  maximum_upload_bytes: number;
}

export interface EvidenceRecordSummary {
  id: string;
  engagement_id: string;
  node_id: string;
  collection_id: string;
  collector_version: string;
  collector_profile: string;
  manifest_schema_version: string;
  uploaded_at: string;
  collected_at: string;
  sanitized: boolean;
  simulated: boolean;
  command_count: number;
  collected_count: number;
  missing_count: number;
  failed_count: number;
  skipped_count: number;
  bundle_sha256: string;
  manifest_sha256: string;
  upload_token_id: string;
  ingestion_status: string;
  validation_warnings: string[];
  source_hostname_display: string;
  supersedes_evidence_id: string | null;
  storage_id: string;
}

export interface ActivityEntry {
  id: string;
  engagement_id: string;
  node_id: string | null;
  type: string;
  created_at: string;
  actor: string;
  message: string;
  metadata: Record<string, string | number | boolean | null>;
}

export function formatEngagementLabel(value: string): string {
  return value.replace(/[-_]+/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());
}

export function engagementStatusTone(status: string): "healthy" | "warning" | "critical" | "neutral" {
  if (["complete", "ready_for_review"].includes(status)) return "healthy";
  if (["collecting", "processing", "draft"].includes(status)) return "warning";
  if (status === "archived") return "neutral";
  return "critical";
}

export function acceptanceTone(status: string): "healthy" | "warning" | "critical" | "neutral" {
  if (status === "ready") return "healthy";
  if (status === "ready_with_observations" || status === "not_evaluated") return "warning";
  if (status === "remediation_required" || status === "failed") return "critical";
  return "neutral";
}

export function filterEngagements(
  engagements: Engagement[],
  query: string,
  status: string,
  platform: string,
): Engagement[] {
  const normalizedQuery = query.trim().toLowerCase();
  return engagements.filter((engagement) => {
    const matchesQuery = !normalizedQuery || [engagement.name, engagement.customer_name, engagement.platform_profile, ...engagement.tags]
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery);
    const matchesStatus = status === "all" || engagement.status === status;
    const matchesPlatform = platform === "all" || engagement.platform_profile === platform;
    return matchesQuery && matchesStatus && matchesPlatform;
  });
}
