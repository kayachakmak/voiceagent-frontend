"use client";

import { useReducer, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import type {
  AgentSummary,
  AgentDetail,
  AgentListResponse,
  PhoneNumber,
  BatchCallRecipient,
  BatchJob,
  SubmitBatchCallRequest,
} from "@/lib/types/batch-calling";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProductItem {
  product_name: string;
  quantity_threshold: string;
  price: string;
}

interface RecipientRow {
  phone_number: string;
  dynamicVars: Record<string, string>; // simple vars as strings, products as JSON
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

interface FormState {
  // Step 1: Phone number
  phoneNumbers: PhoneNumber[];
  phonesLoading: boolean;
  selectedPhoneId: string | null;

  // Step 2: Agent
  agents: AgentSummary[];
  agentsLoading: boolean;
  agentSearch: string;
  selectedAgent: AgentDetail | null;
  agentValidating: boolean;
  agentWarnings: string[];
  requiredVariables: string[];

  // Step 3: Recipients
  recipients: RecipientRow[];
  recipientErrors: string[];
  scheduledTime: string;
  timezone: string;

  // Step 4: Review & submit
  callName: string;
  isSubmitting: boolean;
  error: string | null;
}

type Action =
  | { type: "SET_PHONES"; phones: PhoneNumber[]; loading: boolean }
  | { type: "SET_SELECTED_PHONE"; phoneId: string | null }
  | { type: "SET_AGENTS"; agents: AgentSummary[]; loading: boolean }
  | { type: "SET_AGENT_SEARCH"; search: string }
  | { type: "SET_SELECTED_AGENT"; agent: AgentDetail | null; warnings: string[]; variables: string[] }
  | { type: "SET_AGENT_VALIDATING"; validating: boolean }
  | { type: "RESET_AGENT" }
  | { type: "ADD_RECIPIENT"; row: RecipientRow }
  | { type: "ADD_RECIPIENTS"; rows: RecipientRow[] }
  | { type: "REMOVE_RECIPIENT"; index: number }
  | { type: "SET_RECIPIENT_ERRORS"; errors: string[] }
  | { type: "SET_SCHEDULED_TIME"; time: string }
  | { type: "SET_TIMEZONE"; tz: string }
  | { type: "SET_CALL_NAME"; name: string }
  | { type: "SET_SUBMITTING"; submitting: boolean }
  | { type: "SET_ERROR"; error: string | null };

const initialState: FormState = {
  phoneNumbers: [],
  phonesLoading: true,
  selectedPhoneId: null,
  agents: [],
  agentsLoading: true,
  agentSearch: "",
  selectedAgent: null,
  agentValidating: false,
  agentWarnings: [],
  requiredVariables: [],
  recipients: [],
  recipientErrors: [],
  scheduledTime: "",
  timezone: "",
  callName: "",
  isSubmitting: false,
  error: null,
};

function reducer(state: FormState, action: Action): FormState {
  switch (action.type) {
    case "SET_PHONES":
      return {
        ...state,
        phoneNumbers: action.phones,
        phonesLoading: action.loading,
        selectedPhoneId:
          action.phones.length === 1 ? action.phones[0].phone_number_id : state.selectedPhoneId,
      };
    case "SET_SELECTED_PHONE":
      return { ...state, selectedPhoneId: action.phoneId };
    case "SET_AGENTS":
      return { ...state, agents: action.agents, agentsLoading: action.loading };
    case "SET_AGENT_SEARCH":
      return { ...state, agentSearch: action.search };
    case "SET_SELECTED_AGENT":
      return {
        ...state,
        selectedAgent: action.agent,
        agentWarnings: action.warnings,
        requiredVariables: action.variables,
        agentValidating: false,
        recipients: [],
        recipientErrors: [],
      };
    case "SET_AGENT_VALIDATING":
      return { ...state, agentValidating: action.validating };
    case "RESET_AGENT":
      return {
        ...state,
        selectedAgent: null,
        agentWarnings: [],
        requiredVariables: [],
        agentValidating: false,
        recipients: [],
        recipientErrors: [],
      };
    case "ADD_RECIPIENT":
      return { ...state, recipients: [...state.recipients, action.row], recipientErrors: [] };
    case "ADD_RECIPIENTS":
      return { ...state, recipients: [...state.recipients, ...action.rows], recipientErrors: [] };
    case "REMOVE_RECIPIENT":
      return { ...state, recipients: state.recipients.filter((_, i) => i !== action.index) };
    case "SET_RECIPIENT_ERRORS":
      return { ...state, recipientErrors: action.errors };
    case "SET_SCHEDULED_TIME":
      return { ...state, scheduledTime: action.time };
    case "SET_TIMEZONE":
      return { ...state, timezone: action.tz };
    case "SET_CALL_NAME":
      return { ...state, callName: action.name };
    case "SET_SUBMITTING":
      return { ...state, isSubmitting: action.submitting };
    case "SET_ERROR":
      return { ...state, error: action.error };
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Kolkata",
  "Australia/Sydney",
  "UTC",
];

const PRODUCTS_VAR = "products";
const HIDDEN_VARS = new Set(["system__time_utc"]);
const MIN_TABLE_ROWS = 10;

const PRODUCT_FIELDS: { key: keyof ProductItem; label: string; placeholder: string }[] = [
  { key: "product_name", label: "Product", placeholder: "Çimento" },
  { key: "quantity_threshold", label: "Qty Threshold", placeholder: "50" },
  { key: "price", label: "Price", placeholder: "120" },
];

const emptyProduct: ProductItem = { product_name: "", quantity_threshold: "", price: "" };

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Table input for recipients: phone_number + company_address (+ other simple vars) */
function RecipientsInputTable({
  columns,
  rows,
  onChange,
}: {
  columns: string[];
  rows: Record<string, string>[];
  onChange: (rows: Record<string, string>[]) => void;
}) {
  const updateCell = (rowIdx: number, col: string, value: string) => {
    const next = rows.map((r, i) => (i === rowIdx ? { ...r, [col]: value } : r));
    onChange(next);
  };

  return (
    <div className="overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-700">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50">
            <th className="w-8 px-2 py-2 text-center text-[10px] font-medium text-zinc-400">#</th>
            {columns.map((col) => (
              <th
                key={col}
                className="px-2 py-2 text-left font-mono text-[10px] font-medium text-zinc-500 dark:text-zinc-400"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className="border-b border-zinc-100 last:border-0 dark:border-zinc-800"
            >
              <td className="px-2 py-1 text-center text-[10px] text-zinc-300 dark:text-zinc-600">
                {i + 1}
              </td>
              {columns.map((col) => (
                <td key={col} className="px-1 py-1">
                  <input
                    type="text"
                    value={row[col] ?? ""}
                    onChange={(e) => updateCell(i, col, e.target.value)}
                    placeholder={col === "phone_number" ? "+905xxxxxxxxx" : col}
                    className="w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-sm text-zinc-900 placeholder-zinc-300 focus:border-zinc-300 focus:bg-white focus:outline-none dark:text-zinc-50 dark:placeholder-zinc-600 dark:focus:border-zinc-600 dark:focus:bg-zinc-800"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Confirmed recipients shown on the right side */
function ConfirmedRecipientsList({
  recipients,
  onRemove,
}: {
  recipients: { phone_number: string; company_address: string }[];
  onRemove: (i: number) => void;
}) {
  if (recipients.length === 0) {
    return (
      <div className="flex min-h-[120px] items-center justify-center rounded-md border border-dashed border-zinc-200 bg-zinc-50/50 dark:border-zinc-700 dark:bg-zinc-800/50">
        <span className="text-xs text-zinc-300 dark:text-zinc-600">no recipients added</span>
      </div>
    );
  }

  return (
    <div className="max-h-[320px] space-y-1 overflow-y-auto rounded-md border border-dashed border-zinc-200 bg-zinc-50/50 p-2 dark:border-zinc-700 dark:bg-zinc-800/50">
      {recipients.map((r, i) => (
        <div
          key={i}
          className="group flex items-center justify-between rounded bg-zinc-200 px-2.5 py-1.5 text-xs dark:bg-zinc-700"
        >
          <div className="flex gap-4">
            <span className="font-mono font-medium text-zinc-900 dark:text-zinc-50">
              {r.phone_number}
            </span>
            <span className="text-zinc-500 dark:text-zinc-400">{r.company_address}</span>
          </div>
          <button
            onClick={() => onRemove(i)}
            className="ml-2 text-zinc-400 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100 dark:text-zinc-500 dark:hover:text-red-400"
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  );
}

/** Table input for products: product_name + quantity_threshold + price */
function ProductsInputTable({
  rows,
  onChange,
}: {
  rows: ProductItem[];
  onChange: (rows: ProductItem[]) => void;
}) {
  const updateCell = (rowIdx: number, key: keyof ProductItem, value: string) => {
    const next = rows.map((r, i) => (i === rowIdx ? { ...r, [key]: value } : r));
    onChange(next);
  };

  return (
    <div className="overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-700">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50">
            <th className="w-8 px-2 py-2 text-center text-[10px] font-medium text-zinc-400">#</th>
            {PRODUCT_FIELDS.map((f) => (
              <th
                key={f.key}
                className="px-2 py-2 text-left font-mono text-[10px] font-medium text-zinc-500 dark:text-zinc-400"
              >
                {f.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className="border-b border-zinc-100 last:border-0 dark:border-zinc-800"
            >
              <td className="px-2 py-1 text-center text-[10px] text-zinc-300 dark:text-zinc-600">
                {i + 1}
              </td>
              {PRODUCT_FIELDS.map((f) => (
                <td key={f.key} className="px-1 py-1">
                  <input
                    type="text"
                    value={row[f.key]}
                    onChange={(e) => updateCell(i, f.key, e.target.value)}
                    placeholder={f.placeholder}
                    className="w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-sm text-zinc-900 placeholder-zinc-300 focus:border-zinc-300 focus:bg-white focus:outline-none dark:text-zinc-50 dark:placeholder-zinc-600 dark:focus:border-zinc-600 dark:focus:bg-zinc-800"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Confirmed products shown on the right side */
function ConfirmedProductsList({
  products,
  onRemove,
}: {
  products: ProductItem[];
  onRemove: (i: number) => void;
}) {
  if (products.length === 0) {
    return (
      <div className="flex min-h-[120px] items-center justify-center rounded-md border border-dashed border-zinc-200 bg-zinc-50/50 dark:border-zinc-700 dark:bg-zinc-800/50">
        <span className="text-xs text-zinc-300 dark:text-zinc-600">no products added</span>
      </div>
    );
  }

  return (
    <div className="max-h-[320px] space-y-1 overflow-y-auto rounded-md border border-dashed border-zinc-200 bg-zinc-50/50 p-2 dark:border-zinc-700 dark:bg-zinc-800/50">
      {products.map((p, i) => (
        <div
          key={i}
          className="group flex items-center justify-between rounded bg-zinc-200 px-2.5 py-1.5 text-xs dark:bg-zinc-700"
        >
          <span className="text-zinc-700 dark:text-zinc-300">
            <span className="font-medium">{p.product_name}</span>
            <span className="ml-2 text-zinc-400">
              qty: {p.quantity_threshold} &middot; price: {p.price}
            </span>
          </span>
          <button
            onClick={() => onRemove(i)}
            className="ml-2 text-zinc-400 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100 dark:text-zinc-500 dark:hover:text-red-400"
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function NewCampaignPage() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const router = useRouter();

  // Table rows for recipient input (phone_number + company_address)
  const makeEmptyRecipientRows = () =>
    Array.from({ length: MIN_TABLE_ROWS }, () => ({ phone_number: "", company_address: "" }));
  const [recipientInputRows, setRecipientInputRows] = useState(makeEmptyRecipientRows);
  const [confirmedRecipients, setConfirmedRecipients] = useState<
    { phone_number: string; company_address: string }[]
  >([]);

  // Table rows for product input
  const makeEmptyProductRows = () =>
    Array.from({ length: MIN_TABLE_ROWS }, () => ({ ...emptyProduct }));
  const [productInputRows, setProductInputRows] = useState(makeEmptyProductRows);
  const [confirmedProducts, setConfirmedProducts] = useState<ProductItem[]>([]);

  // Which simple variables (non-products) the agent needs
  const simpleVars = state.requiredVariables.filter(
    (v) => v !== PRODUCTS_VAR && !HIDDEN_VARS.has(v),
  );
  const hasProductsVar = state.requiredVariables.includes(PRODUCTS_VAR);

  // ── Data fetching ──

  useEffect(() => {
    apiGet<PhoneNumber[]>("batch-calling/phone-numbers")
      .then((data) => dispatch({ type: "SET_PHONES", phones: data, loading: false }))
      .catch(() => dispatch({ type: "SET_PHONES", phones: [], loading: false }));
  }, []);

  useEffect(() => {
    apiGet<AgentListResponse>("batch-calling/agents", { page_size: "100" })
      .then((data) => dispatch({ type: "SET_AGENTS", agents: data.agents, loading: false }))
      .catch(() => dispatch({ type: "SET_AGENTS", agents: [], loading: false }));
  }, []);

  const extractVariables = (prompt: string): string[] => {
    const matches = prompt.match(/\{\{([^}]+)\}\}/g);
    if (!matches) return [];
    const vars = matches.map((m) => m.slice(2, -2).trim());
    return [...new Set(vars)];
  };

  const selectAgent = async (agentId: string) => {
    dispatch({ type: "SET_AGENT_VALIDATING", validating: true });
    try {
      const agent = await apiGet<AgentDetail>(`batch-calling/agents/${agentId}`);
      const warnings: string[] = [];

      if (!agent.phone_numbers || agent.phone_numbers.length === 0) {
        warnings.push("Agent has no phone number assigned");
      }
      const promptText = agent.conversation_config?.agent?.prompt?.prompt;
      if (!promptText) {
        warnings.push("Agent has no prompt configured");
      }
      if (!agent.conversation_config?.tts?.voice_id) {
        warnings.push("Agent has no voice assigned");
      }

      const variables = promptText ? extractVariables(promptText) : [];

      dispatch({ type: "SET_SELECTED_AGENT", agent, warnings, variables });
      // Reset draft
      setRecipientInputRows(makeEmptyRecipientRows());
      setConfirmedRecipients([]);
      setProductInputRows(makeEmptyProductRows());
      setConfirmedProducts([]);
    } catch (err) {
      dispatch({
        type: "SET_ERROR",
        error: err instanceof ApiError ? err.message : "Failed to load agent details",
      });
      dispatch({ type: "SET_AGENT_VALIDATING", validating: false });
    }
  };

  // ── Draft helpers ──

  const confirmRecipients = () => {
    const filled = recipientInputRows.filter(
      (r) => r.phone_number.trim() && r.company_address.trim(),
    );
    if (filled.length === 0) return;

    // Check for duplicates against already-confirmed
    const existingPhones = new Set([
      ...confirmedRecipients.map((r) => r.phone_number),
      ...state.recipients.map((r) => r.phone_number),
    ]);
    const dupes: string[] = [];
    const newEntries: { phone_number: string; company_address: string }[] = [];
    for (const row of filled) {
      const phone = row.phone_number.trim();
      if (existingPhones.has(phone)) {
        dupes.push(phone);
      } else {
        existingPhones.add(phone);
        newEntries.push({ phone_number: phone, company_address: row.company_address.trim() });
      }
    }
    if (dupes.length > 0) {
      dispatch({ type: "SET_RECIPIENT_ERRORS", errors: dupes.map((p) => `${p} already added`) });
    }
    if (newEntries.length > 0) {
      setConfirmedRecipients((prev) => [...prev, ...newEntries]);
      // Clear the input rows
      setRecipientInputRows(makeEmptyRecipientRows());
    }
  };

  const removeConfirmedRecipient = (i: number) => {
    setConfirmedRecipients((prev) => prev.filter((_, idx) => idx !== i));
  };

  const confirmProducts = () => {
    const filled = productInputRows.filter((p) =>
      PRODUCT_FIELDS.every((f) => p[f.key].trim()),
    );
    if (filled.length === 0) return;
    setConfirmedProducts((prev) => [...prev, ...filled]);
    setProductInputRows(makeEmptyProductRows());
  };

  const removeConfirmedProduct = (i: number) => {
    setConfirmedProducts((prev) => prev.filter((_, idx) => idx !== i));
  };

  /** Commit all confirmed recipients + products into the reducer state */
  const addAllRecipients = () => {
    if (confirmedRecipients.length === 0) return;

    const productsJson = hasProductsVar ? JSON.stringify(confirmedProducts) : undefined;

    const rows: RecipientRow[] = confirmedRecipients.map((r) => {
      const dynamicVars: Record<string, string> = {};
      dynamicVars.company_address = r.company_address;
      if (productsJson) {
        dynamicVars[PRODUCTS_VAR] = productsJson;
      }
      return { phone_number: r.phone_number, dynamicVars };
    });

    dispatch({ type: "ADD_RECIPIENTS", rows });
    setConfirmedRecipients([]);
    setRecipientInputRows(makeEmptyRecipientRows());
    setConfirmedProducts([]);
    setProductInputRows(makeEmptyProductRows());
  };

  // ── Submit ──

  const handleSubmit = async () => {
    if (!state.selectedAgent || !state.callName || state.recipients.length === 0) return;

    dispatch({ type: "SET_SUBMITTING", submitting: true });
    dispatch({ type: "SET_ERROR", error: null });

    const recipients: BatchCallRecipient[] = state.recipients.map((r) => ({
      phone_number: r.phone_number,
      dynamic_variables:
        Object.keys(r.dynamicVars).length > 0 ? r.dynamicVars : undefined,
    }));

    const payload: SubmitBatchCallRequest = {
      call_name: state.callName,
      agent_id: state.selectedAgent.agent_id,
      recipients,
    };

    if (state.selectedPhoneId) {
      payload.agent_phone_number_id = state.selectedPhoneId;
    }
    if (state.scheduledTime) {
      payload.scheduled_time_unix = Math.floor(new Date(state.scheduledTime).getTime() / 1000);
    }
    if (state.timezone) {
      payload.timezone = state.timezone;
    }

    try {
      const result = await apiPost<BatchJob>("batch-calling/submit", payload);
      router.push(`/dashboard/batch-calling/${result.id}`);
    } catch (err) {
      dispatch({
        type: "SET_ERROR",
        error: err instanceof ApiError ? err.message : "Failed to submit campaign",
      });
      dispatch({ type: "SET_SUBMITTING", submitting: false });
    }
  };

  // ── Derived state ──

  const phoneReady = state.selectedPhoneId !== null;
  const agentReady = state.selectedAgent !== null && state.agentWarnings.length === 0;
  const hasRecipients = state.recipients.length > 0;
  const canSubmit = phoneReady && agentReady && state.callName.trim().length > 0 && hasRecipients && !state.isSubmitting;

  const canCommitRecipients =
    confirmedRecipients.length > 0 &&
    (!hasProductsVar || confirmedProducts.length > 0);

  const filteredAgents = state.agentSearch
    ? state.agents.filter((a) => a.name.toLowerCase().includes(state.agentSearch.toLowerCase()))
    : state.agents;

  // ── Render ──

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-6">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
              VoiceAgent
            </Link>
            <span className="text-sm text-zinc-400">/</span>
            <Link
              href="/dashboard/batch-calling"
              className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
            >
              Batch Calling
            </Link>
            <span className="text-sm text-zinc-400">/</span>
            <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300">New</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        <h1 className="mb-8 text-2xl font-bold text-zinc-900 dark:text-zinc-50">New Campaign</h1>

        {state.error && (
          <div className="mb-6 rounded-md bg-red-50 p-4 dark:bg-red-900/20">
            <p className="text-sm text-red-700 dark:text-red-400">{state.error}</p>
          </div>
        )}

        <div className="space-y-8">
          {/* ── Section 1: Select Phone Number ───────────────── */}
          <section className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-4 flex items-center gap-3">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                  phoneReady
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
                }`}
              >
                1
              </span>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Select Phone Number
              </h2>
            </div>

            {state.phonesLoading ? (
              <p className="text-sm text-zinc-500">Loading phone numbers...</p>
            ) : state.phoneNumbers.length === 0 ? (
              <p className="text-sm text-red-600 dark:text-red-400">
                No phone numbers available. Add a phone number in ElevenLabs first.
              </p>
            ) : (
              <select
                value={state.selectedPhoneId ?? ""}
                onChange={(e) =>
                  dispatch({ type: "SET_SELECTED_PHONE", phoneId: e.target.value || null })
                }
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
              >
                <option value="">Select a phone number...</option>
                {state.phoneNumbers.map((p) => (
                  <option key={p.phone_number_id} value={p.phone_number_id}>
                    {p.label ? `${p.label} — ` : ""}
                    {p.phone_number ?? p.phone_number_id}
                    {p.provider ? ` (${p.provider})` : ""}
                  </option>
                ))}
              </select>
            )}
          </section>

          {/* ── Section 2: Select Agent ──────────────────────── */}
          <section
            className={`rounded-lg border p-6 ${
              phoneReady
                ? "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
                : "border-zinc-100 bg-zinc-50 opacity-60 dark:border-zinc-800/50 dark:bg-zinc-900/50"
            }`}
          >
            <div className="mb-4 flex items-center gap-3">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                  agentReady
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
                }`}
              >
                2
              </span>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Select Agent
              </h2>
            </div>

            {!phoneReady ? (
              <p className="text-sm text-zinc-400">Select a phone number first</p>
            ) : state.agentsLoading ? (
              <p className="text-sm text-zinc-500">Loading agents...</p>
            ) : state.selectedAgent ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-zinc-900 dark:text-zinc-50">
                    {state.selectedAgent.name}
                  </p>
                  <p className="text-xs text-zinc-500">{state.selectedAgent.agent_id}</p>
                  {state.agentWarnings.map((w) => (
                    <p key={w} className="mt-1 text-sm text-yellow-600 dark:text-yellow-400">
                      Warning: {w}
                    </p>
                  ))}
                  {state.requiredVariables.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      <span className="text-xs text-zinc-400">Variables:</span>
                      {state.requiredVariables.map((v) => (
                        <span
                          key={v}
                          className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-[10px] text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                        >
                          {v}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => dispatch({ type: "RESET_AGENT" })}
                  className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50"
                >
                  Change
                </button>
              </div>
            ) : (
              <div>
                <input
                  type="text"
                  placeholder="Search agents..."
                  value={state.agentSearch}
                  onChange={(e) => dispatch({ type: "SET_AGENT_SEARCH", search: e.target.value })}
                  className="mb-3 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:placeholder-zinc-500"
                />
                {state.agentValidating ? (
                  <p className="text-sm text-zinc-500">Validating agent...</p>
                ) : (
                  <div className="max-h-48 overflow-y-auto rounded-md border border-zinc-200 dark:border-zinc-700">
                    {filteredAgents.length === 0 ? (
                      <p className="px-3 py-4 text-center text-sm text-zinc-400">No agents found</p>
                    ) : (
                      filteredAgents.map((agent) => (
                        <button
                          key={agent.agent_id}
                          onClick={() => selectAgent(agent.agent_id)}
                          className="flex w-full items-center justify-between border-b border-zinc-100 px-3 py-2.5 text-left text-sm hover:bg-zinc-50 last:border-0 dark:border-zinc-800 dark:hover:bg-zinc-800"
                        >
                          <span className="font-medium text-zinc-900 dark:text-zinc-50">
                            {agent.name}
                          </span>
                          <span className="text-xs text-zinc-400">
                            {agent.agent_id.slice(0, 8)}...
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* ── Section 3: Recipients ────────────────────────── */}
          <section
            className={`rounded-lg border p-6 ${
              phoneReady && agentReady
                ? "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
                : "border-zinc-100 bg-zinc-50 opacity-60 dark:border-zinc-800/50 dark:bg-zinc-900/50"
            }`}
          >
            <div className="mb-4 flex items-center gap-3">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                  hasRecipients
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
                }`}
              >
                3
              </span>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Add Recipients
              </h2>
            </div>

            {!(phoneReady && agentReady) ? (
              <p className="text-sm text-zinc-400">Complete the steps above first</p>
            ) : (
              <>
                {/* ── Recipients: phone_number + company_address ── */}
                <div className="space-y-6">
                  <div>
                    <h3 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Recipients
                    </h3>
                    <div className="flex gap-3">
                      {/* Left: table input */}
                      <div className="flex flex-1 flex-col gap-2">
                        <RecipientsInputTable
                          columns={["phone_number", "company_address"]}
                          rows={recipientInputRows}
                          onChange={(rows) =>
                            setRecipientInputRows(
                              rows.map((r) => ({
                                phone_number: r.phone_number ?? "",
                                company_address: r.company_address ?? "",
                              })),
                            )
                          }
                        />
                        <button
                          onClick={confirmRecipients}
                          disabled={
                            !recipientInputRows.some(
                              (r) => r.phone_number.trim() && r.company_address.trim(),
                            )
                          }
                          className="flex items-center gap-1.5 self-end rounded bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-30 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                        >
                          Add &rarr;
                        </button>
                      </div>

                      {/* Right: confirmed list */}
                      <div className="flex-1">
                        <ConfirmedRecipientsList
                          recipients={confirmedRecipients}
                          onRemove={removeConfirmedRecipient}
                        />
                      </div>
                    </div>
                  </div>

                  {/* ── Products (shared across all recipients) ── */}
                  {hasProductsVar && (
                    <div>
                      <h3 className="mb-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        Products
                      </h3>
                      <p className="mb-2 text-[11px] text-zinc-400">
                        These products apply to every recipient above.
                      </p>
                      <div className="flex gap-3">
                        {/* Left: table input */}
                        <div className="flex flex-1 flex-col gap-2">
                          <ProductsInputTable
                            rows={productInputRows}
                            onChange={setProductInputRows}
                          />
                          <button
                            onClick={confirmProducts}
                            disabled={
                              !productInputRows.some((p) =>
                                PRODUCT_FIELDS.every((f) => p[f.key].trim()),
                              )
                            }
                            className="flex items-center gap-1.5 self-end rounded bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-30 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                          >
                            Add &rarr;
                          </button>
                        </div>

                        {/* Right: confirmed list */}
                        <div className="flex-1">
                          <ConfirmedProductsList
                            products={confirmedProducts}
                            onRemove={removeConfirmedProduct}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Commit all to final recipients */}
                <button
                  onClick={addAllRecipients}
                  disabled={!canCommitRecipients}
                  className="mt-5 flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-30 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                >
                  Confirm Recipients
                </button>

                {/* Errors */}
                {state.recipientErrors.length > 0 && (
                  <div className="mt-3 rounded-md bg-yellow-50 p-3 dark:bg-yellow-900/20">
                    {state.recipientErrors.map((err, i) => (
                      <p key={i} className="text-xs text-yellow-700 dark:text-yellow-400">
                        {err}
                      </p>
                    ))}
                  </div>
                )}

                {/* ── Committed recipients list ── */}
                {state.recipients.length > 0 && (
                  <div className="mt-5">
                    <h3 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Committed Recipients ({state.recipients.length})
                    </h3>
                    <div className="space-y-1.5">
                      {state.recipients.map((r, i) => (
                        <div
                          key={i}
                          className="group flex items-center justify-between rounded-md border border-zinc-100 bg-zinc-50 px-3 py-2 text-xs dark:border-zinc-800 dark:bg-zinc-800/50"
                        >
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5">
                            <span className="font-mono font-medium text-zinc-900 dark:text-zinc-50">
                              {r.phone_number}
                            </span>
                            {Object.entries(r.dynamicVars).map(([k, v]) => (
                              <span key={k} className="text-zinc-500 dark:text-zinc-400">
                                <span className="text-zinc-400">{k}:</span>{" "}
                                {k === PRODUCTS_VAR
                                  ? `${(JSON.parse(v) as ProductItem[]).length} product${(JSON.parse(v) as ProductItem[]).length !== 1 ? "s" : ""}`
                                  : v}
                              </span>
                            ))}
                          </div>
                          <button
                            onClick={() => dispatch({ type: "REMOVE_RECIPIENT", index: i })}
                            className="text-zinc-300 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100 dark:text-zinc-600 dark:hover:text-red-400"
                          >
                            &times;
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Schedule ── */}
                <div className="mt-6 border-t border-zinc-100 pt-4 dark:border-zinc-800">
                  <h3 className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Schedule (optional)
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs text-zinc-500">Date & Time</label>
                      <input
                        type="datetime-local"
                        value={state.scheduledTime}
                        onChange={(e) =>
                          dispatch({ type: "SET_SCHEDULED_TIME", time: e.target.value })
                        }
                        className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-zinc-500">Timezone</label>
                      <select
                        value={state.timezone}
                        onChange={(e) => dispatch({ type: "SET_TIMEZONE", tz: e.target.value })}
                        className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                      >
                        <option value="">Auto-detect</option>
                        {TIMEZONES.map((tz) => (
                          <option key={tz} value={tz}>
                            {tz}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </>
            )}
          </section>

          {/* ── Section 4: Review & Submit ───────────────────── */}
          <section
            className={`rounded-lg border p-6 ${
              phoneReady && agentReady && hasRecipients
                ? "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
                : "border-zinc-100 bg-zinc-50 opacity-60 dark:border-zinc-800/50 dark:bg-zinc-900/50"
            }`}
          >
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-200 text-xs font-bold text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                4
              </span>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Review & Submit
              </h2>
            </div>

            {!(phoneReady && agentReady && hasRecipients) ? (
              <p className="text-sm text-zinc-400">Complete the steps above first</p>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Campaign Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={state.callName}
                    onChange={(e) => dispatch({ type: "SET_CALL_NAME", name: e.target.value })}
                    placeholder="e.g., March delivery notices"
                    className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:placeholder-zinc-500"
                  />
                </div>

                <div className="rounded-md bg-zinc-50 p-4 dark:bg-zinc-800">
                  <h3 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Summary
                  </h3>
                  <dl className="grid grid-cols-2 gap-y-1 text-sm">
                    <dt className="text-zinc-500">Phone Number</dt>
                    <dd className="text-zinc-900 dark:text-zinc-50">
                      {state.phoneNumbers.find((p) => p.phone_number_id === state.selectedPhoneId)
                        ?.phone_number ?? state.selectedPhoneId}
                    </dd>
                    <dt className="text-zinc-500">Agent</dt>
                    <dd className="text-zinc-900 dark:text-zinc-50">
                      {state.selectedAgent?.name}
                    </dd>
                    <dt className="text-zinc-500">Recipients</dt>
                    <dd className="text-zinc-900 dark:text-zinc-50">
                      {state.recipients.length}
                    </dd>
                    <dt className="text-zinc-500">Scheduled</dt>
                    <dd className="text-zinc-900 dark:text-zinc-50">
                      {state.scheduledTime
                        ? new Date(state.scheduledTime).toLocaleString()
                        : "Immediately"}
                    </dd>
                  </dl>
                </div>

                <div className="flex items-center gap-4">
                  <button
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                    className="rounded-lg bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                  >
                    {state.isSubmitting ? "Submitting..." : "Launch Campaign"}
                  </button>
                  <Link
                    href="/dashboard/batch-calling"
                    className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50"
                  >
                    Cancel
                  </Link>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
