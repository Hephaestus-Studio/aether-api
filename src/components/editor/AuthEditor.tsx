import { useState } from "react";
import { Box, Select, ActionIcon } from "@mantine/core";
import UndoableTextInput from "@/components/common/UndoableTextInput";
import {
  IconShieldOff,
  IconKey,
  IconUserCheck,
  IconShieldLock,
  IconArrowBackUp,
  IconEye,
  IconEyeOff,
  IconCopy,
  IconCheck,
  IconInfoCircle,
  IconLock,
  IconCloud,
  IconFileCode,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import type { AuthConfig } from "@/types/request";
import classes from "./AuthEditor.module.css";

interface AuthEditorProps {
  auth: AuthConfig;
  onChange: (v: AuthConfig) => void;
}

interface AuthTypeOption {
  id: string;
  name: string;
  icon: React.ComponentType<{ size: number }>;
  disabled?: boolean;
  comingSoon?: boolean;
}

const AUTH_TYPES: AuthTypeOption[] = [
  { id: "none", name: "No Auth", icon: IconShieldOff },
  { id: "inherit", name: "Inherit from parent", icon: IconArrowBackUp },
  { id: "bearer", name: "Bearer Token", icon: IconKey },
  { id: "basic", name: "Basic Auth", icon: IconUserCheck },
  { id: "apikey", name: "API Key", icon: IconShieldLock },
  { id: "oauth2", name: "OAuth 2.0", icon: IconLock, disabled: true, comingSoon: true },
  { id: "aws", name: "AWS Signature", icon: IconCloud, disabled: true, comingSoon: true },
  { id: "digest", name: "Digest Auth", icon: IconFileCode, disabled: true, comingSoon: true },
];

function safeBtoa(str: string): string {
  try {
    return btoa(unescape(encodeURIComponent(str)));
  } catch {
    return "";
  }
}

export default function AuthEditor({ auth, onChange }: Readonly<AuthEditorProps>) {
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState(false);

  const toggleSecret = (fieldKey: string) => {
    setShowSecret((prev) => ({ ...prev, [fieldKey]: !prev[fieldKey] }));
  };

  const handleTypeSelect = (typeId: string) => {
    switch (typeId) {
      case "bearer":
        onChange({
          type: "bearer",
          bearer: {
            token: auth.type === "bearer" ? auth.bearer.token : "",
            prefix: auth.type === "bearer" ? auth.bearer.prefix : "Bearer",
          },
        });
        break;
      case "basic":
        onChange({
          type: "basic",
          basic: {
            username: auth.type === "basic" ? auth.basic.username : "",
            password: auth.type === "basic" ? auth.basic.password : "",
          },
        });
        break;
      case "apikey":
        onChange({
          type: "apikey",
          apikey: {
            key: auth.type === "apikey" ? auth.apikey.key : "X-API-Key",
            value: auth.type === "apikey" ? auth.apikey.value : "",
            addTo: auth.type === "apikey" ? auth.apikey.addTo : "header",
          },
        });
        break;
      case "inherit":
        onChange({ type: "inherit" });
        break;
      case "none":
      default:
        onChange({ type: "none" });
        break;
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    notifications.show({
      title: "Copied to clipboard",
      message: text,
      color: "blue",
      autoClose: 2000,
    });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Box className={classes.container}>
      {/* Left Column: Auth Type Selector */}
      <Box className={classes.leftCol}>
        <Box className={classes.typeSection}>
          <div className={classes.sectionTitle}>Auth Method</div>
          <div className={classes.typeList}>
            {AUTH_TYPES.map((t) => {
              const Icon = t.icon;
              const isActive = auth.type === t.id;

              return (
                <button
                  key={t.id}
                  type="button"
                  disabled={t.disabled}
                  onClick={() => handleTypeSelect(t.id)}
                  className={`${classes.typeItem} ${isActive ? classes.typeItemActive : ""} ${
                    t.disabled ? classes.typeItemDisabled : ""
                  }`}
                >
                  <div className={classes.typeItemLeft}>
                    <Icon size={16} />
                    <span>{t.name}</span>
                  </div>
                  {t.comingSoon && <span className={classes.comingSoonBadge}>Soon</span>}
                </button>
              );
            })}
          </div>
        </Box>

        <Box className={classes.infoBox}>
          <div className={classes.infoTitle}>
            <IconInfoCircle size={14} />
            <span>Automatic Injection</span>
          </div>
          <div className={classes.infoDesc}>
            Authorization headers and parameters are resolved dynamically and injected when sending
            requests.
          </div>
        </Box>
      </Box>

      {/* Right Column: Configuration Form */}
      <Box className={classes.rightCol}>
        {/* None */}
        {auth.type === "none" && (
          <Box className={classes.stateCard}>
            <div className={classes.panelHeader}>
              <div>
                <div className={classes.panelTitle}>
                  <IconShieldOff size={18} color="var(--text-muted)" />
                  <span>No Authorization</span>
                </div>
                <div className={classes.panelDesc}>
                  This request does not use any authentication credentials or authorization headers.
                </div>
              </div>
            </div>
            <div className={classes.infoBanner}>
              <IconInfoCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>
                To add authentication, select an auth method such as <strong>Bearer Token</strong>,{" "}
                <strong>Basic Auth</strong>, or <strong>API Key</strong> from the list on the left.
              </span>
            </div>
          </Box>
        )}

        {/* Inherit */}
        {auth.type === "inherit" && (
          <Box className={classes.stateCard}>
            <div className={classes.panelHeader}>
              <div>
                <div className={classes.panelTitle}>
                  <IconArrowBackUp size={18} color="#38bdf8" />
                  <span>Inherit from Parent</span>
                </div>
                <div className={classes.panelDesc}>
                  This request inherits its authorization configuration directly from the parent
                  collection or folder.
                </div>
              </div>
            </div>
            <div className={classes.infoBanner}>
              <IconInfoCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>
                Any headers or credentials defined at the collection or folder level will be
                automatically applied when executing this request.
              </span>
            </div>
          </Box>
        )}

        {/* Bearer Token */}
        {auth.type === "bearer" && (
          <>
            <div className={classes.panelHeader}>
              <div>
                <div className={classes.panelTitle}>
                  <IconKey size={18} color="#60a5fa" />
                  <span>Bearer Token</span>
                </div>
                <div className={classes.panelDesc}>
                  The token will be prefixed and sent in the Authorization header.
                </div>
              </div>
            </div>

            <div className={classes.formGroup}>
              <div className={classes.fieldRow}>
                <div className={classes.fieldLabel}>
                  <span>Token</span>
                  <span className={classes.fieldHint}>
                    Supports &#123;&#123;variable&#125;&#125;
                  </span>
                </div>
                <UndoableTextInput
                  type={showSecret["bearer_token"] ? "text" : "password"}
                  value={auth.bearer.token}
                  onChange={(e) =>
                    onChange({
                      type: "bearer",
                      bearer: { ...auth.bearer, token: e.target.value },
                    })
                  }
                  placeholder="e.g. {{token}} or eyJhbGciOi..."
                  className={classes.inputField}
                  rightSection={
                    <ActionIcon
                      variant="subtle"
                      size="xs"
                      color="gray"
                      onClick={() => toggleSecret("bearer_token")}
                      title={showSecret["bearer_token"] ? "Hide token" : "Show token"}
                    >
                      {showSecret["bearer_token"] ? (
                        <IconEyeOff size={14} />
                      ) : (
                        <IconEye size={14} />
                      )}
                    </ActionIcon>
                  }
                />
              </div>

              <div className={classes.fieldRow}>
                <div className={classes.fieldLabel}>
                  <span>Header Prefix</span>
                  <span className={classes.fieldHint}>Default: Bearer</span>
                </div>
                <UndoableTextInput
                  value={auth.bearer.prefix ?? "Bearer"}
                  onChange={(e) =>
                    onChange({
                      type: "bearer",
                      bearer: { ...auth.bearer, prefix: e.target.value },
                    })
                  }
                  placeholder="Bearer"
                  className={classes.inputField}
                />
              </div>

              {/* Live Preview Card */}
              {auth.bearer.token.trim() && (
                <div className={classes.previewCard}>
                  <div className={classes.previewHeader}>
                    <span>Request Header Preview</span>
                    <span className={classes.previewBadge}>Generated</span>
                  </div>
                  <div className={classes.previewCodeBlock}>
                    <div className={classes.previewCodeText}>
                      <span className={classes.previewKey}>Authorization:</span>
                      <span className={classes.previewVal}>
                        {auth.bearer.prefix || "Bearer"}{" "}
                        {showSecret["bearer_token"]
                          ? auth.bearer.token
                          : auth.bearer.token.length > 12
                            ? `${auth.bearer.token.slice(0, 6)}••••${auth.bearer.token.slice(-4)}`
                            : "••••••••"}
                      </span>
                    </div>
                    <ActionIcon
                      variant="subtle"
                      size="xs"
                      color="gray"
                      onClick={() =>
                        copyToClipboard(
                          `Authorization: ${auth.bearer.prefix || "Bearer"} ${auth.bearer.token}`,
                        )
                      }
                      title="Copy header string"
                    >
                      {copied ? <IconCheck size={13} color="#4ade80" /> : <IconCopy size={13} />}
                    </ActionIcon>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Basic Auth */}
        {auth.type === "basic" && (
          <>
            <div className={classes.panelHeader}>
              <div>
                <div className={classes.panelTitle}>
                  <IconUserCheck size={18} color="#4ade80" />
                  <span>Basic Auth</span>
                </div>
                <div className={classes.panelDesc}>
                  Credentials will be encoded in Base64 and sent in the Authorization header.
                </div>
              </div>
            </div>

            <div className={classes.formGroup}>
              <div className={classes.fieldRow}>
                <div className={classes.fieldLabel}>
                  <span>Username</span>
                  <span className={classes.fieldHint}>
                    Supports &#123;&#123;variable&#125;&#125;
                  </span>
                </div>
                <UndoableTextInput
                  value={auth.basic.username}
                  onChange={(e) =>
                    onChange({
                      type: "basic",
                      basic: { ...auth.basic, username: e.target.value },
                    })
                  }
                  placeholder="Username"
                  className={classes.inputField}
                />
              </div>

              <div className={classes.fieldRow}>
                <div className={classes.fieldLabel}>
                  <span>Password</span>
                  <span className={classes.fieldHint}>
                    Supports &#123;&#123;variable&#125;&#125;
                  </span>
                </div>
                <UndoableTextInput
                  type={showSecret["basic_password"] ? "text" : "password"}
                  value={auth.basic.password}
                  onChange={(e) =>
                    onChange({
                      type: "basic",
                      basic: { ...auth.basic, password: e.target.value },
                    })
                  }
                  placeholder="Password"
                  className={classes.inputField}
                  rightSection={
                    <ActionIcon
                      variant="subtle"
                      size="xs"
                      color="gray"
                      onClick={() => toggleSecret("basic_password")}
                      title={showSecret["basic_password"] ? "Hide password" : "Show password"}
                    >
                      {showSecret["basic_password"] ? (
                        <IconEyeOff size={14} />
                      ) : (
                        <IconEye size={14} />
                      )}
                    </ActionIcon>
                  }
                />
              </div>

              {/* Live Preview Card */}
              {(auth.basic.username.trim() || auth.basic.password.trim()) && (
                <div className={classes.previewCard}>
                  <div className={classes.previewHeader}>
                    <span>Request Header Preview</span>
                    <span className={classes.previewBadge}>Generated</span>
                  </div>
                  <div className={classes.previewCodeBlock}>
                    <div className={classes.previewCodeText}>
                      <span className={classes.previewKey}>Authorization:</span>
                      <span className={classes.previewVal}>
                        Basic{" "}
                        {safeBtoa(`${auth.basic.username}:${auth.basic.password}`) ||
                          "••••••••••••"}
                      </span>
                    </div>
                    <ActionIcon
                      variant="subtle"
                      size="xs"
                      color="gray"
                      onClick={() =>
                        copyToClipboard(
                          `Authorization: Basic ${safeBtoa(
                            `${auth.basic.username}:${auth.basic.password}`,
                          )}`,
                        )
                      }
                      title="Copy header string"
                    >
                      {copied ? <IconCheck size={13} color="#4ade80" /> : <IconCopy size={13} />}
                    </ActionIcon>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* API Key */}
        {auth.type === "apikey" && (
          <>
            <div className={classes.panelHeader}>
              <div>
                <div className={classes.panelTitle}>
                  <IconShieldLock size={18} color="#facc15" />
                  <span>API Key</span>
                </div>
                <div className={classes.panelDesc}>
                  Inject an API key header or query parameter into the outgoing request.
                </div>
              </div>
            </div>

            <div className={classes.formGroup}>
              <div className={classes.fieldRow}>
                <div className={classes.fieldLabel}>
                  <span>Key Name</span>
                  <span className={classes.fieldHint}>e.g. X-API-Key</span>
                </div>
                <UndoableTextInput
                  value={auth.apikey.key}
                  onChange={(e) =>
                    onChange({
                      type: "apikey",
                      apikey: { ...auth.apikey, key: e.target.value },
                    })
                  }
                  placeholder="X-API-Key"
                  className={classes.inputField}
                />
              </div>

              <div className={classes.fieldRow}>
                <div className={classes.fieldLabel}>
                  <span>Value</span>
                  <span className={classes.fieldHint}>
                    Supports &#123;&#123;variable&#125;&#125;
                  </span>
                </div>
                <UndoableTextInput
                  type={showSecret["api_key"] ? "text" : "password"}
                  value={auth.apikey.value}
                  onChange={(e) =>
                    onChange({
                      type: "apikey",
                      apikey: { ...auth.apikey, value: e.target.value },
                    })
                  }
                  placeholder="API Key secret value"
                  className={classes.inputField}
                  rightSection={
                    <ActionIcon
                      variant="subtle"
                      size="xs"
                      color="gray"
                      onClick={() => toggleSecret("api_key")}
                      title={showSecret["api_key"] ? "Hide value" : "Show value"}
                    >
                      {showSecret["api_key"] ? <IconEyeOff size={14} /> : <IconEye size={14} />}
                    </ActionIcon>
                  }
                />
              </div>

              <div className={classes.fieldRow}>
                <div className={classes.fieldLabel}>
                  <span>Add To</span>
                  <span className={classes.fieldHint}>Location</span>
                </div>
                <Select
                  value={auth.apikey.addTo}
                  onChange={(val) =>
                    onChange({
                      type: "apikey",
                      apikey: {
                        ...auth.apikey,
                        addTo: (val as "header" | "query") || "header",
                      },
                    })
                  }
                  data={[
                    { label: "Header (Recommended)", value: "header" },
                    { label: "Query Params", value: "query" },
                  ]}
                  className={classes.selectField}
                  allowDeselect={false}
                />
              </div>

              {/* Live Preview Card */}
              {auth.apikey.key.trim() && (
                <div className={classes.previewCard}>
                  <div className={classes.previewHeader}>
                    <span>
                      {auth.apikey.addTo === "query" ? "Query Parameter Preview" : "Header Preview"}
                    </span>
                    <span className={classes.previewBadge}>Generated</span>
                  </div>
                  <div className={classes.previewCodeBlock}>
                    <div className={classes.previewCodeText}>
                      <span className={classes.previewKey}>
                        {auth.apikey.addTo === "query"
                          ? `?${auth.apikey.key}=`
                          : `${auth.apikey.key}:`}
                      </span>
                      <span className={classes.previewVal}>
                        {showSecret["api_key"]
                          ? auth.apikey.value || "<value>"
                          : auth.apikey.value.length > 8
                            ? `${auth.apikey.value.slice(0, 4)}••••${auth.apikey.value.slice(-3)}`
                            : "••••••••"}
                      </span>
                    </div>
                    <ActionIcon
                      variant="subtle"
                      size="xs"
                      color="gray"
                      onClick={() =>
                        copyToClipboard(
                          auth.apikey.addTo === "query"
                            ? `${auth.apikey.key}=${auth.apikey.value}`
                            : `${auth.apikey.key}: ${auth.apikey.value}`,
                        )
                      }
                      title="Copy string"
                    >
                      {copied ? <IconCheck size={13} color="#4ade80" /> : <IconCopy size={13} />}
                    </ActionIcon>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </Box>
    </Box>
  );
}
