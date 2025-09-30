import { z } from 'zod';
import { Relation, RichTextField, TitleField } from '../notion-data.js';
import { makePageSchema } from './utils.js';

const OriginalContextDataPageProperties = z.object({
  Name: RichTextField,
  Content: RichTextField,
  'Doc No': TitleField,
  'Needed Research': Relation,
  'Global Tags': Relation,
});
export const OriginalContextDataPageSchema = makePageSchema(OriginalContextDataPageProperties);
