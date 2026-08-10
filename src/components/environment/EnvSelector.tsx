import { Select } from "@mantine/core";
import { useEnvStore } from "@/stores/envStore";

export default function EnvSelector() {
  const { environments, activeEnvironmentName, setActiveEnvironment } = useEnvStore();

  const data = [
    { value: "global", label: "Global" },
    ...environments.map((e) => ({ value: e.name, label: e.name })),
  ];

  return (
    <Select
      placeholder="Select environment..."
      value={activeEnvironmentName || "global"}
      onChange={(val) => setActiveEnvironment(val || "global")}
      data={data}
    />
  );
}
