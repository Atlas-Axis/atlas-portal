import { z } from 'zod';
import { Relation, RichTextField, TitleField } from '../notion-data.js';
import { makePageSchema } from './utils.js';

export const ActiveDataPageProperties = z.object({
  'Doc No': TitleField,
  Name: RichTextField,
  Content: RichTextField,
  'Original Context Data': Relation,
  'Needed Research': Relation,
  'Global Tags': Relation,
});

export const ActiveDataPageSchema = makePageSchema(ActiveDataPageProperties);
