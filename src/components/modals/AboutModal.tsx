import { Modal } from "@mantine/core";
import logoUrl from "@/assets/logo.svg";
import classes from "./AboutModal.module.css";

interface AboutModalProps {
  opened: boolean;
  onClose: () => void;
}

export default function AboutModal({ opened, onClose }: Readonly<AboutModalProps>) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="sm"
      centered
      withCloseButton
      classNames={{
        content: classes.modalContent,
        header: classes.modalHeader,
        body: classes.modalBody,
      }}
    >
      <div className={classes.logoGlowContainer}>
        <div className={classes.logoGlowBackground} />
        <img src={logoUrl} alt="Aether API Logo" className={classes.logoImg} />
      </div>

      <div className={classes.appName}>Aether API</div>
      <div className={classes.appVersionBadge}>
        <span>v0.1.0</span>
      </div>

      <div className={classes.appDesc}>
        High-Performance Native Desktop API Testing & Development Environment.
      </div>

      <div className={classes.copyright}>© 2026 Hephaestus Studio. All rights reserved.</div>
    </Modal>
  );
}
