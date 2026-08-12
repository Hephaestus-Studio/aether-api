import { Modal, Switch, Select, TextInput } from "@mantine/core";
import { useSnippetStore } from "@/stores/snippetStore";
import { SUPPORTED_LANGUAGES } from "@/utils/codeGenerators";
import classes from "./LanguageSettingsModal.module.css";

export default function LanguageSettingsModal() {
  const {
    isSettingsModalOpen,
    setSettingsModalOpen,
    selectedLanguage,
    options,
    updateLanguageOptions,
  } = useSnippetStore();

  const langMeta = SUPPORTED_LANGUAGES.find((l) => l.id === selectedLanguage);
  const title = `Settings for ${langMeta?.name || selectedLanguage}`;

  return (
    <Modal
      opened={isSettingsModalOpen}
      onClose={() => setSettingsModalOpen(false)}
      title={title}
      size="md"
      centered
      classNames={{
        content: classes.modalContent,
        header: classes.modalHeader,
        title: classes.modalTitle,
        body: classes.modalBody,
      }}
    >
      {/* Settings for cURL */}
      {selectedLanguage === "curl" && (
        <>
          <div className={classes.settingRow}>
            <div className={classes.settingInfo}>
              <div className={classes.settingLabel}>Generate multiline snippet</div>
              <div className={classes.settingDesc}>Split cURL command across multiple lines</div>
            </div>
            <Switch
              checked={options.curl.multiline}
              onChange={(e) =>
                updateLanguageOptions("curl", { multiline: e.currentTarget.checked })
              }
            />
          </div>

          <div className={classes.settingRow}>
            <div className={classes.settingInfo}>
              <div className={classes.settingLabel}>Use long form options</div>
              <div className={classes.settingDesc}>
                Use the long form for cURL options (--header instead of -H)
              </div>
            </div>
            <Switch
              checked={options.curl.longForm}
              onChange={(e) => updateLanguageOptions("curl", { longForm: e.currentTarget.checked })}
            />
          </div>

          <div className={classes.settingRow}>
            <div className={classes.settingInfo}>
              <div className={classes.settingLabel}>Line continuation character</div>
              <div className={classes.settingDesc}>
                Set character used to mark continuation (\ for Linux/macOS, ^ for Cmd, ` for
                PowerShell)
              </div>
            </div>
            <Select
              className={classes.controlField}
              value={options.curl.continuationChar}
              onChange={(val) =>
                updateLanguageOptions("curl", {
                  continuationChar: (val as "\\" | "^" | "`") || "\\",
                })
              }
              data={[
                { label: "\\ (Linux/macOS)", value: "\\" },
                { label: "^ (Windows cmd)", value: "^" },
                { label: "` (PowerShell)", value: "`" },
              ]}
              allowDeselect={false}
            />
          </div>

          <div className={classes.settingRow}>
            <div className={classes.settingInfo}>
              <div className={classes.settingLabel}>Quote Type</div>
              <div className={classes.settingDesc}>
                String denoting the quote type to use (single or double)
              </div>
            </div>
            <Select
              className={classes.controlField}
              value={options.curl.quoteType}
              onChange={(val) =>
                updateLanguageOptions("curl", {
                  quoteType: (val as "single" | "double") || "single",
                })
              }
              data={[
                { label: "single (')", value: "single" },
                { label: 'double (")', value: "double" },
              ]}
              allowDeselect={false}
            />
          </div>

          <div className={classes.settingRow}>
            <div className={classes.settingInfo}>
              <div className={classes.settingLabel}>Set request timeout (in seconds)</div>
              <div className={classes.settingDesc}>
                Set number of seconds the request should wait before timing out (0 for infinity)
              </div>
            </div>
            <TextInput
              type="number"
              className={classes.controlField}
              value={options.curl.timeout}
              onChange={(e) =>
                updateLanguageOptions("curl", { timeout: Number(e.target.value) || 0 })
              }
            />
          </div>

          <div className={classes.settingRow}>
            <div className={classes.settingInfo}>
              <div className={classes.settingLabel}>Follow redirects</div>
              <div className={classes.settingDesc}>Automatically follow HTTP redirects (-L)</div>
            </div>
            <Switch
              checked={options.curl.followRedirects}
              onChange={(e) =>
                updateLanguageOptions("curl", { followRedirects: e.currentTarget.checked })
              }
            />
          </div>

          <div className={classes.settingRow}>
            <div className={classes.settingInfo}>
              <div className={classes.settingLabel}>Follow original HTTP method</div>
              <div className={classes.settingDesc}>
                Redirect with the original HTTP method instead of redirecting with GET
              </div>
            </div>
            <Switch
              checked={options.curl.followOriginalMethod}
              onChange={(e) =>
                updateLanguageOptions("curl", { followOriginalMethod: e.currentTarget.checked })
              }
            />
          </div>

          <div className={classes.settingRow}>
            <div className={classes.settingInfo}>
              <div className={classes.settingLabel}>Trim request body fields</div>
              <div className={classes.settingDesc}>
                Remove white space and additional lines that may affect the server response
              </div>
            </div>
            <Switch
              checked={options.curl.trimBody}
              onChange={(e) => updateLanguageOptions("curl", { trimBody: e.currentTarget.checked })}
            />
          </div>

          <div className={classes.settingRow}>
            <div className={classes.settingInfo}>
              <div className={classes.settingLabel}>Use Silent Mode</div>
              <div className={classes.settingDesc}>
                Display data without showing the progress meter or error messages (-s)
              </div>
            </div>
            <Switch
              checked={options.curl.silent}
              onChange={(e) => updateLanguageOptions("curl", { silent: e.currentTarget.checked })}
            />
          </div>
        </>
      )}

      {/* Settings for Raw HTTP */}
      {selectedLanguage === "http" && (
        <>
          <div className={classes.settingRow}>
            <div className={classes.settingInfo}>
              <div className={classes.settingLabel}>Trim request body fields</div>
              <div className={classes.settingDesc}>
                Remove white space and additional lines that may affect the server response
              </div>
            </div>
            <Switch
              checked={options.http.trimBody}
              onChange={(e) => updateLanguageOptions("http", { trimBody: e.currentTarget.checked })}
            />
          </div>

          <div className={classes.settingRow}>
            <div className={classes.settingInfo}>
              <div className={classes.settingLabel}>HTTP Protocol Version</div>
              <div className={classes.settingDesc}>Specify HTTP version string in request line</div>
            </div>
            <Select
              className={classes.controlField}
              value={options.http.httpVersion}
              onChange={(val) =>
                updateLanguageOptions("http", {
                  httpVersion: (val as "HTTP/1.1" | "HTTP/2") || "HTTP/1.1",
                })
              }
              data={["HTTP/1.1", "HTTP/2"]}
              allowDeselect={false}
            />
          </div>
        </>
      )}

      {/* Settings for Rust - reqwest */}
      {selectedLanguage === "rust_reqwest" && (
        <>
          <div className={classes.settingRow}>
            <div className={classes.settingInfo}>
              <div className={classes.settingLabel}>Set indentation count</div>
              <div className={classes.settingDesc}>
                Set the number of indentation characters to add per code level
              </div>
            </div>
            <TextInput
              type="number"
              className={classes.controlField}
              value={options.rust_reqwest.indentCount}
              onChange={(e) =>
                updateLanguageOptions("rust_reqwest", { indentCount: Number(e.target.value) || 4 })
              }
            />
          </div>

          <div className={classes.settingRow}>
            <div className={classes.settingInfo}>
              <div className={classes.settingLabel}>Set indentation type</div>
              <div className={classes.settingDesc}>
                Select the character used to indent lines of code
              </div>
            </div>
            <Select
              className={classes.controlField}
              value={options.rust_reqwest.indentType}
              onChange={(val) =>
                updateLanguageOptions("rust_reqwest", {
                  indentType: (val as "space" | "tab") || "space",
                })
              }
              data={[
                { label: "Space", value: "space" },
                { label: "Tab", value: "tab" },
              ]}
              allowDeselect={false}
            />
          </div>

          <div className={classes.settingRow}>
            <div className={classes.settingInfo}>
              <div className={classes.settingLabel}>Set request timeout</div>
              <div className={classes.settingDesc}>
                Set number of milliseconds the request should wait before timing out (0 for
                infinity)
              </div>
            </div>
            <TextInput
              type="number"
              className={classes.controlField}
              value={options.rust_reqwest.timeout}
              onChange={(e) =>
                updateLanguageOptions("rust_reqwest", { timeout: Number(e.target.value) || 0 })
              }
            />
          </div>

          <div className={classes.settingRow}>
            <div className={classes.settingInfo}>
              <div className={classes.settingLabel}>Follow redirects</div>
              <div className={classes.settingDesc}>Automatically follow HTTP redirects</div>
            </div>
            <Switch
              checked={options.rust_reqwest.followRedirects}
              onChange={(e) =>
                updateLanguageOptions("rust_reqwest", { followRedirects: e.currentTarget.checked })
              }
            />
          </div>

          <div className={classes.settingRow}>
            <div className={classes.settingInfo}>
              <div className={classes.settingLabel}>Trim request body fields</div>
              <div className={classes.settingDesc}>
                Remove white space and additional lines that may affect the server response
              </div>
            </div>
            <Switch
              checked={options.rust_reqwest.trimBody}
              onChange={(e) =>
                updateLanguageOptions("rust_reqwest", { trimBody: e.currentTarget.checked })
              }
            />
          </div>
        </>
      )}

      {/* Settings for other languages */}
      {!["curl", "http", "rust_reqwest"].includes(selectedLanguage) && (
        <>
          <div className={classes.settingRow}>
            <div className={classes.settingInfo}>
              <div className={classes.settingLabel}>Trim request body fields</div>
              <div className={classes.settingDesc}>
                Remove white space and additional lines that may affect the server response
              </div>
            </div>
            <Switch
              checked={(options as any)[selectedLanguage]?.trimBody ?? false}
              onChange={(e) =>
                updateLanguageOptions(
                  selectedLanguage as any,
                  {
                    trimBody: e.currentTarget.checked,
                  } as any,
                )
              }
            />
          </div>
        </>
      )}
    </Modal>
  );
}
