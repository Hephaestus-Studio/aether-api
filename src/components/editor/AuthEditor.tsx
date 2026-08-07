import { Box, Select, TextInput, Group } from "@mantine/core";
import type { AuthConfig } from "@/types/request";

interface AuthEditorProps {
  auth: AuthConfig;
  onChange: (v: AuthConfig) => void;
}

export default function AuthEditor({ auth, onChange }: Readonly<AuthEditorProps>) {
  const handleTypeChange = (val: string) => {
    switch (val) {
      case "bearer":
        onChange({ type: "bearer", bearer: { token: "" } });
        break;
      case "basic":
        onChange({ type: "basic", basic: { username: "", password: "" } });
        break;
      case "inherit":
        onChange({ type: "inherit" });
        break;
      default:
        onChange({ type: "none" });
    }
  };

  return (
    <Box>
      <Select
        label="Auth Type"
        value={auth.type}
        onChange={(val) => handleTypeChange(val || "none")}
        data={[
          { label: "None", value: "none" },
          { label: "Inherit from parent", value: "inherit" },
          { label: "Bearer Token", value: "bearer" },
          { label: "Basic Auth", value: "basic" },
        ]}
        mb={16}
      />
      {auth.type === "bearer" && (
        <TextInput
          label="Token"
          value={auth.bearer.token}
          onChange={(e) => onChange({ type: "bearer", bearer: { token: e.target.value } })}
          placeholder="ey..."
        />
      )}
      {auth.type === "basic" && (
        <Group grow>
          <TextInput
            label="Username"
            value={auth.basic.username}
            onChange={(e) =>
              onChange({
                type: "basic",
                basic: { ...auth.basic, username: e.target.value },
              })
            }
          />
          <TextInput
            label="Password"
            type="password"
            value={auth.basic.password}
            onChange={(e) =>
              onChange({
                type: "basic",
                basic: { ...auth.basic, password: e.target.value },
              })
            }
          />
        </Group>
      )}
    </Box>
  );
}
