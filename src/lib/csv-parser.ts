import type { BatchCallRecipient } from "@/lib/types/batch-calling";

export interface CsvParseResult {
  recipients: BatchCallRecipient[];
  errors: string[];
}

export async function parseCsvFile(file: File): Promise<CsvParseResult> {
  const text = await file.text();
  return parseCsvText(text);
}

export function parseCsvText(text: string): CsvParseResult {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { recipients: [], errors: ["CSV file is empty"] };
  }

  const headers = lines[0].split(",").map((h) => h.trim());
  const phoneIndex = headers.findIndex(
    (h) => h.toLowerCase() === "phone_number",
  );

  if (phoneIndex === -1) {
    return {
      recipients: [],
      errors: ['CSV must have a "phone_number" column'],
    };
  }

  const dynamicHeaders = headers.filter((_, i) => i !== phoneIndex);
  const recipients: BatchCallRecipient[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    const phone = cols[phoneIndex];

    if (!phone) {
      errors.push(`Row ${i + 1}: missing phone number`);
      continue;
    }

    if (seen.has(phone)) {
      errors.push(`Row ${i + 1}: duplicate phone number ${phone}`);
      continue;
    }
    seen.add(phone);

    const recipient: BatchCallRecipient = { phone_number: phone };

    if (dynamicHeaders.length > 0) {
      const vars: Record<string, string> = {};
      for (const header of dynamicHeaders) {
        const colIndex = headers.indexOf(header);
        const value = cols[colIndex];
        if (value) {
          vars[header] = value;
        }
      }
      if (Object.keys(vars).length > 0) {
        recipient.dynamic_variables = vars;
      }
    }

    recipients.push(recipient);
  }

  return { recipients, errors };
}
