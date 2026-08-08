import { Box, Table } from "@mantine/core";

interface ResponseHeadersProps {
  headers: string[][];
}

export default function ResponseHeaders({ headers }: Readonly<ResponseHeadersProps>) {
  return (
    <Box>
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Header</Table.Th>
            <Table.Th>Value</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {headers.map(([k, v]) => (
            <Table.Tr key={`${k}-${v}`}>
              <Table.Td
                style={{
                  fontWeight: 600,
                  fontSize: 13,
                  fontFamily: "JetBrains Mono, monospace",
                  color: "var(--text-primary)",
                }}
              >
                {k}
              </Table.Td>
              <Table.Td
                style={{
                  fontSize: 13,
                  fontFamily: "JetBrains Mono, monospace",
                  color: "var(--text-muted)",
                  wordBreak: "break-all",
                }}
              >
                {v}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Box>
  );
}
