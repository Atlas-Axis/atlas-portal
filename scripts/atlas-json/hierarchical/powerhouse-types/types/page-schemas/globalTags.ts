import { z } from 'zod';
import { TitleField } from '../notion-data.js';
import { makeGlobalTagsSchema } from './utils.js';

export const GlobalTagsPageProperties = z.object({
  Name: TitleField,
});

export const GlobalTagsPageSchema = makeGlobalTagsSchema(GlobalTagsPageProperties);
