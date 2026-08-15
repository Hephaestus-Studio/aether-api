import { useState } from "react";
import { Modal } from "@mantine/core";
import {
  IconInfoCircle,
  IconScale,
  IconShieldLock,
  IconBolt,
  IconFolders,
  IconEyeOff,
  IconCopy,
  IconCheck,
} from "@tabler/icons-react";
import logoUrl from "@/assets/logo.svg";
import clsx from "clsx";
import classes from "./AboutModal.module.css";

interface AboutModalProps {
  opened: boolean;
  onClose: () => void;
}

const MIT_LICENSE_TEXT = `MIT License

Copyright (c) 2026 Hephaestus Studio

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;

export default function AboutModal({ opened, onClose }: Readonly<AboutModalProps>) {
  const [activeTab, setActiveTab] = useState<"overview" | "license" | "privacy">("overview");
  const [copiedLicense, setCopiedLicense] = useState(false);

  const handleCopyLicense = async () => {
    try {
      await navigator.clipboard.writeText(MIT_LICENSE_TEXT);
      setCopiedLicense(true);
      setTimeout(() => setCopiedLicense(false), 2000);
    } catch {}
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="md"
      centered
      withCloseButton
      title={<span className={classes.modalTitle}>About Aether API</span>}
      classNames={{
        content: classes.modalContent,
        header: classes.modalHeader,
        body: classes.modalBody,
      }}
    >
      {/* Navigation Tabs */}
      <div className={classes.tabList}>
        <button
          type="button"
          className={clsx(classes.tabBtn, activeTab === "overview" && classes.tabBtnActive)}
          onClick={() => setActiveTab("overview")}
        >
          <IconInfoCircle size={14} />
          <span>Overview</span>
        </button>
        <button
          type="button"
          className={clsx(classes.tabBtn, activeTab === "license" && classes.tabBtnActive)}
          onClick={() => setActiveTab("license")}
        >
          <IconScale size={14} />
          <span>License</span>
        </button>
        <button
          type="button"
          className={clsx(classes.tabBtn, activeTab === "privacy" && classes.tabBtnActive)}
          onClick={() => setActiveTab("privacy")}
        >
          <IconShieldLock size={14} />
          <span>Privacy</span>
        </button>
      </div>

      {/* Tab Contents */}
      <div className={classes.tabContent}>
        {activeTab === "overview" && (
          <div className={classes.overviewContainer}>
            <div className={classes.logoGlowContainer}>
              <div className={classes.logoGlowBackground} />
              <img src={logoUrl} alt="Aether API Logo" className={classes.logoImg} />
            </div>

            <div className={classes.appName}>Aether API</div>
            <div className={classes.appVersionBadge}>
              <span>v0.2.0-beta.2</span>
            </div>

            <div className={classes.appSlogan}>Your APIs. Your Files. Your Control.</div>

            <div className={classes.featureGrid}>
              <div className={classes.featureCard}>
                <div className={classes.featureTitle}>
                  <IconBolt size={14} color="#60a5fa" />
                  <span>Native Core</span>
                </div>
                <div className={classes.featureDesc}>
                  Built with Rust & Tauri v2 for ultra-fast, memory-efficient performance.
                </div>
              </div>

              <div className={classes.featureCard}>
                <div className={classes.featureTitle}>
                  <IconFolders size={14} color="#34d399" />
                  <span>File-System Workspaces</span>
                </div>
                <div className={classes.featureDesc}>
                  Collections are saved as pure JSON files on disk, ready for Git versioning.
                </div>
              </div>

              <div className={classes.featureCard}>
                <div className={classes.featureTitle}>
                  <IconShieldLock size={14} color="#fbbf24" />
                  <span>AES-256 Secrets</span>
                </div>
                <div className={classes.featureDesc}>
                  Encrypted environment secrets with PBKDF2 passphrase protection.
                </div>
              </div>

              <div className={classes.featureCard}>
                <div className={classes.featureTitle}>
                  <IconEyeOff size={14} color="#a78bfa" />
                  <span>Zero Telemetry</span>
                </div>
                <div className={classes.featureDesc}>
                  100% offline & local-first. No tracking, cloud syncing, or data harvesting.
                </div>
              </div>
            </div>

            <div className={classes.copyright}>© 2026 Hephaestus Studio. All rights reserved.</div>
          </div>
        )}

        {activeTab === "license" && (
          <div className={classes.docContainer}>
            <div className={classes.docHeader}>
              <div className={classes.docTitle}>
                <IconScale size={16} color="#60a5fa" />
                <span>Open Source License</span>
              </div>
              <button type="button" className={classes.copyBtn} onClick={handleCopyLicense}>
                {copiedLicense ? (
                  <>
                    <IconCheck size={12} color="#4ade80" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <IconCopy size={12} />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <pre className={classes.docBox}>{MIT_LICENSE_TEXT}</pre>
          </div>
        )}

        {activeTab === "privacy" && (
          <div className={classes.docContainer}>
            <div className={classes.docHeader}>
              <div className={classes.docTitle}>
                <IconShieldLock size={16} color="#34d399" />
                <span>Privacy Manifesto</span>
              </div>
            </div>

            <div className={classes.privacyCard}>
              <div className={classes.privacyItem}>
                <IconEyeOff size={16} className={classes.privacyItemIcon} />
                <div className={classes.privacyItemContent}>
                  <div className={classes.privacyItemTitle}>100% Local-First & Zero Telemetry</div>
                  <div className={classes.privacyItemText}>
                    Aether API never collects, monitors, or uploads your request headers, payloads,
                    tokens, or API responses to any external cloud or analytics server.
                  </div>
                </div>
              </div>

              <div className={classes.privacyItem}>
                <IconShieldLock size={16} className={classes.privacyItemIcon} />
                <div className={classes.privacyItemContent}>
                  <div className={classes.privacyItemTitle}>On-Device Encryption for Secrets</div>
                  <div className={classes.privacyItemText}>
                    All sensitive environment variables are encrypted locally with AES-256-GCM.
                    Master keys are only unlocked for your active session and never stored in
                    plaintext on disk.
                  </div>
                </div>
              </div>

              <div className={classes.privacyItem}>
                <IconFolders size={16} className={classes.privacyItemIcon} />
                <div className={classes.privacyItemContent}>
                  <div className={classes.privacyItemTitle}>Total Data Ownership</div>
                  <div className={classes.privacyItemText}>
                    Your workspace is a regular directory on your computer. You retain complete
                    control to collaborate, backup, or version your files via Git without vendor
                    lock-in.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
