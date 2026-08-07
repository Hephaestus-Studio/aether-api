import { Box, Table, TextInput, Checkbox, ActionIcon } from "@mantine/core";
import { IconTrash } from "@tabler/icons-react";
import type { KeyValuePair } from "@/types/request";

interface HeadersEditorProps {
  headers: KeyValuePair[];
  onChange: (v: KeyValuePair[]) => void;
}

export default function HeadersEditor({ headers, onChange }: Readonly<HeadersEditorProps>) {
  const handleItemChange = (index: number, fields: Partial<KeyValuePair>) => {
    const next = [...headers];
    next[index] = { ...next[index], ...fields };
    onChange(next);
  };

  const handleAdd = () => {
    onChange([...headers, { key: "", value: "", enabled: true }]);
  };

  const handleDelete = (index: number) => {
    onChange(headers.filter((_, i) => i !== index));
  };

  return (
    <Box>
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th style={{ width: 40 }}></Table.Th>
            <Table.Th>Header Key</Table.Th>
            <Table.Th>Header Value</Table.Th>
            <Table.Th style={{ width: 40 }}></Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {headers.map((h, idx) => (
            <Table.Tr key={idx}>
              <Table.Td>
                <Checkbox
                  checked={h.enabled}
                  onChange={(e) => handleItemChange(idx, { enabled: e.target.checked })}
                />
              </Table.Td>
              <Table.Td>
                <TextInput
                  value={h.key}
                  onChange={(e) => handleItemChange(idx, { key: e.target.value })}
                  placeholder="Content-Type"
                />
              </Table.Td>
              <Table.Td>
                <TextInput
                  value={h.value}
                  onChange={(e) => handleItemChange(idx, { value: e.target.value })}
                  placeholder="application/json"
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
        + Add New Header
      </Box>
    </Box>
  );
}
