import { Box, SegmentedControl, Textarea } from "@mantine/core";
import type { RequestBody } from "@/types/request";

interface BodyEditorProps {
  body: RequestBody;
  onChange: (v: RequestBody) => void;
}

export default function BodyEditor({ body, onChange }: Readonly<BodyEditorProps>) {
  const handleTypeChange = (val: string) => {
    if (val === "none") {
      onChange({ type: "none" });
    } else {
      onChange({ type: val as any, content: "" });
    }
  };

  const handleContentChange = (content: string) => {
    onChange({ ...body, content } as any);
  };

  return (
    <Box>
      <SegmentedControl
        value={body.type}
        onChange={handleTypeChange}
        data={[
          { label: "None", value: "none" },
          { label: "JSON", value: "json" },
          { label: "XML", value: "xml" },
          { label: "Text", value: "text" },
        ]}
        mb={12}
      />
      {body.type !== "none" && (
        <Textarea
          value={(body as any).content || ""}
          onChange={(e) => handleContentChange(e.target.value)}
          placeholder="Type request body..."
          rows={10}
          styles={{ input: { fontFamily: "JetBrains Mono, Courier New, monospace" } }}
        />
      )}
    </Box>
  );
}
