import { Alert } from '@heroui/react';
import { APIResponseError, PageObjectResponse } from '@notionhq/client';
import { notion } from '@/app/server/services/notion/notion-client';
import { uuidToHyphens } from '@/app/shared/utils/utils';
import ActionButton from './action-button';

async function loadPage(notionPageId: string) {
  const response = (await notion().pages.retrieve({
    page_id: notionPageId,
  })) as PageObjectResponse;

  console.log(response);

  const page = response as PageObjectResponse;

  return page;
}

function getPageTitle(page: PageObjectResponse) {
  // Find the property of type "title"
  const titleProp = Object.values(page.properties).find((prop) => prop.type === 'title');
  if (!titleProp || titleProp.type !== 'title') return null;

  // Concatenate all title rich_text parts
  const title = titleProp.title.map((t) => t.plain_text).join('');
  return title || null;
}

export default async function Page({ params }: { params: Promise<{ 'notion-page-id': string }> }) {
  const { 'notion-page-id': notionPageId } = await params;
  let page: PageObjectResponse;
  try {
    page = await loadPage(notionPageId);
  } catch (error) {
    console.error('Error loading page:', { error });
    const errorMessage = error instanceof APIResponseError ? error.message : String(error);
    return <Alert color="danger" description={errorMessage} />;
  }

  return (
    <div className="flex flex-col items-center">
      <h1 className="mb-6 text-lg font-bold">{getPageTitle(page)}</h1>
      <ActionButton notionPageId={uuidToHyphens(notionPageId)} />
    </div>
  );
}
