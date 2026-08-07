import { Box, Table, TextInput, ActionIcon, Group, Button } from "@mantine/core";
import { IconTrash } from "@tabler/icons-react";
import { useEnvStore } from "@/stores/envStore";
import type { EnvVariableItem } from "@/types/environment";
import EnvSelector from "./EnvSelector";

export default function EnvEditor() {
  const { activeVariables, setActiveVariables } = useEnvStore();

  const handleItemChange = (index: number, fields: Partial<EnvVariableItem>) => {
    const next = [...activeVariables];
    next[index] = { ...next[index], ...fields };
    setActiveVariables(next);
  };

  const handleAdd = () => {
    setActiveVariables([...activeVariables, { key: "", value: "", type: "text", enabled: true }]);
  };

  const handleDelete = (index: number) => {
    setActiveVariables(activeVariables.filter((_, i) => i !== index));
  };

  return (
    <Box style={{ padding: "0 12px" }}>
      <EnvSelector />
      <Table mb={12}>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Key</Table.Th>
            <Table.Th>Value</Table.Th>
            <Table.Th style={{ width: 40 }}></Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {activeVariables.map((v, idx) => (
            <Table.Tr key={idx}>
              <Table.Td>
                <TextInput
                  value={v.key}
                  onChange={(e) => handleItemChange(idx, { key: e.target.value })}
                  size="xs"
                />
              </Table.Td>
              <Table.Td>
                <TextInput
                  value={v.value}
                  onChange={(e) => handleItemChange(idx, { value: e.target.value })}
                  size="xs"
                  type={v.type === "secret" ? "password" : "text"}
                />
              </Table.Td>
              <Table.Td>
                <ActionIcon color="red" size="xs" onClick={() => handleDelete(idx)}>
                  <IconTrash size={12} />
                </ActionIcon>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      <Group justify="space-between">
        <Button size="xs" variant="default" onClick={handleAdd}>
          Add Variable
        </Button>
        <Button size="xs">Save changes</Button>
      </Group>
    </Box>
  );
}
