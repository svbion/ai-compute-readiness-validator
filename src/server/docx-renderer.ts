import crypto from "crypto";
import fs from "fs";
import path from "path";
import type { ReportRecord } from "./reports";

export const DOCX_TEMPLATE_VERSION = "1.0.0";
export const DOCX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

type StoreDoc = Record<string, any>;

type DocxGenerationMetadata = {
  file_path: string;
  mime_type: string;
  size_bytes: number;
  sha256: string;
  generated_at: string;
  template_version: string;
};

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let c = index;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(input: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of input) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()): { time: number; date: number } {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, date: dosDate };
}

function zipStored(files: { name: string; content: string | Buffer }[]): Buffer {
  const chunks: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  const stamp = dosDateTime();
  for (const file of files) {
    const name = Buffer.from(file.name, "utf8");
    const data = Buffer.isBuffer(file.content) ? file.content : Buffer.from(file.content, "utf8");
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(stamp.time, 10);
    local.writeUInt16LE(stamp.date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    chunks.push(local, name, data);

    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(0, 8);
    entry.writeUInt16LE(0, 10);
    entry.writeUInt16LE(stamp.time, 12);
    entry.writeUInt16LE(stamp.date, 14);
    entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(data.length, 20);
    entry.writeUInt32LE(data.length, 24);
    entry.writeUInt16LE(name.length, 28);
    entry.writeUInt16LE(0, 30);
    entry.writeUInt16LE(0, 32);
    entry.writeUInt16LE(0, 34);
    entry.writeUInt16LE(0, 36);
    entry.writeUInt32LE(0, 38);
    entry.writeUInt32LE(offset, 42);
    central.push(entry, name);
    offset += local.length + name.length + data.length;
  }
  const centralStart = offset;
  const centralBuffer = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuffer.length, 12);
  end.writeUInt32LE(centralStart, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...chunks, centralBuffer, end]);
}

function esc(value: unknown): string {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&apos;", "\"": "&quot;" }[char] ?? char));
}

function text(value: unknown, fallback = "Not collected"): string {
  const cleaned = String(value ?? "").trim();
  return cleaned || fallback;
}

function paragraph(value: unknown, style?: string): string {
  const styleXml = style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : "";
  return `<w:p>${styleXml}<w:r><w:t xml:space="preserve">${esc(value)}</w:t></w:r></w:p>`;
}

function pageBreak(): string { return `<w:p><w:r><w:br w:type="page"/></w:r></w:p>`; }

