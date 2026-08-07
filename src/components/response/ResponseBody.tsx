import { Box, Code } from "@mantine/core";

interface ResponseBodyProps {
  response: any;
}

export default function ResponseBody({ response }: Readonly<ResponseBodyProps>) {
  return (
    <Box style={{ height: "100%", overflow: "auto" }}>
      <Code block style={{ fontFamily: "JetBrains Mono, Courier New, monospace" }}>
        {response.body}
      </Code>
    </Box>
  );
}
