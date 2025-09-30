import { NotionToMarkdown } from "notion-to-md";
import type { NotionToMarkdownOptions } from "notion-to-md/build/types/index.js";
import type { RichTextItemResponse } from "@notionhq/client/build/src/api-endpoints.js";

export async function convertToMarkdown(richText: RichTextItemResponse[]): Promise<string> {
    const n2m = new NotionToMarkdown({} as NotionToMarkdownOptions);

    return await n2m.blockToMarkdown({
        type: "paragraph",
        paragraph: {
            rich_text: richText,
            color: "default",
        },
        object: "block",
        id: ""
    });
}
