import { Box, Table, TextInput, Checkbox, ActionIcon } from "@mantine/core";
import { IconTrash } from "@tabler/icons-react";
import type { KeyValuePair } from "@/types/request";

interface ParamsEditorProps {
  params: KeyValuePair[];
  onChange: (v: KeyValuePair[]) => void;
}

export default function ParamsEditor({ params, onChange }: Readonly<ParamsEditorProps>) {
  const handleItemChange = (index: number, fields: Partial<KeyValuePair>) => {
    const next = [...params];
    next[index] = { ...next[index], ...fields };
    onChange(next);
  };

  const handleAdd = () => {
    onChange([...params, { key: "", value: "", enabled: true }]);
  };

  const handleDelete = (index: number) => {
    onChange(params.filter((_, i) => i !== index));
  };

  return (
    <Box>
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th style={{ width: 40 }}></Table.Th>
            <Table.Th>Key</Table.Th>
            <Table.Th>Value</Table.Th>
            <Table.Th style={{ width: 40 }}></Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {params.map((p, idx) => (
            <Table.Tr key={idx}>
              <Table.Td>
                <Checkbox
                  checked={p.enabled}
                  onChange={(e) => handleItemChange(idx, { enabled: e.target.checked })}
                />
              </Table.Td>
              <Table.Td>
                <TextInput
                  value={p.key}
                  onChange={(e) => handleItemChange(idx, { key: e.target.value })}
                  placeholder="name"
                />
              </Table.Td>
              <Table.Td>
                <TextInput
                  value={p.value}
                  onChange={(e) => handleItemChange(idx, { value: e.target.value })}
                  placeholder="value"
                />
              </Table.Td>
              <Table.Td>
                <ActionIcon color="red" onClick={() => handleDelete(idx)}>
                  <IconTrash size={14} />
                </ActionIcon>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      <Box
        onClick={handleAdd}
        style={{ padding: "8px 12px", cursor: "pointer", color: "var(--text-muted)", fontSize: 13 }}
      >
        + Add New Parameter
      </Box>
    </Box>
  );
}