function table(rows: unknown[][]): string {
  return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/><w:left w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/><w:right w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/></w:tblBorders></w:tblPr>${rows.map((row) => `<w:tr>${row.map((cell) => `<w:tc><w:tcPr><w:tcW w:w="2400" w:type="dxa"/></w:tcPr>${paragraph(cell)}</w:tc>`).join("")}</w:tr>`).join("")}</w:tbl>`;
}

function selectedValidations(report: ReportRecord, document: StoreDoc): any[] {
  const validations = Array.isArray(document.validations) ? document.validations : [];
  if (report.validation_ids?.length) return validations.filter((validation: any) => report.validation_ids.includes(validation.id));
  if (report.scope_type === "validation_run" && report.scope_id) return validations.filter((validation: any) => validation.id === report.scope_id);
  return validations;
}

function resultRows(validationIds: string[], document: StoreDoc): any[] {
  const results = Array.isArray(document.validation_results) ? document.validation_results : [];
  return results.filter((result: any) => validationIds.includes(result.validation_id));
}

function selectedAgents(report: ReportRecord, validations: any[], document: StoreDoc): any[] {
  const agents = Array.isArray(document.validation_agents) ? document.validation_agents : [];
  const ids = new Set([...(report.agent_ids ?? []), ...validations.map((validation) => validation.agent_id).filter(Boolean)]);
  return ids.size ? agents.filter((agent: any) => ids.has(agent.id)) : agents;
}

function selectedBenchmarks(report: ReportRecord, document: StoreDoc): any[] {
  const benchmarks = Array.isArray(document.benchmark_runs) ? document.benchmark_runs : [];
  return report.benchmark_ids?.length ? benchmarks.filter((run: any) => report.benchmark_ids.includes(run.id)) : benchmarks;
}

function selectedEvidence(report: ReportRecord, validationIds: string[], document: StoreDoc): any[] {
  const evidence = Array.isArray(document.evidence_records) ? document.evidence_records : [];
  return report.evidence_ids?.length ? evidence.filter((record: any) => report.evidence_ids.includes(record.id)) : evidence.filter((record: any) => !record.validation_id || validationIds.includes(record.validation_id));
}

function buildDocumentXml(report: ReportRecord, document: StoreDoc, generatedAt: string): string {
  const validations = selectedValidations(report, document);
  const validationIds = [...new Set([...(report.validation_ids ?? []), ...validations.map((validation) => validation.id)])];
  const results = resultRows(validationIds, document);
  const agents = selectedAgents(report, validations, document);
  const benchmarks = selectedBenchmarks(report, document);
  const evidence = selectedEvidence(report, validationIds, document);
  const gpuRows = results.flatMap((result: any) => Array.isArray(result.structured_result?.gpus) ? result.structured_result.gpus.map((gpu: any) => [text(result.node_id ?? result.agent_id, "Not available"), text(gpu.index), text(gpu.name ?? gpu.model, "Not collected"), text(gpu.uuid), text(gpu.memory_total ?? gpu.memoryTotal, "Not collected")]) : []);
  const body = [
    paragraph("GPUValidator Report", "Title"),
    paragraph(report.name, "Title"),
    paragraph(`Generated by Sabion P Frazier`),
    paragraph(`Purpose: GPUValidator interview demonstration`),
    paragraph(`Customer: ${text(report.customer, "Not available")}`),
    paragraph(`Confidentiality: ${text(report.confidentiality)}`),
    paragraph(`Report version: v${report.version}`),
    paragraph(`Generated at: ${generatedAt}`),
    pageBreak(),
    paragraph("Document Control", "Heading1"),
    table([["Field", "Value"], ["Report ID", report.report_id], ["Report Type", report.report_type], ["Scope", `${report.scope_type} / ${text(report.scope_id, "Not available")}`], ["Author", report.author_name], ["Purpose", report.purpose], ["Confidentiality", report.confidentiality], ["Version", `v${report.version}`]]),
    paragraph("Executive Summary", "Heading1"),
    paragraph("This DOCX was generated server-side from selected GPUValidator report records. Missing values remain explicit and no measurements are fabricated."),
    paragraph("Hardware Inventory", "Heading1"),
    table([["Agent", "Hostname", "Status", "GPU Count"], ...(agents.length ? agents.map((agent: any) => [text(agent.name), text(agent.hostname), text(agent.status), text(agent.gpu_count, "Not collected")]) : [["Not available", "Not available", "Not available", "Not collected"]])]),
    paragraph("GPU Inventory", "Heading1"),
    table([["Node", "Index", "Model", "UUID", "Memory"], ...(gpuRows.length ? gpuRows : [["Not collected", "Not collected", "Not collected", "Not collected", "Not collected"]])]),
    paragraph("Validation Results", "Heading1"),
    table([["Validation", "Profile", "State", "Command", "Result"], ...(results.length ? results.map((result: any) => [text(result.validation_id), text(validations.find((validation) => validation.id === result.validation_id)?.profile, "Not available"), text(result.state, "Validation not run"), text(result.command_evidence?.command_type ?? result.job_id, "Not available"), text(result.structured_result?.driver_version ?? result.structured_result?.cuda_version ?? result.stdout, "Not collected")]) : [["Validation not run", "Not available", "Validation not run", "Not available", "Not collected"]])]),
    paragraph("Benchmark Results", "Heading1"),
    table([["Benchmark", "Type", "Status", "Primary Metric"], ...(benchmarks.length ? benchmarks.map((run: any) => [text(run.id), text(run.benchmark_type), text(run.status), text(run.metrics?.bus_bandwidth_gbps ?? run.metrics?.throughput, "Not collected")]) : [["Not available", "Not available", "Not available", "Not collected"]])]),
    paragraph("Findings", "Heading1"),
    table([["Finding", "Severity", "Description"], ...((report.finding_ids?.length ? report.finding_ids : validations.filter((validation) => ["failed", "timed_out", "cancelled"].includes(validation.state)).map((validation) => validation.id)).map((finding) => [finding, "Observation", "Review selected validation evidence and benchmark context."]))]),
    paragraph("Recommended Remediation", "Heading1"),
    paragraph("Collect missing validation outputs, re-run unavailable validations, and review benchmark records before customer-facing performance claims."),
    paragraph("Evidence References", "Heading1"),
    table([["Evidence", "Node", "Status", "Collected", "Missing"], ...(evidence.length ? evidence.map((record: any) => [text(record.id), text(record.node_id, "Not available"), text(record.ingestion_status, "Not available"), text(record.collected_count, "Not collected"), text(record.missing_count, "Not collected")]) : [["Not available", "Not available", "Not available", "Not collected", "Not collected"]])]),
    paragraph("Report Provenance", "Heading1"),
    table([["Lineage", "Values"], ["Agents", agents.map((agent: any) => agent.id).join(", ") || "Not available"], ["Validations", validationIds.join(", ") || "Validation not run"], ["Benchmarks", [...new Set([...(report.benchmark_ids ?? []), ...benchmarks.map((run: any) => run.id)])].join(", ") || "Not available"], ["Evidence", evidence.map((record: any) => record.id).join(", ") || "Not available"]]),
  ].join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body}<w:sectPr><w:headerReference w:type="default" r:id="rIdHeader1"/><w:footerReference w:type="default" r:id="rIdFooter1"/><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1080" w:bottom="1440" w:left="1080" w:header="720" w:footer="720"/></w:sectPr></w:body></w:document>`;
}

function relationshipsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
}

function documentRelationshipsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdHeader1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/><Relationship Id="rIdFooter1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>`;
}

function contentTypesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`;
}

function headerXml(report: ReportRecord) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${paragraph(`GPUValidator — ${report.name} — ${report.confidentiality} — v${report.version}`)}</w:hdr>`;
}

function footerXml(generatedAt: string) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:r><w:t>Generated by Sabion P Frazier · Purpose: GPUValidator interview demonstration · Page </w:t></w:r><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText>PAGE</w:instrText></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r><w:r><w:t> · ${esc(generatedAt)}</w:t></w:r></w:p></w:ftr>`;
}

function coreXml(report: ReportRecord, generatedAt: string) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(report.name)}</dc:title><dc:creator>Sabion P Frazier</dc:creator><dc:description>GPUValidator interview demonstration</dc:description><dcterms:created xsi:type="dcterms:W3CDTF">${esc(generatedAt)}</dcterms:created></cp:coreProperties>`;
}

export function generateDocxReport(report: ReportRecord, document: StoreDoc, outputPath: string, generatedAt = new Date().toISOString()): DocxGenerationMetadata {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true, mode: 0o700 });
  const archive = zipStored([
    { name: "[Content_Types].xml", content: contentTypesXml() },
    { name: "_rels/.rels", content: relationshipsXml() },
    { name: "word/_rels/document.xml.rels", content: documentRelationshipsXml() },
    { name: "word/document.xml", content: buildDocumentXml(report, document, generatedAt) },
    { name: "word/header1.xml", content: headerXml(report) },
    { name: "word/footer1.xml", content: footerXml(generatedAt) },
    { name: "docProps/core.xml", content: coreXml(report, generatedAt) },
  ]);
  fs.writeFileSync(outputPath, archive, { mode: 0o600 });
  const docx = fs.readFileSync(outputPath);
  return {
    file_path: outputPath,
    mime_type: DOCX_MIME_TYPE,
    size_bytes: docx.length,
    sha256: crypto.createHash("sha256").update(docx).digest("hex"),
    generated_at: generatedAt,
    template_version: DOCX_TEMPLATE_VERSION,
  };
}
