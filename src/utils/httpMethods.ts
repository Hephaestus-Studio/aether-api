export interface HttpMethodDefinition {
  name: string;
  color: string;
  bgColor: string;
}

export const HTTP_METHODS: HttpMethodDefinition[] = [
  { name: "GET", color: "#22c55e", bgColor: "rgba(34, 197, 94, 0.15)" },
  { name: "POST", color: "#f59e0b", bgColor: "rgba(245, 158, 11, 0.15)" },
  { name: "PUT", color: "#3b82f6", bgColor: "rgba(59, 130, 246, 0.15)" },
  { name: "PATCH", color: "#a855f7", bgColor: "rgba(168, 85, 247, 0.15)" },
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
