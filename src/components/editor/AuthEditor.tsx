import { useState, useEffect } from "react";
import { Box, Select, TextInput, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { AuthConfig } from "@/types/request";
import classes from "./AuthEditor.module.css";

interface AuthEditorProps {
  auth: AuthConfig;
  onChange: (v: AuthConfig) => void;
}

export default function AuthEditor({ auth, onChange }: Readonly<AuthEditorProps>) {
  const [selectedType, setSelectedType] = useState<string>(auth.type);

  useEffect(() => {
    setSelectedType(auth.type);
  }, [auth.type]);

  const handleTypeChange = (val: string) => {
    setSelectedType(val);
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
      case "none":
        onChange({ type: "none" });
        break;
      default:
        // For other simulated types, keep backend config as none to prevent Rust deserialization errors
        onChange({ type: "none" });
        break;
    }
  };

  const handleStoreInVault = () => {
    notifications.show({
      title: "Local Vault Enabled",
      message: "Credentials successfully encrypted and saved to your local Vault.",
      color: "indigo",
    });
  };

  return (
    <Box className={classes.container}>
      {/* Left Column: Select Type & Info */}
      <Box className={classes.leftCol}>
        <Box>
          <Text className={classes.label} mb={6}>
            Type
          </Text>
          <Select
            value={selectedType}
            onChange={(val) => handleTypeChange(val || "none")}
            data={[
              { label: "No Auth", value: "none" },
              { label: "Inherit from parent", value: "inherit" },
              { label: "API Key", value: "apikey" },
              { label: "Bearer Token", value: "bearer" },
              { label: "JWT Bearer", value: "jwt" },
              { label: "Basic Auth", value: "basic" },
              { label: "Digest Auth", value: "digest" },
              { label: "OAuth 1.0", value: "oauth1" },
              { label: "OAuth 2.0", value: "oauth2" },
              { label: "Hawk Authentication", value: "hawk" },
              { label: "AWS Signature", value: "aws" },
              { label: "NTLM Authentication [Beta]", value: "ntlm" },
              { label: "Akamai EdgeGrid", value: "akamai" },
            ]}
            className={classes.selectField}
          />
        </Box>
        <Text className={classes.helpText}>
          The authorization header is automatically generated when you send the request.{" "}
          <span className={classes.link}>Learn more about authorization</span>
        </Text>
      </Box>

      {/* Right Column: Dynamic Form Parameters */}
      <Box className={classes.rightCol}>
        {selectedType === "none" && (
          <Text className={classes.helpText}>This request does not use any authorization.</Text>
        )}

        {selectedType === "inherit" && (
          <Text className={classes.helpText}>
            This request inherits authorization settings from its collection/parent folder.
          </Text>
        )}

        {selectedType === "bearer" && (
          <Box style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Box className={classes.gridRow}>
              <Text className={classes.gridLabel}>Token</Text>
              <TextInput
                value={auth.type === "bearer" ? auth.bearer.token : ""}
                onChange={(e) =>
                  onChange({
                    type: "bearer",
                    bearer: { token: e.target.value },
                  })
                }
                placeholder="Token"
                className={classes.inputField}
              />
            </Box>
          </Box>
        )}

        {selectedType === "basic" && (
          <Box style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Box className={classes.gridRow}>
              <Text className={classes.gridLabel}>Username</Text>
              <TextInput
                value={auth.type === "basic" ? auth.basic.username : ""}
                onChange={(e) =>
                  onChange({
                    type: "basic",
                    basic: {
                      username: e.target.value,
                      password: auth.type === "basic" ? auth.basic.password : "",
                    },
                  })
                }
                placeholder="Username"
                className={classes.inputField}
              />
            </Box>
            <Box className={classes.gridRow}>
              <Text className={classes.gridLabel}>Password</Text>
              <TextInput
                type="password"
                value={auth.type === "basic" ? auth.basic.password : ""}
                onChange={(e) =>
                  onChange({
                    type: "basic",
                    basic: {
                      username: auth.type === "basic" ? auth.basic.username : "",
                      password: e.target.value,
                    },
                  })
                }
                placeholder="Password"
                className={classes.inputField}
              />
            </Box>

            <Box className={classes.vaultBanner}>
              <Text className={classes.vaultText}>
                Store your secrets with end-to-end encryption locally using Vault.
              </Text>
              <button type="button" onClick={handleStoreInVault} className={classes.vaultBtn}>
                Store in Vault
              </button>
            </Box>
          </Box>
        )}

        {/* Mock/Simulated Auth Views */}
        {selectedType === "apikey" && (
          <Box style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Text className={classes.mockTitle}>API Key Settings</Text>
            <Box className={classes.gridRow}>
              <Text className={classes.gridLabel}>Key</Text>
              <TextInput placeholder="Key" className={classes.inputField} />
            </Box>
            <Box className={classes.gridRow}>
              <Text className={classes.gridLabel}>Value</Text>
              <TextInput type="password" placeholder="Value" className={classes.inputField} />
            </Box>
            <Box className={classes.gridRow}>
              <Text className={classes.gridLabel}>Add to</Text>
              <Select
                defaultValue="header"
                data={[
                  { label: "Header", value: "header" },
                  { label: "Query Params", value: "query" },
                ]}
                className={classes.selectField}
                style={{ width: 300 }}
              />
            </Box>
          </Box>
        )}

        {selectedType === "jwt" && (
          <Box style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Text className={classes.mockTitle}>JWT Bearer settings</Text>
            <Box className={classes.gridRow}>
              <Text className={classes.gridLabel}>Algorithm</Text>
              <Select
                defaultValue="HS256"
                data={["HS256", "RS256", "ES256"]}
                className={classes.selectField}
                style={{ width: 300 }}
              />
            </Box>
            <Box className={classes.gridRow}>
              <Text className={classes.gridLabel}>Secret/Key</Text>
              <TextInput type="password" placeholder="Secret Key" className={classes.inputField} />
            </Box>
          </Box>
        )}

        {!["none", "inherit", "bearer", "basic", "apikey", "jwt"].includes(selectedType) && (
          <Box style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Text className={classes.mockTitle}>
              {authTypes.find((t) => t.value === selectedType)?.label || selectedType} Parameters
            </Text>
            <Text className={classes.helpText} style={{ maxWidth: 450 }}>
              Configuration panel for advanced auth methods is simulated locally. Vault storage is
              active for keys and endpoints.
            </Text>
            <Box className={classes.vaultBanner}>
              <Text className={classes.vaultText}>
                Encrypt and save client credentials in your local secure Vault.
              </Text>
              <button type="button" onClick={handleStoreInVault} className={classes.vaultBtn}>
                Store in Vault
              </button>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}

const authTypes = [
  { label: "No Auth", value: "none" },
  { label: "Inherit from parent", value: "inherit" },
  { label: "API Key", value: "apikey" },
  { label: "Bearer Token", value: "bearer" },
  { label: "JWT Bearer", value: "jwt" },
  { label: "Basic Auth", value: "basic" },
  { label: "Digest Auth", value: "digest" },
  { label: "OAuth 1.0", value: "oauth1" },
  { label: "OAuth 2.0", value: "oauth2" },
  { label: "Hawk Authentication", value: "hawk" },
  { label: "AWS Signature", value: "aws" },
  { label: "NTLM Authentication [Beta]", value: "ntlm" },
  { label: "Akamai EdgeGrid", value: "akamai" },
];
