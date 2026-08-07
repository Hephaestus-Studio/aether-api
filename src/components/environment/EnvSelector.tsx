import { Select } from "@mantine/core";
import { useEnvStore } from "@/stores/envStore";

export default function EnvSelector() {
  const { environments, activeEnvironmentName, setActiveEnvironment } = useEnvStore();

  const data = [
    { value: "none", label: "No Environment" },
    ...environments.map((e) => ({ value: e.name, label: e.name })),
  ];

  return (
    <Select
      placeholder="Select environment..."
      value={activeEnvironmentName || "none"}
      onChange={(val) => setActiveEnvironment(val === "none" ? null : val)}
      data={data}
      mb={12}
    />
  );
}
