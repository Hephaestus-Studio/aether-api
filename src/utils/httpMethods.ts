export interface HttpMethodDefinition {
  name: string;
  color: string;
  bgColor: string;
}

export const HTTP_METHODS: HttpMethodDefinition[] = [
  { name: "GET", color: "#4ade80", bgColor: "rgba(74, 222, 128, 0.15)" },
  { name: "POST", color: "#facc15", bgColor: "rgba(250, 204, 21, 0.15)" },
  { name: "PUT", color: "#38bdf8", bgColor: "rgba(56, 189, 248, 0.15)" },
  { name: "PATCH", color: "#c084fc", bgColor: "rgba(192, 132, 252, 0.15)" },
  { name: "DELETE", color: "#f87171", bgColor: "rgba(248, 113, 113, 0.15)" },
  { name: "HEAD", color: "#34d399", bgColor: "rgba(52, 211, 153, 0.15)" },
  { name: "OPTIONS", color: "#f472b6", bgColor: "rgba(244, 114, 182, 0.15)" },
];

export const getMethodColor = (method?: string): string => {
  if (!method) return "#22c55e";
  const m = method.toUpperCase();
  const found = HTTP_METHODS.find((item) => item.name === m);
  return found ? found.color : "#9ca3af";
};

export const getMethodBgColor = (method?: string): string => {
  if (!method) return "rgba(34, 197, 94, 0.15)";
  const m = method.toUpperCase();
  const found = HTTP_METHODS.find((item) => item.name === m);
  return found ? found.bgColor : "rgba(156, 163, 175, 0.15)";
};

export const getStatusColor = (status?: number): string => {
  if (!status) return "#ef4444";
  if (status >= 100 && status < 200) return "#06b6d4"; // 1xx Informational (Cyan)
  if (status >= 200 && status < 300) return "#22c55e"; // 2xx Success (Green)
  if (status >= 300 && status < 400) return "#f59e0b"; // 3xx Redirection (Yellow / Amber)
  if (status >= 400 && status < 500) return "#f97316"; // 4xx Client Error (Orange / Coral)
  if (status >= 500) return "#ef4444"; // 5xx Server Error (Red)
  return "#9ca3af";
};
