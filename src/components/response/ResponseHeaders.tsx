import { Box, Table, ScrollArea } from "@mantine/core";

interface ResponseHeadersProps {
  headers: string[][];
}

export default function ResponseHeaders({ headers }: Readonly<ResponseHeadersProps>) {
  return (
    <Box style={{ height: "100%", width: "100%", overflow: "hidden" }}>
      <ScrollArea style={{ height: "100%" }} type="hover" offsetScrollbars={false}>
        <Table stickyHeader withRowBorders>
          <Table.Thead>
            <Table.Tr style={{ backgroundColor: "var(--bg-app)" }}>
              <Table.Th
                style={{
                  width: "35%",
                  color: "var(--text-muted)",
                  fontSize: 12,
                  padding: "8px 12px",
                }}
              >
                Header
              </Table.Th>
              <Table.Th style={{ color: "var(--text-muted)", fontSize: 12, padding: "8px 12px" }}>
                Value
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {headers.map(([k, v]) => (
              <Table.Tr key={`${k}-${v}`}>
                <Table.Td
                  style={{
                    fontWeight: 600,
                    fontSize: 13,
                    fontFamily: "var(--aether-font-mono)",
                    color: "var(--text-primary)",
                    verticalAlign: "top",
                    padding: "8px 12px",
                  }}
                >
                  {k}
                </Table.Td>
                <Table.Td
                  style={{
                    fontSize: 13,
                    fontFamily: "var(--aether-font-mono)",
                    color: "var(--text-muted)",
                    wordBreak: "break-all",
                    padding: "8px 12px",
                  }}
                >
                  {v}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </ScrollArea>
    </Box>
  );
}
