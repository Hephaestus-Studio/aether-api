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
              <Table.Td style={{ fontWeight: 600 }}>{k}</Table.Td>
              <Table.Td>{v}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Box>
  );
}
