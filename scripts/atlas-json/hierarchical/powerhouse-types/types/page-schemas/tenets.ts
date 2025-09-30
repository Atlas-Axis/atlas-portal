import { z } from 'zod';
import { Relation, RichTextField, TitleField } from '../notion-data.js';
import { makePageSchema } from './utils.js';

export const TenetsPageProperties = z.object({
  'Doc No (or Temp Name)': TitleField,
  Content: RichTextField,
  'Original Context Data': Relation,
  'Needed Research': Relation,
  Name: RichTextField,
  Scenarios: Relation,
  'Global Tags': Relation,
});

export const TenetsPageSchema = makePageSchema(TenetsPageProperties);
