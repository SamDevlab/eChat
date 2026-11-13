export const validateBaseUrl = (value: string): string => {
  const parsed = new URL(value.trim());
  const localHttp = process.env.NODE_ENV !== "production" && parsed.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsed.hostname);
  if (parsed.protocol !== "https:" && !localHttp) throw new Error("Base URL deve usar HTTPS; HTTP só é permitido para localhost em desenvolvimento");
  if (parsed.username || parsed.password) throw new Error("Base URL não pode conter credenciais");
  parsed.hash = "";
  parsed.search = "";
  return parsed.toString().replace(/\/$/, "");
};

export const sanitizedProviderError = (status: number, message = "Erro no provider"): string => {
  if (status === 401) return "AUTHENTICATION_FAILED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "ACCOUNT_NOT_FOUND";
  if (status >= 500) return "PROVIDER_UNAVAILABLE";
  return message.includes("Timeout") ? "TIMEOUT" : "PROVIDER_ERROR";
};
