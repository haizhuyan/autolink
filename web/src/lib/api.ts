import "server-only";

// 后端（FastAPI）地址，只在服务端使用，不暴露给浏览器
const API_URL = (process.env.API_URL ?? "http://127.0.0.1:8000").replace(/\/+$/, "");

type FastApiDetail = string | { loc?: (string | number)[]; msg?: string }[] | undefined;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly detail: FastApiDetail,
  ) {
    super(typeof detail === "string" ? detail : `API 请求失败（${status}）`);
    this.name = "ApiError";
  }

  /** 422 校验错误按字段汇总：{ name: ["..."] } */
  fieldErrors(): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    if (!Array.isArray(this.detail)) return out;
    for (const e of this.detail) {
      const key = String(e.loc?.filter((p) => p !== "body").at(0) ?? "");
      if (key) (out[key] ??= []).push(e.msg ?? "无效");
    }
    return out;
  }
}

type Options = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  token?: string;
  json?: unknown;
  form?: FormData;
  query?: Record<string, string | number | undefined>;
};

export async function apiFetch<T>(path: string, { method = "GET", token, json, form, query }: Options = {}): Promise<T> {
  const url = new URL(API_URL + path);
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  }
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  let body: BodyInit | undefined;
  if (json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(json);
  } else if (form) {
    body = form;
  }

  const res = await fetch(url, { method, headers, body });
  if (!res.ok) {
    let detail: FastApiDetail;
    try {
      detail = ((await res.json()) as { detail?: FastApiDetail }).detail;
    } catch {
      detail = undefined;
    }
    throw new ApiError(res.status, detail);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}
