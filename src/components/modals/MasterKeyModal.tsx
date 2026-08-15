import { useEnvStore } from "@/stores/envStore";
import UnlockMasterKeyModal from "./UnlockMasterKeyModal";
import ManageMasterKeyModal from "./ManageMasterKeyModal";

interface MasterKeyModalProps {
  opened: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

/**
 * Unified MasterKeyModal wrapper that automatically delegates to either
 * UnlockMasterKeyModal or ManageMasterKeyModal based on workspace state.
 */
export default function MasterKeyModal(props: Readonly<MasterKeyModalProps>) {
  const hasMasterKey = useEnvStore((s) => s.hasMasterKey);
  const hasEncryptedSecrets = useEnvStore((s) => s.hasEncryptedSecrets);

  const isUnlockMode = hasEncryptedSecrets && !hasMasterKey;

  if (isUnlockMode) {
    return <UnlockMasterKeyModal {...props} />;
  }

  return <ManageMasterKeyModal {...props} />;
}

export { UnlockMasterKeyModal, ManageMasterKeyModal };
