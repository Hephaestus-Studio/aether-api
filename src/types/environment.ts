export interface EnvVariableItem {
  key: string;
  value: string;
  type: "text" | "secret";
  enabled: boolean;
}

export interface EnvironmentDetails {
  name: string;
  variables: EnvVariableItem[];
}

export interface EnvironmentSummary {
  name: string;
  path: string;
  isSecretMasked: boolean;
}
